import { computeGlobalProgress, computeProgressBySubject } from "@/lib/progress";
import { sessionsInWeek, startOfWeek, timeBySubjectInWeek } from "@/lib/week";
import { subjects, totalSeconds } from "@/lib/study";
import type { WeekSnapshot } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Mémoire hebdomadaire de la progression (Sprint 5).
 *
 * Complémentaire de lib/week.ts (qui répond à "qu'a fait l'élève CETTE
 * semaine", toujours en direct) et de lib/progress.ts (l'état ACTUEL de la
 * banque) : ce module répond à "où en était l'élève la semaine dernière",
 * en figeant une seule fois par semaine écoulée un instantané (`WeekSnapshot`,
 * voir lib/storage.ts) qui ne change plus jamais ensuite.
 *
 * Volontairement PAS de rattrapage rétroactif de plusieurs semaines
 * manquées : seule la semaine immédiatement précédente est figée, la
 * première fois qu'une nouvelle semaine est détectée (voir
 * `findMissingSnapshotWeekStart`). La maîtrise n'étant pas elle-même
 * historisée, tenter de reconstituer un état plus ancien que ça reviendrait
 * à inventer une donnée plutôt qu'à la mesurer.
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
  exercises: Exercise[],
  sessions: WorkSession[],
  snapshots: WeekSnapshot[],
  now: Date = new Date()
): Date | null {
  const currentWeekStart = startOfWeek(now);
  const target = previousWeekStart(now);
  const targetIso = target.toISOString();

  if (snapshots.some((snapshot) => snapshot.weekStart === targetIso)) return null;

  const hadActivityBeforeThisWeek =
    sessions.some((session) => new Date(session.started_at) < currentWeekStart) ||
    exercises.some((exercise) => new Date(exercise.created_at) < currentWeekStart);
  return hadActivityBeforeThisWeek ? target : null;
}

/** Fige l'état réel de `weekStart` (temps investi cette semaine-là, progression actuelle) — ne modifie jamais `exercises`/`sessions`, fonction pure. */
export function captureWeekSnapshot(exercises: Exercise[], sessions: WorkSession[], weekStart: Date, now: Date = new Date()): WeekSnapshot {
  const weekSessions = sessionsInWeek(sessions, weekStart);
  const progress = computeGlobalProgress(exercises);
  const bySubjectProgress = computeProgressBySubject(exercises);

  return {
    weekStart: weekStart.toISOString(),
    capturedAt: now.toISOString(),
    totalSeconds: totalSeconds(weekSessions),
    bySubject: subjects.map((subject) => ({ subject, seconds: totalSeconds(weekSessions.filter((session) => session.subject === subject)) })),
    activeCount: progress.activeCount,
    masteredCount: progress.masteredCount,
    completionRate: progress.completionRate,
    bySubjectProgress: bySubjectProgress.map(({ subject, total, mastered, completionRate }) => ({ subject, total, mastered, completionRate })),
  };
}

/** Snapshot de la semaine immédiatement précédente, ou `null` si elle n'a jamais été figée (voir `findMissingSnapshotWeekStart`). */
export function findPreviousWeekSnapshot(snapshots: WeekSnapshot[], now: Date = new Date()): WeekSnapshot | null {
  const targetIso = previousWeekStart(now).toISOString();
  return snapshots.find((snapshot) => snapshot.weekStart === targetIso) ?? null;
}

export interface SubjectMasteryDelta {
  subject: Subject;
  previousCompletionRate: number;
  currentCompletionRate: number;
  deltaCompletionRate: number;
}

export interface SubjectTimeDelta {
  subject: Subject;
  previousSeconds: number;
  currentSeconds: number;
  deltaSeconds: number;
}

export interface WeekComparison {
  previous: WeekSnapshot;
  currentTotalSeconds: number;
  currentMasteredCount: number;
  currentCompletionRate: number;
  deltaTotalSeconds: number;
  deltaMasteredCount: number;
  deltaCompletionRate: number;
  /** Matière avec la plus forte progression de maîtrise depuis la semaine précédente — `null` si aucune matière n'a progressé. */
  mostImprovedSubject: SubjectMasteryDelta | null;
  /**
   * Matière la moins travaillée cette semaine, parmi celles qui ont encore
   * des exercices actifs non maîtrisés en attente — pas une "régression" au
   * sens strict (la maîtrise ne diminue jamais toute seule dans ce modèle,
   * décision Sprint 2.5), mais le signal le plus proche et le plus
   * actionnable disponible avec les données existantes (même logique que
   * lib/week.ts#neglectedSubjects). `null` si aucune matière active n'a
   * d'exercice en attente.
   */
  mostNeglectedSubject: SubjectTimeDelta | null;
}

/** Compare l'état ACTUEL (exercices + séances de la semaine en cours) au dernier `WeekSnapshot` figé. Fonction pure. */
export function compareToPreviousWeek(exercises: Exercise[], sessions: WorkSession[], previous: WeekSnapshot, now: Date = new Date()): WeekComparison {
  const currentWeekStart = startOfWeek(now);
  const currentSubjectSeconds = timeBySubjectInWeek(sessions, currentWeekStart);
  const currentTotalSeconds = totalSeconds(sessionsInWeek(sessions, currentWeekStart));
  const currentProgress = computeGlobalProgress(exercises);
  const currentBySubject = computeProgressBySubject(exercises);

  const masteryDeltas: SubjectMasteryDelta[] = subjects.map((subject) => {
    const previousRate = previous.bySubjectProgress.find((entry) => entry.subject === subject)?.completionRate ?? 0;
    const currentRate = currentBySubject.find((entry) => entry.subject === subject)?.completionRate ?? 0;
    return { subject, previousCompletionRate: previousRate, currentCompletionRate: currentRate, deltaCompletionRate: currentRate - previousRate };
  });
  const mostImprovedSubject = masteryDeltas.filter((delta) => delta.deltaCompletionRate > 0).sort((a, b) => b.deltaCompletionRate - a.deltaCompletionRate)[0] ?? null;

  const timeDeltas: SubjectTimeDelta[] = subjects.map((subject) => {
    const previousSecondsValue = previous.bySubject.find((entry) => entry.subject === subject)?.seconds ?? 0;
    const currentSecondsValue = currentSubjectSeconds.find((entry) => entry.subject === subject)?.seconds ?? 0;
    return { subject, previousSeconds: previousSecondsValue, currentSeconds: currentSecondsValue, deltaSeconds: currentSecondsValue - previousSecondsValue };
  });
  const pendingSubjects = new Set(currentBySubject.filter((entry) => entry.total - entry.mastered > 0).map((entry) => entry.subject));
  const mostNeglectedSubject =
    timeDeltas
      .filter((delta) => pendingSubjects.has(delta.subject))
      .sort((a, b) => a.currentSeconds - b.currentSeconds || a.deltaSeconds - b.deltaSeconds)[0] ?? null;

  return {
    previous,
    currentTotalSeconds,
    currentMasteredCount: currentProgress.masteredCount,
    currentCompletionRate: currentProgress.completionRate,
    deltaTotalSeconds: currentTotalSeconds - previous.totalSeconds,
    deltaMasteredCount: currentProgress.masteredCount - previous.masteredCount,
    deltaCompletionRate: currentProgress.completionRate - previous.completionRate,
    mostImprovedSubject,
    mostNeglectedSubject,
  };
}
