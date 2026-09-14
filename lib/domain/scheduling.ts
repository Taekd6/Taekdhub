import { freeSlotsForDay, type Slot } from "@/lib/domain/availability";
import { addMinutes, dayKey, dayKeyRange, daysBetween, formatRelativeDay, timeOf } from "@/lib/domain/date";
import { isDeadlineTask, isOpen, isScheduled, remainingMinutes, slotsOnDay } from "@/lib/domain/tasks";
import type { AppState, Task, TaskSlot } from "@/lib/domain/types";

/**
 * ============================================================================
 * PLANIFICATION — transformer une liste de tâches en un emploi du temps tenable.
 * ============================================================================
 *
 * L'algorithme est délibérément SIMPLE et EXPLICABLE. Un solveur d'optimisation
 * produirait un planning marginalement meilleur que personne ne comprendrait,
 * et qu'on ne pourrait ni corriger ni contester. Ici :
 *
 *   1. Les tâches sont classées par ÉCHÉANCE la plus proche (les évaluations
 *      et les tâches en retard d'abord, à échéance égale la priorité tranche).
 *   2. Chacune est posée AU PLUS TÔT dans les créneaux libres, jamais après
 *      son échéance — c'est la règle qui garantit qu'un DM pour vendredi n'est
 *      pas proposé samedi.
 *   3. Une tâche longue est DÉCOUPÉE en séances de 45 à 90 minutes, réparties
 *      sur plusieurs jours. C'est la différence entre « tu as 3 h de DM » et
 *      « 1 h 30 mercredi, 1 h 30 jeudi ».
 *   4. Ce qui ne rentre pas n'est PAS posé de force : il ressort en
 *      `unplaced`, avec la raison. Un planning qui ment en tassant tout dans
 *      la dernière soirée est pire que pas de planning du tout.
 *
 * Rien n'est écrit ici : la fonction produit une PROPOSITION. C'est l'élève
 * qui l'applique (ou non), tâche par tâche ou en bloc.
 */

/** Une séance de travail ne descend pas sous 20 min (coût de mise en route) et ne dépasse pas 90 min (attention). */
export const MIN_CHUNK_MINUTES = 20;
export const MAX_CHUNK_MINUTES = 90;
/** Découpage préféré quand une tâche doit être répartie : des séances d'1 h 30, puis d'1 h, puis de 45 min. */
const PREFERRED_CHUNKS = [90, 60, 45, 30] as const;

export interface PlanAssignment {
  taskId: string;
  slots: TaskSlot[];
  /** Minutes réellement placées — peut être inférieur au travail restant si la fenêtre est trop courte. */
  minutes: number;
  /** Minutes restées sans place. */
  missingMinutes: number;
  /** Phrase expliquant la répartition retenue. */
  rationale: string;
}

export interface UnplacedTask {
  taskId: string;
  minutes: number;
  reason: "no-capacity" | "no-slot-before-due";
  message: string;
}

export interface PlanProposal {
  assignments: PlanAssignment[];
  unplaced: UnplacedTask[];
  /** Minutes libres restantes après application, sur la fenêtre. */
  freeMinutesLeft: number;
  windowStart: string;
  windowEnd: string;
}

export interface PlanOptions {
  now?: Date;
  /** Nombre de jours planifiés à partir d'aujourd'hui (inclus). */
  days?: number;
  /** Ne replanifie que ces tâches — sinon, toutes les tâches ouvertes non posées. */
  taskIds?: string[];
  /** `true` : ignore les créneaux déjà posés et replanifie tout à zéro. */
  replaceExisting?: boolean;
}

/** Espace de travail interne : les créneaux libres jour par jour, consommés au fur et à mesure. */
interface Canvas {
  byDay: Map<string, Slot[]>;
  keys: string[];
}

function buildCanvas(state: AppState, keys: string[], now: Date, ignoreTaskIds: Set<string>): Canvas {
  const byDay = new Map<string, Slot[]>();
  for (const key of keys) {
    const busy: { start: string; end: string }[] = [];
    for (const task of state.tasks) {
      if (!isOpen(task) || ignoreTaskIds.has(task.id)) continue;
      for (const slot of slotsOnDay(task, key)) busy.push(slot);
    }
    byDay.set(key, freeSlotsForDay(state.availability, key, busy, now));
  }
  return { byDay, keys };
}

