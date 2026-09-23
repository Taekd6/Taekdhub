import { computeWorkTimeSeries } from "@/lib/analytics/work-time";
import { dayKey } from "@/lib/study";
import { CHECKIN_SLEEP_MAX, CHECKIN_SLEEP_MIN, type DailyCheckin } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * CHECK-IN DU SOIR — modèle pur et constats.
 *
 * La persistance vit dans lib/storage.ts (`DailyCheckin`), la réactivité
 * dans hooks/use-prepahub-data.ts — même contrat que lib/grades.ts.
 *
 * CE QUE LE CHECK-IN PERMET, ET CE QU'IL NE PERMET PAS.
 *
 * Le sommeil participe à la consolidation de ce qu'on a appris (Walker &
 * Stickgold, 2006 ; Diekelmann & Born, 2010), et le simple fait de noter
 * son état chaque jour — l'auto-observation — aide à voir ce qu'on ne voit
 * pas au jour le jour. C'est tout ce que ce module suppose.
 *
 * Il NE prétend PAS mesurer l'effet du sommeil sur le travail. Il
 * rapproche deux séries saisies par l'élève et DÉCRIT ce qu'on y observe,
 * sur SES données, sans jamais employer un mot de cause : un jour de DS,
 * un week-end, une semaine de vacances pèsent sur les deux séries à la fois,
 * et aucun de ces facteurs n'est mesuré ici.
 *
 * Le temps de travail n'est PAS recompté ici : il vient de
 * lib/analytics/work-time.ts#computeWorkTimeSeries, la seule définition
 * d'une « minute travaillée » de l'application.
 */

/** Heure (locale) à partir de laquelle le Dashboard propose le check-in du jour. */
export const CHECKIN_PROMPT_HOUR = 17;

/**
 * Nombre minimal de jours appariés (sommeil connu ET journée de travail
 * observée) avant d'énoncer le moindre constat. En dessous, un écart de
 * moyennes entre deux petits groupes dépend surtout de deux ou trois jours
 * particuliers — le montrer serait présenter du bruit comme une tendance.
 */
export const SLEEP_RELATION_MIN_DAYS = 14;

/** Seuil qui partage les nuits en deux groupes — 7 h, borne basse usuelle des recommandations pour un jeune adulte. */
export const SLEEP_THRESHOLD_HOURS = 7;

/** Il faut au moins ce nombre de jours DANS CHAQUE groupe, sinon la comparaison oppose 13 jours à 1. */
const SLEEP_GROUP_MIN_DAYS = 4;

/** En deçà de cet écart (minutes), on dit « à peu près autant » plutôt que de gonfler une différence insignifiante. */
const SLEEP_GAP_NEGLIGIBLE_MINUTES = 5;

export interface CheckinInput {
  sleepHours: number;
  energy: number;
  stress: number;
  note?: string | null;
}

/** Ramène le sommeil saisi au pas d'une demi-heure, dans les bornes. */
export function clampSleep(hours: number): number {
  if (!Number.isFinite(hours)) return CHECKIN_SLEEP_MIN;
  return Math.max(CHECKIN_SLEEP_MIN, Math.min(CHECKIN_SLEEP_MAX, Math.round(hours * 2) / 2));
}

function clampScale(value: number): number {
  return Math.max(1, Math.min(5, Math.round(Number.isFinite(value) ? value : 3)));
}

/**
 * Enregistre le check-in du jour `now` — ou le CORRIGE s'il existe déjà.
 *
 * Un seul check-in par jour calendaire : la clé est la date, pas un
 * identifiant. Renvoie la nouvelle liste, triée par jour croissant.
 */
