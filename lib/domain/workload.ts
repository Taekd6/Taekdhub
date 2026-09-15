import { capacityMinutes, freeSlotsForDay } from "@/lib/domain/availability";
import { dayKey, dayKeyRange, dateFromDayKey } from "@/lib/domain/date";
import { effortMinutes, isDeadlineTask, isOpen, isOverdue, isScheduled, remainingMinutes, scheduledMinutesOnDay, slotsOnDay } from "@/lib/domain/tasks";
import type { AppState, Task } from "@/lib/domain/types";

/**
 * ============================================================================
 * CHARGE DE TRAVAIL — « est-ce que mon planning est réaliste ? »
 * ============================================================================
 *
 * Une seule question, posée jour par jour : ce qui est POSÉ ce jour-là
 * tient-il dans ce qui est DISPONIBLE ce jour-là ?
 *
 * Trois états, pas un score :
 *   ok         il reste de la marge ;
 *   tight      au-delà de `tightLoadRatio` (90 % par défaut) — ça tient,
 *              mais au prix d'une soirée sans le moindre imprévu ;
 *   over       ça ne tient pas. C'est un fait arithmétique, pas un avis.
 *
 * Le seuil « tendu » existe parce qu'un planning rempli à 98 % est faux en
 * pratique : la première interruption le fait déborder, et la seule chose que
 * l'élève en retient est que l'outil ment.
 */

export type LoadStatus = "empty" | "ok" | "tight" | "over";

export interface DayLoad {
  /** `YYYY-MM-DD` local. */
  date: string;
  capacityMinutes: number;
  /** Somme du travail RESTANT des tâches ouvertes posées ce jour-là. */
  plannedMinutes: number;
  /** Part de cette charge qui est un point fixe (DS, khôlle) : non déplaçable. */
  fixedMinutes: number;
  /** Nombre de tâches posées ce jour-là (ouvertes). */
  taskCount: number;
  /** Échéances tombant ce jour-là — repères, pas de la charge. */
  dueCount: number;
  status: LoadStatus;
  /** Capacité restante, jamais négative. */
  freeMinutes: number;
  /** Dépassement, 0 si la journée tient. */
  overflowMinutes: number;
  /** 0 → ∞. 100 = journée exactement pleine. */
  ratio: number;
}

export interface WorkloadWindow {
  days: DayLoad[];
  totalCapacityMinutes: number;
  totalPlannedMinutes: number;
  /** Travail ouvert NON POSÉ dans la fenêtre — ce qui devra bien trouver une place quelque part. */
  unscheduledMinutes: number;
  unscheduledCount: number;
  overdueCount: number;
  overdueMinutes: number;
}

/** Charge d'UN jour. */
export function computeDayLoad(state: AppState, day: Date | string): DayLoad {
  const key = typeof day === "string" ? day : dayKey(day);
  const capacity = capacityMinutes(state.availability, key);

  let planned = 0;
  let fixed = 0;
  let taskCount = 0;
  let dueCount = 0;

  for (const task of state.tasks) {
    if (!isOpen(task)) continue;
    if (task.dueAt && dayKey(task.dueAt) === key) dueCount += 1;
    if (slotsOnDay(task, key).length === 0) continue;
    // Le créneau POSÉ fait foi : si l'élève a réservé 2 h ce jour-là pour une
    // tâche estimée à 3 h, ce sont bien 2 h qui pèsent sur CE jour — le reste
    // pèsera sur le jour où il est posé, ou nulle part tant qu'il ne l'est pas
    // (c'est précisément ce que compte `unscheduledMinutes`).
    const minutes = scheduledMinutesOnDay(task, key);
    planned += minutes;
    if (isDeadlineTask(task)) fixed += minutes;
    taskCount += 1;
  }

  return finalize(key, capacity, planned, fixed, taskCount, dueCount, state.settings.tightLoadRatio);
}

