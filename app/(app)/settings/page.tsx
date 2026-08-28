import { DataBackup } from "@/components/data-backup";
import { PageHeader } from "@/components/page-header";
import { PreferencesForm } from "@/components/preferences-form";
import { ThemePicker } from "@/components/theme-picker";

// Refonte design : les trois blocs (profil, apparence, données) étaient trois
// cartes bordées empilées — trois cadres pour un seul écran de préférences.
// Un seul panneau, sous-sections séparées par un filet, comme un vrai panneau
// de réglages (Linear, macOS) plutôt que trois widgets indépendants.
export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Réglages" description="Ton identité de travail et ton rythme." />
      <div className="surface max-w-2xl divide-y divide-hairline/[0.07] p-6">
        <div className="pb-6 first:pt-0">
          <PreferencesForm />
        </div>
        <div className="py-6">
          <ThemePicker />
        </div>
        <div className="pt-6">
          <DataBackup />
        </div>
      </div>
    </>
  );
}
