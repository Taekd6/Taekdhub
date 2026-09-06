/**
 * NAVIGATION « précédent / suivant » DU LECTEUR D'EXERCICES.
 *
 * Isolée du composant parce que deux bugs réels s'y sont logés, et qu'aucun
 * des deux ne se voit à la lecture du JSX :
 *
 * 1. L'ordre était recalculé à chaque rendu à partir du tri courant. Or le tri
 *    par défaut est « Recommandé » : dès qu'un résultat est noté, le moteur
 *    reclasse la banque, l'exercice courant change de place, et « suivant »
 *    pointait sur un exercice arbitraire — voire sur rien, laissant un bouton
 *    mort. L'ordre passé ici est donc celui FIGÉ à l'ouverture du lecteur.
 * 2. Un exercice archivé depuis le lecteur restait dans l'ordre et
 *    réapparaissait comme « suivant ».
 */

export interface ReaderNavigation {
  /** Position de l'exercice courant dans l'ordre actif, ou -1 s'il n'y est pas. */
  index: number;
  /** Ordre effectivement navigable (ordre figé, moins les exercices inactifs). */
  order: string[];
  previousId: string | null;
  nextId: string | null;
}

/**
 * @param frozenOrder ordre des identifiants tel qu'il était à l'ouverture du lecteur
 * @param currentId   exercice affiché
 * @param isActive    un exercice encore présent et non archivé
 */
export function readerNavigation(
  frozenOrder: readonly string[],
  currentId: string,
  isActive: (id: string) => boolean
): ReaderNavigation {
  const order = frozenOrder.filter(isActive);
  const index = order.indexOf(currentId);
  if (index < 0) return { index: -1, order, previousId: null, nextId: null };
  return {
    index,
    order,
    previousId: index > 0 ? order[index - 1] : null,
    nextId: index < order.length - 1 ? order[index + 1] : null,
  };
}
