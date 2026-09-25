import { computeConsistency, currentStreak } from "@/lib/analytics/consistency";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import { computeSubjectDistribution, computeWorkTimeSeries, measuredMinutes, minutesBetween, type TimePoint } from "@/lib/analytics/work-time";
import { computeGradeStats, computeGradeTrend, isScored, type GradeStats } from "@/lib/grades";
import { dayKey, subjects as allSubjects, todaySeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { startOfWeek } from "@/lib/week";
import { GRADE_KINDS, type Grade, type GradeKind } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SUIVI DE L'ÉVOLUTION — les agrégations de l'écran « Mon évolution ».
 *
 * CE MODULE NE DÉFINIT AUCUNE MÉTRIQUE NOUVELLE. Le temps vient de
 * `minutesBetween` et `computeWorkTimeSeries`, la régularité de
 * `computeConsistency`, les notes de `computeGradeStats`, les tendances de
 * `computeTrend`. Tout ce qu'on ajoute ici, c'est le DÉCOUPAGE PAR PÉRIODE et
 * la comparaison à soi-même — deux choses qu'aucun moteur ne faisait, et
 * qu'il aurait été absurde de refaire en dupliquant leurs définitions.
 *
 * Une seule règle, partout : une comparaison ne s'affiche que si elle repose
 * sur quelque chose. Une période précédente vide ne donne pas « +100 % », elle
 * donne `null`, et l'interface dit alors qu'il n'y a pas encore de quoi
 * comparer.
 *
 * Fonctions pures.
 */

/* ══════════════════════════════════════════════════════════════════
   PÉRIODES
   ══════════════════════════════════════════════════════════════════ */

export type TrackingPeriod = "7j" | "30j" | "3mois";

export const TRACKING_PERIODS: readonly TrackingPeriod[] = ["7j", "30j", "3mois"];

export const PERIOD_DAYS: Record<TrackingPeriod, number> = { "7j": 7, "30j": 30, "3mois": 90 };

export const PERIOD_LABELS: Record<TrackingPeriod, string> = {
  "7j": "7 jours",
  "30j": "30 jours",
  "3mois": "3 mois",
};

/** Au-delà de 31 jours, une barre par jour devient illisible : on agrège par semaine. */
export function granularityFor(period: TrackingPeriod): "jour" | "semaine" {
  return PERIOD_DAYS[period] <= 31 ? "jour" : "semaine";
}

function daysAgo(now: Date, days: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export interface PeriodTotals {
  period: TrackingPeriod;
  days: number;
  /** Minutes travaillées sur la période. */
  minutes: number;
  /** Moyenne par jour CALENDAIRE de la période — la question « à quel rythme », pas « quand je m'y mets ». */
  dailyAverage: number;
  /** Jours où au moins une minute a été travaillée. */
  activeDays: number;
  /** Minutes sur la période PRÉCÉDENTE de même longueur. */
  previousMinutes: number;
  deltaMinutes: number;
  /**
   * Écart relatif, ou `null` quand la période précédente est vide.
   *
   * Passer de 0 à 4 h n'est pas « +100 % » ni « +∞ » : c'est un démarrage, et
   * aucun pourcentage ne le décrit. On préfère se taire.
   */
  deltaPercent: number | null;
  /** La série à tracer — une barre par jour, ou par semaine au-delà d'un mois. */
  points: TimePoint[];
}

export function computePeriodTotals(sessions: WorkSession[], period: TrackingPeriod, now: Date = new Date()): PeriodTotals {
  const days = PERIOD_DAYS[period];
  const since = daysAgo(now, days);
  const minutes = minutesBetween(sessions, since, now);
  const previousMinutes = minutesBetween(sessions, daysAgo(now, days * 2), since);

  const granularity = granularityFor(period);
  const count = granularity === "jour" ? days : Math.ceil(days / 7);

  // Jours actifs : on réutilise la définition unique du produit (au moins une
  // minute CUMULÉE sur la journée — voir lib/analytics/consistency.ts).
  const active = new Set<string>();
  const secondsByDay = new Map<string, number>();
  for (const session of sessions) {
    const started = new Date(session.started_at);
    if (started < since || started > now) continue;
    const key = dayKey(started);
    secondsByDay.set(key, (secondsByDay.get(key) ?? 0) + session.duration_seconds);
  }
  for (const [key, seconds] of secondsByDay) if (secondsToWholeMinutes(seconds) > 0) active.add(key);

  return {
    period,
    days,
    minutes,
    dailyAverage: Math.round(minutes / days),
    activeDays: active.size,
    previousMinutes,
    deltaMinutes: minutes - previousMinutes,
    deltaPercent: previousMinutes > 0 ? Math.round(((minutes - previousMinutes) / previousMinutes) * 100) : null,
    points: computeWorkTimeSeries(sessions, granularity, count, now),
  };
}

/* ══════════════════════════════════════════════════════════════════
   VUE D'ENSEMBLE — cinq chiffres, pas quinze
   ══════════════════════════════════════════════════════════════════ */

export interface TrackingOverview {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  /** Jours travaillés dans la semaine EN COURS, sur les jours écoulés. */
  activeDaysThisWeek: number;
  /** Jours écoulés de la semaine en cours, aujourd'hui inclus — le dénominateur honnête de « X / 7 ». */
  elapsedDaysThisWeek: number;
  streak: number;
  /** Tendance du volume hebdomadaire — `insuffisant` tant qu'il n'y a pas de quoi conclure. */
  trend: Trend;
}

/** Semaines observées pour la tendance de volume — même horizon que l'écran Progression. */
export const TRACKING_TREND_WEEKS = 6;

export function computeTrackingOverview(sessions: WorkSession[], now: Date = new Date()): TrackingOverview {
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    todayMinutes: secondsToWholeMinutes(todaySeconds(sessions, now)),
    weekMinutes: minutesBetween(sessions, weekStart, now),
    monthMinutes: minutesBetween(sessions, monthStart, now),
    activeDaysThisWeek: computeConsistency(sessions, 1, now).currentActiveDays,
    // Lundi = 1 jour écoulé, dimanche = 7. « 3 / 7 » un mardi serait un
    // reproche adressé à des jours qui ne sont pas arrivés.
    elapsedDaysThisWeek: Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - weekStart.getTime()) / 86400000) + 1,
    streak: currentStreak(sessions, now),
    trend: computeTrend(measuredMinutes(computeWorkTimeSeries(sessions, "semaine", TRACKING_TREND_WEEKS, now).slice(0, -1))),
  };
}

