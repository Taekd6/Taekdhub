"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import type { Preferences } from "@/lib/storage";

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

  function save(event: React.FormEvent) {
    event.preventDefault();
    savePreferences(prefs);
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
          <Input
            type="number"
            value={prefs.dailyGoalMinutes}
            min={1}
            onChange={(e) => setPrefs({ ...prefs, dailyGoalMinutes: Math.max(1, Number(e.target.value)) })}
            className="mt-2"
          />
          <span className="mt-2 block text-xs text-muted">Durée visée en minutes.</span>
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
