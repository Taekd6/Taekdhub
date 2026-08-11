import { computeProgressBySubject } from "@/lib/progress";
import { subjects, totalSeconds } from "@/lib/study";
import { minutesToSeconds } from "@/lib/utils";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Bilan hebdomadaire (Sprint 3E) — lundi 00:00 → maintenant.
 *
 * Seul module responsable de cette notion de "semaine" : `startOfWeek` est
 * la définition unique de la borne, réutilisée par dashboard-overview.tsx
 * pour son propre repère "Cette semaine" (avant ce sprint, cette borne était
 * calculée localement dans le composant, avec un bug — voir plus bas).
 *
 * Complémentaire de lib/progress.ts (qui répond à "où en est l'élève",
 * cumulatif) : ce module répond à "qu'a fait l'élève CETTE semaine". Aucune
 * duplication de `computeProgressBySubject` : la détection de matière
 * délaissée le réutilise directement pour savoir ce qui reste en attente.
 */

/**
 * Minuit du lundi de la semaine contenant `reference`. Corrige un bug
 * pré-existant (dashboard-overview.tsx avant Sprint 3E) : la borne gardait
 * l'heure courante plutôt que minuit, ce qui excluait à tort les séances du
 * lundi matin tant que l'heure du jour n'avait pas "rattrapé" celle de la
 * consultation.
 */
export function startOfWeek(reference: Date): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Bornes [début, fin) d'une semaine donnée par son lundi 00:00 — fin exclusive, toujours +7 jours. */
export function weekBounds(weekStart: Date): { start: Date; end: Date } {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return { start: weekStart, end };
}

/**
 * Séances dont `started_at` tombe dans une semaine donnée (bornes
 * `weekBounds`) — généralisation de "cette semaine" à une semaine
 * quelconque, notamment déjà écoulée (voir lib/week-snapshot.ts, qui fige
 * l'état d'une semaine passée une fois qu'elle est terminée).
 */
export function sessionsInWeek(sessions: WorkSession[], weekStart: Date): WorkSession[] {
  const { start, end } = weekBounds(weekStart);
  return sessions.filter((session) => {
    const startedAt = new Date(session.started_at);
    return startedAt >= start && startedAt < end;
  });
}

function sessionsThisWeek(sessions: WorkSession[], now: Date): WorkSession[] {
  return sessionsInWeek(sessions, startOfWeek(now));
}

export interface SubjectWeekTime {
  subject: Subject;
  seconds: number;
}

/** Temps investi durant une semaine donnée, par matière, dans l'ordre de lib/study.ts#subjects. */
export function timeBySubjectInWeek(sessions: WorkSession[], weekStart: Date): SubjectWeekTime[] {
  const weekSessions = sessionsInWeek(sessions, weekStart);
  return subjects.map((subject) => ({
    subject,
    seconds: totalSeconds(weekSessions.filter((session) => session.subject === subject)),
  }));
}

/** Temps investi cette semaine, par matière, dans l'ordre de lib/study.ts#subjects. */
export function weeklyTimeBySubject(sessions: WorkSession[], now: Date = new Date()): SubjectWeekTime[] {
  return timeBySubjectInWeek(sessions, startOfWeek(now));
}

export interface NeglectedSubject {
  subject: Subject;
  /** Exercices actifs non maîtrisés en attente dans cette matière — sert à trier et à justifier le signal auprès de l'utilisateur. */
  pendingCount: number;
}

/**
 * Matières "délaissées cette semaine" — critère volontairement strict et
 * explicable en une phrase, pas un score composite :
 *
 *   0 seconde investie cette semaine ET au moins un exercice actif non
 *   maîtrisé en attente dans cette matière.
 *
 * Une matière sans exercice, ou déjà entièrement maîtrisée, n'est jamais
 * signalée : un temps à 0 n'y a rien d'anormal à signaler (rien n'attend).
 *
 * N'évalue rien avant que 2 jours pleins se soient écoulés depuis lundi
 * (donc pas avant mercredi) : plus tôt dans la semaine, un temps à 0 est
 * normal pour toutes les matières et ne prouve rien — pas assez de données
 * pour conclure, plutôt que d'inventer un signal à partir de presque rien.
 */
export function neglectedSubjects(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): NeglectedSubject[] {
  const daysElapsed = Math.floor((now.getTime() - startOfWeek(now).getTime()) / 86400000);
  if (daysElapsed < 2) return [];

  const timeBySubject = weeklyTimeBySubject(sessions, now);
  const progress = computeProgressBySubject(exercises);

  return subjects
    .map((subject) => {
      const seconds = timeBySubject.find((entry) => entry.subject === subject)?.seconds ?? 0;
      const subjectProgress = progress.find((entry) => entry.subject === subject);
      const pendingCount = subjectProgress ? subjectProgress.total - subjectProgress.mastered : 0;
      return { subject, seconds, pendingCount };
    })
    .filter((entry) => entry.seconds === 0 && entry.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .map(({ subject, pendingCount }) => ({ subject, pendingCount }));
}

export interface WeeklySummary {
  totalSeconds: number;
  objectiveSeconds: number;
  /** 0-100, plafonné — même convention que `model.objective` dans dashboard-overview.tsx. */
  progressPercent: number;
  bySubject: SubjectWeekTime[];
  neglected: NeglectedSubject[];
}

/**
 * Bilan complet — point d'entrée unique consommé par le Dashboard. `totalSeconds`
 * est dérivé de `bySubject` (une seule somme des sessions de la semaine, pas
 * un second passage séparé) : aucune double logique de calcul du temps hebdomadaire.
 *
 * `weeklyGoalMinutes` (Sprint Plan de travail) : préférence indépendante
 * (voir `Preferences.weeklyGoalMinutes`, lib/storage.ts), plus jamais dérivée
 * de `dailyGoalMinutes * 7` — un objectif hebdomadaire a rarement un sens
 * comme simple multiple de l'objectif quotidien (rythme différent selon les
 * jours de la semaine).
 */
export function computeWeeklySummary(exercises: Exercise[], sessions: WorkSession[], weeklyGoalMinutes: number, now: Date = new Date()): WeeklySummary {
  const bySubject = weeklyTimeBySubject(sessions, now);
  const total = bySubject.reduce((sum, entry) => sum + entry.seconds, 0);
  const objectiveSeconds = minutesToSeconds(weeklyGoalMinutes);

  return {
    totalSeconds: total,
    objectiveSeconds,
    progressPercent: objectiveSeconds ? Math.min(100, Math.round((total / objectiveSeconds) * 100)) : 0,
    bySubject,
    neglected: neglectedSubjects(exercises, sessions, now),
  };
}
