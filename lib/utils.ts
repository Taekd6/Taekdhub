/**
 * Conversions de durées — point d'entrée unique pour éviter les `/ 60` ou
 * `* 60` implicites dispersés dans les composants (voir lib/supabase/types.ts
 * pour le rappel des unités : WorkSession = secondes, Exercise = minutes).
 */

/** Arrondit des secondes à la minute inférieure (perte du reste) — utilisé notamment par `minutesSpentOnExercise` (lib/study.ts) pour dériver le temps passé sur un exercice à partir de ses `WorkSession`. */
export function secondsToWholeMinutes(seconds: number) {
  return Math.floor(seconds / 60);
}

export function minutesToSeconds(minutes: number) {
  return minutes * 60;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number) {
  return formatDuration(minutesToSeconds(minutes));
}
