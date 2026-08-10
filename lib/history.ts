import { startOfWeek } from "@/lib/week";
import { subjects, totalSeconds } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Historique exploitable (Sprint 3F) — filtre et agrège des `WorkSession`
 * déjà existantes, ne les modifie jamais.
 *
 * `periodStart` réutilise `startOfWeek` (lib/week.ts) pour "week" plutôt que
 * de redéfinir une borne lundi : une seule définition de "cette semaine"
 * dans tout le produit, comme déjà établi au Sprint 3E.
 */

export type HistoryPeriod = "week" | "month" | "all";

export const historyPeriodOptions: { value: HistoryPeriod; label: string }[] = [
  { value: "week", label: "Semaine en cours" },
  { value: "month", label: "Mois en cours" },
  { value: "all", label: "Tout" },
];

/** Début de la période demandée, ou `null` pour "all" (aucune borne). */
export function periodStart(period: HistoryPeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  if (period === "week") return startOfWeek(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  return start;
}

export interface HistoryFilters {
  subject: Subject | "Toutes";
  period: HistoryPeriod;
}

export const defaultHistoryFilters: HistoryFilters = { subject: "Toutes", period: "all" };

/** Filtre matière + période, combinables (ET logique) — même principe que lib/exercise-filters.ts#filterExercises. */
export function filterSessions(sessions: WorkSession[], filters: HistoryFilters, now: Date = new Date()): WorkSession[] {
  const start = periodStart(filters.period, now);
  return sessions
    .filter((session) => filters.subject === "Toutes" || session.subject === filters.subject)
    .filter((session) => !start || new Date(session.started_at) >= start);
}

export interface HistorySubjectTime {
  subject: Subject;
  seconds: number;
}

export interface HistorySummary {
  totalSeconds: number;
  sessionCount: number;
  /** Uniquement les matières avec du temps réel sur la période — pas de liste fixe à 7 entrées ici, contrairement à lib/week.ts#weeklyTimeBySubject (usage différent : agrégat d'une sélection déjà filtrée, pas un tableau de bord à position fixe). */
  bySubject: HistorySubjectTime[];
}

/** Agrégat sur un ensemble de séances déjà filtré (aucune borne temporelle recalculée ici). */
export function summarizeSessions(sessions: WorkSession[]): HistorySummary {
  const bySubject = subjects
    .map((subject) => ({ subject, seconds: totalSeconds(sessions.filter((session) => session.subject === subject)) }))
    .filter((entry) => entry.seconds > 0);

  return {
    totalSeconds: totalSeconds(sessions),
    sessionCount: sessions.length,
    bySubject,
  };
}

/** Séances liées à un exercice donné, la plus récente d'abord — pour le lien "exercice → historique" (ExerciseDetail). */
export function sessionsForExercise(sessions: WorkSession[], exerciseId: string): WorkSession[] {
  return sessions
    .filter((session) => session.exercise_id === exerciseId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

export interface ResultCounts {
  success: number;
  partial: number;
  failure: number;
  /** Séances sans résultat renseigné dans ce même ensemble — pas une erreur, juste non comptée dans `attempted`/`successRate`. */
  unrecorded: number;
  /** success + partial + failure — dénominateur de `successRate`, exclut `unrecorded`. */
  attempted: number;
  /** Pourcentage de réussites parmi les tentatives avec résultat, arrondi à l'entier — `null` si `attempted === 0` (rien à mesurer, pas 0%). */
  successRate: number | null;
}

/**
 * Compte les résultats (réussi/partiel/échoué) sur un ensemble de séances déjà
 * choisi par l'appelant — pas de filtre implicite ici (ni matière, ni
 * période, ni exercice) : `sessionsForExercise`, `filterSessions`, ou toute
 * autre sélection en amont. Une séance sans résultat (`result === null`,
 * séance libre ou antérieure à ce champ — voir `WorkSession.result`) compte
 * dans `unrecorded`, jamais dans `attempted` ni `successRate` : on ne devine
 * jamais un résultat manquant.
 */
export function resultCounts(sessions: WorkSession[]): ResultCounts {
  let success = 0;
  let partial = 0;
  let failure = 0;
  let unrecorded = 0;
  for (const session of sessions) {
    if (session.result === "réussi") success++;
    else if (session.result === "partiel") partial++;
    else if (session.result === "échoué") failure++;
    else unrecorded++;
  }
  const attempted = success + partial + failure;
  return {
    success,
    partial,
    failure,
    unrecorded,
    attempted,
    successRate: attempted > 0 ? Math.round((success / attempted) * 100) : null,
  };
}
