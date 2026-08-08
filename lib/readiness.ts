import { computeProgressBySubject } from "@/lib/progress";
import { recommendExercises } from "@/lib/recommendation";
import { subjects } from "@/lib/study";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * "Prêt pour le DS ?" (Sprint 6) — regroupe par matière ce que le moteur de
 * recommandation (lib/recommendation.ts, seule source de vérité pour "quoi
 * travailler") a déjà signalé. Ce module n'évalue rien lui-même : il agrège
 * `recommendExercises` par matière, pour répondre à "suis-je prêt pour un DS
 * dans cette matière" sans dupliquer aucun critère.
 */

export type ReadinessLevel = "prêt" | "à consolider" | "pas prêt";

export interface SubjectReadiness {
  subject: Subject;
  /** Exercices actifs de la matière. */
  total: number;
  completionRate: number;
  /** Nombre d'exercices de la matière actuellement signalés par `recommendExercises`. */
  flaggedCount: number;
  level: ReadinessLevel;
}

/**
 * Critère volontairement simple et explicable, pas un score composite :
 * aucun exercice signalé → prêt ; sinon, au moins la moitié de la matière
 * déjà maîtrisée → à consolider ; en dessous → pas prêt.
 */
function readinessLevel(flaggedCount: number, completionRate: number): ReadinessLevel {
  if (flaggedCount === 0) return "prêt";
  return completionRate >= 50 ? "à consolider" : "pas prêt";
}

/** Uniquement les matières avec au moins un exercice actif — une matière vide n'a rien à évaluer. */
export function computeReadinessBySubject(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): SubjectReadiness[] {
  const progress = computeProgressBySubject(exercises);
  const flagged = recommendExercises(exercises, sessions, exercises.length, { now });

  const flaggedCountBySubject = new Map<Subject, number>();
  for (const { exercise } of flagged) {
    flaggedCountBySubject.set(exercise.subject, (flaggedCountBySubject.get(exercise.subject) ?? 0) + 1);
  }

  return subjects
    .map((subject) => {
      const entry = progress.find((item) => item.subject === subject);
      const total = entry?.total ?? 0;
      const completionRate = entry?.completionRate ?? 0;
      const flaggedCount = flaggedCountBySubject.get(subject) ?? 0;
      return { subject, total, completionRate, flaggedCount, level: readinessLevel(flaggedCount, completionRate) };
    })
    .filter((entry) => entry.total > 0);
}