function finalize(
  date: string,
  capacity: number,
  planned: number,
  fixed: number,
  taskCount: number,
  dueCount: number,
  tightRatio: number
): DayLoad {
  const ratio = capacity > 0 ? (planned / capacity) * 100 : planned > 0 ? Number.POSITIVE_INFINITY : 0;
  const threshold = Math.min(100, Math.max(50, Math.round(tightRatio * 100)));

  let status: LoadStatus;
  if (planned === 0) status = "empty";
  else if (capacity === 0 || planned > capacity) status = "over";
  else if (ratio >= threshold) status = "tight";
  else status = "ok";

  // NOTE : `freeMinutes` est une capacité BRUTE (plages du jour moins ce qui y
  // est posé). La capacité réellement encore utilisable aujourd'hui, une fois
  // l'heure courante passée, est calculée par `freeSlotsForDay`
  // (domain/availability.ts), qui seul connaît le découpage en plages — une
  // simple soustraction du temps écoulé serait fausse dès qu'une plage
  // commence après l'heure courante.

  return {
    date,
    capacityMinutes: capacity,
    plannedMinutes: Math.round(planned),
    fixedMinutes: Math.round(fixed),
    taskCount,
    dueCount,
    status,
    freeMinutes: Math.max(0, Math.round(capacity - planned)),
    overflowMinutes: Math.max(0, Math.round(planned - capacity)),
    ratio: Number.isFinite(ratio) ? Math.round(ratio) : 999,
  };
}

/** Charge sur une FENÊTRE de jours consécutifs — c'est la vue « ma semaine » et le graphique de charge. */
export function computeWorkload(state: AppState, from: Date | string, days: number, now: Date = new Date()): WorkloadWindow {
  const keys = dayKeyRange(typeof from === "string" ? dateFromDayKey(from) : from, days);
  const loads = keys.map((key) => computeDayLoad(state, key));

  const windowStart = keys[0];
  const windowEnd = keys[keys.length - 1];

  let unscheduledMinutes = 0;
  let unscheduledCount = 0;
  let overdueCount = 0;
  let overdueMinutes = 0;

  for (const task of state.tasks) {
    if (!isOpen(task)) continue;
    if (isOverdue(task, now)) {
      overdueCount += 1;
      overdueMinutes += remainingMinutes(task, state.timeEntries);
    }
    // Une évaluation n'est pas du travail « à caser » : voir la note de
    // domain/scheduling.ts#planWork. Elle reste comptée comme échéance
    // (`dueCount`) et comme repère du calendrier.
    if (isDeadlineTask(task) || isScheduled(task)) continue;
    // Non posée : ne compte dans la fenêtre que si son échéance y tombe (ou
    // est déjà passée). Une tâche sans date ne pèse sur aucun jour précis.
    if (task.dueAt) {
      const key = dayKey(task.dueAt);
      if (key > windowEnd) continue;
      if (key < windowStart && !isOverdue(task, now)) continue;
    }
    unscheduledMinutes += remainingMinutes(task, state.timeEntries);
    unscheduledCount += 1;
  }

  return {
    days: loads,
    totalCapacityMinutes: loads.reduce((total, day) => total + day.capacityMinutes, 0),
    totalPlannedMinutes: loads.reduce((total, day) => total + day.plannedMinutes, 0),
    unscheduledMinutes: Math.round(unscheduledMinutes),
    unscheduledCount,
    overdueCount,
    overdueMinutes: Math.round(overdueMinutes),
  };
}

export interface FeasibilityVerdict {
  /** `true` quand tout le travail à échéance dans la fenêtre tient dans la capacité restante. */
  feasible: boolean;
  requiredMinutes: number;
  availableMinutes: number;
  /** Minutes manquantes — 0 si ça tient. */
  deficitMinutes: number;
  /** Jours en dépassement dans la fenêtre. */
  overloadedDays: string[];
}

/**
 * VERDICT DE FAISABILITÉ — la question que pose l'élève avant de se coucher :
 * « avec tout ce qui tombe d'ici dimanche, est-ce que ça passe ? »
 *
 * Compte tout le travail ouvert dont l'échéance tombe dans la fenêtre (ou est
 * déjà dépassée), posé ou non, et le compare à la capacité de la fenêtre.
 * C'est volontairement une addition, pas une simulation : une addition, on
 * peut la vérifier de tête et donc y croire.
 */
export function computeFeasibility(state: AppState, from: Date | string, days: number, now: Date = new Date()): FeasibilityVerdict {
  const window = computeWorkload(state, from, days, now);
  const keys = window.days.map((day) => day.date);
  const last = keys[keys.length - 1];

  let required = 0;
  for (const task of state.tasks) {
    if (!isOpen(task) || isDeadlineTask(task)) continue;
    const dueKey = task.dueAt ? dayKey(task.dueAt) : undefined;
    const scheduledInWindow = task.slots.some((slot) => {
      const key = dayKey(slot.start);
      return key >= keys[0] && key <= last;
    });
    if (!(dueKey !== undefined && dueKey <= last) && !scheduledInWindow) continue;
    required += remainingMinutes(task, state.timeEntries);
  }

  const available = window.totalCapacityMinutes;
  return {
    feasible: required <= available,
    requiredMinutes: Math.round(required),
    availableMinutes: available,
    deficitMinutes: Math.max(0, Math.round(required - available)),
    overloadedDays: window.days.filter((day) => day.status === "over").map((day) => day.date),
  };
}

