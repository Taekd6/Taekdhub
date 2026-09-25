import { DeadlinesOverview } from "@/components/work/deadlines-overview";

export const metadata = { title: "Échéances — TaekdHub" };

/**
 * Écran atteint depuis l'accueil (carte « Échéances ») — la barre de
 * navigation garde ses QUATRE destinations : la planification est un outil
 * que l'on consulte depuis la journée, pas une section de plus.
 *
 * Titre porté par la composition elle-même (voir `PageHero`, components/ui/page-hero.tsx).
 */
export default function EcheancesPage() {
  return <DeadlinesOverview />;
}
