import { DashboardOverview } from "@/components/dashboard-overview";
/* ── Premier lancement : aiguillage vers /bienvenue (components/onboarding/onboarding-gate.tsx) ── */
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
/* ── fin premier lancement ── */

/**
 * L'écran ne pose plus d'en-tête au-dessus de son contenu : le titre vit
 * DANS la composition (voir `PageHero`, components/ui/page-hero.tsx), à
 * l'intérieur de la colonne principale, pour que le rail « où j'en suis »
 * commence à la même hauteur que lui. Un en-tête pleine largeur au-dessus
 * d'une mise en page en deux colonnes casse justement les deux colonnes.
 */
export default function DashboardPage() {
  return (
    // ── Premier lancement : l'accueil n'est rendu qu'une fois l'aiguillage décidé ──
    <OnboardingGate>
      <DashboardOverview />
    </OnboardingGate>
    // ── fin premier lancement ──
  );
}
