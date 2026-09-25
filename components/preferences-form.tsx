"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Group, Row } from "@/components/ui/grouped";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData, MAX_EVENING_MINIMUM_MINUTES, MAX_WEEKLY_SUBJECT_TARGET_MINUTES, type Preferences } from "@/lib/storage";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import type { Subject } from "@/lib/supabase/types";
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
 * Un seul formulaire, une seule sauvegarde — réparti en TROIS listes
 * groupées : toi, tes objectifs, ton budget par matière.
 */
/** Les matières réglables dans « Minimum du soir ». */
const EVENING_SUBJECTS: Subject[] = ["Mathématiques", "Physique"];

export function PreferencesForm() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  // TOUTES les rangées attendent `ready` : `prefs` est lu dans le
  // localStorage dès le premier rendu CLIENT, alors que le serveur rend les
  // valeurs par défaut — le préréglage allumé et le prénom divergeaient, et
  // React jetait tout le rendu serveur (erreur d'hydratation constatée).
  // Les groupes, eux, sont toujours là : `/settings#budgets` a son ancre.

  // N'écrit QUE les cinq champs de ce formulaire, par-dessus ce qui est
  // réellement enregistré à cet instant. `prefs` est un instantané pris au
  // montage, et `usePrepahubData` n'est pas un contexte partagé : envoyer
  // l'objet complet renvoyait aussi `accent` et `themeMode` tels qu'ils
  // étaient à l'ouverture de la page, annulant la couleur ou le mode que le
  // sélecteur d'apparence — sur cette même page Réglages — venait
  // d'enregistrer.
  function save(event: React.FormEvent) {
    event.preventDefault();
    savePreferences({
      ...localData.preferences(),
      displayName: prefs.displayName,
      dailyGoalMinutes: prefs.dailyGoalMinutes,
      weeklyGoalMinutes: prefs.weeklyGoalMinutes,
      contestDate: prefs.contestDate,
      weeklySubjectTargets: prefs.weeklySubjectTargets,
      eveningMinimums: prefs.eveningMinimums,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const subjectTotal = subjects.reduce((sum, subject) => sum + prefs.weeklySubjectTargets[subject], 0);

  return (
    <form onSubmit={save} className="space-y-10">
      <Group title="Toi" footer="La date des concours donne le J− de l'accueil.">
        {!ready ? (
          <div className="py-3 pr-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <Row label="Prénom" htmlFor="pref-name">
              <Input
                id="pref-name"
                value={prefs.displayName}
                onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
                placeholder="Ton prénom"
                className="w-40 text-right sm:w-52"
              />
            </Row>
            <Row label="Date des concours" htmlFor="pref-contest">
              <Input id="pref-contest" type="date" value={prefs.contestDate} onChange={(e) => setPrefs({ ...prefs, contestDate: e.target.value })} className="w-40 sm:w-44" />
            </Row>
          </>
        )}
      </Group>

      {/* Sélecteurs segmentés, pas quatre boutons dont l'actif en aplat
          plein : régler n'est pas agir, et le seul aplat d'accent de l'écran
          reste « Enregistrer ». Le champ nombre à côté couvre toute valeur
          hors préréglage. */}
      <Group title="Objectifs" footer="Le quotidien et l'hebdomadaire sont indépendants.">
        {!ready ? (
          <div className="py-3 pr-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <Row label="Chaque jour" hint="en minutes" stack>
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
                className="w-20 shrink-0 text-center"
                aria-label="Objectif quotidien personnalisé, en minutes"
              />
            </Row>
            <Row label="Chaque semaine" hint={formatMinutesSpan(prefs.weeklyGoalMinutes)} stack>
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
                className="w-20 shrink-0 text-center"
                aria-label="Objectif hebdomadaire personnalisé, en minutes"
              />
            </Row>
          </>
        )}
      </Group>

      {/* BUDGET PAR MATIÈRE — une rangée par matière, en minutes, avec sa
          lecture en heures sous le nom : « 480 » ne se lit pas d'un coup
          d'œil, « 8 h » si. Pas de préréglages : chaque matière a son propre
          ordre de grandeur. Voir lib/subject-targets.ts.

          Les rangées ne sont rendues qu'une fois `ready` : le total est un
          TEXTE calculé depuis le localStorage, que le serveur ne voit pas —
          même divergence d'hydratation que celle documentée dans
          components/work/capacity-form.tsx. Le groupe, lui, est toujours
          là : c'est l'ancre de `/settings#budgets`. */}
      <Group
        id="budgets"
        title="Budget par matière"
        footer={
          ready ? (
            <>
              Minutes par semaine, 0 pour ne pas suivre. Soit{" "}
              <span className="tabular font-semibold text-ink">{formatMinutesSpan(subjectTotal)}</span> au total
              {/* Deux objectifs saisis séparément finissent par diverger ; le
                  dire ici, au moment où on les règle, évite de le découvrir
                  sur l'accueil. Un constat, pas une correction automatique. */}
              {subjectTotal > prefs.weeklyGoalMinutes
                ? `, au-dessus de ton objectif hebdomadaire (${formatMinutesSpan(prefs.weeklyGoalMinutes)}).`
                : "."}
            </>
          ) : undefined
        }
      >
        {!ready ? (
          <div className="py-3 pr-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          subjects.map((subject) => {
            const value = prefs.weeklySubjectTargets[subject];
            const id = `budget-${subject}`;
            return (
              <Row
                key={subject}
                htmlFor={id}
                icon={<SubjectAvatar subject={subject} />}
                label={subject}
                hint={value > 0 ? `${formatMinutesSpan(value)} par semaine` : "non suivie"}
              >
                <Input
                  id={id}
                  type="number"
                  min={0}
                  step={15}
                  max={MAX_WEEKLY_SUBJECT_TARGET_MINUTES}
                  value={value}
                  onChange={(event) => {
                    const next = Math.max(0, Math.min(MAX_WEEKLY_SUBJECT_TARGET_MINUTES, Math.round(Number(event.target.value) || 0)));
                    setPrefs({ ...prefs, weeklySubjectTargets: { ...prefs.weeklySubjectTargets, [subject]: next } });
                  }}
                  className="w-20 text-center"
                  aria-describedby={`${id}-unit`}
                />
                <span id={`${id}-unit`} className="t-meta w-7 text-[0.8125rem]">
                  min
                </span>
              </Row>
            );
          })
        )}
      </Group>

      {/* MINIMUM DU SOIR — voir lib/evening-minimums.ts. Une ligne par jour,
          deux matières : la règle de l'élève (maths et physique). */}
      <Group id="soirs" title="Minimum du soir" footer="Minutes à faire au moins ce jour-là. 0 partout = soir libre.">
        {!ready ? (
          <div className="py-3 pr-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          WEEKDAY_LABELS.map((label, dayIndex) => (
            <Row key={label} label={label} hint={EVENING_SUBJECTS.every((subject) => !prefs.eveningMinimums[dayIndex]?.[subject]) ? "soir libre" : undefined}>
              {EVENING_SUBJECTS.map((subject) => {
                const id = `soir-${dayIndex}-${subject}`;
                return (
                  <label key={subject} htmlFor={id} className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                    {subject === "Mathématiques" ? "Maths" : subject}
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={15}
                      max={MAX_EVENING_MINIMUM_MINUTES}
                      value={prefs.eveningMinimums[dayIndex]?.[subject] ?? 0}
                      onChange={(event) => {
                        const next = Math.max(0, Math.min(MAX_EVENING_MINIMUM_MINUTES, Math.round(Number(event.target.value) || 0)));
                        const days = prefs.eveningMinimums.map((day, index) => {
                          if (index !== dayIndex) return day;
                          const updated = { ...day };
                          if (next > 0) updated[subject] = next;
                          else delete updated[subject];
                          return updated;
                        });
                        setPrefs({ ...prefs, eveningMinimums: days });
                      }}
                      className="w-[4.5rem] px-1 text-center tabular"
                    />
                  </label>
                );
              })}
            </Row>
          ))
        )}
      </Group>

      <div className="flex justify-end px-1">
        <Button type="submit" size="lg" className="max-sm:w-full">
          {saved ? (
            <>
              <Check size={16} aria-hidden /> Enregistré
            </>
          ) : (
            "Enregistrer mes objectifs"
          )}
        </Button>
      </div>
    </form>
  );
}
