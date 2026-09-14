import { CATEGORY_META, isDeadlineCategory } from "@/lib/domain/categories";
import { addMinutes, dayKey, daysBetween, startOfDay } from "@/lib/domain/date";
import type { Priority, Task, TaskCategory, TaskSlot, TaskStatus, TimeEntry } from "@/lib/domain/types";

/**
 * ============================================================================
 * TÂCHES — création, transitions et lectures dérivées. Fonctions PURES.
 * ============================================================================
 *
 * Aucune de ces fonctions ne touche au stockage ni à React : elles prennent
 * un état et rendent un nouvel état. C'est ce qui rend la logique de
 * priorisation, de retard et de report testable sans navigateur — et
 * remplaçable sans toucher à l'interface.
 */

export interface NewTaskInput {
  title: string;
  subjectId?: string;
  category?: TaskCategory;
  description?: string;
  priority?: Priority;
  estimatedMinutes?: number;
  dueAt?: string;
  dueDateOnly?: boolean;
  slots?: TaskSlot[];
  source?: string;
  sourceUrl?: string;
  notes?: string;
  goalId?: string;
  routineId?: string;
  status?: TaskStatus;
}

let sequence = 0;

/** Identifiant : `crypto.randomUUID` quand il existe, repli explicite sinon (anciens navigateurs, contexte non sécurisé, tests Node). */
export function createId(prefix = "t"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export function createTask(input: NewTaskInput, now: Date = new Date()): Task {
  const iso = now.toISOString();
  const category = input.category ?? "autre";
  return {
    id: createId(),
    title: input.title.trim(),
    subjectId: input.subjectId,
    category,
    description: input.description?.trim() || undefined,
    status: input.status ?? "todo",
    priority: input.priority ?? 2,
    estimatedMinutes: input.estimatedMinutes ?? CATEGORY_META[category]?.defaultMinutes,
    dueAt: input.dueAt,
    dueDateOnly: input.dueAt ? input.dueDateOnly : undefined,
    slots: sortSlots(input.slots ?? []),
    source: input.source?.trim() || undefined,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    goalId: input.goalId,
    routineId: input.routineId,
    postponedCount: 0,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function updateTask(task: Task, patch: Partial<Task>, now: Date = new Date()): Task {
  return { ...task, ...patch, id: task.id, createdAt: task.createdAt, updatedAt: now.toISOString() };
}

/**
 * TERMINER — pose `completedAt`. Le temps réellement passé n'est PAS écrit
 * ici : il vit dans les `TimeEntry` (voir domain/types.ts), pour qu'il
 * n'existe jamais deux vérités sur le temps travaillé.
 */
export function completeTask(task: Task, now: Date = new Date()): Task {
  return updateTask(task, { status: "done", completedAt: now.toISOString() }, now);
}

export function reopenTask(task: Task, now: Date = new Date()): Task {
  return updateTask(task, { status: "todo", completedAt: undefined }, now);
}

export function cancelTask(task: Task, now: Date = new Date()): Task {
  return updateTask(task, { status: "cancelled", slots: [] }, now);
}

/* ─────────────────────────── CRÉNEAUX ─────────────────────────── */

/** Créneaux triés, valides et non chevauchants — invariant tenu à l'écriture, jamais vérifié à la lecture. */
export function sortSlots(slots: TaskSlot[]): TaskSlot[] {
  const valid = slots
    .filter((slot) => {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const merged: TaskSlot[] = [];
  for (const slot of valid) {
    const previous = merged[merged.length - 1];
    if (previous && new Date(slot.start).getTime() < new Date(previous.end).getTime()) {
      // Chevauchement sur la MÊME tâche : on étend plutôt que de compter deux
      // fois les mêmes minutes dans la charge du jour.
      if (new Date(slot.end).getTime() > new Date(previous.end).getTime()) previous.end = slot.end;
      continue;
    }
    merged.push({ ...slot });
  }
  return merged;
}

export function isScheduled(task: Task): boolean {
  return task.slots.length > 0;
}

/** Début du PREMIER créneau — l'équivalent en lecture de l'ancien `scheduledStart`. */
export function firstSlotStart(task: Task): string | undefined {
  return task.slots[0]?.start;
}

/** Fin du DERNIER créneau — l'équivalent en lecture de l'ancien `scheduledEnd`. */
export function lastSlotEnd(task: Task): string | undefined {
  return task.slots[task.slots.length - 1]?.end;
}

/** Le prochain créneau à venir (ou celui en cours) — `undefined` si tous sont passés. */
export function nextSlot(task: Task, now: Date = new Date()): TaskSlot | undefined {
  return task.slots.find((slot) => new Date(slot.end).getTime() > now.getTime());
}

export function slotMinutes(slot: TaskSlot): number {
  return Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000);
}

/** Durée totale POSÉE dans le calendrier, tous créneaux confondus. */
export function scheduledMinutes(task: Task): number {
  return task.slots.reduce((total, slot) => total + slotMinutes(slot), 0);
}

export function slotsOnDay(task: Task, key: string): TaskSlot[] {
  return task.slots.filter((slot) => dayKey(slot.start) === key);
}

export function scheduledMinutesOnDay(task: Task, key: string): number {
  return slotsOnDay(task, key).reduce((total, slot) => total + slotMinutes(slot), 0);
}

/** Pose (ou remplace) les créneaux d'une tâche — utilisé par la planification et par l'édition manuelle. */
export function scheduleTask(task: Task, slots: TaskSlot[], now: Date = new Date()): Task {
  return updateTask(task, { slots: sortSlots(slots) }, now);
}

/** Un créneau unique, à partir d'un début et d'une durée — le cas courant de l'interface. */
export function scheduleAt(task: Task, start: string, minutes?: number, now: Date = new Date()): Task {
  const duration = minutes ?? effortMinutes(task);
  return scheduleTask(task, [{ start, end: addMinutes(start, duration).toISOString() }], now);
}

export function unscheduleTask(task: Task, now: Date = new Date()): Task {
  return updateTask(task, { slots: [] }, now);
}

/**
 * REPORTER — déplacer les CRÉNEAUX, jamais l'échéance.
 *
 * C'est la distinction que la plupart des gestionnaires de tâches ratent :
 * repousser un DM au lendemain ne repousse pas la date du DM. `dueAt` reste
 * intact, les créneaux bougent, et le compteur de reports s'incrémente — c'est
 * lui qui permet ensuite de dire « tu reportes systématiquement
 * l'apprentissage » (domain/habits.ts) et de faire remonter une tâche qui
 * glisse depuis trois jours (domain/priority.ts).
 */
export function postponeTask(task: Task, slots: TaskSlot[], now: Date = new Date()): Task {
  return updateTask(
    task,
    {
      slots: sortSlots(slots),
      postponedCount: task.postponedCount + 1,
      lastPostponedAt: now.toISOString(),
      status: task.status === "doing" ? "todo" : task.status,
    },
    now
  );
}

/* ─────────────────────────── LECTURES DÉRIVÉES ─────────────────────────── */

export function isOpen(task: Task): boolean {
  return task.status === "todo" || task.status === "doing";
}

/**
 * CHARGE d'une tâche, en minutes — l'estimation de l'élève, ou le défaut de
 * sa catégorie. Jamais 0 : une tâche sans durée rendrait toute journée
 * infiniment remplissable, ce qui est exactement le mensonge que la
 * visualisation de charge doit empêcher.
 */
export function effortMinutes(task: Task, fallback = 30): number {
  if (typeof task.estimatedMinutes === "number" && task.estimatedMinutes > 0) return Math.round(task.estimatedMinutes);
  const byCategory = CATEGORY_META[task.category]?.defaultMinutes;
  return byCategory && byCategory > 0 ? byCategory : fallback;
}

/** Temps RÉELLEMENT passé sur une tâche, en minutes — dérivé des entrées de temps, jamais stocké sur la tâche. */
export function actualMinutes(taskId: string, entries: TimeEntry[]): number {
  return entries.reduce((total, entry) => (entry.taskId === taskId ? total + entry.minutes : total), 0);
}

/** Index `taskId → minutes` en un seul passage — à préférer dès qu'on affiche une liste. */
export function actualMinutesByTask(entries: TimeEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.taskId) continue;
    map.set(entry.taskId, (map.get(entry.taskId) ?? 0) + entry.minutes);
  }
  return map;
}

/**
 * TRAVAIL RESTANT d'une tâche ouverte, en minutes.
 *
 * Une tâche de 3 h déjà travaillée 2 h ne pèse plus 3 h sur la fin de
 * semaine : sans cette soustraction, la charge annoncée reste fausse tant
 * que la tâche n'est pas terminée, et le planning devient un objet de
 * défiance. Plancher à 15 min tant que ce n'est pas fini : « il reste
 * 0 minute » sur une tâche non terminée n'a aucun sens.
 */
export function remainingMinutes(task: Task, entries: TimeEntry[]): number {
  if (!isOpen(task)) return 0;
  const done = actualMinutes(task.id, entries);
  const planned = effortMinutes(task);
  return done >= planned ? 15 : planned - done;
}

export type DueState = "none" | "overdue" | "today" | "tomorrow" | "soon" | "later";

export interface DueInfo {
  state: DueState;
  /** Jours calendaires jusqu'à l'échéance : négatif = en retard, 0 = aujourd'hui. `undefined` sans échéance. */
  days?: number;
}

/** « Bientôt » = dans les 6 jours — l'horizon d'une semaine de prépa, celui que le rail hebdomadaire affiche. */
export const SOON_DAYS = 6;

export function dueInfo(task: Task, now: Date = new Date()): DueInfo {
  if (!task.dueAt) return { state: "none" };
  const days = daysBetween(now, task.dueAt);
  if (days < 0) return { state: "overdue", days };
  if (days === 0) return { state: "today", days };
  if (days === 1) return { state: "tomorrow", days };
  if (days <= SOON_DAYS) return { state: "soon", days };
  return { state: "later", days };
}

/**
 * EN RETARD — deux cas distincts, réunis parce qu'ils appellent la même
 * réaction de l'élève :
 *   — l'échéance est passée et la tâche n'est pas faite ;
 *   — le créneau prévu est passé (jour révolu) et la tâche n'est pas faite.
 *
 * Le second cas est celui que les gestionnaires de tâches ignorent, alors que
 * c'est le plus fréquent : un créneau manqué hier soir est un retard réel,
 * même si le DM n'est que pour vendredi.
 */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (!isOpen(task)) return false;
  if (task.dueAt && new Date(task.dueAt).getTime() < startOfDay(now).getTime()) return true;
  return isMissedSlot(task, now);
}

/**
 * CRÉNEAU MANQUÉ : tous les créneaux posés sont dans un jour révolu et la
 * tâche n'est pas faite. Tant qu'il reste un créneau à venir, il n'y a rien à
 * signaler — c'est ce qui distingue « en retard » de « en cours de
 * réalisation sur plusieurs jours ».
 */
export function isMissedSlot(task: Task, now: Date = new Date()): boolean {
  if (!isOpen(task) || task.slots.length === 0) return false;
  return task.slots.every((slot) => daysBetween(now, slot.start) < 0);
}

export function isScheduledOn(task: Task, key: string): boolean {
  return task.slots.some((slot) => dayKey(slot.start) === key);
}

export function isDueOn(task: Task, key: string): boolean {
  return Boolean(task.dueAt) && dayKey(task.dueAt!) === key;
}

/** Une évaluation posée dans le calendrier — repère FIXE, pas du travail déplaçable. */
export function isDeadlineTask(task: Task): boolean {
  return isDeadlineCategory(task.category);
}

/* ─────────────────────────── FILTRES & TRIS ─────────────────────────── */

export interface TaskFilter {
  search?: string;
  subjectId?: string;
  category?: TaskCategory;
  status?: TaskStatus | "open";
  goalId?: string;
  /** `true` : seulement les tâches en retard. */
  overdueOnly?: boolean;
  /** `true` : seulement les tâches sans aucun créneau posé. */
  unscheduledOnly?: boolean;
}

export function filterTasks(tasks: Task[], filter: TaskFilter, now: Date = new Date()): Task[] {
  const needle = filter.search?.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filter.status === "open" ? !isOpen(task) : filter.status && task.status !== filter.status) return false;
    if (filter.subjectId && task.subjectId !== filter.subjectId) return false;
    if (filter.category && task.category !== filter.category) return false;
    if (filter.goalId && task.goalId !== filter.goalId) return false;
    if (filter.overdueOnly && !isOverdue(task, now)) return false;
    if (filter.unscheduledOnly && isScheduled(task)) return false;
    if (needle) {
      const haystack = `${task.title} ${task.description ?? ""} ${task.source ?? ""} ${task.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** Tri par ÉCHÉANCE : les datées d'abord, dans l'ordre ; les non datées ensuite, par priorité. */
export function sortByDue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return b.priority - a.priority;
  });
}

/** Tri CHRONOLOGIQUE d'une journée : les créneaux posés dans l'ordre horaire, le reste après. */
export function sortBySlot(tasks: Task[], key?: string): Task[] {
  const startOf = (task: Task) => {
    const slot = key ? slotsOnDay(task, key)[0] : task.slots[0];
    return slot ? new Date(slot.start).getTime() : undefined;
  };
  return [...tasks].sort((a, b) => {
    const left = startOf(a);
    const right = startOf(b);
    if (left !== undefined && right !== undefined) return left - right;
    if (left !== undefined) return -1;
    if (right !== undefined) return 1;
    return b.priority - a.priority;
  });
}
