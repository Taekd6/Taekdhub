import type { Exercise, WorkSession } from "@/lib/supabase/types";
const sessionsKey = "prepahub:sessions"; const exercisesKey = "prepahub:exercises";
export const localData = {
  sessions: (): WorkSession[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(sessionsKey) || "[]"),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(exercisesKey) || "[]"),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
};
