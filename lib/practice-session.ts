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

/**
 * Les séances d'une khôlle : UNE PAR CHAPITRE (donc par matière), mises bout
 * à bout jusqu'à `end`. `chapterId` est un identifiant du PROGRAMME
 * (lib/programme-data.ts) — `WorkSession.chapter_id` peut porter l'un ou
 * l'autre, voir `chapterWorkIndex` (lib/programme.ts). Un chapitre interrogé
 * moins d'une minute au total ne laisse pas de séance.
 */
export function khollePracticeSessions(entries: ReadonlyArray<{ subject: Subject; chapterId: string; seconds: number }>, end: Date): WorkSession[] {
  const byChapter = new Map<string, { subject: Subject; seconds: number }>();
  for (const entry of entries) {
    const current = byChapter.get(entry.chapterId);
    byChapter.set(entry.chapterId, { subject: entry.subject, seconds: (current?.seconds ?? 0) + entry.seconds });
  }
  const sessions: WorkSession[] = [];
  let cursor = end.getTime();
  for (const [chapterId, { subject, seconds }] of byChapter) {
    const session = createPracticeSession({ subject, startedAt: new Date(cursor - seconds * 1000), endedAt: new Date(cursor), note: "Khôlle", chapterId }, end);
    if (session) sessions.push(session);
    cursor -= seconds * 1000;
  }
  return sessions;
}