export function upsertCheckin(checkins: DailyCheckin[], input: CheckinInput, now: Date = new Date()): DailyCheckin[] {
  const date = dayKey(now);
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 140) : null;
  const entry: DailyCheckin = {
    date,
    sleepHours: clampSleep(input.sleepHours),
    energy: clampScale(input.energy),
    stress: clampScale(input.stress),
    note,
    updatedAt: now.toISOString(),
  };
  return [...checkins.filter((item) => item.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

export function checkinForDay(checkins: DailyCheckin[], day: string): DailyCheckin | null {
  return checkins.find((item) => item.date === day) ?? null;
}

/** Le Dashboard propose-t-il le check-in ? Seulement le soir, et seulement s'il n'est pas déjà fait. */
export function shouldPromptCheckin(checkins: DailyCheckin[], now: Date = new Date()): boolean {
  if (now.getHours() < CHECKIN_PROMPT_HOUR) return false;
  return checkinForDay(checkins, dayKey(now)) === null;
}

/* ── MOYENNES ─────────────────────────────────────────────────────── */

export interface CheckinAverages {
  /** Fenêtre demandée, en jours (aujourd'hui inclus). */
  days: number;
  /** Check-ins réellement saisis dans la fenêtre — une moyenne sur 2 jours sur 30 doit le dire. */
  count: number;
  sleepHours: number | null;
  energy: number | null;
  stress: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number | null, decimals: number): number | null {
  const factor = 10 ** decimals;
  return value === null ? null : Math.round(value * factor) / factor;
}

function shiftDay(now: Date, offset: number): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
  return dayKey(date);
}

/**
 * Moyennes sur les `days` derniers jours, aujourd'hui inclus. Les jours SANS
 * check-in sont absents du calcul — jamais comptés comme une nuit de zéro
 * heure. `null` quand la fenêtre est vide.
 */
export function computeCheckinAverages(checkins: DailyCheckin[], days: number, now: Date = new Date()): CheckinAverages {
  const since = shiftDay(now, -(days - 1));
  const until = dayKey(now);
  const scoped = checkins.filter((item) => item.date >= since && item.date <= until);
  return {
    days,
    count: scoped.length,
    sleepHours: roundTo(mean(scoped.map((item) => item.sleepHours)), 1),
    energy: roundTo(mean(scoped.map((item) => item.energy)), 1),
    stress: roundTo(mean(scoped.map((item) => item.stress)), 1),
  };
}

/* ── SOMMEIL ET TEMPS DE TRAVAIL ──────────────────────────────────────
 *
 * APPARIEMENT. Le check-in du soir du jour J porte sur la nuit qui a
 * PRÉCÉDÉ J (voir `DailyCheckin.sleepHours`). Le « lendemain » de cette nuit
 * est donc J lui-même : on rapproche le sommeil saisi le soir de J des
 * minutes travaillées pendant J. Pas de décalage d'un jour à ajouter — il
 * est déjà dans la définition du champ.
 *
 * Aujourd'hui est EXCLU : la journée n'est pas finie, ses minutes
 * sous-estimeraient le travail et tireraient le constat vers le bas.
 * Les jours antérieurs à la première séance enregistrée aussi : ils ne sont
 * pas « zéro minute », ils ne sont pas observés (voir
 * lib/analytics/work-time.ts#TimePoint.measured).
 */

export interface SleepWorkDay {
  date: string;
  /** `null` = pas de check-in ce jour-là. */
  sleepHours: number | null;
  /** `null` = jour non observé (avant la première séance, ou aujourd'hui en cours). */
  minutes: number | null;
}

/** Série jour par jour, du plus ancien au plus récent, sur `days` jours se terminant aujourd'hui. */
export function computeSleepWorkSeries(checkins: DailyCheckin[], sessions: WorkSession[], days: number, now: Date = new Date()): SleepWorkDay[] {
  const today = dayKey(now);
  const sleepByDay = new Map(checkins.map((item) => [item.date, item.sleepHours]));
  return computeWorkTimeSeries(sessions, "jour", days, now).map((point) => ({
    date: point.key,
    sleepHours: sleepByDay.get(point.key) ?? null,
    minutes: point.measured && point.key !== today ? point.minutes : null,
  }));
}

export interface SleepWorkRelation {
  /** Jours où sommeil ET minutes sont connus. */
  pairedDays: number;
  /** Vrai seulement quand il y a assez de jours pour énoncer quoi que ce soit — voir `SLEEP_RELATION_MIN_DAYS`. */
  sufficient: boolean;
  /** Jours après une nuit ≥ 7 h / < 7 h. */
  longNights: number;
  shortNights: number;
  /** Minutes moyennes travaillées dans chaque groupe — `null` si le groupe est vide. */
  minutesAfterLong: number | null;
  minutesAfterShort: number | null;
  /** Écart (long − court), arrondi à la minute. `null` tant que la comparaison n'est pas possible. */
  gapMinutes: number | null;
  /** Coefficient de corrélation de Pearson — donné pour information, JAMAIS affiché comme une preuve. */
  correlation: number | null;
}

function pearson(xs: number[], ys: number[]): number | null {
  const mx = mean(xs);
  const my = mean(ys);
  if (mx === null || my === null) return null;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let index = 0; index < xs.length; index += 1) {
    num += (xs[index] - mx) * (ys[index] - my);
    dx += (xs[index] - mx) ** 2;
    dy += (ys[index] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

/**
 * Rapproche le sommeil et le temps travaillé, sur au plus `windowDays`
 * jours. Ne se prononce qu'à partir de `SLEEP_RELATION_MIN_DAYS` jours
 * appariés ET d'au moins quatre jours dans chaque groupe.
 */
export function computeSleepWorkRelation(
  checkins: DailyCheckin[],
  sessions: WorkSession[],
  now: Date = new Date(),
  windowDays = 90
): SleepWorkRelation {
  const paired = computeSleepWorkSeries(checkins, sessions, windowDays, now).filter(
    (day): day is { date: string; sleepHours: number; minutes: number } => day.sleepHours !== null && day.minutes !== null
  );
  const long = paired.filter((day) => day.sleepHours >= SLEEP_THRESHOLD_HOURS).map((day) => day.minutes);
  const short = paired.filter((day) => day.sleepHours < SLEEP_THRESHOLD_HOURS).map((day) => day.minutes);
  const sufficient = paired.length >= SLEEP_RELATION_MIN_DAYS && long.length >= SLEEP_GROUP_MIN_DAYS && short.length >= SLEEP_GROUP_MIN_DAYS;
  const minutesAfterLong = roundTo(mean(long), 0);
  const minutesAfterShort = roundTo(mean(short), 0);
  return {
    pairedDays: paired.length,
    sufficient,
    longNights: long.length,
    shortNights: short.length,
    minutesAfterLong,
    minutesAfterShort,
    gapMinutes: sufficient && minutesAfterLong !== null && minutesAfterShort !== null ? minutesAfterLong - minutesAfterShort : null,
    correlation: sufficient ? pearson(paired.map((day) => day.sleepHours), paired.map((day) => day.minutes)) : null,
  };
}

/**
 * Le constat en une phrase — TOUJOURS une observation sur les données de
 * l'élève, jamais une relation de cause. `null` tant que les données ne
 * suffisent pas : l'interface dit alors ce qui manque.
 */
export function describeSleepWorkRelation(relation: SleepWorkRelation): string | null {
  if (!relation.sufficient || relation.gapMinutes === null) return null;
  const gap = Math.abs(relation.gapMinutes);
  if (gap < SLEEP_GAP_NEGLIGIBLE_MINUTES) {
    return `Les jours après ≥ ${SLEEP_THRESHOLD_HOURS} h de sommeil, tu as travaillé à peu près autant que les autres jours (écart de moins de ${SLEEP_GAP_NEGLIGIBLE_MINUTES} min).`;
  }
  return `Les jours après ≥ ${SLEEP_THRESHOLD_HOURS} h de sommeil, tu as travaillé en moyenne ${gap} min de ${relation.gapMinutes > 0 ? "plus" : "moins"} que les jours après une nuit plus courte.`;
}

/** « 7 h », « 6 h 30 » — jamais « 6,5 h », qui ne se lit pas comme une durée. */
export function formatSleep(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0 ? `${whole} h` : `${whole} h ${String(minutes).padStart(2, "0")}`;
}

/** Moyenne 1–5 à la française — « 3,4 ». */
export function formatScale(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
