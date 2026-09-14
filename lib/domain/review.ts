import { capacityMinutes } from "@/lib/domain/availability";
import { categoryFamily, CATEGORY_FAMILY_LABELS } from "@/lib/domain/categories";
import { addDays, dayKey, dayKeyRange, formatMinutes, startOfWeek } from "@/lib/domain/date";
import { effortMinutes, isOpen } from "@/lib/domain/tasks";
import type { AppState, CategoryFamily, Task, TimeEntry } from "@/lib/domain/types";

/**
 * ============================================================================
 * BILAN HEBDOMADAIRE — « est-ce que j'ai réellement avancé ? »
 * ============================================================================
 *
 * Trois questions, dans cet ordre : le TRAVAIL (prévu / réel), les ÉCHÉANCES
 * (tenues / manquées), les MATIÈRES. Puis une analyse en phrases, et des
 * ajustements concrets.
 *
 * Rien n'est inventé : chaque chiffre est une somme vérifiable sur les
 * données brutes, et chaque phrase d'analyse cite le chiffre qui la justifie.
 * Une analyse qu'on ne peut pas recouper est une analyse qu'on n'applique
 * pas.
 */

export interface SubjectTime {
  subjectId: string | null;
  minutes: number;
}

export interface WeeklyReview {
  /** Lundi 00:00 de la semaine analysée, en clé locale. */
  weekStart: string;
  weekEnd: string;
  /** `true` quand la semaine analysée est celle en cours (le bilan est alors partiel). */
  current: boolean;

  plannedMinutes: number;
  workedMinutes: number;
  capacityMinutes: number;
  /** Temps réel / temps prévu, en %. */
  completionRate: number;
  /** Temps réel / capacité déclarée, en %. */
  capacityUse: number;

  tasksCompleted: number;
  tasksPostponed: number;
  tasksCancelled: number;
  tasksStillOpen: number;

  deadlinesMet: number;
  deadlinesMissed: number;
  deadlinesAtRisk: number;

  bySubject: SubjectTime[];
  byFamily: { family: CategoryFamily; minutes: number; label: string }[];
  byDay: { date: string; plannedMinutes: number; workedMinutes: number; capacityMinutes: number }[];

  /** Constats, en français, chacun adossé à un chiffre du bilan. */
  insights: string[];
  /** Ajustements proposés pour la semaine suivante. */
  suggestions: string[];
}

function inWeek(iso: string, startKey: string, endKey: string): boolean {
  const key = dayKey(iso);
  return key >= startKey && key <= endKey;
}

