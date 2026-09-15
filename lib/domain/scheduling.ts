import { capacityMinutes, freeSlotsForDay, type Slot } from "@/lib/domain/availability";
import { addMinutes, dayKey, dayKeyRange, daysBetween, formatMinutes, formatRelativeDay, timeOf } from "@/lib/domain/date";
import { isDeadlineTask, isMissedSlot, isOpen, isScheduled, remainingMinutes, slotsOnDay } from "@/lib/domain/tasks";
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
 *   2. Chacune est posée au plus tôt dans les créneaux libres, jamais après
 *      son échéance — c'est la règle qui garantit qu'un DM pour vendredi n'est
 *      pas proposé samedi.
 *   3. Une tâche longue est DÉCOUPÉE en séances de 45 à 90 minutes, puis ces
 *      séances sont ÉTALÉES sur des jours différents — une par jour tant qu'il
 *      reste des jours avant l'échéance.
 *
 *      C'est le point qui sépare un planning crédible d'un planning qu'on
 *      referme. La version précédente posait tout « au plus tôt » : un DM de
 *      3 h à rendre dans trois jours occupait la soirée entière du jour même
 *      (18 h → 21 h), et une semaine chargée saturait le lundi à 100 % en
 *      laissant le week-end vide. Personne ne travaille comme ça, et un
 *      planning qu'on sait faux ne sert à rien. Une séance par jour, en
 *      tournant sur les jours disponibles, donne « 1 h 30 aujourd'hui, 1 h 30
 *      demain » — ce qu'un élève aurait écrit lui-même.
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

/**
 * Espace de travail interne : les créneaux libres jour par jour, consommés au
 * fur et à mesure.
 *
 * `softRoom` est la place qu'on s'autorise à remplir AVANT de considérer la
 * journée comme tendue — la même notion que celle affichée à l'élève
 * (`tightLoadRatio`, domain/workload.ts). Un premier passage s'y tient, ce qui
 * laisse à chaque journée sa marge ; on ne la dépasse que lorsqu'une échéance
 * l'exige vraiment. Sans ce garde-fou, une semaine chargée remplissait les
 * premiers jours à 100 % et laissait le week-end vide : arithmétiquement
 * correct, humainement intenable.
 */
interface Canvas {
  byDay: Map<string, Slot[]>;
  softRoom: Map<string, number>;
  keys: string[];
}

