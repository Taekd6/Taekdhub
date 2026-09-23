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

/* ── NOTES EN ATTENTE (calibration) ──────────────────────────────────
 *
 * Depuis la calibration (lib/calibration.ts), une note peut exister AVANT
 * d'être connue : l'élève sort du DS, saisit ce qu'il pense avoir, et
 * complète la vraie note le jour où la copie est rendue. Entre-temps
 * `score` vaut `null`.
 *
 * RÈGLE UNIQUE : tout agrégat (moyenne, meilleure/pire note, courbe,
 * tendance, matières notées) ne voit QUE les notes connues. Le filtre
 * `isScored` est appliqué à l'entrée de chaque fonction publique de ce
 * fichier — plutôt qu'à chaque appelant — pour qu'aucun écran ne puisse
 * l'oublier : une note en attente comptée pour 0 ferait chuter une moyenne
 * de plusieurs points sur une simple prédiction.
 */

/** Une note dont le résultat est connu — la seule qui se moyenne. */
export type ScoredGrade = Grade & { score: number };

export function isScored(grade: Grade): grade is ScoredGrade {
  return typeof grade.score === "number" && Number.isFinite(grade.score);
}

/** Note en attente : prédiction saisie, résultat pas encore rendu. */
export function isPending(grade: Grade): boolean {
  return !isScored(grade);
}

/** Note ramenée sur 20 — la seule valeur comparable d'une épreuve à l'autre. */
export function normalizedScore(grade: ScoredGrade): number {
  if (grade.maxScore <= 0) return 0;
  return (grade.score / grade.maxScore) * 20;
}

export interface NewGradeInput {
  subject: Subject;
  title: string;
  kind: GradeKind;
  date: string;
  /** `null` = note en attente — il faut alors une prédiction. */
  score: number | null;
  maxScore: number;
  /** Ce que l'élève pense avoir, sur le même barème. Facultatif. */
  predictedScore?: number | null;
}

function clampToScale(value: number, maxScore: number): number {
  return Math.max(0, Math.min(maxScore, value));
}

/**
 * Crée une note, connue ou en attente.
 *
 * Une note SANS résultat NI prédiction ne mesure rien : elle est refusée
 * (`null`), comme `normalizeGrade` l'écarterait à la relecture.
 */
export function createGrade(input: NewGradeInput, now: Date = new Date()): Grade | null {
  const maxScore = input.maxScore > 0 ? input.maxScore : 20;
  const score = typeof input.score === "number" && Number.isFinite(input.score) ? clampToScale(input.score, maxScore) : null;
  const predicted =
    typeof input.predictedScore === "number" && Number.isFinite(input.predictedScore) ? clampToScale(input.predictedScore, maxScore) : null;
  if (score === null && predicted === null) return null;
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    title: input.title.trim(),
    kind: input.kind,
    date: input.date,
    score,
    maxScore,
    ...(predicted !== null ? { predictedScore: predicted } : {}),
    createdAt: now.toISOString(),
  };
}

/**
 * Complète une note en attente avec le résultat rendu — la prédiction, elle,
 * n'est JAMAIS réécrite : c'est tout l'intérêt de l'avoir saisie avant.
 */
export function resolveGrade(grades: Grade[], id: string, score: number): Grade[] {
  if (!Number.isFinite(score)) return grades;
  return grades.map((grade) => (grade.id === id ? { ...grade, score: clampToScale(score, grade.maxScore) } : grade));
}

/** Une note SE SUPPRIME (on saisit 14 au lieu de 4) — voir `localData.saveGrades`, qui remplace au lieu de fusionner, exactement comme les chapitres. */
export function removeGrade(grades: Grade[], id: string): Grade[] {
  return grades.filter((grade) => grade.id !== id);
}

/** De la plus ancienne à la plus récente — l'ordre d'une courbe. */
export function sortedByDate<T extends Grade>(grades: T[]): T[] {
  return [...grades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export interface GradeStats {
  count: number;
  /** Moyenne SIMPLE, ramenée sur 20 — `null` s'il n'y a aucune note. */
  average: number | null;
  best: ScoredGrade | null;
  worst: ScoredGrade | null;
  /** Dernière note dans l'ordre chronologique. */
  latest: ScoredGrade | null;
}

/** Les notes en attente sont IGNORÉES — voir `isScored`. */
export function computeGradeStats(all: Grade[]): GradeStats {
  const grades = all.filter(isScored);
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
  /** Notes CONNUES uniquement — voir `isScored`. */
  grades: ScoredGrade[];
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
  const known = grades.filter(isScored);
  const scoped = sortedByDate(subject ? known.filter((grade) => grade.subject === subject) : known);
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

/** Matières pour lesquelles au moins une note CONNUE existe — ce que le filtre doit proposer, et rien d'autre. */
export function gradedSubjects(grades: Grade[]): Subject[] {
  const seen: Subject[] = [];
  for (const grade of sortedByDate(grades.filter(isScored))) if (!seen.includes(grade.subject)) seen.push(grade.subject);
  return seen;
}

/** Moyenne formatée à la française — « 12,1 », jamais « 12.1 ». Les entiers restent entiers : « 14 », pas « 14,0 ». */
export function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

/**
 * Note formatée telle qu'elle a été saisie — « 14/20 », « 11,5/20 », « 17/40 ». Jamais la valeur normalisée, qui n'a pas été vécue.
 * Note en attente : « ?/20 » — jamais « 0/20 », qui serait un résultat.
 */
export function formatGrade(grade: Grade): string {
  return `${grade.score === null ? "?" : formatPoints(grade.score)}/${grade.maxScore}`;
}

/** Prédiction formatée sur le barème de l'épreuve — « 13/20 », ou `null` sans prédiction. */
export function formatPrediction(grade: Grade): string | null {
  if (typeof grade.predictedScore !== "number") return null;
  return `${formatPoints(grade.predictedScore)}/${grade.maxScore}`;
}