export function computeWeeklyReview(state: AppState, reference: Date = new Date(), now: Date = new Date()): WeeklyReview {
  const start = startOfWeek(reference);
  const keys = dayKeyRange(start, 7);
  const startKey = keys[0];
  const endKey = keys[6];
  const current = dayKey(startOfWeek(now)) === startKey;

  const entries = state.timeEntries.filter((entry) => inWeek(entry.startedAt, startKey, endKey));
  const workedMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);

  // PRÉVU : la somme des créneaux posés dans la semaine. C'est bien ce qui
  // était PRÉVU, pas ce qui restait à faire — comparer le réel à autre chose
  // que l'engagement pris fausserait le taux de réalisation.
  let plannedMinutes = 0;
  const plannedByDay = new Map<string, number>();
  for (const task of state.tasks) {
    for (const slot of task.slots) {
      const key = dayKey(slot.start);
      if (key < startKey || key > endKey) continue;
      const minutes = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000;
      plannedMinutes += minutes;
      plannedByDay.set(key, (plannedByDay.get(key) ?? 0) + minutes);
    }
  }

  const capacity = keys.reduce((total, key) => total + capacityMinutes(state.availability, key), 0);

  const completedThisWeek = state.tasks.filter(
    (task) => task.status === "done" && task.completedAt && inWeek(task.completedAt, startKey, endKey)
  );
  const postponedThisWeek = state.tasks.filter(
    (task) => task.lastPostponedAt && inWeek(task.lastPostponedAt, startKey, endKey)
  );
  const cancelledThisWeek = state.tasks.filter(
    (task) => task.status === "cancelled" && inWeek(task.updatedAt, startKey, endKey)
  );

  // ÉCHÉANCES de la semaine : tenue = terminée avant la fin du jour d'échéance.
  let deadlinesMet = 0;
  let deadlinesMissed = 0;
  let deadlinesAtRisk = 0;
  for (const task of state.tasks) {
    if (!task.dueAt || !inWeek(task.dueAt, startKey, endKey)) continue;
    if (task.status === "done") {
      const onTime = task.completedAt ? dayKey(task.completedAt) <= dayKey(task.dueAt) : true;
      if (onTime) deadlinesMet += 1;
      else deadlinesMissed += 1;
    } else if (task.status === "cancelled") {
      continue;
    } else if (dayKey(task.dueAt) < dayKey(now)) {
      deadlinesMissed += 1;
    } else {
      deadlinesAtRisk += 1;
    }
  }

  const bySubject = summarizeBySubject(entries);
  const byFamily = summarizeByFamily(entries, state.tasks);
  const byDay = keys.map((key) => ({
    date: key,
    plannedMinutes: Math.round(plannedByDay.get(key) ?? 0),
    workedMinutes: Math.round(
      entries.filter((entry) => dayKey(entry.startedAt) === key).reduce((total, entry) => total + entry.minutes, 0)
    ),
    capacityMinutes: capacityMinutes(state.availability, key),
  }));

  const review: WeeklyReview = {
    weekStart: startKey,
    weekEnd: endKey,
    current,
    plannedMinutes: Math.round(plannedMinutes),
    workedMinutes: Math.round(workedMinutes),
    capacityMinutes: capacity,
    completionRate: plannedMinutes > 0 ? Math.round((workedMinutes / plannedMinutes) * 100) : 0,
    capacityUse: capacity > 0 ? Math.round((workedMinutes / capacity) * 100) : 0,
    tasksCompleted: completedThisWeek.length,
    tasksPostponed: postponedThisWeek.length,
    tasksCancelled: cancelledThisWeek.length,
    tasksStillOpen: state.tasks.filter((task) => isOpen(task) && task.slots.some((slot) => inWeek(slot.start, startKey, endKey))).length,
    deadlinesMet,
    deadlinesMissed,
    deadlinesAtRisk,
    bySubject,
    byFamily,
    byDay,
    insights: [],
    suggestions: [],
  };

  review.insights = buildInsights(review, state);
  review.suggestions = buildSuggestions(review, state);
  return review;
}