/** Retire `minutes` du premier créneau libre assez grand d'un jour, et renvoie la portion consommée. */
function take(canvas: Canvas, key: string, minutes: number): TaskSlot | undefined {
  const slots = canvas.byDay.get(key);
  if (!slots) return undefined;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot.minutes < minutes) continue;
    const start = slot.start;
    const end = addMinutes(start, minutes);
    const rest = slot.minutes - minutes;
    if (rest >= MIN_CHUNK_MINUTES) slots[index] = { start: end, end: slot.end, minutes: rest };
    else slots.splice(index, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  return undefined;
}

/** Minutes libres d'un jour, dans l'état courant du canevas. */
function freeOn(canvas: Canvas, key: string): number {
  return (canvas.byDay.get(key) ?? []).reduce((total, slot) => total + slot.minutes, 0);
}

/**
 * Ordre de traitement — c'est LUI qui fait la qualité du planning, bien plus
 * que le remplissage lui-même :
 *   1. les évaluations (points fixes) ;
 *   2. l'échéance la plus proche ;
 *   3. à échéance égale, la priorité déclarée ;
 *   4. enfin, la tâche la plus longue d'abord (les grosses pièces se placent
 *      mal en dernier — c'est le même principe qu'un sac à dos).
 */
function planningOrder(tasks: Task[], entries: AppState["timeEntries"]): Task[] {
  const FAR = Number.MAX_SAFE_INTEGER;
  return [...tasks].sort((a, b) => {
    const aFixed = isDeadlineTask(a) ? 0 : 1;
    const bFixed = isDeadlineTask(b) ? 0 : 1;
    if (aFixed !== bFixed) return aFixed - bFixed;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : FAR;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : FAR;
    if (aDue !== bDue) return aDue - bDue;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return remainingMinutes(b, entries) - remainingMinutes(a, entries);
  });
}

/** Découpe une durée en séances de taille décroissante mais jamais ridicules. */
export function splitIntoChunks(minutes: number): number[] {
  if (minutes <= MAX_CHUNK_MINUTES) return [Math.max(MIN_CHUNK_MINUTES, Math.round(minutes))];
  const chunks: number[] = [];
  let left = Math.round(minutes);
  while (left > 0) {
    const chunk = PREFERRED_CHUNKS.find((size) => size <= left) ?? left;
    // Ne jamais laisser une miette derrière : si le reste devient trop petit
    // pour être une séance, on l'ajoute à la séance courante.
    if (left - chunk > 0 && left - chunk < MIN_CHUNK_MINUTES) {
      chunks.push(left);
      break;
    }
    chunks.push(chunk);
    left -= chunk;
  }
  return chunks;
}

