import { PageBar, Stack } from "@/components/ui/layout";
import { SubjectHub } from "@/components/hub/subject-hub";

export const metadata = { title: "Suivi par matière — TaekdHub" };

/**
 * LE HUB D'UNE MATIÈRE.
 *
 * Cet écran s'appelait « Équilibrer mes matières » et répartissait des minutes
 * entre des exercices, en se terminant par un bouton qui construisait une
 * séance. C'était un écran de banque déguisé en écran de pilotage.
 *
 * Il répond désormais à une seule question — « où j'en suis dans cette
 * matière ? » — et n'affiche aucun exercice. Les fiches restent la matière
 * première des chiffres ; elles ne sont plus la structure de l'écran.
 */
export default function PreparationPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Suivi par matière"
        lede="Où tu en es, ce que tu y as mis, ce qui arrive, et ce qu'il y a à consolider — matière par matière."
      />
      <SubjectHub />
    </Stack>
  );
}
