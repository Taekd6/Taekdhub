import { DataBackup } from "@/components/data-backup";
import { PageBar, Stack } from "@/components/ui/layout";
import { PreferencesForm } from "@/components/preferences-form";
import { ThemePicker } from "@/components/theme-picker";

/**
 * Composition `Stack` : un écran de saisie se lit et se remplit dans une
 * colonne, pas sur 1 140 px — un champ de 900 px de large n'aide personne, et
 * une étiquette perdue à l'autre bout de l'écran non plus.
 */
export default function SettingsPage() {
  return (
    <Stack className="space-y-8">
      <PageBar title="Réglages" lede="Ton identité de travail, ton rythme et tes sauvegardes." />
      <PreferencesForm />
      <ThemePicker />
      <DataBackup />
    </Stack>
  );
}