function buildCanvas(state: AppState, keys: string[], now: Date, ignoreTaskIds: Set<string>): Canvas {
  const byDay = new Map<string, Slot[]>();
  const softRoom = new Map<string, number>();
  const ratio = Math.min(1, Math.max(0.5, state.settings.tightLoadRatio));

  for (const key of keys) {
    const busy: { start: string; end: string }[] = [];
    let alreadyPlanned = 0;
    for (const task of state.tasks) {
      if (!isOpen(task) || ignoreTaskIds.has(task.id)) continue;
      for (const slot of slotsOnDay(task, key)) {
        busy.push(slot);
        alreadyPlanned += (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000;
      }
    }
    const free = freeSlotsForDay(state.availability, key, busy, now);
    byDay.set(key, free);
    const capacity = capacityMinutes(state.availability, key);
    softRoom.set(key, Math.max(0, capacity * ratio - alreadyPlanned));
  }
  return { byDay, softRoom, keys };
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
    canvas.softRoom.set(key, Math.max(0, (canvas.softRoom.get(key) ?? 0) - minutes));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  return undefined;
}

/** Minutes libres d'un jour, dans l'état courant du canevas. */
function freeOn(canvas: Canvas, key: string): number {
  return (canvas.byDay.get(key) ?? []).reduce((total, slot) => total + slot.minutes, 0);
}

/**
 * Le prochain jour capable d'accueillir `minutes`, en partant de `from` et en
 * bouclant sur le début de la fenêtre si nécessaire.
 *
 * C'est ce qui réalise l'étalement : après avoir posé une séance le jour J, on
 * repart de J+1 pour la suivante. On ne revient au début que si tous les jours
 * suivants sont pleins — auquel cas tasser est la seule option restante, et
 * c'est alors la bonne.
 */
function nextDayWithRoom(canvas: Canvas, days: string[], from: number, minutes: number): number {
  // Premier passage : on respecte la marge de chaque journée.
  for (let step = 0; step < days.length; step += 1) {
    const index = (from + step) % days.length;
    const key = days[index];
    if (freeOn(canvas, key) >= minutes && (canvas.softRoom.get(key) ?? 0) >= minutes) return index;
  }
  // Second passage : plus aucune journée n'a de marge, mais l'échéance, elle,
  // n'attend pas. On remplit alors jusqu'à la capacité réelle — et la journée
  // sera signalée « tendue » à l'élève, ce qui est l'information juste.
  for (let step = 0; step < days.length; step += 1) {
    const index = (from + step) % days.length;
    if (freeOn(canvas, days[index]) >= minutes) return index;
  }
  return -1;
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
    if (options.replaceExisting) return true;
    /*
     * Une tâche dont TOUS les créneaux sont passés sans qu'elle soit faite est
     * candidate au même titre qu'une tâche jamais posée : son planning
     * n'existe plus que sur le papier.
     *
     * Sans cette ligne, « Planifier » ne faisait strictement RIEN le matin où
     * l'on rouvre l'application après une soirée ratée — c'est-à-dire
     * exactement le moment où l'on en a besoin (constaté en scénario).
     */
    return !isScheduled(task) || isMissedSlot(task, now);
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
    let dayIndex = 0;
    for (const chunk of splitIntoChunks(needed)) {
      if (left <= 0) break;
      const size = Math.min(chunk, left);
      const index = nextDayWithRoom(canvas, usableKeys, dayIndex, size);
      if (index === -1) break;
      const slot = take(canvas, usableKeys[index], size);
      if (!slot) break;
      placed.push(slot);
      left -= size;
      // Séance suivante : le jour d'APRÈS. C'est tout l'étalement.
      dayIndex = index + 1;
    }

    /*
     * Les séances sont triées avant d'être annoncées. Sans cela, une tâche
     * dont la deuxième séance retombe sur un jour antérieur (parce qu'il y
     * restait un bout de créneau) s'affichait à l'envers — « mercredi 15:30,
     * puis lundi 21:30 » — ce qui fait douter de tout le reste de la
     * proposition.
     */
    placed.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

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
  return missing > 0 ? `${base} Il reste ${formatMinutes(missing)} sans place.` : base;
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

/**
 * PLUSIEURS JOURS POSSIBLES, au lieu d'un seul.
 *
 * `suggestPostponement` donne LE meilleur jour. C'est ce qu'il faut quand on
 * veut aller vite — mais pas quand on sait déjà quelque chose que
 * l'application ignore (« mercredi j'ai piscine », « je préfère attaquer
 * samedi matin »). Sans choix, il ne restait qu'à sortir la tâche du
 * calendrier et à la reposer à la main, c'est-à-dire à renoncer à l'outil
 * précisément au moment où l'on s'en sert le plus.
 *
 * Chaque option est calculée sur un canevas NEUF : ce sont des alternatives
 * exclusives, pas un empilement. Sans cela, la deuxième option décrivait un
 * calendrier où la première aurait déjà été appliquée.
 */
export function suggestPostponeOptions(
  state: AppState,
  task: Task,
  now: Date = new Date(),
  count = 3
): PostponeSuggestion[] {
  const needed = remainingMinutes(task, state.timeEntries);
  const keys = dayKeyRange(now, 14);
  const dueKey = task.dueAt && dayKey(task.dueAt) >= keys[0] ? dayKey(task.dueAt) : undefined;

  const options: PostponeSuggestion[] = [];
  for (const key of keys) {
    if (options.length >= count) break;
    const canvas = buildCanvas(state, keys, now, new Set([task.id]));
    if (freeOn(canvas, key) < Math.min(needed, MIN_CHUNK_MINUTES)) continue;

    const slots: TaskSlot[] = [];
    let left = needed;
    while (left > 0) {
      const size = Math.min(left, MAX_CHUNK_MINUTES);
      const slot = take(canvas, key, Math.min(size, freeOn(canvas, key)));
      if (!slot) break;
      slots.push(slot);
      left -= (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000;
    }
    if (slots.length === 0) continue;

    const afterDue = dueKey !== undefined && key > dueKey;
    options.push({
      slots,
      day: key,
      message: `${capitalize(formatRelativeDay(key, now))} à ${timeOf(slots[0].start)}`,
      warning: afterDue
        ? "Après l'échéance"
        : left > 0
          ? `${formatMinutes(left)} n'y tiennent pas`
          : undefined,
    });
  }

  return options;
}
