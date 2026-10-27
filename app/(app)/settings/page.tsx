import { AvatarPicker } from "@/components/account/avatar-picker";
import { PushSettings } from "@/components/notifications/push-settings";
import { AccountSection } from "@/components/account/account-section";
import { BriefingSetting } from "@/components/briefing/briefing-setting";
import { CapacityForm } from "@/components/work/capacity-form";
import { PerformanceWindowsForm } from "@/components/work/performance-windows-form";
import { CaptureGuide } from "@/components/capture-guide";
import { CalendarSettings } from "@/components/calendar/calendar-settings";
import { RappelsGuide } from "@/components/rappels/rappels-guide";
import { DataBackup } from "@/components/data-backup";
import { DataHealth } from "@/components/data-health";
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
      <PageHero title="Réglages" lede="L'essentiel : apparence, agendas, compte et Rappels." />
      <AvatarPicker />
      <ThemePicker />
      <CalendarSettings />
      <AccountSection />
      <RappelsGuide />
      {/* ── Mission 26 (« beaucoup de données pour pas grand-chose ») : le reste
          existe toujours, replié par défaut. Rien n'est supprimé. ── */}
      <details className="group surface rounded-[var(--radius-tile)] p-5 sm:p-6">
        <summary className="press flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="t-subhead block font-bold">Réglages avancés</span>
            <span className="t-meta">Objectifs, notifications, temps de travail, sauvegardes, guides</span>
          </span>
          <span aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-90">›</span>
        </summary>
        <div className="mt-8 space-y-10">
          <DataHealth />
          <PreferencesForm />
          <BriefingSetting />
          <PushSettings />
          <CapacityForm />
          <PerformanceWindowsForm />
          {/* ── Premier lancement : rouvrir l'accueil guidé ── */}
          <OnboardingRestartEntry />
          {/* ── fin premier lancement ── */}
          <CaptureGuide />
          <DataBackup />
        </div>
      </details>
    </div>
  );
}
