import { RevisionProgramScreen } from "@/components/revision/revision-program";

export const metadata = { title: "Programme de révision — TaekdHub" };

/**
 * LE PROGRAMME DE RÉVISION (lib/revision-program.ts) : quoi réviser, pourquoi
 * maintenant, combien de temps, avec quelle fiabilité, et par où commencer.
 * Atteint depuis l'accueil (« Le reste de ta journée ») — comme /revoir et
 * /memoire, il ne prend PAS de place dans la barre de navigation (voir
 * components/app-nav.tsx).
 */
export default function RevisionPage() {
  return <RevisionProgramScreen />;
}
