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

  /**
   * Sauvegarde à chaque changement (Sprint Study OS Phase 6) — ce formulaire
   * était le seul de la page Réglages à exiger un clic sur "Enregistrer"
   * avant de persister quoi que ce soit (weekly-plan-editor.tsx et
   * deadlines-manager.tsx sauvegardent déjà à chaque interaction) : quitter la
   * page sans avoir remarqué/cliqué ce bouton effaçait silencieusement toute
   * modification, détecté en direct en répétant exactement ce geste pendant
   * l'audit go-live. `save`/"Enregistrer" restent inchangés (juste redondants
   * avec ce qui est déjà persisté) pour ne rien retirer à l'existant.
   */
  function commit(next: Preferences) {
    setPrefs(next);
    savePreferences(next);
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
    commit({ ...prefs, subjectDeadlines: next });
  }

  // Objectif du jour par matière (Sprint Study OS — Aujourd'hui) — même
  // convention que `setSubjectDeadline` ci-dessus : une valeur vide ou ≤ 0
  // RETIRE la clé plutôt que de la garder à 0 (voir
  // lib/storage.ts#normalizeDailySubjectGoals).
  function setDailySubjectGoal(subject: Subject, value: string) {
    const next = { ...prefs.dailySubjectGoals };
    const minutes = Number(value);
    if (value && minutes > 0) next[subject] = minutes;
    else delete next[subject];
    commit({ ...prefs, dailySubjectGoals: next });
  }

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={save} className="space-y-5">
        <label className="block text-sm font-medium">
          Prénom
          <Input
            value={prefs.displayName}
            onChange={(e) => commit({ ...prefs, displayName: e.target.value })}
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
                onClick={() => commit({ ...prefs, dailyGoalMinutes: preset })}
              >
                {preset} min
              </Button>
            ))}
            <Input
              type="number"
              value={prefs.dailyGoalMinutes}
              min={1}
              onChange={(e) => commit({ ...prefs, dailyGoalMinutes: Math.max(1, Number(e.target.value)) })}
              className="w-24"
              aria-label="Objectif quotidien personnalisé, en minutes"
            />
          </div>
          <span className="mt-2 block text-xs text-muted">Durée visée chaque jour, en minutes — alimente le Dashboard et le plan du jour.</span>
        </label>
        <label className="block text-sm font-medium">
          Objectif du jour — nombre d&apos;exercices
          <Input
            type="number"
            min={1}
            value={prefs.dailyExerciseGoal ?? ""}
            onChange={(e) => commit({ ...prefs, dailyExerciseGoal: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
            placeholder="Facultatif"
            className="mt-2 w-24"
            aria-label="Objectif du jour, en nombre d'exercices"
          />
          <span className="mt-2 block text-xs text-muted">Facultatif, indépendant du temps — laisse vide pour ne suivre que la durée.</span>
        </label>
        <div>
          <p className="text-sm font-medium">Objectif du jour par matière</p>
          <p className="mt-1 text-xs text-muted">Facultatif — répartis ton objectif quotidien si tu veux garantir un minimum par matière. Laisse à 0 pour ne pas en fixer.</p>
          <div className="mt-3 space-y-2">
            {subjects.map((subject) => (
              <div key={subject} className="flex items-center gap-3">
                <SubjectAvatar subject={subject} size="sm" />
                <span className="w-36 shrink-0 truncate text-sm text-zinc-300">{subject}</span>
                <Input
                  type="number"
                  min={0}
                  value={prefs.dailySubjectGoals[subject] ?? ""}
                  onChange={(e) => setDailySubjectGoal(subject, e.target.value)}
                  placeholder="0"
                  className="w-24"
                  aria-label={`Objectif du jour pour ${subject}, en minutes`}
                />
                <span className="text-xs text-muted">min</span>
              </div>
            ))}
          </div>
        </div>
        <label className="block text-sm font-medium">
          Objectif hebdomadaire
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {WEEKLY_GOAL_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={prefs.weeklyGoalMinutes === preset ? "primary" : "secondary"}
                onClick={() => commit({ ...prefs, weeklyGoalMinutes: preset })}
              >
                {Math.round(preset / 60)} h
              </Button>
            ))}
            <Input
              type="number"
              value={prefs.weeklyGoalMinutes}
              min={1}
              onChange={(e) => commit({ ...prefs, weeklyGoalMinutes: Math.max(1, Number(e.target.value)) })}
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
            onChange={(e) => commit({ ...prefs, contestDate: e.target.value })}
            className="mt-2"
          />
        </label>
        <div>
          <p className="text-sm font-medium">Échéances par matière</p>
          <p className="mt-1 text-xs text-muted">
            Date de repli, facultative, si tu n&apos;as pas encore créé de DS ou khôlle précis pour cette matière — prioritaire sur la date des concours, les autres matières restent basées sur elle. Pour associer des chapitres précis à un DS ou une khôlle, utilise plutôt « DS, khôlles et leurs chapitres » plus bas.
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
