import { Stack } from "@/components/ui/layout";
import { ReviewSession } from "@/components/review/review-session";

export const metadata = { title: "Révisions du jour — TaekdHub" };

/**
 * La séance de révision espacée du carnet « À revoir » — une carte à la
 * fois. Composition `Stack` : c'est un ENCHAÎNEMENT
 * (accueil, cartes, bilan), et un rail n'aurait rien à y montrer que la
 * carte en cours ne dise déjà. Atteinte depuis la carte « Révisions du
 * jour » (accueil, /revoir, hub d'une matière), jamais depuis la barre de
 * navigation — voir app/(app)/revoir/page.tsx.
 */
export default function RevisionSessionPage() {
  return (
    <Stack>
      <ReviewSession />
    </Stack>
  );
}
