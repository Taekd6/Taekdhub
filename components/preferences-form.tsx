"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { PLAN_DURATION_PRESETS } from "@/lib/plan";
import { patchPreferences, type Preferences } from "@/lib/storage";

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

  // `patchPreferences` (voir lib/storage.ts) plutôt que `savePreferences(prefs)`
  // tel quel : ce formulaire n'est monté qu'avec SA PROPRE instance de
  // `usePrepahubData`, indépendante de celle de ThemePicker (juste en dessous
  // sur cette même page) — enregistrer l'instantané complet `prefs` écraserait
  // silencieusement une couleur d'accent ou un mode d'apparence changé entre-
  // temps ailleurs sur la page. Seuls les champs réellement possédés par CE
  // formulaire sont appliqués, par-dessus les préférences les plus fraîches.
  function save(event: React.FormEvent) {
    event.preventDefault();
    savePreferences(
      patchPreferences({
        displayName: prefs.displayName,
        dailyGoalMinutes: prefs.dailyGoalMinutes,
        weeklyGoalMinutes: prefs.weeklyGoalMinutes,
        contestDate: prefs.contestDate,
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={save} className="space-y-5">
        <label className="block text-sm font-medium">
          Prénom
          <Input
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            placeholder="Ton prénom"
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Objectif quotidien
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PLAN_DURATION_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={prefs.dailyGoalMinutes === preset ? "primary" : "secondary"}
                onClick={() => setPrefs({ ...prefs, dailyGoalMinutes: preset })}
              >
                {preset} min
              </Button>
            ))}
            <Input
              type="number"
              value={prefs.dailyGoalMinutes}
              min={1}
              onChange={(e) => setPrefs({ ...prefs, dailyGoalMinutes: Math.max(1, Number(e.target.value)) })}
              className="w-24"
              aria-label="Objectif quotidien personnalisé, en minutes"
            />
          </div>
          <span className="mt-2 block text-xs text-muted">Durée visée chaque jour, en minutes — alimente le Dashboard et le plan du jour.</span>
        </label>
        <label className="block text-sm font-medium">
          Objectif hebdomadaire
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {WEEKLY_GOAL_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={prefs.weeklyGoalMinutes === preset ? "primary" : "secondary"}
                onClick={() => setPrefs({ ...prefs, weeklyGoalMinutes: preset })}
              >
                {Math.round(preset / 60)} h
              </Button>
            ))}
            <Input
              type="number"
              value={prefs.weeklyGoalMinutes}
              min={1}
              onChange={(e) => setPrefs({ ...prefs, weeklyGoalMinutes: Math.max(1, Number(e.target.value)) })}
              className="w-24"
              aria-label="Objectif hebdomadaire personnalisé, en minutes"
            />
          </div>
          <span className="mt-2 block text-xs text-muted">Durée visée sur la semaine, en minutes — indépendant de l&apos;objectif quotidien.</span>
        </label>
        <label className="block text-sm font-medium">
          Date des concours
          <Input
            type="date"
            value={prefs.contestDate}
            onChange={(e) => setPrefs({ ...prefs, contestDate: e.target.value })}
            className="mt-2"
          />
        </label>
        <Button type="submit">
          {saved ? (
            <>
              <Check size={16} /> Enregistré
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </form>
    </Card>
  );
}
