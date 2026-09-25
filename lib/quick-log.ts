import { dayKey, subjects } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SAISIE RAPIDE — le temps de travail qu'aucun chronomètre n'a vu.
 *
 * Jusqu'ici, une minute n'existait pour TaekdHub que si le chrono tournait.
 * Or une bonne part du travail réel se fait sans lui : les cartes Anki dans
 * le métro, la relecture du cours le soir sur un coin de table. Ces minutes
 * manquaient partout — objectif du jour, bilan de la semaine, répartition par
 * matière — et l'anglais, travaillé tous les jours, paraissait abandonné.
 *
 * On ne crée PAS de nouveau type de donnée : une saisie rapide est une
 * `WorkSession` ordinaire, marquée par sa note. Toutes les agrégations
 * existantes (lib/tracking.ts, lib/analytics/work-time.ts, lib/week.ts) la
 * comptent donc sans une ligne de plus, et la sauvegarde JSON la transporte
 * telle quelle.
 *
 * Ce qu'on ne compte PAS : les heures de cours en classe. La capacité
 * (lib/capacity.ts) est définie « cours, colles et trajets déduits » —
 * TaekdHub mesure le travail PERSONNEL. Compter la classe gonflerait les
 * chiffres sans une minute de travail en plus.
 *
 * Fonctions pures : aucune dépendance à localStorage, React ou au DOM.
 */

/** Marqueur des séances saisies à la main — c'est lui qui les distingue d'une séance chronométrée. */
export const QUICK_LOG_NOTE = "Saisie rapide";

/** Les durées qu'on tape le plus : un seul geste pour 90 % des saisies. */
export const QUICK_LOG_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

/** Au-delà, ce n'est plus une saisie rapide mais une erreur de frappe (« 300 » pour « 30 »). */
export const QUICK_LOG_MAX_MINUTES = 240;

export type QuickLogDay = "aujourd'hui" | "hier";

export interface QuickLogInput {
  subject: Subject;
  minutes: number;
  day: QuickLogDay;
}

/** Durée saisie ramenée à un entier de minutes valide, ou `null` si elle n'a pas de sens. */
export function sanitizeMinutes(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const minutes = Math.round(value);
  if (minutes < 1 || minutes > QUICK_LOG_MAX_MINUTES) return null;
  return minutes;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Construit la séance correspondant à une saisie rapide.
 *
 * La séance est placée pour se TERMINER maintenant (ou à la même heure hier),
 * mais jamais à cheval sur minuit : 90 min saisies à 0 h 30 commencent à
 * minuit pile, pas la veille au soir. Sinon ces minutes compteraient pour le
 * jour précédent, et l'objectif du jour — la raison même de la saisie —
 * resterait à zéro.
 */
export function createQuickLogSession(input: QuickLogInput, now: Date = new Date()): WorkSession | null {
  const minutes = sanitizeMinutes(input.minutes);
  if (minutes === null) return null;

  const end = new Date(now);
  if (input.day === "hier") end.setDate(end.getDate() - 1);

  const dayStart = startOfDay(end);
  const start = new Date(Math.max(dayStart.getTime(), end.getTime() - minutes * 60_000));
  const finish = new Date(start.getTime() + minutes * 60_000);

  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    exercise_id: null,
    started_at: start.toISOString(),
    ended_at: finish.toISOString(),
    duration_seconds: minutes * 60,
    note: QUICK_LOG_NOTE,
    created_at: now.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

export function isQuickLog(session: WorkSession): boolean {
  return session.note === QUICK_LOG_NOTE;
}

/** Les saisies rapides d'aujourd'hui, la plus récente d'abord — ce que l'élève peut encore annuler d'un geste. */
export function todayQuickLogs(sessions: WorkSession[], now: Date = new Date()): WorkSession[] {
  const today = dayKey(now);
  return sessions
    .filter((session) => isQuickLog(session) && dayKey(session.created_at) === today)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Dernier choix de l'élève, relu depuis le stockage : une saisie quotidienne identique (Anki, 30 min) redevient un seul geste. */
export interface QuickLogMemory {
  subject: Subject;
  minutes: number;
}

export const QUICK_LOG_MEMORY_KEY = "prepahub:quick-log:last";

export function parseQuickLogMemory(raw: string | null): QuickLogMemory | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { subject, minutes } = value as Record<string, unknown>;
    if (!subjects.includes(subject as Subject)) return null;
    const clean = typeof minutes === "number" ? sanitizeMinutes(minutes) : null;
    if (clean === null) return null;
    return { subject: subject as Subject, minutes: clean };
  } catch {
    return null;
  }
}
