import { PageHeader } from "@/components/page-header";
import { PreparationCommand } from "@/components/preparation/preparation-command";
export const metadata = { title: "Préparation globale" };
export default function PreparationPage() {
  return <><PageHeader eyebrow="Pilotage" title="Préparation globale" description="Répartir ton temps sans perdre de vue une seule matière." /><PreparationCommand /></>;
}
