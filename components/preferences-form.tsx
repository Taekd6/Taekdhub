"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { PLAN_DURATION_PRESETS } from "@/lib/plan";
import { subjects } from "@/lib/study";
import type { Preferences } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

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

  function save(event: React.FormEvent) {
    event.preventDefault();
    savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Échéance par matière (Sprint planification hebdomadaire adaptative) —
  // clé absente = pas d'échéance pour cette matière (voir
  // lib/storage.ts#normalizeSubjectDeadlines) : une valeur vide RETIRE la clé
  // plutôt que de la garder à `""`, pour ne jamais accumuler d'entrées
  // vides dans la préférence sauvegardée.
  function setSubjectDeadline(subject: Subject, value: string) {
    const next = { ...prefs.subjectDeadlines };
    if (value) next[subject] = value;
    else delete next[subject];
    setPrefs({ ...prefs, subjectDeadlines: next });
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
        <div>
          <p className="text-sm font-medium">Échéances par matière</p>
          <p className="mt-1 text-xs text-muted">
            DS, colle, DM… facultatif. Prioritaire sur la date des concours pour la matière concernée — les autres matières restent basées sur elle.
          </p>
          <div className="mt-3 space-y-2">
            {subjects.map((subject) => (
              <div key={subject} className="flex items-center gap-3">
                <SubjectAvatar subject={subject} size="sm" />
                <span className="w-36 shrink-0 truncate text-sm text-zinc-300">{subject}</span>
                <Input
                  type="date"
                  value={prefs.subjectDeadlines[subject] ?? ""}
                  onChange={(e) => setSubjectDeadline(subject, e.target.value)}
                  className="flex-1"
                  aria-label={`Échéance pour ${subject}`}
                />
              </div>
            ))}
          </div>
        </div>
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
