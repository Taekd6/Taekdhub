/**
 * Conversions de durées — point d'entrée unique pour éviter les `/ 60` ou
 * `* 60` implicites dispersés dans les composants (voir lib/supabase/types.ts
 * pour le rappel des unités : WorkSession = secondes, estimations = minutes).
 */

/** Arrondit des secondes à la minute inférieure (perte du reste) — utilisé notamment par l'objectif du jour (lib/daily-objective.ts). */
export function secondsToWholeMinutes(seconds: number) {
  return Math.floor(seconds / 60);
}

export function minutesToSeconds(minutes: number) {
  return minutes * 60;
}

/**
 * CHRONOMÈTRE — un compteur qui TOURNE, lu en `m:ss`.
 *
 * Réservé à l'endroit où une durée s'écoule sous les yeux : le chronomètre
 * (components/timer.tsx). Pour toute durée déjà ÉCOULÉE —
 * un total de semaine, la durée d'une séance passée, un cumul par matière —
 * c'est `formatSpan` qu'il faut, jamais celle-ci : voir la note qui l'ouvre.
 */
export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * DURÉE ÉCOULÉE — « 45 min », « 5 h 50 », « 19 h ».
 *
 * `formatDuration` composait toute durée de moins d'une heure en `m:ss` :
 * une semaine de travail s'affichait « 45:00 », la durée d'une séance
 * « 30:00 ». Trois défauts mesurés à l'écran, pas supposés :
 *
 *   — « 45:00 » se lit comme une HEURE. Dans le journal des séances, la
 *     ligne portait déjà « 14 sept., 05:30 » : deux nombres de même forme
 *     côte à côte, dont un seul est une durée.
 *   — la forme CHANGE au passage de l'heure (« 55:00 » puis « 1 h 05 min »),
 *     donc une colonne de durées n'est pas comparable d'une ligne à l'autre.
 *   — les secondes n'ont aucun sens sur un cumul : personne ne lit les
 *     secondes d'une semaine de travail.
 *
 * Ici, une seule forme, arrondie à la minute, et jamais de zéro postiche :
 * « 2 h » plutôt que « 2 h 00 ». Le nombre reste composable en chiffres
 * tabulaires (`.tabular`) pour qu'une colonne s'aligne.
 */
export function formatSpan(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total === 0) return seconds > 0 ? "< 1 min" : "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Même forme que `formatSpan`, à partir de MINUTES (unité des estimations, des budgets et des objectifs). */
export function formatMinutesSpan(minutes: number): string {
  return formatSpan(minutesToSeconds(minutes));
}
