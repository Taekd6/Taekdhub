import { completedExercises, dayKey } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

export function xpFromExercise(exercise: Exercise): number {
  if (exercise.status !== "maîtrisé" || exercise.archived) return 0;
  return exercise.difficulty * 25;
}

export function xpFromSession(session: WorkSession): number {
  return secondsToWholeMinutes(session.duration_seconds) * 5;
}

export function totalXp(exercises: Exercise[], sessions: WorkSession[]): number {
  const exerciseXp = completedExercises(exercises).reduce((sum, e) => sum + xpFromExercise(e), 0);
  const sessionXp = sessions.reduce((sum, s) => sum + xpFromSession(s), 0);
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

/**
 * Série de jours consécutifs travaillés, en comptant jusqu'à AUJOURD'HUI si
 * une séance y a déjà eu lieu, sinon jusqu'à HIER — la journée en cours
 * n'étant pas terminée, l'absence de séance aujourd'hui ne doit jamais, à
 * elle seule, remettre la série à 0 : un utilisateur qui a travaillé 14
 * jours d'affilée et ouvre le Dashboard le matin, avant sa séance du jour,
 * doit voir "14 j de suite" (série toujours active), pas "0" (série rompue
 * à tort). La série n'est réellement rompue que si ni aujourd'hui NI hier
 * n'ont de séance.
 */
export function computeStreak(sessions: WorkSession[], now: Date = new Date()): number {
  const workByDay = workByDayMap(sessions);
  const cursor = new Date(now);
  if (!workByDay[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
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