/* ══════════════════════════════════════════════════════════════════
   RÉPARTITION DU TEMPS PAR MATIÈRE
   ══════════════════════════════════════════════════════════════════ */

export interface SubjectTracking {
  subject: Subject;
  /** Minutes sur la période. */
  minutes: number;
  /** Part du temps de la période, 0–100. */
  percent: number;
  /** Minutes sur la période précédente de même longueur. */
  previousMinutes: number;
  deltaMinutes: number;
}

/**
 * Temps par matière sur la période, face à la période précédente de même
 * longueur. Une matière n'apparaît que si elle a été travaillée sur l'une ou
 * l'autre des deux périodes — jamais une ligne « 0 → 0 ».
 */
export function computeSubjectTracking(sessions: WorkSession[], period: TrackingPeriod, now: Date = new Date()): SubjectTracking[] {
  const days = PERIOD_DAYS[period];
  const since = daysAgo(now, days);
  const distribution = computeSubjectDistribution(sessions, since, now);

  return allSubjects
    .map((subject) => {
      const share = distribution.find((entry) => entry.subject === subject);
      const own = sessions.filter((session) => session.subject === subject);
      return {
        subject,
        minutes: share?.minutes ?? 0,
        percent: share?.percent ?? 0,
        previousMinutes: minutesBetween(own, daysAgo(now, days * 2), since),
        deltaMinutes: (share?.minutes ?? 0) - minutesBetween(own, daysAgo(now, days * 2), since),
      };
    })
    .filter((entry) => entry.minutes > 0 || entry.previousMinutes > 0);
}

