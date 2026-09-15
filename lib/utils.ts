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

/**
 * CHRONOMÈTRE — un compteur qui TOURNE, lu en `m:ss`.
 *
 * Réservé aux deux endroits où une durée s'écoule sous les yeux : le
 * chronomètre (components/timer.tsx) et le lecteur d'exercice
 * (components/exercises/focus-view.tsx). Pour toute durée déjà ÉCOULÉE —
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

/** Même forme que `formatSpan`, à partir de MINUTES (unité d'`Exercise.estimated_minutes`). */
export function formatMinutesSpan(minutes: number): string {
  return formatSpan(minutesToSeconds(minutes));
}

export function formatMinutes(minutes: number) {
  return formatDuration(minutesToSeconds(minutes));
}

/**
 * Forme canonique d'un libellé (titre d'exercice, libellé de chapitre) pour
 * le dédoublonnage et le rapprochement banque ↔ local.
 *
 * `trim().toLowerCase()` ne suffisait pas : deux fiches rigoureusement
 * identiques passaient au travers dès que l'une écrivait l'apostrophe typo-
 * graphique U+2019 et l'autre l'apostrophe ASCII U+0027 — cas réel,
 * « Déterminant d'une matrice tridiagonale », entrée deux fois dans la banque.
 * Même effet avec une espace insécable ou une double espace. Et le problème ne
 * s'arrête pas au doublon : `reconcileSeedBank` utilise la MÊME clé pour
 * retrouver la fiche locale correspondante — une apostrophe changée d'un
 * dataset à l'autre détachait la progression de l'élève de sa fiche et
 * réinsérait la version banque à côté, à zéro tentative.
 *
 * NFKC unifie les variantes de compatibilité (dont l'espace insécable), la
 * classe explicite couvre les apostrophes/accents que NFKC laisse distincts.
 */
export function canonicalLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u02BC\u00B4\u0060]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
