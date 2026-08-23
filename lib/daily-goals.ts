import { subjects, todaySessions } from "@/lib/study";
import { totalSeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Objectif du jour, au-delà du simple total en minutes (Sprint Study OS —
 * "Aujourd'hui"). `computeDailyObjective` (lib/next-action.ts) reste
 * l'UNIQUE source pour l'objectif global déjà affiché partout — ce module ne
 * fait qu'ajouter deux lectures optionnelles, PAR MATIÈRE et EN NOMBRE
 * D'EXERCICES, dérivées des mêmes `WorkSession` déjà existantes
 * (`Preferences.dailySubjectGoals`/`dailyExerciseGoal`, lib/storage.ts).
 * Aucun nouveau moteur de décision, aucune donnée inventée : un objectif
 * absent (matière sans valeur configurée, `dailyExerciseGoal` à `null`)
 * n'apparaît simplement pas dans le résultat plutôt que d'afficher un 0/0
 * qui laisserait croire à un objectif réel.
 *
 * "Exercices réalisés aujourd'hui" = nombre d'exercices DISTINCTS ayant au
 * moins une séance aujourd'hui (`WorkSession.exercise_id`) — la seule
 * définition honnête disponible avec les données existantes : on ne sait pas
 * si un exercice a été "terminé" à proprement parler (une séance peut être
 * interrompue), seulement qu'il a été travaillé.
 */

export interface DailySubjectGoalProgress {
  subject: Subject;
  goalMinutes: number;
  workedMinutes: number;
  met: boolean;
}

export interface DailyExerciseGoalProgress {
  goal: number;
  worked: number;
  met: boolean;
}

export interface DailyObjectiveBreakdown {
  /** Uniquement les matières avec un objectif réellement configuré (> 0) — jamais les 7 matières forcées à l'affichage. */
  bySubject: DailySubjectGoalProgress[];
  /** `null` si aucun objectif de nombre d'exercices n'est configuré. */
  exercises: DailyExerciseGoalProgress | null;
}

export function computeDailyObjectiveBreakdown(
  sessions: WorkSession[],
  dailySubjectGoals: Partial<Record<Subject, number>>,
  dailyExerciseGoal: number | null,
  now: Date = new Date()
): DailyObjectiveBreakdown {
  const today = todaySessions(sessions, now);

  const bySubject = subjects
    .filter((subject) => (dailySubjectGoals[subject] ?? 0) > 0)
    .map((subject) => {
      const goalMinutes = dailySubjectGoals[subject]!;
      const workedMinutes = secondsToWholeMinutes(totalSeconds(today.filter((session) => session.subject === subject)));
      return { subject, goalMinutes, workedMinutes, met: workedMinutes >= goalMinutes };
    });

  const workedExerciseCount = new Set(today.map((session) => session.exercise_id).filter((id): id is string => id !== null)).size;
  const exercises =
    dailyExerciseGoal && dailyExerciseGoal > 0
      ? { goal: dailyExerciseGoal, worked: workedExerciseCount, met: workedExerciseCount >= dailyExerciseGoal }
      : null;

  return { bySubject, exercises };
}
