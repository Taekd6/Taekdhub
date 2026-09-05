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