function summarizeBySubject(entries: TimeEntry[]): SubjectTime[] {
  const map = new Map<string | null, number>();
  for (const entry of entries) {
    const key = entry.subjectId ?? null;
    map.set(key, (map.get(key) ?? 0) + entry.minutes);
  }
  return [...map.entries()]
    .map(([subjectId, minutes]) => ({ subjectId, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
}

function summarizeByFamily(entries: TimeEntry[], tasks: Task[]): { family: CategoryFamily; minutes: number; label: string }[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const map = new Map<CategoryFamily, number>();
  for (const entry of entries) {
    const task = entry.taskId ? taskById.get(entry.taskId) : undefined;
    if (!task) continue;
    const family = categoryFamily(task.category);
    map.set(family, (map.get(family) ?? 0) + entry.minutes);
  }
  return [...map.entries()]
    .map(([family, minutes]) => ({ family, minutes: Math.round(minutes), label: CATEGORY_FAMILY_LABELS[family] }))
    .sort((a, b) => b.minutes - a.minutes);
}

/**
 * CONSTATS — au plus cinq, toujours chiffrés.
 *
 * La tentation serait d'en écrire quinze. Un bilan qu'on ne lit pas jusqu'au
 * bout ne change aucune habitude : on garde ce qui est à la fois vrai, rare
 * et actionnable.
 */
function buildInsights(review: WeeklyReview, state: AppState): string[] {
  const insights: string[] = [];

  if (review.plannedMinutes > 0) {
    insights.push(
      `Tu as réalisé ${review.completionRate} % du travail prévu (${formatMinutes(review.workedMinutes)} sur ${formatMinutes(review.plannedMinutes)} planifiées).`
    );
  } else if (review.workedMinutes > 0) {
    insights.push(`${formatMinutes(review.workedMinutes)} travaillées, sans planning posé cette semaine.`);
  }

  if (review.deadlinesMissed > 0) {
    insights.push(
      `${review.deadlinesMissed} échéance${review.deadlinesMissed > 1 ? "s" : ""} manquée${review.deadlinesMissed > 1 ? "s" : ""} sur ${review.deadlinesMet + review.deadlinesMissed}.`
    );
  } else if (review.deadlinesMet > 0) {
    insights.push(`Toutes tes échéances de la semaine ont été tenues (${review.deadlinesMet}).`);
  }

  const overloaded = review.byDay.filter((day) => day.capacityMinutes > 0 && day.plannedMinutes > day.capacityMinutes);
  if (overloaded.length > 0) {
    const names = overloaded.map((day) => frenchWeekday(day.date)).join(" et ");
    insights.push(`Ton planning dépassait ta capacité ${overloaded.length > 1 ? "les" : "le"} ${names}.`);
  }

  const learning = review.byFamily.find((item) => item.family === "cours");
  const exercises = review.byFamily.find((item) => item.family === "exercices");
  if (exercises && exercises.minutes > 0 && (!learning || learning.minutes * 3 < exercises.minutes)) {
    insights.push(
      `Le cours passe après les exercices : ${formatMinutes(learning?.minutes ?? 0)} d'apprentissage contre ${formatMinutes(exercises.minutes)} d'exercices.`
    );
  }

  if (review.tasksPostponed >= 3) {
    insights.push(`${review.tasksPostponed} tâches reportées cette semaine — c'est le signe d'un planning trop optimiste.`);
  }

  const neglected = neglectedSubjects(review, state);
  if (neglected.length > 0) {
    insights.push(`Aucune minute enregistrée en ${neglected.join(", ")} cette semaine.`);
  }

  return insights.slice(0, 5);
}

/** Matières où il reste du travail ouvert mais où rien n'a été travaillé — un signal, pas un reproche. */
function neglectedSubjects(review: WeeklyReview, state: AppState): string[] {
  const worked = new Set(review.bySubject.filter((item) => item.minutes > 0).map((item) => item.subjectId));
  return state.subjects
    .filter((subject) => !subject.archived)
    .filter((subject) => !worked.has(subject.id))
    .filter((subject) => state.tasks.some((task) => isOpen(task) && task.subjectId === subject.id))
    .map((subject) => subject.label)
    .slice(0, 3);
}

/** AJUSTEMENTS — trois au maximum, toujours formulés comme une action. */
function buildSuggestions(review: WeeklyReview, state: AppState): string[] {
  const suggestions: string[] = [];

  if (review.completionRate > 0 && review.completionRate < 70) {
    const ratio = review.completionRate / 100;
    const target = Math.round((review.plannedMinutes * ratio) / 15) * 15;
    suggestions.push(
      `Planifie environ ${formatMinutes(target)} la semaine prochaine plutôt que ${formatMinutes(review.plannedMinutes)} : c'est ce que tu tiens réellement.`
    );
  }

  const heavy = review.byDay
    .filter((day) => day.capacityMinutes > 0 && day.plannedMinutes > day.capacityMinutes)
    .sort((a, b) => b.plannedMinutes - b.capacityMinutes - (a.plannedMinutes - a.capacityMinutes))[0];
  if (heavy) {
    suggestions.push(
      `Allège le ${frenchWeekday(heavy.date)} de ${formatMinutes(heavy.plannedMinutes - heavy.capacityMinutes)} en déplaçant une tâche sur un jour plus creux.`
    );
  }

  if (review.deadlinesAtRisk > 0) {
    suggestions.push(`${review.deadlinesAtRisk} échéance${review.deadlinesAtRisk > 1 ? "s" : ""} encore ouverte${review.deadlinesAtRisk > 1 ? "s" : ""} : place-les avant tout le reste.`);
  }

  const openUnplanned = state.tasks.filter((task) => isOpen(task) && task.slots.length === 0);
  if (openUnplanned.length >= 5) {
    const minutes = openUnplanned.reduce((total, task) => total + effortMinutes(task), 0);
    suggestions.push(`${openUnplanned.length} tâches ne sont posées nulle part (${formatMinutes(minutes)}). Lance une planification.`);
  }

  return suggestions.slice(0, 3);
}

const WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function frenchWeekday(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  return WEEKDAY_NAMES[(date.getDay() + 6) % 7];
}

/** Bilan de la semaine précédente — le point d'entrée du dimanche soir. */
export function computePreviousWeekReview(state: AppState, now: Date = new Date()): WeeklyReview {
  return computeWeeklyReview(state, addDays(startOfWeek(now), -7), now);
}
