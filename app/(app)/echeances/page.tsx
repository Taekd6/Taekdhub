import { DeadlinesOverview } from "@/components/work/deadlines-overview";

export const metadata = { title: "Échéances — TaekdHub" };

/**
 * Écran atteint depuis l'accueil, comme /preparation — la barre de navigation
 * garde ses CINQ destinations. Une sixième entrée aurait fait de la
 * planification une section du produit au même rang que la banque
 * d'exercices, alors qu'elle est un outil que l'on consulte depuis la
 * décision du jour.
 *
 * Titre porté par la composition elle-même (voir `PageBar`).
 */
export default function EcheancesPage() {
  return <DeadlinesOverview />;
}
