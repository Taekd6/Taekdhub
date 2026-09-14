import { dayKey, formatMinutes, startOfWeek } from "@/lib/domain/date";
import { actualMinutesByTask, effortMinutes, isOpen } from "@/lib/domain/tasks";
import { categoryFamily } from "@/lib/domain/categories";
import type { AppState, CategoryFamily, Task } from "@/lib/domain/types";

/**
 * ============================================================================
 * HABITUDES — la mémoire longue de TaekdHub.
 * ============================================================================
 *
 * Le bilan hebdomadaire répond à « comment s'est passée cette semaine ».
 * Ce module répond à « comment je fonctionne » : mes estimations sont-elles
 * justes, quelles tâches je reporte, quels jours je travaille vraiment.
 *
 * C'est ce qui permet, à terme, de MIEUX PRÉVOIR : un élève qui sous-estime
 * systématiquement la physique de 40 % doit le savoir, et son planning doit
 * finir par en tenir compte (`estimationBias`, utilisé par la planification
 * comme correctif proposé — jamais appliqué en douce).
 *
 * Règle de prudence appliquée partout : PAS DE CONCLUSION SOUS 5 MESURES.
 * Une moyenne sur deux tâches n'est pas une habitude, c'est du bruit.
 */

export const MIN_SAMPLES = 5;

export interface EstimationAccuracy {
  /** `null` = toutes matières confondues. */
  subjectId: string | null;
  samples: number;
  estimatedMinutes: number;
  actualMinutes: number;
  /** Réel / estimé. 1 = estimation juste, 1.4 = 40 % de sous-estimation. `null` tant qu'il n'y a pas assez de mesures. */
  ratio: number | null;
}

/**
 * Justesse des estimations, mesurée sur les tâches TERMINÉES qui ont
 * réellement du temps enregistré. Une tâche terminée sans temps saisi
 * n'apprend rien et est écartée — l'inclure ferait croire à une surestimation
 * généralisée.
 */
export function computeEstimationAccuracy(state: AppState): EstimationAccuracy[] {
  const byTask = actualMinutesByTask(state.timeEntries);
  const buckets = new Map<string | null, { samples: number; estimated: number; actual: number }>();

  for (const task of state.tasks) {
    if (task.status !== "done") continue;
    const actual = byTask.get(task.id) ?? 0;
    if (actual <= 0) continue;
    const key = task.subjectId ?? null;
    const bucket = buckets.get(key) ?? { samples: 0, estimated: 0, actual: 0 };
    bucket.samples += 1;
    bucket.estimated += effortMinutes(task);
    bucket.actual += actual;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([subjectId, bucket]) => ({
      subjectId,
      samples: bucket.samples,
      estimatedMinutes: Math.round(bucket.estimated),
      actualMinutes: Math.round(bucket.actual),
      ratio: bucket.samples >= MIN_SAMPLES && bucket.estimated > 0 ? Number((bucket.actual / bucket.estimated).toFixed(2)) : null,
    }))
    .sort((a, b) => b.samples - a.samples);
}

/** Correctif d'estimation proposé pour une matière — `1` quand on ne sait pas encore. */
export function estimationFactor(accuracy: EstimationAccuracy[], subjectId: string | undefined): number {
  const entry = accuracy.find((item) => item.subjectId === (subjectId ?? null));
  if (!entry || entry.ratio === null) return 1;
  // Borné : même avec un historique très déséquilibré, on ne double jamais ni
  // ne divise par deux une estimation sans que l'élève l'ait décidé.
  return Math.min(1.6, Math.max(0.7, entry.ratio));
}

export interface PostponeHabit {
  taskId: string;
  title: string;
  count: number;
}

export interface WeekdayHabit {
  /** 0 = lundi. */
  weekday: number;
  minutes: number;
  sessions: number;
}

