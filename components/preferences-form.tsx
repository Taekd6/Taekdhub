"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { PLAN_DURATION_PRESETS } from "@/lib/plan";
import { localData, type Preferences } from "@/lib/storage";

/** Préréglages "objectif hebdomadaire" (Sprint Plan de travail), en minutes — 3h/5h/7h, plus une valeur libre déjà couverte par le champ nombre ci-dessous. */
const WEEKLY_GOAL_PRESETS = [180, 300, 420];

/**
 * Réglages (Sprint 3G : fusion de l'ancienne page Profil, séparée sans
 * raison réelle — un seul champ chacune, jamais consultées indépendamment).
 * Un seul formulaire, une seule sauvegarde.
 */
export function PreferencesForm() {
  const { preferences, savePreferences } = usePrepahubData();
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  // N'écrit QUE les quatre champs de ce formulaire, par-dessus ce qui est
  // réellement enregistré à cet instant. `prefs` est un instantané pris au
  // montage, et `usePrepahubData` n'est pas un contexte partagé : envoyer
  // l'objet complet renvoyait aussi `accent` et `themeMode` tels qu'ils
  // étaient à l'ouverture de la page, annulant la couleur ou le mode que le
  // sélecteur d'apparence — juste en dessous, sur cette même page Réglages —
  // venait d'enregistrer.
  function save(event: React.FormEvent) {
    event.preventDefault();
    savePreferences({
      ...localData.preferences(),
      displayName: prefs.displayName,
      dailyGoalMinutes: prefs.dailyGoalMinutes,
      weeklyGoalMinutes: prefs.weeklyGoalMinutes,
      contestDate: prefs.contestDate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Section
      variant="panel"
      label="Rythme"
      title="Ton identité de travail"
      description="Ces deux objectifs alimentent l'accueil, le plan du jour et la mesure de ta semaine."
      className="max-w-2xl"
    >
      <form onSubmit={save} className="space-y-6">
        <Field label="Prénom">
          <Input
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            placeholder="Ton prénom"
            className="max-w-xs"
          />
        </Field>

        {/* Sélecteur segmenté, pas quatre boutons dont l'actif en aplat plein :
            le préréglage choisi portait le style de l'ACTION PRINCIPALE, le
            même que « Enregistrer » quelques lignes plus bas. Régler n'est pas
            agir. */}
        <Field
          label="Objectif quotidien"
          hint="Durée visée chaque jour, en minutes — alimente l'accueil et le plan du jour."
        >
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Objectif quotidien"
              value={prefs.dailyGoalMinutes}
              onChange={(value) => setPrefs({ ...prefs, dailyGoalMinutes: value })}
              options={PLAN_DURATION_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
            />
            <Input
              type="number"
              value={prefs.dailyGoalMinutes}
              min={1}
              onChange={(e) => setPrefs({ ...prefs, dailyGoalMinutes: Math.max(1, Number(e.target.value)) })}
              className="w-20 text-center"
              aria-label="Objectif quotidien personnalisé, en minutes"
            />
          </div>
        </Field>

        <Field
          label="Objectif hebdomadaire"
          hint="Durée visée sur la semaine, en minutes — indépendant de l'objectif quotidien."
        >
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Objectif hebdomadaire"
              value={prefs.weeklyGoalMinutes}
              onChange={(value) => setPrefs({ ...prefs, weeklyGoalMinutes: value })}
              options={WEEKLY_GOAL_PRESETS.map((preset) => ({ value: preset, label: `${Math.round(preset / 60)} h` }))}
            />
            <Input
              type="number"
              value={prefs.weeklyGoalMinutes}
              min={1}
              onChange={(e) => setPrefs({ ...prefs, weeklyGoalMinutes: Math.max(1, Number(e.target.value)) })}
              className="w-20 text-center"
              aria-label="Objectif hebdomadaire personnalisé, en minutes"
            />
          </div>
        </Field>

        <Field label="Date des concours" hint="Affiche le compte à rebours sur l'accueil. Laisse vide si tu ne veux pas le voir.">
          <Input
            type="date"
            value={prefs.contestDate}
            onChange={(e) => setPrefs({ ...prefs, contestDate: e.target.value })}
            className="max-w-xs"
          />
        </Field>

        <div className="border-t border-line pt-5">
          <Button type="submit">
            {saved ? (
              <>
                <Check size={16} /> Enregistré
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** Champ de formulaire — étiquette au-dessus, aide en dessous. Une seule forme pour tous les réglages. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="t-subhead mb-2 block">{label}</span>
      {children}
      {hint && <span className="t-meta mt-2 block max-w-[56ch]">{hint}</span>}
    </label>
  );
}
