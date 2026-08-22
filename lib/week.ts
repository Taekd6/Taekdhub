import { computeProgressBySubject } from "@/lib/progress";
import { dayKey, subjects, totalSeconds } from "@/lib/study";
import { minutesToSeconds, secondsToWholeMinutes } from "@/lib/utils";
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

export type WeeklyPace = "en avance" | "dans le rythme" | "à travailler";

/**
 * État du rythme hebdomadaire — compare la progression réelle à ce qui est
 * "normal" pour le jour de la semaine actuel (ex. mercredi soir = ~3/7 de la
 * semaine écoulée, donc ~43% de l'objectif est un rythme normal, pas un
 * retard). Seuil de ±15 points volontairement large : évite de signaler "à
 * travailler" pour un simple décalage d'un jour, qui n'a rien d'anormal.
 *
 * `null` avant mercredi (< 2 jours écoulés depuis lundi) — même garde que
 * `neglectedSubjects` ci-dessus : trop tôt dans la semaine pour qu'un écart
 * signifie quoi que ce soit, plutôt que d'inventer un jugement prématuré.
 *
 * Volontairement pas de version "objectif du jour" équivalente (Dashboard) :
 * une journée n'a pas de repère horaire fiable dans les données disponibles
 * (on ne sait pas à quelle heure l'utilisateur compte travailler), donc tout
 * seuil serait arbitraire et risquerait un message culpabilisant à tort
 * (ex. "en retard" à 9h du matin). L'objectif du jour garde son message
 * binaire existant (atteint / reste X min).
 */
function computeWeeklyPace(progressPercent: number, daysElapsed: number): WeeklyPace | null {
  if (daysElapsed < 2) return null;
  const expectedPercent = Math.min(100, Math.round((Math.min(daysElapsed, 7) / 7) * 100));
  const delta = progressPercent - expectedPercent;
  if (delta >= 15) return "en avance";
  if (delta <= -15) return "à travailler";
  return "dans le rythme";
}

export interface WeeklySummary {
  totalSeconds: number;
  objectiveSeconds: number;
  /** 0-100, plafonné — même convention que `model.objective` dans dashboard-overview.tsx. */
  progressPercent: number;
  bySubject: SubjectWeekTime[];
  neglected: NeglectedSubject[];
  /** `null` tant qu'il est trop tôt dans la semaine pour juger (voir `computeWeeklyPace`). */
  pace: WeeklyPace | null;
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
  // Le temps total de la semaine reste calculé sur TOUTES les matières (y
  // compris une matière sans exercice actif aujourd'hui mais qui aurait
  // quand même une séance enregistrée — cas archive/suppression) : seul
  // l'AFFICHAGE par matière (`bySubject` du résultat) doit être restreint
  // aux matières qui ont réellement du contenu, pas le total.
  const allBySubject = weeklyTimeBySubject(sessions, now);
  const total = allBySubject.reduce((sum, entry) => sum + entry.seconds, 0);
  // Filtre sur le CONTENU réel de la banque (`computeProgressBySubject`,
  // déjà filtré), jamais sur `seconds > 0` : une matière avec des exercices
  // mais 0 minute cette semaine doit rester visible (rien à signaler de
  // spécial), seule une matière sans aucun exercice ne doit jamais
  // apparaître ici.
  const subjectsWithContent = new Set(computeProgressBySubject(exercises).map((entry) => entry.subject));
  const bySubject = allBySubject.filter((entry) => subjectsWithContent.has(entry.subject));
  const objectiveSeconds = minutesToSeconds(weeklyGoalMinutes);
  const progressPercent = objectiveSeconds ? Math.min(100, Math.round((total / objectiveSeconds) * 100)) : 0;
  const daysElapsed = Math.floor((now.getTime() - startOfWeek(now).getTime()) / 86400000);

  return {
    totalSeconds: total,
    objectiveSeconds,
    progressPercent,
    bySubject,
    neglected: neglectedSubjects(exercises, sessions, now),
    pace: computeWeeklyPace(progressPercent, daysElapsed),
  };
}

export interface WeeklyDayBar {
  /** Jour civil local (lib/study.ts#dayKey) — même convention que le reste de l'app, pas un jour UTC. */
  dayKey: string;
  /** Libellé court à 3 lettres pour l'affichage compact — Lun/Mar/Mer/Jeu/Ven/Sam/Dim, dans cet ordre. */
  label: string;
  minutes: number;
  isToday: boolean;
  /** Jour pas encore atteint dans la semaine — jamais de jugement porté dessus (voir `met`). */
  isFuture: boolean;
  /** Objectif quotidien atteint ce jour-là — toujours faux pour un jour futur (0 minute travaillée n'y est pas un manquement). */
  met: boolean;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Vue "Lun → Dim" de la semaine en cours (Sprint Study OS — "Est-ce que je
 * travaille vraiment toutes mes matières ?" généralisé à "est-ce que je
 * travaille régulièrement ?"). Un seul passage sur `sessions` par jour,
 * regroupées par `dayKey` — même découpage que `groupSessionsByDay`
 * (lib/history.ts), mais sur les 7 jours de la semaine CIVILE (lundi →
 * dimanche, voir `startOfWeek`) plutôt que les jours les plus récents.
 *
 * Volontairement indépendant de `computeWeeklySummary` ci-dessus : aucun
 * nouveau total, seulement la RÉPARTITION jour par jour d'un temps déjà
 * comptabilisé ailleurs.
 */
export function computeWeeklyDayBars(sessions: WorkSession[], dailyGoalMinutes: number, now: Date = new Date()): WeeklyDayBar[] {
  const monday = startOfWeek(now);
  const todayKey = dayKey(now);
  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    const key = dayKey(date);
    const minutes = secondsToWholeMinutes(totalSeconds(sessions.filter((session) => dayKey(session.started_at) === key)));
    return {
      dayKey: key,
      label,
      minutes,
      isToday: key === todayKey,
      isFuture: key > todayKey,
      met: dailyGoalMinutes > 0 && minutes >= dailyGoalMinutes,
    };
  });
}
