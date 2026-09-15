import { dayKey } from "@/lib/study";
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
}

export interface Consistency {
  weeks: ConsistencyWeek[];
  /** Jours actifs de la semaine en cours. */
  currentActiveDays: number;
  /** Moyenne des jours actifs sur les semaines COMPLÈTES observées — `null` s'il n'y en a aucune. */
  averageActiveDays: number | null;
  /** Tendance du nombre de jours actifs, semaines complètes uniquement. */
  trend: Trend;
}

/** Les jours où au moins une séance a été enregistrée, quelle que soit sa durée — une demi-heure est un jour actif. */
export function activeDayKeys(sessions: WorkSession[]): Set<string> {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.duration_seconds > 0) days.add(dayKey(session.started_at));
  }
  return days;
}

export function computeConsistency(sessions: WorkSession[], weeks: number, now: Date = new Date()): Consistency {
  const active = activeDayKeys(sessions);
  const currentWeekStart = startOfWeek(now).getTime();
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
    });
  }

  // Les semaines INCOMPLÈTES sont écartées de la moyenne et de la tendance :
  // un mardi compte au mieux deux jours actifs, et l'inclure ferait chuter
  // la régularité tous les débuts de semaine.
  const complete = list.filter((week) => !week.partial);
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
  };
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
