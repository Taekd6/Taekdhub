import { PageBar, Stack } from "@/components/ui/layout";
import { PreparationCommand } from "@/components/preparation/preparation-command";

export const metadata = { title: "Équilibrer mes matières — TaekdHub" };

export default function PreparationPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Équilibrer mes matières"
        lede="Répartir ton temps sans laisser une matière disparaître — la vue d'ensemble que la séance du jour ne donne pas."
      />
      <PreparationCommand />
    </Stack>
  );
}
