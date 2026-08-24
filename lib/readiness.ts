import { computeProgressBySubject } from "@/lib/progress";
import { estimatedDurationMinutes, recommendExercises } from "@/lib/recommendation";
import { subjects } from "@/lib/study";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * "Prêt pour le DS ?" (Sprint 6) — regroupe par matière ce que le moteur de
 * recommandation (lib/recommendation.ts, seule source de vérité pour "quoi
 * travailler") a déjà signalé. Ce module n'évalue rien lui-même : il agrège
 * `recommendExercises` par matière, pour répondre à "suis-je prêt pour un DS
 * dans cette matière" sans dupliquer aucun critère.
 */

export type ReadinessLevel = "prêt" | "à consolider" | "pas prêt" | "pas commencé";

/**
 * Métadonnées d'affichage par niveau (libellé + variante de badge) — source
 * unique pour toute UI qui montre un niveau de préparation (page Progression
 * ET Dashboard), pour ne jamais laisser deux libellés diverger. Le style fin
 * (bordures/fonds) reste propre à chaque écran, ce champ ne fixe que le sens.
 */
export const READINESS_META: Record<ReadinessLevel, { label: string; badge: "success" | "warning" | "default" }> = {
  "prêt": { label: "Prêt", badge: "success" },
  "à consolider": { label: "À consolider", badge: "warning" },
  "pas prêt": { label: "Pas prêt", badge: "default" },
  "pas commencé": { label: "Pas encore commencé", badge: "default" },
};

export interface SubjectReadiness {
  subject: Subject;
  /** Exercices actifs de la matière. */
  total: number;
  completionRate: number;
  /** Nombre d'exercices de la matière actuellement signalés par `recommendExercises`. */
  flaggedCount: number;
  /** Somme de `estimatedDurationMinutes` (lib/recommendation.ts) sur les exercices signalés — même estimation que celle utilisée par la séance bornée par le temps, jamais recalculée différemment ici. */
  estimatedMinutes: number;
  level: ReadinessLevel;
}

/**
 * Critère volontairement simple et explicable, pas un score composite :
 * aucun exercice signalé → prêt ; sinon, une matière jamais engagée (voir
 * `hasEngagement`, même critère que `hasChapterEngagement` dans
 * lib/next-action.ts et `SubjectSignal.hasEngagement` dans lib/plan.ts) →
 * "pas commencé", distinct de "pas prêt" — sans cette distinction, une
 * matière simplement jamais entamée (100% "à faire" par défaut, donc
 * mécaniquement 0% de complétion) ressort identique à une matière où
 * l'élève échoue réellement, avec le même ton d'alarme (fond rose) alors
 * qu'il n'y a, pour l'instant, tout simplement rien à évaluer. En dessous de
 * 50% de complétion pour une matière déjà engagée → pas prêt ; au-dessus →
 * à consolider.
 */
function readinessLevel(flaggedCount: number, completionRate: number, hasEngagement: boolean): ReadinessLevel {
  if (flaggedCount === 0) return "prêt";
  if (!hasEngagement) return "pas commencé";
  return completionRate >= 50 ? "à consolider" : "pas prêt";
}

/** Au moins un exercice de la matière a déjà été engagé — même critère que `hasChapterEngagement` (lib/next-action.ts) et `SubjectSignal.hasEngagement` (lib/plan.ts), jamais un quatrième calcul de la même notion. */
function hasSubjectEngagement(subjectExercises: Exercise[]): boolean {
  return subjectExercises.some((exercise) => exercise.attempts > 0 || exercise.status !== "à faire" || exercise.last_worked_at !== null);
}

/** Uniquement les matières avec au moins un exercice actif — une matière vide n'a rien à évaluer. */
export function computeReadinessBySubject(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): SubjectReadiness[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  const progress = computeProgressBySubject(exercises);
  const flagged = recommendExercises(exercises, sessions, exercises.length, { now });

  const flaggedBySubject = new Map<Subject, { count: number; minutes: number }>();
  for (const { exercise } of flagged) {
    const entry = flaggedBySubject.get(exercise.subject) ?? { count: 0, minutes: 0 };
    entry.count += 1;
    entry.minutes += estimatedDurationMinutes(exercise, sessions);
    flaggedBySubject.set(exercise.subject, entry);
  }

  return subjects
    .map((subject) => {
      const entry = progress.find((item) => item.subject === subject);
      const total = entry?.total ?? 0;
      const completionRate = entry?.completionRate ?? 0;
      const flaggedEntry = flaggedBySubject.get(subject);
      const engaged = hasSubjectEngagement(active.filter((exercise) => exercise.subject === subject));
      return {
        subject,
        total,
        completionRate,
        flaggedCount: flaggedEntry?.count ?? 0,
        estimatedMinutes: flaggedEntry?.minutes ?? 0,
        level: readinessLevel(flaggedEntry?.count ?? 0, completionRate, engaged),
      };
    })
    .filter((entry) => entry.total > 0);
}
