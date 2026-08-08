import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, ExerciseStatus, ExerciseType, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

export const subjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];
export const exerciseStatuses: ExerciseStatus[] = ["à faire", "en cours", "à revoir", "maîtrisé"];
export const exerciseTypes: ExerciseType[] = ["TD", "DM", "DS", "Colle", "TP", "Annale", "Concours", "Personnel"];
/** Paliers de maîtrise, dans l'ordre d'affichage — source unique pour toute UI qui énumère les paliers (voir lib/progress.ts). */
export const masteryLevels: Mastery[] = [0, 25, 50, 75, 100];

export const subjectMeta: Record<Subject, { short: string; className: string }> = {
  Mathématiques: { short: "M", className: "bg-violet-400/15 text-violet-200" },
  Physique: { short: "P", className: "bg-sky-400/15 text-sky-200" },
  Chimie: { short: "C", className: "bg-amber-400/15 text-amber-200" },
  "Informatique TC": { short: "IT", className: "bg-emerald-400/15 text-emerald-200" },
  "Informatique Spé": { short: "IS", className: "bg-teal-400/15 text-teal-200" },
  Français: { short: "F", className: "bg-orange-400/15 text-orange-200" },
  Anglais: { short: "A", className: "bg-rose-400/15 text-rose-200" },
};

/** Couleurs par statut, pour que le sélecteur de statut reste immédiatement lisible d'un coup d'œil (Sprint 2B). Purement visuel — n'affecte pas le modèle de données. */
export const statusMeta: Record<ExerciseStatus, { className: string }> = {
  "à faire": { className: "bg-white/[0.045] text-zinc-300" },
  "en cours": { className: "bg-sky-400/15 text-sky-200" },
  "à revoir": { className: "bg-amber-400/15 text-amber-200" },
  maîtrisé: { className: "bg-emerald-400/15 text-emerald-200" },
};

export function dayKey(value: string | Date) { return new Date(value).toLocaleDateString("en-CA"); }
/** Un exercice est considéré acquis une fois "maîtrisé" — "à revoir" reste actif (fondation pour un futur suivi de type révision). */
export function completedExercises(exercises: Exercise[]) { return exercises.filter((exercise) => exercise.status === "maîtrisé" && !exercise.archived); }
export function totalSeconds(sessions: WorkSession[]) { return sessions.reduce((total, session) => total + session.duration_seconds, 0); }

/**
 * Temps réellement passé par exercice, en MINUTES — dérivé des `WorkSession`
 * liées par `exercise_id` (Sprint 2.6, seule source de vérité). Calculé en
 * un seul passage sur `sessions` (pas un par exercice) : point de perf
 * important dès que la banque grossit, réutilisé pour l'affichage ET le tri
 * "temps passé" (voir lib/exercise-sort.ts).
 */
export function minutesByExerciseMap(sessions: WorkSession[]): Map<string, number> {
  const secondsById = new Map<string, number>();
  for (const session of sessions) {
    if (!session.exercise_id) continue;
    secondsById.set(session.exercise_id, (secondsById.get(session.exercise_id) ?? 0) + session.duration_seconds);
  }
  const minutesById = new Map<string, number>();
  for (const [id, seconds] of secondsById) minutesById.set(id, secondsToWholeMinutes(seconds));
  return minutesById;
}

/** Confort pour un usage ponctuel (hors liste) — voir `minutesByExerciseMap` pour le cas "plusieurs exercices à la fois", nettement plus efficace. */
export function minutesSpentOnExercise(exerciseId: string, sessions: WorkSession[]): number {
  return minutesByExerciseMap(sessions).get(exerciseId) ?? 0;
}
