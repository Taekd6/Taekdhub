import { HINT_LEVELS, type AIHintResponse, type HintLevel } from "@/lib/ai/types";

/**
 * L'ÉCHELLE — logique pure, hors de React, pour être testable.
 *
 * Tenir cette progression dans du code plutôt que dans le prompt est
 * délibéré : c'est la seule garantie qu'un modèle serviable ne saute pas au
 * palier 6. Le prompt le lui demande, le schéma le vérifie, et ces fonctions
 * décident de ce qui est demandable. Trois barrières, parce que celle du
 * milieu est la seule qu'un modèle ne peut pas contourner.
 */

export const MAX_HINT_LEVEL: HintLevel = 6;
export const FIRST_HINT_LEVEL: HintLevel = 1;

/** Le palier suivant, ou `null` quand l'échelle est épuisée — on ne boucle pas, on s'arrête. */
export function nextHintLevel(reached: number): HintLevel | null {
  if (!Number.isFinite(reached) || reached < 0) return FIRST_HINT_LEVEL;
  if (reached >= MAX_HINT_LEVEL) return null;
  return (Math.floor(reached) + 1) as HintLevel;
}

/** Les paliers déjà obtenus doivent se suivre : 1, 2, 3… Un trou signale une réponse hors séquence. */
export function isContiguousLadder(hints: Pick<AIHintResponse, "level">[]): boolean {
  return hints.every((hint, index) => hint.level === index + 1);
}

/**
 * Combien d'aides l'élève a-t-il réellement reçues ?
 *
 * Utilisé pour `WorkSession.hints_used`, et c'est un point de VÉRACITÉ, pas de
 * comptabilité : un indice IA est une aide au même titre qu'un indice du
 * professeur. Ne pas le compter ferait passer pour autonome un élève qui a
 * gravi cinq paliers — exactement la fausse statistique que l'audit
 * précédent a passé son temps à supprimer, et le moteur de recommandation
 * (lib/recommendation.ts, `ASSISTED_HINTS_THRESHOLD`) s'en servirait pour
 * proposer un cran au-dessus à tort.
 */
export function totalHintsUsed(staticHints: number, aiHints: number): number {
  const a = Number.isFinite(staticHints) ? Math.max(0, Math.floor(staticHints)) : 0;
  const b = Number.isFinite(aiHints) ? Math.max(0, Math.floor(aiHints)) : 0;
  return a + b;
}

/** Tous les paliers de l'échelle, dans l'ordre — pour l'affichage de la progression. */
export function allLevels(): HintLevel[] {
  return [...HINT_LEVELS];
}
