import { countResults, type AnnaleLog, type ResultCounts } from "@/lib/annales";
import { computeCalibration, describeCalibration } from "@/lib/calibration";
import { countByType, ERROR_TYPE_META } from "@/lib/error-log";
import { isScored, normalizedScore } from "@/lib/grades";
import { computeMastery, summarizeMastery, type ProgrammeSummary } from "@/lib/programme";
import { PROGRAMME_SUBJECTS } from "@/lib/programme-data";
import type { ChapterMemory, ErrorEntry, Grade } from "@/lib/storage";
import { dayKey, subjects } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * LE BILAN — une page, une période, tout ce qui compte.
 *
 * Fait pour être IMPRIMÉ (ou enregistré en PDF depuis le navigateur) et
 * montré : à un professeur, à ses parents, ou relu soi-même avant un
 * conseil de classe. Il ne dit que ce que les données disent :
 *
 *   le temps     total, jours travaillés, par matière, et l'écart avec la
 *                période précédente de même longueur ;
 *   les notes    moyenne (sur 20) par matière, et la calibration ;
 *   les erreurs  combien, de quel type surtout ;
 *   les annales  réussite sur la période ;
 *   le programme l'état ACTUEL de la carte (il n'a pas d'historique).
 *
 * Fonctions pures.
 */

export type BilanPeriod = "semaine" | "mois" | "trimestre" | "annee";

export const BILAN_PERIODS: { value: BilanPeriod; label: string }[] = [
  { value: "semaine", label: "7 jours" },
  { value: "mois", label: "30 jours" },
  { value: "trimestre", label: "Trimestre" },
  { value: "annee", label: "Année" },
];

function shift(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days, 12));
}

function span(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2, 12).getTime() - new Date(y1, m1 - 1, d1, 12).getTime()) / 86_400_000) + 1;
}

/** Bornes incluses de la période qui se termine aujourd'hui. L'année scolaire commence au 1er septembre. */
export function periodRange(period: BilanPeriod, today: string): { from: string; to: string } {
  if (period === "semaine") return { from: shift(today, -6), to: today };
  if (period === "mois") return { from: shift(today, -29), to: today };
  if (period === "trimestre") return { from: shift(today, -89), to: today };
  const [year, month] = today.split("-").map(Number);
  const start = month >= 9 ? year : year - 1;
  return { from: `${start}-09-01`, to: today };
}

export interface BilanInput {
  sessions: WorkSession[];
  grades: Grade[];
  errors: ErrorEntry[];
  chapterMemory: ChapterMemory[];
  annales: AnnaleLog[];
  programmeSeen: string[];
  from: string;
  to: string;
  today: string;
}

export interface SubjectBilan {
  subject: Subject;
  minutes: number;
  /** Moyenne des notes de la période, sur 20, `null` sans note. */
  average: number | null;
  gradeCount: number;
}

export interface Bilan {
  from: string;
  to: string;
  days: number;
  totalMinutes: number;
  activeDays: number;
  /** Minutes de la période précédente de même longueur — pour « +2 h par rapport à la période d'avant ». */
  previousMinutes: number;
  bySubject: SubjectBilan[];
  overallAverage: number | null;
  gradeCount: number;
  calibration: string | null;
  errorCount: number;
  topErrors: { label: string; count: number }[];
  annales: ResultCounts;
  programme: { subject: Subject; summary: ProgrammeSummary }[];
}

function minutesBetween(sessions: WorkSession[], from: string, to: string): { total: number; days: Set<string>; bySubject: Map<Subject, number> } {
  let total = 0;
  const days = new Set<string>();
  const bySubject = new Map<Subject, number>();
  for (const session of sessions) {
    const day = dayKey(session.started_at);
    if (day < from || day > to) continue;
    const minutes = session.duration_seconds / 60;
    total += minutes;
    if (session.duration_seconds >= 60) days.add(day);
    bySubject.set(session.subject, (bySubject.get(session.subject) ?? 0) + minutes);
  }
  return { total, days, bySubject };
}

function average(values: number[]): number | null {
  return values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

export function computeBilan(input: BilanInput): Bilan {
  const { from, to } = input;
  const days = span(from, to);
  const current = minutesBetween(input.sessions, from, to);
  const previous = minutesBetween(input.sessions, shift(from, -days), shift(from, -1));

  const grades = input.grades.filter((grade) => grade.date >= from && grade.date <= to);
  const scored = grades.filter(isScored);

  const bySubject: SubjectBilan[] = subjects
    .map((subject) => {
      const own = scored.filter((grade) => grade.subject === subject);
      return { subject, minutes: Math.round(current.bySubject.get(subject) ?? 0), average: average(own.map(normalizedScore)), gradeCount: own.length };
    })
    .filter((entry) => entry.minutes > 0 || entry.gradeCount > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const errors = input.errors.filter((entry) => entry.date >= from && entry.date <= to);
  const annales = input.annales.filter((log) => log.day >= from && log.day <= to);
  const mastery = computeMastery({ chapterMemory: input.chapterMemory, annales: input.annales, seen: input.programmeSeen, today: input.today });

  return {
    from,
    to,
    days,
    totalMinutes: Math.round(current.total),
    activeDays: current.days.size,
    previousMinutes: Math.round(previous.total),
    bySubject,
    overallAverage: average(scored.map(normalizedScore)),
    gradeCount: scored.length,
    calibration: describeCalibration(computeCalibration(grades).overall),
    errorCount: errors.length,
    topErrors: countByType(errors)
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((row) => ({ label: ERROR_TYPE_META[row.type].label, count: row.count })),
    annales: countResults(annales),
    programme: PROGRAMME_SUBJECTS.map((subject) => ({ subject, summary: summarizeMastery(mastery.filter((entry) => entry.chapter.subject === subject)) })),
  };
}

/** « 12 h 30 », « 45 min ». */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** La phrase d'évolution du temps — `null` quand la période d'avant est vide (rien à comparer). */
export function describeTrend(bilan: Bilan): string | null {
  if (bilan.previousMinutes <= 0) return null;
  const delta = bilan.totalMinutes - bilan.previousMinutes;
  const ratio = Math.round((Math.abs(delta) / bilan.previousMinutes) * 100);
  if (ratio < 5) return "Autant que sur la période précédente.";
  return `${delta > 0 ? "+" : "−"}${formatDuration(Math.abs(delta))} (${delta > 0 ? "+" : "−"}${ratio} %) par rapport à la période précédente.`;
}
