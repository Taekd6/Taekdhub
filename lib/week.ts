import { subjects, totalSeconds } from "@/lib/study";
import { minutesToSeconds } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Bilan hebdomadaire (Sprint 3E) — lundi 00:00 → maintenant.
 *
 * Seul module responsable de cette notion de "semaine" : `startOfWeek` est
 * la définition unique de la borne, réutilisée par dashboard-overview.tsx
 * pour son propre repère "Cette semaine" (avant ce sprint, cette borne était
 * calculée localement dans le composant, avec un bug — voir plus bas).
 *
 * Ce module répond à "qu'a fait l'élève CETTE semaine", à partir des seules
 * séances.
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
export function sessionsInWeek(sessions: WorkSession[], weekStart: Date, now: Date = new Date()): WorkSession[] {
  const { start, end } = weekBounds(weekStart);
  return sessions.filter((session) => {
    const startedAt = new Date(session.started_at);
    /*
     * BORNE HAUTE À MAINTENANT, en plus de la fin de semaine.
     *
     * Une séance datée DANS LE FUTUR (horloge décalée, sauvegarde importée
     * depuis un appareil en avance, fuseau) était comptée ici mais pas par
     * `computeWeeklyReview` ni `computeWeeklyComparison`, qui filtrent tous
     * deux à `<= now`. Le même fait s'affichait donc avec deux valeurs :
     * « 5 h 30 cette semaine » sur l'accueil, « 1 h 30 » sur Progression, et
     * « 100 % de l'objectif » contre « 30 % ». Le filtre appartient à la
     * définition de « cette semaine », pas à chacun de ses appelants.
     *
     * Sans effet sur une semaine déjà écoulée (lib/week-snapshot.ts) : sa
     * borne de fin est alors antérieure à `now`.
     */
    return startedAt >= start && startedAt < end && startedAt <= now;
  });
}

export interface SubjectWeekTime {
  subject: Subject;
  seconds: number;
}

/** Temps investi durant une semaine donnée, par matière, dans l'ordre de lib/study.ts#subjects. */
export function timeBySubjectInWeek(sessions: WorkSession[], weekStart: Date, now: Date = new Date()): SubjectWeekTime[] {
  const weekSessions = sessionsInWeek(sessions, weekStart, now);
  return subjects.map((subject) => ({
    subject,
    seconds: totalSeconds(weekSessions.filter((session) => session.subject === subject)),
  }));
}

/** Temps investi cette semaine, par matière, dans l'ordre de lib/study.ts#subjects. */
export function weeklyTimeBySubject(sessions: WorkSession[], now: Date = new Date()): SubjectWeekTime[] {
  return timeBySubjectInWeek(sessions, startOfWeek(now), now);
}

export interface WeeklySummary {
  totalSeconds: number;
  objectiveSeconds: number;
  /** 0-100, plafonné — même convention que `model.objective` dans dashboard-overview.tsx. */
  progressPercent: number;
  bySubject: SubjectWeekTime[];
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
export function computeWeeklySummary(sessions: WorkSession[], weeklyGoalMinutes: number, now: Date = new Date()): WeeklySummary {
  const bySubject = weeklyTimeBySubject(sessions, now);
  const total = bySubject.reduce((sum, entry) => sum + entry.seconds, 0);
  const objectiveSeconds = minutesToSeconds(weeklyGoalMinutes);

  return {
    totalSeconds: total,
    objectiveSeconds,
    progressPercent: objectiveSeconds ? Math.min(100, Math.round((total / objectiveSeconds) * 100)) : 0,
    bySubject,
  };
}
