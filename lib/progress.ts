import { exerciseStatuses, masteryLevels, subjects } from "@/lib/study";
import type { Exercise, ExerciseStatus, Mastery, Subject } from "@/lib/supabase/types";

/**
 * Statistiques de progression — Sprint 3B.
 *
 * Toute la logique d'agrégation "où en est l'élève" vit ici, dans ce seul
 * module — Dashboard et Progression n'en sont que des vues. Complémentaire
 * de lib/recommendation.ts (qui répond à "quel exercice proposer") : ce
 * fichier répond à "où en est l'élève, globalement et par matière", sans
 * dupliquer ses critères (voir `isNeverWorked`, réutilisé tel quel).
 *
 * Aucune de ces fonctions ne prend `WorkSession[]` : la progression telle que
 * définie ici (statut, maîtrise) ne dépend que de `Exercise`. Le temps investi
 * dans le temps reste la responsabilité de lib/gamification.ts (heatmap,
 * streak) — pas dupliqué ici non plus.
 */

export interface GlobalProgress {
  activeCount: number;
  masteredCount: number;
  inProgressCount: number;
  toReviewCount: number;
  todoCount: number;
  /** Part des exercices actifs maîtrisés, arrondie à l'entier (0 si aucun exercice actif). */
  completionRate: number;
}

/** Vue d'ensemble : compte les exercices actifs par statut et en dérive un taux de complétion global. */
export function computeGlobalProgress(exercises: Exercise[]): GlobalProgress {
  const activeCount = exercises.filter((exercise) => !exercise.archived).length;
  const buckets = statusDistribution(exercises);
  const countFor = (status: ExerciseStatus) => buckets.find((bucket) => bucket.status === status)?.count ?? 0;
  const masteredCount = countFor("maîtrisé");

  return {
    activeCount,
    masteredCount,
    inProgressCount: countFor("en cours"),
    toReviewCount: countFor("à revoir"),
    todoCount: countFor("à faire"),
    completionRate: activeCount ? Math.round((masteredCount / activeCount) * 100) : 0,
  };
}

export interface SubjectProgress {
  subject: Subject;
  /** Nombre d'exercices actifs (non archivés) pour cette matière. */
  total: number;
  mastered: number;
  /** 0 si `total` est nul — évite une division par zéro côté appelant. */
  completionRate: number;
}

/**
 * Progression par matière, dans l'ordre de `lib/study.ts#subjects`.
 * Source unique pour le Dashboard ET la page Progression (avant le Sprint
 * 3B, ce calcul était dupliqué dans les deux composants).
 */
export function computeProgressBySubject(exercises: Exercise[]): SubjectProgress[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  return subjects.map((subject) => {
    const subjectExercises = active.filter((exercise) => exercise.subject === subject);
    const mastered = subjectExercises.filter((exercise) => exercise.status === "maîtrisé").length;
    return {
      subject,
      total: subjectExercises.length,
      mastered,
      completionRate: subjectExercises.length ? Math.round((mastered / subjectExercises.length) * 100) : 0,
    };
  });
}

export interface MasteryBucket {
  mastery: Mastery;
  count: number;
  /** 0 si aucun exercice actif — évite une division par zéro côté appelant. */
  percentage: number;
}

/** Répartition des exercices actifs par palier de maîtrise, dans l'ordre de `lib/study.ts#masteryLevels`. */
export function masteryDistribution(exercises: Exercise[]): MasteryBucket[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  return masteryLevels.map((mastery) => {
    const count = active.filter((exercise) => exercise.mastery === mastery).length;
    return { mastery, count, percentage: active.length ? Math.round((count / active.length) * 100) : 0 };
  });
}

export interface StatusBucket {
  status: ExerciseStatus;
  count: number;
  /** 0 si aucun exercice actif — évite une division par zéro côté appelant. */
  percentage: number;
}

/** Répartition des exercices actifs par statut, dans l'ordre de `lib/study.ts#exerciseStatuses`. */
export function statusDistribution(exercises: Exercise[]): StatusBucket[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  return exerciseStatuses.map((status) => {
    const count = active.filter((exercise) => exercise.status === status).length;
    return { status, count, percentage: active.length ? Math.round((count / active.length) * 100) : 0 };
  });
}
