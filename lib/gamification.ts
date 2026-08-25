import { completedExercises, dayKey } from "@/lib/study";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * XP — ce que TaekdHub choisit de récompenser.
 *
 * L'ancienne formule accordait `minutes × 5` à TOUTE séance, quel qu'en soit
 * le résultat. Elle récompensait donc le temps passé devant l'application,
 * pas le travail accompli : laisser le chrono tourner sans rien résoudre
 * rapportait strictement autant que résoudre — davantage, même, puisqu'il
 * suffisait de durer. Sur un outil de prépa, c'est exactement l'habitude à
 * ne pas encourager, et c'est ce qui rendait la mécanique décorative : elle
 * montait toute seule et ne disait donc rien.
 *
 * La composante temps est supprimée. L'XP ne récompense plus que ce qui
 * prouve un apprentissage — et pondère par la difficulté, pour que monter
 * de palier rapporte réellement plus que rester en terrain connu.
 */

/** Un exercice porté jusqu'à "maîtrisé" — l'accomplissement le plus fort, seul état durable. */
export function xpFromExercise(exercise: Exercise): number {
  if (exercise.status !== "maîtrisé" || exercise.archived) return 0;
  return exercise.difficulty * 25;
}

/**
 * XP d'une tentative, à partir de son résultat réel.
 *
 * Une réussite obtenue avec plusieurs indices vaut MOINS qu'une réussite
 * autonome : c'est une vraie progression, mais pas la même preuve — et
 * c'est exactement la distinction qu'utilise déjà le moteur de
 * recommandation (voir `ASSISTED_HINTS_THRESHOLD`, lib/recommendation.ts).
 * Les deux systèmes récompensent donc la même chose, au lieu de se
 * contredire.
 *
 * Un échec ne rapporte rien mais ne retire rien : se tromper fait partie du
 * travail, le produit n'a pas à le sanctionner.
 *
 * Une séance sans résultat renseigné (séance libre du chronomètre, ou
 * antérieure au suivi des résultats) vaut 0 : on ne sait pas ce qui s'y est
 * passé, on ne crédite donc rien.
 */
export function xpFromSession(session: WorkSession, difficulty = 3): number {
  if (session.result === "réussi") {
    const assisted = session.hints_used !== null && session.hints_used >= 2;
    return difficulty * (assisted ? 5 : 10);
  }
  if (session.result === "partiel") return difficulty * 3;
  return 0;
}

export function totalXp(exercises: Exercise[], sessions: WorkSession[]): number {
  const difficultyById = new Map(exercises.map((exercise) => [exercise.id, exercise.difficulty]));
  const exerciseXp = completedExercises(exercises).reduce((sum, e) => sum + xpFromExercise(e), 0);
  const sessionXp = sessions.reduce(
    (sum, session) => sum + xpFromSession(session, session.exercise_id ? difficultyById.get(session.exercise_id) : undefined),
    0
  );
  return exerciseXp + sessionXp;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 100;
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; percent: number } {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return { current, needed, percent: Math.min(100, Math.round((current / needed) * 100)) };
}

export function computeStreak(sessions: WorkSession[]): number {
  const workByDay = sessions.reduce<Record<string, number>>((result, session) => {
    const key = dayKey(session.started_at);
    return { ...result, [key]: (result[key] || 0) + session.duration_seconds };
  }, {});

  let streak = 0;
  const cursor = new Date();
  while (workByDay[dayKey(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function workByDayMap(sessions: WorkSession[]): Record<string, number> {
  return sessions.reduce<Record<string, number>>((result, session) => {
    const key = dayKey(session.started_at);
    return { ...result, [key]: (result[key] || 0) + session.duration_seconds };
  }, {});
}

export function lastNDays(n: number): Date[] {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (n - 1 - index));
    return date;
  });
}
