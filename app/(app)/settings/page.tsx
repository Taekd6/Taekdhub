import { CapacityForm } from "@/components/work/capacity-form";
import { DataBackup } from "@/components/data-backup";
import { PageHero } from "@/components/ui/page-hero";
import { PreferencesForm } from "@/components/preferences-form";
import { ThemePicker } from "@/components/theme-picker";
/* ── Premier lancement ── */
import { OnboardingRestartEntry } from "@/components/onboarding/restart-entry";
/* ── fin premier lancement ── */

/**
 * RÉGLAGES — l'app Réglages d'iOS : un grand titre, puis des LISTES
 * GROUPÉES (components/ui/grouped.tsx), chacune avec son titre au-dessus et
 * sa note en gris au-dessous. Une seule colonne bornée à la mesure de
 * lecture : un champ de 900 px de large n'aide personne, et une étiquette
 * perdue à l'autre bout de l'écran non plus.
 *
 * L'apparence vient en premier : c'est le réglage qu'on vient toucher pour
 * le plaisir, et il se voit immédiatement.
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[44rem] space-y-10">
      <PageHero title="Réglages" lede="Apparence, objectifs, temps et sauvegardes." />
      <ThemePicker />
      <PreferencesForm />
      <CapacityForm />
      {/* ── Premier lancement : rouvrir l'accueil guidé ── */}
      <OnboardingRestartEntry />
      {/* ── fin premier lancement ── */}
      <DataBackup />
    </div>
  );
}