export interface HabitsReport {
  accuracy: EstimationAccuracy[];
  /** Ratio global, toutes matières — `null` sous le seuil de mesures. */
  globalRatio: number | null;
  mostPostponed: PostponeHabit[];
  /** Familles de tâches les plus reportées — « tu reportes l'apprentissage ». */
  postponedFamilies: { family: CategoryFamily; count: number }[];
  byWeekday: WeekdayHabit[];
  /** Taux de réalisation moyen sur les semaines observées. */
  averageCompletionRate: number | null;
  /** Nombre de semaines avec au moins une minute travaillée — dit si les moyennes veulent dire quelque chose. */
  weeksObserved: number;
  totalWorkedMinutes: number;
}

export function computeHabits(state: AppState): HabitsReport {
  const accuracy = computeEstimationAccuracy(state);

  const byTask = actualMinutesByTask(state.timeEntries);
  let estimated = 0;
  let actual = 0;
  let samples = 0;
  for (const task of state.tasks) {
    if (task.status !== "done") continue;
    const real = byTask.get(task.id) ?? 0;
    if (real <= 0) continue;
    estimated += effortMinutes(task);
    actual += real;
    samples += 1;
  }

  const mostPostponed = state.tasks
    .filter((task) => task.postponedCount > 0)
    .sort((a, b) => b.postponedCount - a.postponedCount)
    .slice(0, 5)
    .map((task) => ({ taskId: task.id, title: task.title, count: task.postponedCount }));

  const familyCounts = new Map<CategoryFamily, number>();
  for (const task of state.tasks) {
    if (task.postponedCount === 0) continue;
    const family = categoryFamily(task.category);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + task.postponedCount);
  }

  const weekdayMinutes = new Map<number, { minutes: number; sessions: number }>();
  const weeks = new Set<string>();
  let totalWorked = 0;
  for (const entry of state.timeEntries) {
    const date = new Date(entry.startedAt);
    const weekday = (date.getDay() + 6) % 7;
    const bucket = weekdayMinutes.get(weekday) ?? { minutes: 0, sessions: 0 };
    bucket.minutes += entry.minutes;
    bucket.sessions += 1;
    weekdayMinutes.set(weekday, bucket);
    weeks.add(dayKey(startOfWeek(date)));
    totalWorked += entry.minutes;
  }

  return {
    accuracy,
    globalRatio: samples >= MIN_SAMPLES && estimated > 0 ? Number((actual / estimated).toFixed(2)) : null,
    mostPostponed,
    postponedFamilies: [...familyCounts.entries()]
      .map(([family, count]) => ({ family, count }))
      .sort((a, b) => b.count - a.count),
    byWeekday: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      minutes: Math.round(weekdayMinutes.get(weekday)?.minutes ?? 0),
      sessions: weekdayMinutes.get(weekday)?.sessions ?? 0,
    })),
    averageCompletionRate: null,
    weeksObserved: weeks.size,
    totalWorkedMinutes: Math.round(totalWorked),
  };
}

/** Phrase unique résumant la justesse des estimations — `null` quand il est trop tôt pour le dire. */
export function describeEstimationBias(report: HabitsReport): string | null {
  if (report.globalRatio === null) return null;
  const percent = Math.round(Math.abs(report.globalRatio - 1) * 100);
  if (percent < 10) return "Tes estimations sont justes à moins de 10 % près.";
  return report.globalRatio > 1
    ? `Tu sous-estimes tes tâches d'environ ${percent} % : compte ${formatMinutes(Math.round(60 * report.globalRatio))} pour une heure annoncée.`
    : `Tu surestimes tes tâches d'environ ${percent} % : tu peux en planifier un peu plus.`;
}

/** Tâches ouvertes jamais planifiées et jamais touchées depuis longtemps — le fond de tiroir, qu'il vaut mieux voir. */
export function stalledTasks(state: AppState, now: Date = new Date(), days = 14): Task[] {
  const limit = now.getTime() - days * 86_400_000;
  return state.tasks
    .filter((task) => isOpen(task) && task.slots.length === 0 && new Date(task.updatedAt).getTime() < limit)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}
