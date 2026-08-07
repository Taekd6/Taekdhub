import type { Exercise, ExerciseStatus, Subject, WorkSession } from "@/lib/supabase/types";

export const subjects: Subject[] = ["Mathématiques", "Physique", "Informatique", "Français", "Anglais"];
export const exerciseStatuses: ExerciseStatus[] = ["à faire", "en cours", "terminé"];

export const subjectMeta: Record<Subject, { short: string; className: string }> = {
  Mathématiques: { short: "M", className: "bg-violet-400/15 text-violet-200" },
  Physique: { short: "P", className: "bg-sky-400/15 text-sky-200" },
  Informatique: { short: "I", className: "bg-emerald-400/15 text-emerald-200" },
  Français: { short: "F", className: "bg-orange-400/15 text-orange-200" },
  Anglais: { short: "A", className: "bg-rose-400/15 text-rose-200" },
};

export function dayKey(value: string | Date) { return new Date(value).toLocaleDateString("en-CA"); }
export function completedExercises(exercises: Exercise[]) { return exercises.filter((exercise) => exercise.status === "terminé" && !exercise.archived); }
export function totalSeconds(sessions: WorkSession[]) { return sessions.reduce((total, session) => total + session.duration_seconds, 0); }
