import { courseLocks, lockSentence } from "@/lib/course-lock";
import { eveningPlan } from "@/lib/evening-minimums";
import { dueReviewItems } from "@/lib/spaced-repetition";
import { dayKey } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";
import { activeWorkItems, daysUntilDue, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";
import type { Preferences, ReviewItem, WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * LES ALERTES — « tu n'as pas fait X », « urgent : Y ».
 *
 * Ce module DÉCIDE ce qui mérite d'interrompre l'élève ; il n'affiche rien.
 * Deux lecteurs : la bannière animée de l'application
 * (components/alerts/alert-center.tsx) et les notifications iPhone envoyées
 * par le serveur (app/api/push/cron/route.ts). Les deux disent donc
 * exactement la même chose.
 *
 * PEU, ET VRAI. Une alerte qui sonne pour rien apprend à ignorer toutes les
 * autres. Chaque règle ne se déclenche que sur un FAIT saisi par l'élève, et
 * se tait d'elle-même dès qu'il est réglé :
 *
 *   urgent     échéance à rendre aujourd'hui ou demain avec du travail
 *              restant ; échéance dépassée ; chapitre verrouillé dont les
 *              fiches sont à retrouver aujourd'hui (lib/course-lock.ts) ;
 *   attention  minimum du soir pas atteint, à partir de 18 h ; rien noté de
 *              la journée, à partir de 17 h ;
 *   info       des fiches « À revoir » arrivées à échéance.
 *
 * L'identifiant d'une alerte contient le JOUR : « Plus tard » la fait taire
 * pour la journée, et elle revient le lendemain si le problème demeure.
 *
 * Pur : aucune dépendance au stockage, à React ou au réseau.
 */

export type AlertLevel = "urgent" | "attention" | "info";

export interface AppAlert {
  /** Stable sur la journée : `<règle>:<objet>:<jour>`. */
  id: string;
  level: AlertLevel;
  title: string;
  body: string;
  /** Où mène le bouton. */
  href: string;
  /** Le texte du bouton : un verbe. */
  action: string;
}

export interface AlertInput {
  sessions: WorkSession[];
  workItems: WorkItem[];
  reviewItems: ReviewItem[];
  preferences: Preferences;
  now: Date;
}

/** À partir de quelle heure le minimum du soir non atteint devient une alerte. */
export const EVENING_ALERT_HOUR = 18;
/** À partir de quelle heure « rien noté aujourd'hui » devient une alerte. */
export const IDLE_ALERT_HOUR = 17;

const LEVEL_RANK: Record<AlertLevel, number> = { urgent: 0, attention: 1, info: 2 };

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function deadlineAlerts(input: AlertInput, today: string): AppAlert[] {
  const out: AppAlert[] = [];
  for (const item of activeWorkItems(input.workItems)) {
    const days = daysUntilDue(item, input.now);
    if (days === null || days > 1) continue;
    const left = remainingMinutes(item, input.sessions);
    if (left <= 0) continue;
    const kind = WORK_ITEM_KIND_META[item.kind].label;
    const when = days < 0 ? `en retard de ${plural(-days, "jour")}` : days === 0 ? "à rendre aujourd'hui" : "à rendre demain";
    out.push({
      id: `echeance:${item.id}:${today}`,
      level: "urgent",
      title: `${item.title} — ${when}`,
      body: `${kind} : il reste environ ${formatMinutesSpan(left)} de travail. ${days < 0 ? "Termine-le ou repousse-le, mais décide." : "C'est la priorité de la journée."}`,
      href: item.subject ? `/timer?matiere=${encodeURIComponent(item.subject)}` : "/timer",
      action: "Lancer le chrono",
    });
  }
  return out;
}

function lockAlerts(input: AlertInput, today: string): AppAlert[] {
  return courseLocks(input.reviewItems, input.now)
    .filter((lock) => lock.reviewableToday > 0)
    .map((lock) => ({
      id: `verrou:${lock.key}:${today}`,
      level: "urgent" as const,
      title: `Chapitre verrouillé : ${lock.chapter}`,
      body: `${lockSentence(lock)}. Retrouve-les de tête pour pouvoir avancer.`,
      href: `/revoir/session?subject=${encodeURIComponent(lock.subject)}`,
      action: "Retrouver les fiches",
    }));
}

function eveningAlert(input: AlertInput, today: string): AppAlert | null {
  if (input.now.getHours() < EVENING_ALERT_HOUR) return null;
  const plan = eveningPlan(input.preferences, input.sessions, input.now);
  const missing = plan.entries.filter((entry) => !entry.met);
  if (missing.length === 0) return null;
  const lines = missing.map((entry) => `${entry.subject} : ${formatMinutesSpan(entry.minMinutes - entry.doneMinutes)}`);
  return {
    id: `soir:${today}`,
    level: "attention",
    title: "Minimum du soir pas encore atteint",
    body: `Il manque ${lines.join(", ")}.`,
    href: `/timer?matiere=${encodeURIComponent(missing[0].subject)}`,
    action: "Lancer le chrono",
  };
}

function idleAlert(input: AlertInput, today: string): AppAlert | null {
  if (input.now.getHours() < IDLE_ALERT_HOUR) return null;
  // Un nouvel inscrit sans aucune séance n'a pas « oublié » : il n'a pas encore commencé.
  if (input.sessions.length === 0) return null;
  if (input.sessions.some((session) => dayKey(session.started_at) === today)) return null;
  return {
    id: `rien:${today}`,
    level: "attention",
    title: "Rien de noté aujourd'hui",
    body: "Même 25 minutes comptent. Lance le chrono, ou note le temps déjà fait.",
    href: "/dashboard",
    action: "Voir quoi faire",
  };
}

function reviewAlert(input: AlertInput, today: string): AppAlert | null {
  // Les fiches du verrou ont leur propre alerte.
  const due = dueReviewItems(input.reviewItems, input.now).filter((item) => item.origin !== "claude");
  if (due.length === 0) return null;
  return {
    id: `revoir:${today}`,
    level: "info",
    title: `${plural(due.length, "fiche")} à revoir`,
    body: `Environ ${formatMinutesSpan(Math.max(2, due.length * 2))}. Cherche chaque réponse de tête avant de la retourner.`,
    href: "/revoir/session",
    action: "Réviser",
  };
}

/** Les alertes du moment, la plus importante d'abord. */
export function computeAlerts(input: AlertInput): AppAlert[] {
  const today = dayKey(input.now);
  const alerts = [
    ...deadlineAlerts(input, today),
    ...lockAlerts(input, today),
    eveningAlert(input, today),
    idleAlert(input, today),
    reviewAlert(input, today),
  ].filter((alert): alert is AppAlert => alert !== null);
  return alerts.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

/* ── « Plus tard » ─────────────────────────────────────────────────── */

/** Une alerte « urgente » écartée revient après ce délai ; les autres se taisent jusqu'au lendemain (leur identifiant change). */
export const URGENT_SNOOZE_HOURS = 2;

export type SnoozeMap = Record<string, string>;

/** Écarte une alerte : retient le moment, pour savoir quand la reproposer. */
export function snoozeAlert(map: SnoozeMap, alert: AppAlert, now: Date): SnoozeMap {
  return { ...map, [alert.id]: now.toISOString() };
}

export function visibleAlerts(alerts: AppAlert[], map: SnoozeMap, now: Date): AppAlert[] {
  return alerts.filter((alert) => {
    const at = map[alert.id];
    if (!at) return true;
    if (alert.level !== "urgent") return false;
    return now.getTime() - new Date(at).getTime() >= URGENT_SNOOZE_HOURS * 3_600_000;
  });
}

/** Ne garde que les écarts du jour : la table ne grossit jamais. */
export function pruneSnoozes(map: SnoozeMap, now: Date): SnoozeMap {
  const today = dayKey(now);
  return Object.fromEntries(Object.entries(map).filter(([id]) => id.endsWith(`:${today}`)));
}
