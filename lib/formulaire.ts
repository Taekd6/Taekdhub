import { FORMULAIRE, type FormulaCard } from "@/lib/formulaire-data";
import { questionWeight, type KholleGrade, type KholleHistory } from "@/lib/kholle";
import type { Subject } from "@/lib/supabase/types";

/**
 * FORMULAIRE FLASH — réciter ses formules comme on récite ses questions de
 * cours.
 *
 * Même mécanique que la khôlle (lib/kholle.ts) : le recto s'affiche,
 * l'élève écrit la formule de tête, retourne la carte, et s'évalue — su,
 * hésitant, pas su. Le tirage est le même tirage pondéré : ce qui est raté
 * revient, ce qui est su s'efface, ce qui vient d'être vu attend.
 *
 * L'historique des cartes reste sur l'appareil, sous sa propre clé.
 */

export const FORMULA_HISTORY_KEY = "prepahub:formulaire-history";

export function cardsFor(subject: Subject, groups: string[] | null): FormulaCard[] {
  return FORMULAIRE.filter((card) => card.subject === subject && (groups === null || groups.includes(card.group)));
}

/** Maîtrise d'une rubrique d'après le DERNIER résultat de chaque carte : sues, à revoir, jamais vues. */
export function groupMastery(cards: FormulaCard[], history: KholleHistory): { su: number; toReview: number; unseen: number } {
  let su = 0;
  let toReview = 0;
  let unseen = 0;
  for (const card of cards) {
    const last = history[card.id]?.grade;
    if (!last) unseen += 1;
    else if (last === "su") su += 1;
    else toReview += 1;
  }
  return { su, toReview, unseen };
}

/** Les cartes à revoir en priorité — dernier résultat raté, du plus pressant au moins pressant. */
export function weakestCards(cards: FormulaCard[], history: KholleHistory, now: Date, limit = 5): FormulaCard[] {
  return cards
    .filter((card) => {
      const grade: KholleGrade | undefined = history[card.id]?.grade;
      return grade === "pas su" || grade === "hésitant";
    })
    .sort((a, b) => questionWeight(b, history, now) - questionWeight(a, history, now))
    .slice(0, limit);
}
