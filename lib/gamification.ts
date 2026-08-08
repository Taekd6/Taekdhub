import { completedExercises, dayKey, totalSeconds } from "@/lib/study";
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
