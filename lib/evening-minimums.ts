import { weekdayIndex } from "@/lib/capacity";
import { dayKey, subjects } from "@/lib/study";
import type { Preferences } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * MINIMUM DU SOIR — « ce soir, au moins 2 h de maths et 1 h 30 de physique ».
 *
 * Une règle fixée À L'AVANCE, jour par jour (`Preferences.eveningMinimums`),
 * plutôt qu'une décision prise chaque soir : c'est la même logique que les
 * plans « si… alors… » (lib/intentions.ts) — décider une fois, puis
 * exécuter. Par défaut : chaque soir de semaine sauf le mardi.
 *
 * Le temps compté est celui de la JOURNÉE entière dans la matière, pas
 * seulement après 18 h : une heure de maths faite à midi compte pour le
 * minimum du soir. Ce qui compte, c'est le total fait ce jour-là.
 *
 * Fonctions pures.
 */

export interface EveningEntry {
  subject: Subject;
  minMinutes: number;
  doneMinutes: number;
  /** 0-100, plafonné. */
  percent: number;
  met: boolean;
}

export interface EveningPlan {
  entries: EveningEntry[];
  totalMinMinutes: number;
  allMet: boolean;
}

/** Les minimums de ce jour-là — liste vide un soir libre. */
export function minimumsFor(preferences: Preferences, date: Date): Partial<Record<Subject, number>> {
  return preferences.eveningMinimums[weekdayIndex(date)] ?? {};
}

/** Où en est le minimum du soir aujourd'hui, matière par matière, dans l'ordre des matières. */
export function eveningPlan(preferences: Preferences, sessions: WorkSession[], now: Date = new Date()): EveningPlan {
  const minimums = minimumsFor(preferences, now);
  const today = dayKey(now);
  const doneSeconds = new Map<Subject, number>();
  for (const session of sessions) {
    if (dayKey(session.started_at) !== today || new Date(session.started_at) > now) continue;
    doneSeconds.set(session.subject, (doneSeconds.get(session.subject) ?? 0) + session.duration_seconds);
  }
  const entries: EveningEntry[] = [];
  for (const subject of subjects) {
    const minMinutes = minimums[subject] ?? 0;
    if (minMinutes <= 0) continue;
    const doneMinutes = Math.floor((doneSeconds.get(subject) ?? 0) / 60);
    entries.push({
      subject,
      minMinutes,
      doneMinutes,
      percent: Math.min(100, Math.round((doneMinutes / minMinutes) * 100)),
      met: doneMinutes >= minMinutes,
    });
  }
  return {
    entries,
    totalMinMinutes: entries.reduce((sum, entry) => sum + entry.minMinutes, 0),
    allMet: entries.length > 0 && entries.every((entry) => entry.met),
  };
}

/**
 * L'objectif du jour réellement visé : jamais en dessous de la somme des
 * minimums du soir. Sans cela, l'anneau « Ma journée » annoncerait
 * « Objectif atteint » à 1 h un lundi où la règle en exige 3 h 30.
 */
export function effectiveDailyGoal(preferences: Preferences, now: Date = new Date()): number {
  const minimums = minimumsFor(preferences, now);
  const total = Object.values(minimums).reduce((sum, value) => sum + (value ?? 0), 0);
  return Math.max(preferences.dailyGoalMinutes, total);
}