export function planWork(state: AppState, options: PlanOptions = {}): PlanProposal {
  const now = options.now ?? new Date();
  const days = options.days ?? 7;
  const keys = dayKeyRange(now, days);

  const candidates = state.tasks.filter((task) => {
    if (!isOpen(task)) return false;
    /*
     * Une ÉVALUATION (DS, khôlle, interro, concours blanc) n'est pas du
     * travail à répartir : c'est un événement imposé, à une date imposée. Sa
     * durée estimée est celle de l'épreuve, pas un effort à caser dans les
     * soirées — la planifier reviendrait à réserver quatre heures de révision
     * intitulées « DS de maths », et à gonfler la charge d'autant.
     * Ce qui se prépare, ce sont des tâches distinctes (« Préparer la khôlle »),
     * qui, elles, sont planifiées normalement.
     */
    if (isDeadlineTask(task)) return false;
    if (options.taskIds) return options.taskIds.includes(task.id);
    return options.replaceExisting ? true : !isScheduled(task);
  });

  const replanned = new Set(candidates.map((task) => task.id));
  const canvas = buildCanvas(state, keys, now, replanned);

  const assignments: PlanAssignment[] = [];
  const unplaced: UnplacedTask[] = [];

  for (const task of planningOrder(candidates, state.timeEntries)) {
    const needed = remainingMinutes(task, state.timeEntries);

    /*
     * Dernier jour utilisable : le jour de l'échéance inclus, jamais après.
     *
     * Une échéance DÉJÀ PASSÉE ne restreint rien : la borner à sa date
     * ne laisserait aucun jour utilisable, et la tâche ressortait « impossible
     * à planifier » — exactement celle qui a le plus besoin d'un créneau.
     * Une tâche en retard se place donc au plus tôt, dans toute la fenêtre.
     */
    const lastKey = keys[keys.length - 1];
    const dueKey = task.dueAt ? dayKey(task.dueAt) : undefined;
    const limit = dueKey && dueKey >= keys[0] && dueKey < lastKey ? dueKey : lastKey;
    const usableKeys = keys.filter((key) => key <= limit);

    // Ne peut arriver que sur une fenêtre vide (`days: 0`) : gardé pour que
    // la boucle ne parte jamais du principe qu'il reste au moins un jour.
    if (usableKeys.length === 0) {
      unplaced.push({ taskId: task.id, minutes: needed, reason: "no-capacity", message: "Aucun jour dans la fenêtre planifiée." });
      continue;
    }

    const placed: TaskSlot[] = [];
    let left = needed;
    for (const chunk of splitIntoChunks(needed)) {
      if (left <= 0) break;
      const size = Math.min(chunk, left);
      const key = usableKeys.find((candidate) => freeOn(canvas, candidate) >= size);
      if (!key) break;
      const slot = take(canvas, key, size);
      if (!slot) break;
      placed.push(slot);
      left -= size;
    }

    if (placed.length === 0) {
      unplaced.push({
        taskId: task.id,
        minutes: needed,
        reason: dueKey ? "no-slot-before-due" : "no-capacity",
        message: dueKey
          ? `Aucun créneau libre avant l'échéance (${formatRelativeDay(task.dueAt!, now)}).`
          : "Plus de place dans la fenêtre planifiée.",
      });
      continue;
    }

    assignments.push({
      taskId: task.id,
      slots: placed,
      minutes: needed - left,
      missingMinutes: Math.max(0, Math.round(left)),
      rationale: describe(placed, now, left),
    });
  }

  return {
    assignments,
    unplaced,
    freeMinutesLeft: keys.reduce((total, key) => total + freeOn(canvas, key), 0),
    windowStart: keys[0],
    windowEnd: keys[keys.length - 1],
  };
}

function describe(slots: TaskSlot[], now: Date, missing: number): string {
  const parts = slots.map((slot) => `${formatRelativeDay(slot.start, now)} ${timeOf(slot.start)}`);
  const base =
    slots.length === 1
      ? `Placée ${parts[0]}.`
      : `Répartie en ${slots.length} séances : ${parts.join(", ")}.`;
  return missing > 0 ? `${base} Il reste ${Math.round(missing)} min sans place.` : base;
}

/**
 * REPORT INTELLIGENT — où remettre une tâche qu'on n'a pas faite.
 *
 * Surtout pas « demain, par défaut » : c'est ainsi qu'une tâche traverse
 * toute une semaine en glissant d'un jour sur l'autre jusqu'à devenir
 * urgente. On cherche le premier jour qui a RÉELLEMENT la place, avant
 * l'échéance, et on dit ce que ça coûte quand ce jour est déjà chargé.
 */
export interface PostponeSuggestion {
  slots: TaskSlot[];
  /** Jour retenu, `YYYY-MM-DD`. */
  day: string;
  message: string;
  /** Avertissement quand la journée retenue est déjà tendue, ou quand l'échéance ne peut plus être tenue. */
  warning?: string;
}

