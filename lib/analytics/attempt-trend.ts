import type { ExerciseAttempt } from "@/lib/attempts";
import { dayKey } from "@/lib/study";

/**
 * RÉSULTATS AUX EXERCICES, SEMAINE PAR SEMAINE — ce que montrent les graphiques
 * de l'onglet « Exercices ».
 *
 * Deux grandeurs seulement, toutes deux des FAITS enregistrés :
 *   - le nombre de tentatives par résultat (réussi, partiel, échec) ;
 *   - la part de tentatives RÉUSSIES SANS AIDE : la seule qui prouve un savoir-faire
 *     (lib/attempts.ts) — un exercice réussi après lecture de la correction n'y compte pas.
 *
 * La part n'est calculée qu'à partir de `MIN_ATTEMPTS_PER_WEEK` tentatives : un
 * pourcentage sur une seule tentative vaudrait 0 % ou 100 % et raconterait un
 * progrès, ou une chute, qui n'existe pas. En dessous, la valeur est `null` et
 * la courbe s'interrompt (voir `LineChart`).
 */
export const MIN_ATTEMPTS_PER_WEEK = 3;
export const ATTEMPT_WEEKS = 6;

export interface AttemptWeek {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  start: string;
  réussi: number;
  partiel: number;
  échec: number;
  total: number;
  /** Part réussie sans aide, en %, ou `null` sous le seuil. */
  unaidedPercent: number | null;
}

/** Lundi de la semaine du jour `day` (AAAA-MM-JJ). */
export function mondayOf(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return dayKey(date);
}

export function computeAttemptWeeks(attempts: ExerciseAttempt[], now: Date = new Date(), weeks: number = ATTEMPT_WEEKS): AttemptWeek[] {
  const thisMonday = new Date(`${mondayOf(dayKey(now))}T12:00:00`);
  const series: AttemptWeek[] = [];
  for (let back = weeks - 1; back >= 0; back--) {
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - back * 7);
    series.push({ start: dayKey(monday), réussi: 0, partiel: 0, échec: 0, total: 0, unaidedPercent: null });
  }
  const byStart = new Map(series.map((week) => [week.start, week]));
  const unaided = new Map<string, number>();
  for (const attempt of attempts) {
    const week = byStart.get(mondayOf(attempt.day));
    if (!week) continue;
    week[attempt.result] += 1;
    week.total += 1;
    if (attempt.result === "réussi" && attempt.help === "sans") unaided.set(week.start, (unaided.get(week.start) ?? 0) + 1);
  }
  for (const week of series) {
    if (week.total >= MIN_ATTEMPTS_PER_WEEK) week.unaidedPercent = Math.round(((unaided.get(week.start) ?? 0) / week.total) * 100);
  }
  return series;
}
