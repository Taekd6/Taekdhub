import type { Exercise, WorkSession } from "@/lib/supabase/types";
const sessionsKey = "prepahub:sessions"; const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";
export type Preferences = { displayName: string; dailyGoalMinutes: number; contestDate: string };
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 240, contestDate: "" };
export const localData = {
  sessions: (): WorkSession[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(sessionsKey) || "[]"),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(exercisesKey) || "[]"),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
  preferences: (): Preferences => typeof window === "undefined" ? defaults : { ...defaults, ...JSON.parse(localStorage.getItem(preferencesKey) || "{}") },
  savePreferences: (preferences: Preferences) => localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
};
