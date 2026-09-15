"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { suggestCapacityFromHistory, WEEKDAY_LABELS } from "@/lib/capacity";
import { localData, MAX_DAILY_CAPACITY_MINUTES } from "@/lib/storage";
import { formatSpan } from "@/lib/utils";

/** Trois marges lisibles. 20 % est le défaut ; 0 % existe pour qui veut planifier au cordeau, en connaissance de cause. */
const MARGIN_PRESETS = [0, 10, 20, 30];

/**
 * CAPACITÉ — le seul réglage dont dépend tout le planning.
 *
 * Sept champs, un par jour, parce qu'une semaine de prépa n'est pas
 * uniforme : le mercredi après-midi et le samedi n'ont rien à voir avec le
 * mardi. Une valeur unique rendait « j'ai 4 h samedi » littéralement
 * inexprimable.
 *
 * DÉCLARÉE, jamais devinée. TaekdHub peut SUGGÉRER des valeurs à partir des
 * séances réellement enregistrées — et seulement quand il y en a assez pour
 * que ça veuille dire quelque chose (voir
 * lib/capacity.ts#suggestCapacityFromHistory). La suggestion remplit les
 * champs ; c'est l'élève qui enregistre.
 */
export function CapacityForm() {
  const { preferences, sessions, savePreferences, ready } = usePrepahubData();
  const [capacity, setCapacity] = useState<number[]>(preferences.capacityByWeekday);
  const [margin, setMargin] = useState<number>(preferences.planningMarginPercent);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setCapacity(preferences.capacityByWeekday);
    setMargin(preferences.planningMarginPercent);
  }, [preferences]);

  const suggestions = useMemo(() => (ready ? suggestCapacityFromHistory(sessions) : []), [ready, sessions]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    // Même précaution que `PreferencesForm` : on réécrit par-dessus ce qui est
    // RÉELLEMENT enregistré à cet instant, pas par-dessus l'instantané pris
    // au montage — `usePrepahubData` n'est pas un contexte partagé, et le
    // sélecteur d'apparence vit sur la même page.
    savePreferences({ ...localData.preferences(), capacityByWeekday: capacity, planningMarginPercent: margin });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function applySuggestions() {
    setCapacity((current) => current.map((value, index) => suggestions.find((entry) => entry.weekday === index)?.minutes ?? value));
    setApplied(true);
  }

  const plannableWeek = capacity.reduce((sum, value) => sum + Math.floor((value * Math.max(0, 100 - margin)) / 100), 0);

  /*
   * ATTENDRE `ready` AVANT DE RENDRE — divergence d'hydratation constatée
   * sur le build de production (React #418), invisible en développement.
   *
   * `localData.preferences()` lit le localStorage dès le premier rendu côté
   * CLIENT, mais renvoie les valeurs par défaut côté SERVEUR, qui n'y a pas
   * accès. Le serveur écrivait donc « il te reste 16 h planifiables » et le
   * client « 19 h 30 » : React signalait le texte divergent et jetait le
   * rendu serveur. Les autres écrans qui affichent des données locales
   * attendent déjà `ready` pour cette raison (voir components/timer.tsx).
   */
  if (!ready) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <Section
      variant="panel"
      label="Planning"
      title="Ton temps réellement disponible"
      description="Ce que TaekdHub a le droit de remplir quand il répartit tes échéances. À ne pas confondre avec ton objectif : l'objectif est ce que tu vises, la capacité est ce dont tu disposes."
      className="max-w-2xl"
    >
      <form onSubmit={save} className="space-y-6">
        <div>
          <span className="t-subhead mb-2 block">Capacité par jour</span>
          {/* Deux colonnes sur téléphone : sept champs empilés feraient un
              formulaire de trois écrans pour sept nombres. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {WEEKDAY_LABELS.map((label, index) => (
              <label key={label} className="flex items-center justify-between gap-2">
                <span className="t-meta min-w-0 truncate">{label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    max={MAX_DAILY_CAPACITY_MINUTES}
                    value={capacity[index]}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(MAX_DAILY_CAPACITY_MINUTES, Math.round(Number(event.target.value) || 0)));
                      setCapacity((current) => current.map((entry, position) => (position === index ? value : entry)));
                    }}
                    className="w-[4.5rem] text-center"
                    aria-label={`Capacité du ${label.toLowerCase()}, en minutes`}
                  />
                  <span className="t-meta text-2xs">min</span>
                </span>
              </label>
            ))}
          </div>

          {suggestions.length > 0 && (
            <p className="t-meta mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* On DIT sur combien de journées repose la suggestion : sans ce
                  nombre, « d'après ton historique » est une affirmation
                  invérifiable. */}
              {`D'après tes séances : ${suggestions
                .map((entry) => `${WEEKDAY_LABELS[entry.weekday].toLowerCase()} ${entry.minutes} min (${entry.samples} j)`)
                .join(", ")}.`}
              <Button type="button" variant="link" size="sm" onClick={applySuggestions}>
                {applied ? "Appliqué" : "Utiliser"}
              </Button>
            </p>
          )}
        </div>

        <div>
          <span className="t-subhead mb-2 block">Marge</span>
          <SegmentedControl
            ariaLabel="Marge de planification"
            value={margin}
            onChange={setMargin}
            options={MARGIN_PRESETS.map((preset) => ({ value: preset, label: `${preset} %` }))}
          />
          <span className="t-meta mt-2 block max-w-[56ch]">
            Part de chaque journée que TaekdHub ne planifie jamais — pour les cours qui débordent, les exercices plus longs
            que prévu et les trajets. Il te reste {formatSpan(plannableWeek * 60)} planifiables par semaine.
          </span>
        </div>

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