export function suggestPostponement(state: AppState, task: Task, now: Date = new Date()): PostponeSuggestion | null {
  const needed = remainingMinutes(task, state.timeEntries);
  const horizon = 14;
  const keys = dayKeyRange(now, horizon);
  const canvas = buildCanvas(state, keys, now, new Set([task.id]));

  // Même règle que `planWork` : une échéance déjà passée ne restreint plus le
  // choix du jour — sinon aucun jour ne serait proposé pour ce qui est en retard.
  const dueKey = task.dueAt && dayKey(task.dueAt) >= keys[0] ? dayKey(task.dueAt) : undefined;
  const beforeDue = dueKey ? keys.filter((key) => key <= dueKey) : keys;

  // 1) Un jour qui prend la tâche EN ENTIER, avant l'échéance. Le meilleur cas.
  for (const key of beforeDue) {
    if (freeOn(canvas, key) < needed) continue;
    const chunk = take(canvas, key, Math.min(needed, MAX_CHUNK_MINUTES));
    if (!chunk) continue;
    const slots = [chunk];
    let left = needed - Math.min(needed, MAX_CHUNK_MINUTES);
    while (left > 0) {
      const extra = take(canvas, key, Math.min(left, MAX_CHUNK_MINUTES));
      if (!extra) break;
      slots.push(extra);
      left -= Math.min(left, MAX_CHUNK_MINUTES);
    }
    const load = freeOn(canvas, key);
    return {
      slots,
      day: key,
      message: `${capitalize(formatRelativeDay(key, now))} à ${timeOf(slots[0].start)} — ${Math.round(needed)} min y tiennent.`,
      warning: load < 30 ? "Cette journée sera pleine : aucune marge pour un imprévu." : undefined,
    };
  }

  // 2) Répartir sur plusieurs jours avant l'échéance.
  const spread: TaskSlot[] = [];
  let left = needed;
  for (const key of beforeDue) {
    if (left <= 0) break;
    const size = Math.min(left, Math.max(MIN_CHUNK_MINUTES, Math.min(MAX_CHUNK_MINUTES, freeOn(canvas, key))));
    if (freeOn(canvas, key) < MIN_CHUNK_MINUTES) continue;
    const slot = take(canvas, key, size);
    if (!slot) continue;
    spread.push(slot);
    left -= size;
  }
  if (spread.length > 0 && left <= 0) {
    return {
      slots: spread,
      day: dayKey(spread[0].start),
      message: `À découper : ${spread.map((slot) => `${formatRelativeDay(slot.start, now)} ${timeOf(slot.start)}`).join(", ")}.`,
      warning: "Aucun jour ne la prend d'un bloc avant l'échéance — elle est découpée.",
    };
  }

  // 3) Plus de place avant l'échéance : le dire franchement, et proposer le
  // premier jour possible APRÈS, pour que la tâche ne disparaisse pas.
  for (const key of keys) {
    if (freeOn(canvas, key) < MIN_CHUNK_MINUTES) continue;
    const slot = take(canvas, key, Math.min(needed, Math.min(MAX_CHUNK_MINUTES, freeOn(canvas, key))));
    if (!slot) continue;
    return {
      slots: [slot],
      day: key,
      message: `${capitalize(formatRelativeDay(key, now))} à ${timeOf(slot.start)}, faute de mieux.`,
      warning: dueKey
        ? "Ton planning ne laisse plus la place avant l'échéance. Il faut alléger un autre jour, ou accepter de rendre en retard."
        : "Les prochains jours sont pleins.",
    };
  }

  return null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * ADAPTATION EN TEMPS RÉEL — ce qui était prévu ≠ ce qui a été fait.
 *
 * Appelée en fin de journée (ou au retour sur l'application) : elle recense
 * les créneaux passés dont la tâche n'est pas terminée, et propose une
 * nouvelle place pour chacun. Le planning des jours suivants est donc
 * recalculé à partir du RÉEL, pas du prévisionnel.
 */
export interface Adaptation {
  task: Task;
  plannedMinutes: number;
  doneMinutes: number;
  suggestion: PostponeSuggestion | null;
}

export function computeAdaptations(state: AppState, now: Date = new Date()): Adaptation[] {
  const missed = state.tasks.filter((task) => {
    if (!isOpen(task) || task.slots.length === 0) return false;
    return task.slots.every((slot) => daysBetween(now, slot.start) < 0);
  });

  return missed.map((task) => ({
    task,
    plannedMinutes: task.slots.reduce(
      (total, slot) => total + (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000,
      0
    ),
    doneMinutes: state.timeEntries.reduce((total, entry) => (entry.taskId === task.id ? total + entry.minutes : total), 0),
    suggestion: suggestPostponement(state, task, now),
  }));
}
