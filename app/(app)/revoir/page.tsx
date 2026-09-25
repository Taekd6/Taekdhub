import { ReviewNotebook } from "@/components/review/review-notebook";

export const metadata = { title: "À revoir — TaekdHub" };

/**
 * Le carnet « À revoir » en entier. Atteint depuis l'accueil (« Le carnet »)
 * et depuis le hub de chaque matière — comme /echeances, il ne prend PAS de
 * place dans la barre de navigation : ses cinq destinations sont un choix
 * (voir components/app-nav.tsx), et le carnet se remplit là où l'on est
 * déjà, pas dans un lieu où il faudrait se rendre.
 *
 * Titre porté par la composition elle-même (voir `PageHero`, components/ui/page-hero.tsx).
 */
export default function RevoirPage() {
  return <ReviewNotebook />;
}
