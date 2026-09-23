"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData, MAX_WEEKLY_SUBJECT_TARGET_MINUTES, type Preferences } from "@/lib/storage";
import { subjects } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * Préréglages "objectif quotidien", en minutes — mêmes valeurs que les
 * durées de séance de l'ancien plan d'exercices (lib/plan.ts, retiré avec la
 * banque), pour ne rien changer à ce que l'élève a l'habitude de choisir.
 */
const DAILY_GOAL_PRESETS = [20, 45, 60, 90];

/** Préréglages "objectif hebdomadaire" (Sprint Plan de travail), en minutes — 3h/5h/7h, plus une valeur libre déjà couverte par le champ nombre ci-dessous. */
const WEEKLY_GOAL_PRESETS = [180, 300, 420];

/**
 * Réglages (Sprint 3G : fusion de l'ancienne page Profil, séparée sans
 * raison réelle — un seul champ chacune, jamais consultées indépendamment).
 * Un seul formulaire, une seule sauvegarde.
 */
export function PreferencesForm() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  // N'écrit QUE les cinq champs de ce formulaire, par-dessus ce qui est
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
      weeklySubjectTargets: prefs.weeklySubjectTargets,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const subjectTotal = subjects.reduce((sum, subject) => sum + prefs.weeklySubjectTargets[subject], 0);

  return (
    <Section
      variant="panel"
      label="Rythme"
      title="Ton identité de travail"
      description="Tes objectifs alimentent l'accueil, le plan du jour et la mesure de ta semaine."
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
              options={DAILY_GOAL_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
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

        {/* BUDGET PAR MATIÈRE — une ligne par matière, en minutes, avec sa
            lecture en heures à côté : « 480 » ne se lit pas d'un coup d'œil,
            « 8 h » si. Pas de préréglages : chaque matière a son propre
            ordre de grandeur, et sept sélecteurs segmentés feraient un
            formulaire de deux écrans. Voir lib/subject-targets.ts.

            Rendu seulement une fois `ready` : le total est un TEXTE calculé
            depuis le localStorage, que le serveur ne voit pas — même
            divergence d'hydratation que celle documentée dans
            components/work/capacity-form.tsx. */}
        {!ready ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (
          <div>
            <span className="t-subhead mb-2 block">Budget par matière</span>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {subjects.map((subject) => {
                const value = prefs.weeklySubjectTargets[subject];
                return (
                  <label key={subject} className="flex items-center gap-2.5">
                    <SubjectAvatar subject={subject} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">{subject}</span>
                    <Input
                      type="number"
                      min={0}
                      step={15}
                      max={MAX_WEEKLY_SUBJECT_TARGET_MINUTES}
                      value={value}
                      onChange={(event) => {
                        const next = Math.max(0, Math.min(MAX_WEEKLY_SUBJECT_TARGET_MINUTES, Math.round(Number(event.target.value) || 0)));
                        setPrefs({ ...prefs, weeklySubjectTargets: { ...prefs.weeklySubjectTargets, [subject]: next } });
                      }}
                      className="w-[4.5rem] shrink-0 text-center"
                      aria-label={`Budget hebdomadaire en ${subject}, en minutes`}
                    />
                    {/* Largeur fixe : la colonne des champs reste alignée,
                        que l'aide dise « 8 h » ou « non suivie ». */}
                    <span className="tabular t-meta w-16 shrink-0 text-2xs">{value > 0 ? formatMinutesSpan(value) : "non suivie"}</span>
                  </label>
                );
              })}
            </div>
            <span className="t-meta mt-2 block max-w-[56ch]">
              Minutes par semaine, du lundi au dimanche — 0 pour ne pas suivre une matière. Soit{" "}
              <span className="tabular text-ink">{formatMinutesSpan(subjectTotal)}</span> au total
              {/* Deux objectifs saisis séparément finissent par diverger ; le
                  dire ici, au moment où on les règle, évite de le découvrir
                  sur l'accueil. Un constat, pas une correction automatique. */}
              {subjectTotal > prefs.weeklyGoalMinutes
                ? `, au-dessus de ton objectif hebdomadaire (${formatMinutesSpan(prefs.weeklyGoalMinutes)}).`
                : "."}
            </span>
          </div>
        )}

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