/* ══════════════════════════════════════════════════════════════════
   RÉGULARITÉ
   ══════════════════════════════════════════════════════════════════ */

export interface WeekVolume {
  key: string;
  start: Date;
  minutes: number;
}

export interface RegularityStats {
  activeDays: number;
  days: number;
  streak: number;
  /** Moyenne sur les seuls jours TRAVAILLÉS — « quand je m'y mets, j'y passe combien ? ». */
  averagePerActiveDay: number;
  /** Semaines complètes et réellement observées, les plus récentes d'abord. */
  best: WeekVolume | null;
  worst: WeekVolume | null;
  trend: Trend;
}

export function computeRegularity(sessions: WorkSession[], period: TrackingPeriod, now: Date = new Date()): RegularityStats {
  const totals = computePeriodTotals(sessions, period, now);
  const weeks = computeWorkTimeSeries(sessions, "semaine", TRACKING_TREND_WEEKS, now);
  // Semaines COMPLÈTES (on retire celle en cours) ET réellement observées
  // (postérieures à la première séance) — mêmes deux filtres que partout.
  const comparable = weeks.slice(0, -1).filter((point) => point.measured);
  const sorted = [...comparable].sort((a, b) => b.minutes - a.minutes);

  return {
    activeDays: totals.activeDays,
    days: totals.days,
    streak: currentStreak(sessions, now),
    averagePerActiveDay: totals.activeDays > 0 ? Math.round(totals.minutes / totals.activeDays) : 0,
    // Il faut au moins DEUX semaines comparables pour qu'une « meilleure » et
    // une « pire » aient un sens : sur une seule, ce serait la même.
    best: comparable.length >= 2 ? { key: sorted[0].key, start: sorted[0].start, minutes: sorted[0].minutes } : null,
    worst: comparable.length >= 2 ? { key: sorted[sorted.length - 1].key, start: sorted[sorted.length - 1].start, minutes: sorted[sorted.length - 1].minutes } : null,
    trend: computeTrend(measuredMinutes(weeks.slice(0, -1))),
  };
}

/* ══════════════════════════════════════════════════════════════════
   RÉSULTATS PAR NATURE D'ÉPREUVE
   ══════════════════════════════════════════════════════════════════ */

export interface GradeKindTracking {
  kind: GradeKind;
  stats: GradeStats;
  trend: Trend;
}

/**
 * Une moyenne et une tendance PAR NATURE.
 *
 * Un DS, une khôlle et un DM ne se passent pas dans les mêmes conditions ;
 * les agréger produirait un nombre que le modèle ne porte pas. Chaque nature
 * garde donc sa courbe, et l'interface laisse choisir.
 */
export function computeGradesByKind(all: Grade[]): GradeKindTracking[] {
  // Notes en attente exclues : une nature qui n'a QUE des prédictions n'a
  // encore aucun résultat à montrer (voir lib/grades.ts#isScored).
  const grades = all.filter(isScored);
  return GRADE_KINDS.filter((kind) => grades.some((grade) => grade.kind === kind)).map((kind) => {
    const scoped = grades.filter((grade) => grade.kind === kind);
    return { kind, stats: computeGradeStats(scoped), trend: computeGradeTrend(scoped).trend };
  });
}

export interface SubjectGradeRow {
  subject: Subject;
  stats: GradeStats;
  trend: Trend;
}

/** Une ligne par matière NOTÉE — jamais une ligne vide pour une matière sans note. */
export function computeGradesBySubject(all: Grade[], kind: GradeKind | null = null): SubjectGradeRow[] {
  const grades = all.filter(isScored); // notes en attente exclues — voir `computeGradesByKind`
  const scoped = kind ? grades.filter((grade) => grade.kind === kind) : grades;
  return allSubjects
    .filter((subject) => scoped.some((grade) => grade.subject === subject))
    .map((subject) => {
      const own = scoped.filter((grade) => grade.subject === subject);
      return { subject, stats: computeGradeStats(own), trend: computeGradeTrend(own).trend };
    });
}
