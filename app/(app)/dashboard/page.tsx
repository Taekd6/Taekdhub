import { DashboardOverview } from "@/components/dashboard-overview";

/**
 * L'écran ne pose plus d'en-tête au-dessus de son contenu : le titre vit
 * DANS la composition (voir `PageBar`, components/ui/layout.tsx), à
 * l'intérieur de la colonne principale, pour que le rail « où j'en suis »
 * commence à la même hauteur que lui. Un en-tête pleine largeur au-dessus
 * d'une mise en page en deux colonnes casse justement les deux colonnes.
 */
export default function DashboardPage() {
  return <DashboardOverview />;
}
