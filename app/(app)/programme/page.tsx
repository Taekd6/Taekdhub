import { ProgrammeOverview } from "@/components/programme/programme-overview";

export const metadata = { title: "Le programme — TaekdHub" };

/**
 * La carte du programme MP (lib/programme.ts). Atteinte depuis l'écran
 * Matières — comme /memoire et /annales, elle ne prend pas de place dans la
 * barre de navigation (voir components/app-nav.tsx).
 */
export default function ProgrammePage() {
  return <ProgrammeOverview />;
}
