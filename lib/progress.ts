import { exerciseStatuses, masteryLevels, subjects } from "@/lib/study";
import type { Chapter } from "@/lib/storage";
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
  /** Moyenne de `Exercise.mastery` (0-100) sur les exercices actifs de la matière, arrondie à l'entier — même calcul que `computeExerciseBankStats` (lib/recommendation.ts), à l'échelle de la matière. 0 si `total` est nul. */
  averageMastery: number;
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
      averageMastery: subjectExercises.length
        ? Math.round(subjectExercises.reduce((sum, exercise) => sum + exercise.mastery, 0) / subjectExercises.length)
        : 0,
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

/**
 * Un exercice sur lequel l'élève est déjà réellement intervenu — tenté
 * (`attempts > 0`), sorti de "à faire", ou déjà travaillé en focus
 * (`last_worked_at`). Prédicat UNIQUE, jusqu'ici recopié à l'identique dans
 * `lib/next-action.ts` (`hasChapterEngagement`) et `lib/readiness.ts`
 * (`hasSubjectEngagement`) — les trois commentaires se renvoyaient déjà l'un
 * à l'autre en affirmant "même critère, jamais un second calcul", sans que
 * ce soit vrai en pratique. Centralisé ici (le module le plus bas de cette
 * chaîne d'imports) pour que ce soit enfin le cas.
 */
export function isExerciseEngaged(exercise: Exercise): boolean {
  return exercise.attempts > 0 || exercise.status !== "à faire" || exercise.last_worked_at !== null;
}

export interface ChapterProgress {
  chapter: Chapter;
  total: number;
  mastered: number;
  /** 0 si `total` est nul — évite une division par zéro côté appelant. */
  completionRate: number;
  /** Moyenne de `Exercise.mastery` (0-100) sur les exercices actifs du chapitre, arrondie à l'entier — même calcul que `computeExerciseBankStats` (lib/recommendation.ts), à l'échelle du chapitre. 0 si `total` est nul. */
  averageMastery: number;
  /** Nombre d'exercices du chapitre réellement engagés (voir `isExerciseEngaged`) — distinct de `mastered` : un exercice tenté et raté compte ici, pas dans `mastered`. */
  workedCount: number;
  /** Le plus récent `Exercise.last_worked_at` du chapitre — `null` si aucun exercice n'a jamais été travaillé en focus. */
  lastWorkedAt: string | null;
  /** Plus haute `Exercise.difficulty` (1-5) parmi les exercices déjà maîtrisés du chapitre — `null` tant qu'aucun n'est maîtrisé : "jusqu'où" l'élève est vraiment allé, pas seulement "combien". */
  maxDifficultyMastered: number | null;
  /**
   * Prochain exercice à travailler dans ce chapitre — le premier non
   * maîtrisé, sinon le premier tout court (même règle que
   * `computeChaptersToConsolidate`, lib/next-action.ts, qui la reprend
   * désormais d'ici plutôt que de la recalculer). `null` si le chapitre est
   * vide (ne devrait pas arriver, `progressByChapter` filtre déjà `total > 0`).
   */
  nextExerciseId: string | null;
}

/**
 * Progression par chapitre (Sprint 3D, enrichi pour la vue Chapitres) —
 * uniquement les chapitres qui ont au moins un exercice actif assigné : un
 * chapitre créé mais encore vide n'a rien à montrer ici (pas de bruit
 * administratif sur la page Progression). Triés par nombre d'exercices
 * décroissant.
 */
export function progressByChapter(exercises: Exercise[], chapters: Chapter[]): ChapterProgress[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  return chapters
    .map((chapter) => {
      const chapterExercises = active.filter((exercise) => exercise.chapter_id === chapter.id);
      const mastered = chapterExercises.filter((exercise) => exercise.status === "maîtrisé").length;
      const lastWorkedTimestamps = chapterExercises
        .map((exercise) => exercise.last_worked_at)
        .filter((value): value is string => value !== null);
      const masteredDifficulties = chapterExercises.filter((exercise) => exercise.status === "maîtrisé").map((exercise) => exercise.difficulty);
      const nextExercise = chapterExercises.find((exercise) => exercise.status !== "maîtrisé") ?? chapterExercises[0];
      return {
        chapter,
        total: chapterExercises.length,
        mastered,
        completionRate: chapterExercises.length ? Math.round((mastered / chapterExercises.length) * 100) : 0,
        averageMastery: chapterExercises.length
          ? Math.round(chapterExercises.reduce((sum, exercise) => sum + exercise.mastery, 0) / chapterExercises.length)
          : 0,
        workedCount: chapterExercises.filter(isExerciseEngaged).length,
        lastWorkedAt: lastWorkedTimestamps.length
          ? new Date(Math.max(...lastWorkedTimestamps.map((value) => new Date(value).getTime()))).toISOString()
          : null,
        maxDifficultyMastered: masteredDifficulties.length ? Math.max(...masteredDifficulties) : null,
        nextExerciseId: nextExercise?.id ?? null,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);
}
