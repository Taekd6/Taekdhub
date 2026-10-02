import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Une SÉANCE issue d'un entraînement (khôlle, épreuve blanche) : le temps
 * passé compte comme n'importe quelle séance chronométrée — objectif du
 * jour, budget de la matière, série. La note dit d'où elle vient.
 *
 * Moins d'une minute : pas de séance (un tirage annulé n'est pas du travail).
 */
export function createPracticeSession(
  input: { subject: Subject; startedAt: Date; endedAt: Date; note: string; chapterId?: string | null },
  now: Date = new Date()
): WorkSession | null {
  const seconds = Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return null;
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    exercise_id: null,
    started_at: input.startedAt.toISOString(),
    ended_at: input.endedAt.toISOString(),
    duration_seconds: seconds,
    note: input.note,
    created_at: now.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: null,
    ...(input.chapterId ? { chapter_id: input.chapterId } : {}),
  };
}
