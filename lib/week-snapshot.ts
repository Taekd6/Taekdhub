import { sessionsInWeek, startOfWeek } from "@/lib/week";
import { subjects, totalSeconds } from "@/lib/study";
import type { WeekSnapshot } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * Mémoire hebdomadaire du temps de travail (Sprint 5).
 *
 * Complémentaire de lib/week.ts (qui répond à "qu'a fait l'élève CETTE
 * semaine", toujours en direct) : ce module répond à "combien avait-il
 * travaillé la semaine dernière", en figeant une seule fois par semaine
 * écoulée un instantané (`WeekSnapshot`, voir lib/storage.ts) qui ne change
 * plus jamais ensuite.
 *
 * Volontairement PAS de rattrapage rétroactif de plusieurs semaines
 * manquées : seule la semaine immédiatement précédente est figée, la
 * première fois qu'une nouvelle semaine est détectée (voir
 * `findMissingSnapshotWeekStart`). Les semaines plus anciennes restent de
 * toute façon lisibles en direct depuis les séances (lib/tracking.ts).
 */

function previousWeekStart(now: Date): Date {
  const start = new Date(startOfWeek(now));
  start.setDate(start.getDate() - 7);
  return start;
}

/**
 * Semaine à figer, ou `null` si rien n'est à faire — soit parce que la
 * semaine précédente a déjà un snapshot (jamais de doublon), soit parce
 * qu'aucune activité n'existait avant la semaine en cours (rien à figer :
 * pas de semaine précédente réelle à mesurer, voir la note "commence à
 * mesurer" côté UI).
 */
export function findMissingSnapshotWeekStart(
  sessions: WorkSession[],
  snapshots: WeekSnapshot[],
  now: Date = new Date()
): Date | null {
  const currentWeekStart = startOfWeek(now);
  const target = previousWeekStart(now);
  const targetIso = target.toISOString();

  if (snapshots.some((snapshot) => snapshot.weekStart === targetIso)) return null;

  const hadActivityBeforeThisWeek = sessions.some((session) => new Date(session.started_at) < currentWeekStart);
  return hadActivityBeforeThisWeek ? target : null;
}

/** Fige le temps réellement investi durant la semaine `weekStart`, au total et par matière — ne modifie jamais `sessions`, fonction pure. */
export function captureWeekSnapshot(sessions: WorkSession[], weekStart: Date, now: Date = new Date()): WeekSnapshot {
  const weekSessions = sessionsInWeek(sessions, weekStart);

  return {
    weekStart: weekStart.toISOString(),
    capturedAt: now.toISOString(),
    totalSeconds: totalSeconds(weekSessions),
    bySubject: subjects.map((subject) => ({ subject, seconds: totalSeconds(weekSessions.filter((session) => session.subject === subject)) })),
  };
}

/** Snapshot de la semaine immédiatement précédente, ou `null` si elle n'a jamais été figée (voir `findMissingSnapshotWeekStart`). */
export function findPreviousWeekSnapshot(snapshots: WeekSnapshot[], now: Date = new Date()): WeekSnapshot | null {
  const targetIso = previousWeekStart(now).toISOString();
  return snapshots.find((snapshot) => snapshot.weekStart === targetIso) ?? null;
}

export interface WeekComparison {
  previous: WeekSnapshot;
  currentTotalSeconds: number;
  deltaTotalSeconds: number;
}

/** Compare le temps de la semaine EN COURS au dernier `WeekSnapshot` figé. Fonction pure. */
export function compareToPreviousWeek(sessions: WorkSession[], previous: WeekSnapshot, now: Date = new Date()): WeekComparison {
  const currentTotalSeconds = totalSeconds(sessionsInWeek(sessions, startOfWeek(now)));
  return { previous, currentTotalSeconds, deltaTotalSeconds: currentTotalSeconds - previous.totalSeconds };
}
