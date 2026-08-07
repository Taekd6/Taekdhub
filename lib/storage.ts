import type { Exercise, WorkSession } from "@/lib/supabase/types";
const sessionsKey = "prepahub:sessions"; const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";
export type Preferences = { displayName: string; dailyGoalMinutes: number; contestDate: string };
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 240, contestDate: "" };
export const localData = {
  sessions: (): WorkSession[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(sessionsKey) || "[]"),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(exercisesKey) || "[]").map((item: Exercise) => ({ ...item, tags: item.tags || [], favorite: item.favorite || false, archived: item.archived || false, hints: item.hints || [], correction: item.correction || null, last_opened_at: item.last_opened_at || null })),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
  preferences: (): Preferences => typeof window === "undefined" ? defaults : { ...defaults, ...JSON.parse(localStorage.getItem(preferencesKey) || "{}") },
  savePreferences: (preferences: Preferences) => localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
};
