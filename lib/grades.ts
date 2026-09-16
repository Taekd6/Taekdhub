import { computeTrend, type Trend } from "@/lib/analytics/trend";
import type { Grade, GradeKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * NOTES SCOLAIRES — la seule mesure qui ne vient pas de TaekdHub.
 *
 * Modèle pur (création, tri, agrégats) : la persistance vit dans
 * lib/storage.ts, la réactivité dans hooks/use-prepahub-data.ts — même
 * contrat que lib/work-items.ts et lib/chapters.ts.
 *
 * TOUT EST RAMENÉ SUR 20 pour être comparable. Une colle sur 10 et un
 * concours blanc sur 40 ne se moyennent pas tels quels ; la note brute reste
 * affichée telle qu'elle a été saisie (« 17/40 »), mais les moyennes et les
 * courbes travaillent sur la valeur normalisée. Sans ça, une seule épreuve
 * sur un autre barème suffirait à rendre une moyenne absurde.
 *
 * AUCUN COEFFICIENT. C'est délibéré : les coefficients varient d'un
 * établissement à l'autre, se saisissent mal, et une moyenne pondérée fausse
 * est pire qu'une moyenne simple assumée. L'interface dit « moyenne simple ».
 */

export const GRADE_KIND_META: Record<GradeKind, { label: string; short: string }> = {
  ds: { label: "Devoir surveillé", short: "DS" },
  dm: { label: "Devoir maison", short: "DM" },
  interro: { label: "Interrogation", short: "Interro" },
  colle: { label: "Colle", short: "Colle" },
  concours: { label: "Concours blanc", short: "Concours" },
  autre: { label: "Autre", short: "Autre" },
};

/** Note ramenée sur 20 — la seule valeur comparable d'une épreuve à l'autre. */
export function normalizedScore(grade: Grade): number {
  if (grade.maxScore <= 0) return 0;
  return (grade.score / grade.maxScore) * 20;
}

export interface NewGradeInput {
  subject: Subject;
  title: string;
  kind: GradeKind;
  date: string;
  score: number;
  maxScore: number;
}

export function createGrade(input: NewGradeInput, now: Date = new Date()): Grade {
  const maxScore = input.maxScore > 0 ? input.maxScore : 20;
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    title: input.title.trim(),
    kind: input.kind,
    date: input.date,
    score: Math.max(0, Math.min(maxScore, input.score)),
    maxScore,
    createdAt: now.toISOString(),
  };
}

/** Une note SE SUPPRIME (on saisit 14 au lieu de 4) — voir `localData.saveGrades`, qui remplace au lieu de fusionner, exactement comme les chapitres. */
export function removeGrade(grades: Grade[], id: string): Grade[] {
  return grades.filter((grade) => grade.id !== id);
}

/** De la plus ancienne à la plus récente — l'ordre d'une courbe. */
export function sortedByDate(grades: Grade[]): Grade[] {
  return [...grades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export interface GradeStats {
  count: number;
  /** Moyenne SIMPLE, ramenée sur 20 — `null` s'il n'y a aucune note. */
  average: number | null;
  best: Grade | null;
  worst: Grade | null;
  /** Dernière note dans l'ordre chronologique. */
  latest: Grade | null;
}

export function computeGradeStats(grades: Grade[]): GradeStats {
  if (grades.length === 0) return { count: 0, average: null, best: null, worst: null, latest: null };
  const sorted = sortedByDate(grades);
  const normalized = grades.map(normalizedScore);
  const byScore = [...grades].sort((a, b) => normalizedScore(b) - normalizedScore(a));
  return {
    count: grades.length,
    average: Math.round((normalized.reduce((sum, value) => sum + value, 0) / normalized.length) * 10) / 10,
    best: byScore[0],
    worst: byScore[byScore.length - 1],
    latest: sorted[sorted.length - 1],
  };
}

export interface GradeTrend {
  grades: Grade[];
  trend: Trend;
  stats: GradeStats;
}

/**
 * Évolution des notes, éventuellement filtrée sur une matière.
 *
 * `subject` à `null` mélange les matières — utile pour « ma moyenne générale
 * monte-t-elle », trompeur pour « est-ce que je progresse en physique ».
 * L'interface propose donc le filtre, et n'affiche jamais cinq courbes
 * simultanées : elles deviendraient illisibles avant d'être informatives.
 */
export function computeGradeTrend(grades: Grade[], subject: Subject | null = null): GradeTrend {
  const scoped = sortedByDate(subject ? grades.filter((grade) => grade.subject === subject) : grades);
  return {
    grades: scoped,
    // Bruit absolu d'un demi-point sur 20 : en relatif, un écart de 5 %
    // vaudrait 0,5 point à 10/20 mais 0,9 à 18/20, alors qu'un demi-point
    // est un demi-point partout.
    trend: // Un 0/20 est un RÉSULTAT, pas une absence de note — voir `zeroIsMeasurement`.
    computeTrend(scoped.map(normalizedScore), { absoluteNoise: 0.5, zeroIsMeasurement: true }),
    stats: computeGradeStats(scoped),
  };
}

/** Matières pour lesquelles au moins une note existe — ce que le filtre doit proposer, et rien d'autre. */
export function gradedSubjects(grades: Grade[]): Subject[] {
  const seen: Subject[] = [];
  for (const grade of sortedByDate(grades)) if (!seen.includes(grade.subject)) seen.push(grade.subject);
  return seen;
}

/** Moyenne formatée à la française — « 12,1 », jamais « 12.1 ». Les entiers restent entiers : « 14 », pas « 14,0 ». */
export function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

/** Note formatée telle qu'elle a été saisie — « 14/20 », « 11,5/20 », « 17/40 ». Jamais la valeur normalisée, qui n'a pas été vécue. */
export function formatGrade(grade: Grade): string {
  const score = Number.isInteger(grade.score) ? String(grade.score) : grade.score.toFixed(1).replace(".", ",");
  return `${score}/${grade.maxScore}`;
}
