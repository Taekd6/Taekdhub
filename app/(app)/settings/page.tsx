import { DataBackup } from "@/components/data-backup";
import { DeadlinesManager } from "@/components/deadlines-manager";
import { PageHeader } from "@/components/page-header";
import { PreferencesForm } from "@/components/preferences-form";
import { ThemePicker } from "@/components/theme-picker";
import { WeeklyPlanEditor } from "@/components/weekly-plan-editor";

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Réglages" description="Ton identité de travail et ton rythme." />
      <PreferencesForm />
      <div className="mt-5">
        <WeeklyPlanEditor />
      </div>
      <div className="mt-5">
        <DeadlinesManager />
      </div>
      <div className="mt-5">
        <ThemePicker />
      </div>
      <div className="mt-5">
        <DataBackup />
      </div>
    </>
  );
}