/** Somme des estimations d'une liste — utilisée par l'aperçu « ce qui reste à caser ». */
export function totalEffort(tasks: Task[]): number {
  return tasks.reduce((total, task) => total + effortMinutes(task), 0);
}

/**
 * ============================================================================
 * L'IMPOSSIBLE — dit avant l'échéance, pas après.
 * ============================================================================
 *
 * Une tâche est IMPOSSIBLE quand le travail qui lui reste dépasse tout le
 * temps encore libre avant son échéance — même en y consacrant chaque minute
 * disponible, et sans rien faire d'autre de ce qui est déjà posé.
 *
 * C'est le seul signal que l'application doit absolument donner À L'AVANCE :
 * un élève qui découvre le dimanche soir qu'un DM de 6 h était infaisable
 * depuis jeudi n'a plus aucune décision à prendre. S'il le sait jeudi, il en a
 * trois : demander un délai, réduire l'ambition, ou libérer du temps ailleurs.
 *
 * La définition est volontairement GÉNÉREUSE (on suppose qu'il pourrait tout
 * abandonner d'autre) : ainsi, quand TaekdHub dit « impossible », ça l'est
 * vraiment, et l'alerte garde sa valeur.
 */
export interface ImpossibleTask {
  task: Task;
  /** Travail restant sur la tâche. */
  remainingMinutes: number;
  /** Temps réellement disponible d'ici l'échéance, tout le reste mis de côté. */
  availableMinutes: number;
  /** Ce qui manque, au mieux. Toujours > 0. */
  missingMinutes: number;
}

export function findImpossibleTasks(state: AppState, now: Date = new Date(), horizonDays = 21): ImpossibleTask[] {
  const keys = dayKeyRange(now, horizonDays);
  const horizonEnd = keys[keys.length - 1];

  // Les créneaux posés, par jour, calculés une seule fois : la boucle par
  // tâche ne fait ensuite qu'en retirer les siens.
  const busyByDay = new Map<string, { taskId: string; start: string; end: string }[]>();
  for (const task of state.tasks) {
    if (!isOpen(task)) continue;
    for (const slot of task.slots) {
      const key = dayKey(slot.start);
      if (key > horizonEnd) continue;
      const list = busyByDay.get(key) ?? [];
      list.push({ taskId: task.id, start: slot.start, end: slot.end });
      busyByDay.set(key, list);
    }
  }

  const impossible: ImpossibleTask[] = [];
  for (const task of state.tasks) {
    // Une évaluation n'a pas de travail à caser : elle a lieu, point.
    if (!isOpen(task) || isDeadlineTask(task) || !task.dueAt) continue;
    const dueKey = dayKey(task.dueAt);
    if (dueKey > horizonEnd) continue;
    /*
     * Une échéance DÉJÀ PASSÉE n'est pas « impossible », elle est manquée.
     * Ce sont deux états différents, avec deux remèdes différents : on
     * rattrape un retard, on arbitre un impossible. Les confondre produisait
     * la phrase « 0 min réellement disponibles d'ici hier », et surtout
     * noyait le vrai signal sous des alertes qui n'appellent aucune décision.
     */
    if (dueKey < keys[0]) continue;

    const remaining = remainingMinutes(task, state.timeEntries);
    let available = 0;
    for (const key of keys) {
      if (key > dueKey) break;
      const busy = (busyByDay.get(key) ?? []).filter((slot) => slot.taskId !== task.id);
      available += freeSlotsForDay(state.availability, key, busy, now).reduce((total, slot) => total + slot.minutes, 0);
    }

    if (remaining > available) {
      impossible.push({
        task,
        remainingMinutes: remaining,
        availableMinutes: Math.round(available),
        missingMinutes: Math.round(remaining - available),
      });
    }
  }

  // Le plus urgent d'abord : c'est celui sur lequel une décision est due.
  return impossible.sort((a, b) => new Date(a.task.dueAt!).getTime() - new Date(b.task.dueAt!).getTime());
}
