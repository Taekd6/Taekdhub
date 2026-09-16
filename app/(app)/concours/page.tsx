import { PageBar, Stack } from "@/components/ui/layout";
import { ContestHub } from "@/components/hub/contest-hub";

export const metadata = { title: "Concours — TaekdHub" };

/**
 * LE HUB CONCOURS.
 *
 * Cet écran était un catalogue d'annales : il comptait les fiches de chaque
 * banque et proposait de « travailler cette banque ». Il répond désormais à
 * « où j'en suis pour l'épreuve ? » — compte à rebours, couverture par
 * matière, épreuves à venir, résultats de DS, chapitres à consolider. Les
 * annales restent dans la banque, atteintes par un lien.
 */
export default function ConcoursPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Concours"
        lede="Combien de temps il reste, où en est chaque matière, ce qui arrive, et ce que donnent tes épreuves."
      />
      <ContestHub />
    </Stack>
  );
}
