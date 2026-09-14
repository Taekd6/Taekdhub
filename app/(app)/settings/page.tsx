import { AvailabilityEditor } from "@/components/settings/availability-editor";
import { DataPanel } from "@/components/settings/data-panel";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SubjectsEditor } from "@/components/settings/subjects-editor";
import { PageBar, Stack } from "@/components/ui/layout";

export const metadata = { title: "Réglages — TaekdHub" };

/**
 * Composition `Stack` : un écran de saisie se lit et se remplit dans une
 * colonne. Les disponibilités viennent EN PREMIER — c'est le réglage dont
 * dépendent la charge, le planning et la prochaine action ; le reste est du
 * confort.
 */
export default function SettingsPage() {
  return (
    <Stack className="space-y-10">
      <PageBar title="Réglages" lede="Ton temps disponible, tes matières, et tes sauvegardes." />
      <AvailabilityEditor />
      <SubjectsEditor />
      <PreferencesForm />
      <DataPanel />
    </Stack>
  );
}
