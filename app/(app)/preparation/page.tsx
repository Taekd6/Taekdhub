import { PageBar, Stack } from "@/components/ui/layout";
import { SubjectHub } from "@/components/hub/subject-hub";

export const metadata = { title: "Suivi par matière — TaekdHub" };

/**
 * LE HUB D'UNE MATIÈRE.
 *
 * Une seule question — « où j'en suis dans cette matière ? » — à partir de
 * ce que l'élève consigne lui-même : son temps, ses échéances, ses notes,
 * ses carnets. Aucun exercice : la banque intégrée a été retirée.
 */
export default function PreparationPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Suivi par matière"
        lede="Ce que tu y as mis, ce qui arrive, tes notes et ce qu'il reste à revoir — matière par matière."
      />
      <SubjectHub />
    </Stack>
  );
}
