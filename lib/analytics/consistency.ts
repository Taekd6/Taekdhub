import { dayKey } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { startOfWeek } from "@/lib/week";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * RÉGULARITÉ — « est-ce que je suis régulier ? ».
 *
 * PARTI PRIS, et il structure tout le module : c'est le NOMBRE DE JOURS
 * ACTIFS qui est mesuré, pas le volume. Cinq jours à une heure valent mieux
 * que deux jours à deux heures et demie, en prépa comme partout ailleurs, et
 * un tableau de bord qui récompense les pics enseigne exactement le
 * contraire de ce qu'il faudrait.
 *
 * Aucun classement, aucun palier, aucun trophée : un compte de jours, une
 * évolution, et rien de plus. La série en cours existe parce qu'elle décrit
 * un fait — pas pour être défendue.
 *
 * Fonctions pures.
 */

export interface ConsistencyWeek {
  /** Lundi, "AAAA-MM-JJ". */
  key: string;
  start: Date;
  /** Jours de la semaine où au moins une séance a été enregistrée, 0–7. */
  activeDays: number;
  minutes: number;
  /** `true` tant que la semaine n'est pas écoulée — elle ne se compare pas aux autres. */
  partial: boolean;
  /**
   * La semaine est-elle POSTÉRIEURE à la première séance enregistrée ?
   *
   * `false` = le compte n'existait pas encore. Une telle semaine affichait
   * « 0 jour actif » et pesait dans la moyenne comme dans la tendance :
   * un compte de deux semaines annonçait « 5 jours actifs cette semaine,
   * contre 0,4 en moyenne » et « ta régularité est en hausse » avec une
   * confiance élevée, sur la foi de dix semaines qui n'ont jamais existé.
   * Même principe que `TimePoint.measured` (lib/analytics/work-time.ts).
   */
  measured: boolean;
}

export interface Consistency {
  weeks: ConsistencyWeek[];
  /** Jours actifs de la semaine en cours. */
  currentActiveDays: number;
  /** Moyenne des jours actifs sur les semaines COMPLÈTES et RÉELLEMENT observées — `null` s'il n'y en a aucune. */
  averageActiveDays: number | null;
  /** Tendance du nombre de jours actifs, semaines complètes et réellement observées uniquement. */
  trend: Trend;
  /** Nombre de semaines complètes ayant réellement servi à la moyenne et à la tendance — ce que l'interface doit citer plutôt que `weeks.length`. */
  comparableWeeks: number;
}

/**
 * Les jours RÉELLEMENT travaillés — au moins une minute CUMULÉE sur la
 * journée, quel que soit le nombre de séances.
 *
 * DÉFINITION UNIQUE, partagée avec lib/gamification.ts#computeStreak, qui
 * s'appuie désormais dessus. Il y en avait deux : ici, toute séance de plus
 * de zéro seconde ; là-bas, une minute cumulée. Une séance de 40 secondes
 * suffisait donc à les faire diverger, et l'écran
 * Progression affichait « Série actuelle : 1 j » en tête et « 2 jours
 * consécutifs » quelques centaines de pixels plus bas.
 *
 * C'est le seuil d'une minute qui l'emporte, et c'est délibéré : une série
 * qu'on peut tenir sans travailler ne récompense pas la régularité, elle
 * récompense le fait d'ouvrir l'application (voir `computeStreak`).
 */
export function activeDayKeys(sessions: WorkSession[]): Set<string> {
  const secondsByDay = new Map<string, number>();
  for (const session of sessions) {
    const key = dayKey(session.started_at);
    secondsByDay.set(key, (secondsByDay.get(key) ?? 0) + session.duration_seconds);
  }
  const days = new Set<string>();
  for (const [key, seconds] of secondsByDay) {
    if (secondsToWholeMinutes(seconds) > 0) days.add(key);
  }
  return days;
}

export function computeConsistency(sessions: WorkSession[], weeks: number, now: Date = new Date()): Consistency {
  const active = activeDayKeys(sessions);
  const currentWeekStart = startOfWeek(now).getTime();
  // Lundi de la première semaine réellement observée — avant elle, il n'y a
  // pas « zéro jour actif », il n'y a rien. Voir `ConsistencyWeek.measured`.
  const firstMeasured = firstMeasuredWeekStart(sessions, now);
  const list: ConsistencyWeek[] = [];

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const reference = new Date(now);
    reference.setDate(reference.getDate() - offset * 7);
    const start = startOfWeek(reference);
    let activeDays = 0;
    let minutes = 0;
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + day);
      if (date > now) break;
      const key = dayKey(date);
      if (active.has(key)) activeDays += 1;
      minutes += sessions
        .filter((session) => dayKey(session.started_at) === key)
        .reduce((sum, session) => sum + session.duration_seconds / 60, 0);
    }
    list.push({
      key: dayKey(start),
      start,
      activeDays,
      minutes: Math.round(minutes),
      partial: start.getTime() === currentWeekStart,
      measured: firstMeasured !== null && start.getTime() >= firstMeasured,
    });
  }

  // Les semaines INCOMPLÈTES sont écartées de la moyenne et de la tendance :
  // un mardi compte au mieux deux jours actifs, et l'inclure ferait chuter
  // la régularité tous les débuts de semaine.
  // Deux filtres, deux raisons : `partial` écarte la semaine en cours
  // (incomplète), `measured` écarte celles d'avant le compte (inexistantes).
  const complete = list.filter((week) => !week.partial && week.measured);
  const averageActiveDays =
    complete.length > 0 ? Math.round((complete.reduce((sum, week) => sum + week.activeDays, 0) / complete.length) * 10) / 10 : null;

  return {
    weeks: list,
    currentActiveDays: list[list.length - 1]?.activeDays ?? 0,
    averageActiveDays,
    // Bruit absolu d'un demi-jour : en pourcentage, passer de 3 à 4 jours
    // (+33 %) et de 6 à 7 (+17 %) seraient traités différemment alors que
    // c'est le même gain d'une journée.
    trend: computeTrend(complete.map((week) => week.activeDays), { absoluteNoise: 0.5 }),
    comparableWeeks: complete.length,
  };
}

/** Lundi de la semaine contenant la première séance enregistrée, en millisecondes, ou `null` si aucune. */
function firstMeasuredWeekStart(sessions: WorkSession[], now: Date): number | null {
  let earliest: Date | null = null;
  for (const session of sessions) {
    const started = new Date(session.started_at);
    if (Number.isNaN(started.getTime()) || started > now) continue;
    if (!earliest || started < earliest) earliest = started;
  }
  return earliest ? startOfWeek(earliest).getTime() : null;
}

/** Jours consécutifs travaillés jusqu'à aujourd'hui (aujourd'hui inclus s'il est actif) — le même calcul que lib/gamification.ts, réexposé ici pour que la couche analytique soit lisible d'un bloc. */
export function currentStreak(sessions: WorkSession[], now: Date = new Date()): number {
  const active = activeDayKeys(sessions);
  const cursor = new Date(now);
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
