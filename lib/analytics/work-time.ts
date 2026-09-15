import { dayKey, subjects, totalSeconds } from "@/lib/study";
import { startOfWeek } from "@/lib/week";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * TEMPS DE TRAVAIL — « combien ai-je travaillé ? », et « sur quoi ? ».
 *
 * Entièrement dérivé des `WorkSession` brutes : rien n'est persisté pour
 * cette famille de mesures, et rien ne doit l'être. Une séance porte son
 * horodatage et sa durée ; toutes les agrégations par jour, par semaine, par
 * mois et par matière s'en déduisent à la demande, pour n'importe quelle
 * période, y compris rétroactivement. Stocker un cumul ne ferait qu'ajouter
 * une seconde vérité à resynchroniser — la règle du Sprint 2.6, appliquée
 * ici aussi.
 *
 * Fonctions pures.
 */

export interface TimePoint {
  /** Clé de la période — "AAAA-MM-JJ" pour un jour, le lundi pour une semaine, "AAAA-MM" pour un mois. */
  key: string;
  /** Début de la période, pour l'affichage (nom du jour, du mois…). */
  start: Date;
  minutes: number;
}

export type TimeGranularity = "jour" | "semaine" | "mois";

function periodKey(date: Date, granularity: TimeGranularity): string {
  if (granularity === "jour") return dayKey(date);
  if (granularity === "semaine") return dayKey(startOfWeek(date));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodStart(date: Date, granularity: TimeGranularity): Date {
  if (granularity === "jour") return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === "semaine") return startOfWeek(date);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function stepBack(date: Date, granularity: TimeGranularity, steps: number): Date {
  const next = new Date(date);
  if (granularity === "jour") next.setDate(next.getDate() - steps);
  else if (granularity === "semaine") next.setDate(next.getDate() - steps * 7);
  else next.setMonth(next.getMonth() - steps);
  return next;
}

/**
 * Série du temps RÉELLEMENT travaillé, du plus ancien au plus récent, sur
 * les `count` dernières périodes — période courante incluse.
 *
 * Les périodes SANS séance sont présentes, à zéro. C'est volontaire et c'est
 * tout l'intérêt de la série : un trou est une information (une semaine sans
 * travail), et le masquer ferait apparaître une courbe continue là où il y a
 * eu une interruption. Ce n'est pas la même chose que d'inventer une donnée :
 * zéro minute travaillée est une mesure, pas un remplissage.
 */
export function computeWorkTimeSeries(
  sessions: WorkSession[],
  granularity: TimeGranularity,
  count: number,
  now: Date = new Date()
): TimePoint[] {
  const minutesByKey = new Map<string, number>();
  for (const session of sessions) {
    const started = new Date(session.started_at);
    if (started > now) continue;
    const key = periodKey(started, granularity);
    minutesByKey.set(key, (minutesByKey.get(key) ?? 0) + session.duration_seconds / 60);
  }

  const points: TimePoint[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const reference = stepBack(now, granularity, offset);
    const start = periodStart(reference, granularity);
    const key = periodKey(reference, granularity);
    points.push({ key, start, minutes: Math.round(minutesByKey.get(key) ?? 0) });
  }
  return points;
}

export interface SubjectShare {
  subject: Subject;
  minutes: number;
  /** Part du temps total de la période, 0–100, arrondie. */
  percent: number;
}

/**
 * Où part le temps, sur une période donnée — matières à zéro exclues.
 *
 * Triées par volume décroissant : la question posée est « qu'est-ce qui me
 * prend le plus de temps », et l'ordre alphabétique n'y répond pas.
 */
export function computeSubjectDistribution(sessions: WorkSession[], since: Date | null = null, until: Date = new Date()): SubjectShare[] {
  const scoped = sessions.filter((session) => {
    const started = new Date(session.started_at);
    return (!since || started >= since) && started <= until;
  });
  const total = totalSeconds(scoped) / 60;
  if (total === 0) return [];

  return subjects
    .map((subject) => {
      const minutes = Math.round(totalSeconds(scoped.filter((session) => session.subject === subject)) / 60);
      return { subject, minutes, percent: Math.round((minutes / total) * 100) };
    })
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export interface WeeklyComparison {
  currentMinutes: number;
  previousMinutes: number;
  deltaMinutes: number;
  /** Tendance calculée sur les `weeks` dernières semaines COMPLÈTES ou en cours — voir `computeTrend`. */
  trend: Trend;
}

/** Nombre de semaines observées pour la tendance de rythme — six : assez pour absorber une semaine de vacances, assez court pour refléter le trimestre en cours. */
export const RHYTHM_WEEKS = 6;

/**
 * « Est-ce que je travaille plus qu'avant ? »
 *
 * `deltaMinutes` compare la semaine en cours à la précédente — c'est le
 * chiffre que l'élève vérifie. La `trend`, elle, porte sur six semaines :
 * une seule comparaison hebdomadaire est beaucoup trop bruitée pour
 * qualifier un rythme, et le dire serait mentir.
 *
 * ATTENTION à l'interprétation, et c'est pour ça que les deux sont séparés :
 * la semaine en cours n'est pas terminée. Comparer un mercredi à une semaine
 * complète produit toujours une baisse. L'interface doit donc présenter
 * `deltaMinutes` comme un écart À CE STADE, jamais comme un bilan.
 */
export function computeWeeklyComparison(sessions: WorkSession[], now: Date = new Date()): WeeklyComparison {
  const series = computeWorkTimeSeries(sessions, "semaine", RHYTHM_WEEKS, now);
  const current = series[series.length - 1]?.minutes ?? 0;
  const previous = series[series.length - 2]?.minutes ?? 0;
  return {
    currentMinutes: current,
    previousMinutes: previous,
    deltaMinutes: current - previous,
    // La semaine en cours est incomplète : elle fausserait la tendance de
    // rythme vers le bas tous les lundis. On la retire de la série qui sert
    // à qualifier la direction, tout en la gardant pour l'écart brut.
    trend: computeTrend(series.slice(0, -1).map((point) => point.minutes)),
  };
}

/** Minutes travaillées sur une période bornée — brique commune à plusieurs constats. */
export function minutesBetween(sessions: WorkSession[], since: Date, until: Date = new Date()): number {
  return Math.round(
    totalSeconds(
      sessions.filter((session) => {
        const started = new Date(session.started_at);
        return started >= since && started <= until;
      })
    ) / 60
  );
}
