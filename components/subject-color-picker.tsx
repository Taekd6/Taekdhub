"use client";

import { Check, RotateCcw } from "lucide-react";
import { Section } from "@/components/ui/section";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData } from "@/lib/storage";
import { subjectMeta, subjects } from "@/lib/study";
import {
  applySubjectColors,
  DEFAULT_SUBJECT_PALETTE,
  resolveSubjectColors,
  SUBJECT_PALETTES,
  type SubjectColorOverrides,
  type SubjectPaletteId,
} from "@/lib/subject-colors";
import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

/**
 * COULEURS DES MATIÈRES — Réglages.
 *
 * Deux niveaux, du plus large au plus fin :
 *
 *   1. une PALETTE (Néon, Pastel, Sunset, Océan) : sept teintes pensées
 *      ensemble, qui se distinguent deux à deux dans l'anneau du jour ;
 *   2. une SURCHARGE par matière (sélecteur natif), pour qui tient à « la
 *      chimie en rouge ». Elle survit au changement de palette.
 *
 * Tout s'applique IMMÉDIATEMENT à l'interface (`applySubjectColors` écrit les
 * variables CSS), puis s'enregistre. Comme le sélecteur d'apparence, on
 * relit le disque au moment d'écrire et on ne touche qu'aux deux champs que
 * ce composant possède : `usePrepahubData` n'est pas un contexte partagé, et
 * repartir de l'instantané du montage écraserait ce que le formulaire voisin
 * vient d'enregistrer.
 */
export function SubjectColorPicker() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const palette: SubjectPaletteId = ready ? preferences.subjectPalette : DEFAULT_SUBJECT_PALETTE;
  const overrides: SubjectColorOverrides = ready ? preferences.subjectColors : {};
  const effective = resolveSubjectColors(palette, overrides);
  const customized = Object.keys(overrides).length > 0 || palette !== DEFAULT_SUBJECT_PALETTE;

  function persist(nextPalette: SubjectPaletteId, nextOverrides: SubjectColorOverrides) {
    applySubjectColors(nextPalette, nextOverrides);
    savePreferences({ ...localData.preferences(), subjectPalette: nextPalette, subjectColors: nextOverrides });
  }

  function override(subject: Subject, hex: string) {
    persist(palette, { ...overrides, [subject]: hex });
  }

  function clearOverride(subject: Subject) {
    const next = { ...overrides };
    delete next[subject];
    persist(palette, next);
  }

  return (
    <Section
      variant="panel"
      title="Couleurs des matières"
      description="Chaque matière garde sa couleur partout : pastilles, anneau du jour, semaine et budgets."
      className="max-w-2xl"
      action={
        customized ? (
          <button
            type="button"
            onClick={() => persist(DEFAULT_SUBJECT_PALETTE, {})}
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-bold text-subtle hover:bg-inset hover:text-ink max-lg:min-h-11"
          >
            <RotateCcw size={13} /> Réinitialiser
          </button>
        ) : undefined
      }
    >
      <h3 className="t-subhead">Palette</h3>
      <div role="radiogroup" aria-label="Palette des matières" className="mt-3 grid gap-2 sm:grid-cols-2">
        {SUBJECT_PALETTES.map((option) => {
          const active = option.id === palette;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => persist(option.id, overrides)}
              className={cn(
                "press flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                active ? "border-accent/50 bg-accent/[0.08]" : "border-line hover:border-hairline/[0.14]"
              )}
            >
              <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {subjects.map((subject) => (
                  <span
                    key={subject}
                    className="h-5 w-5 rounded-full ring-2 ring-canvas"
                    style={{ backgroundColor: option.colors[subject] }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-ink">{option.label}</span>
              {active && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mt-7 border-t border-line pt-6">
        <h3 className="t-subhead">Par matière</h3>
        <p className="t-meta mt-1">Touche une pastille pour choisir une autre couleur. En thème clair, elle est assombrie juste assez pour rester lisible.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {subjects.map((subject) => {
            const custom = Boolean(overrides[subject]);
            return (
              <li key={subject} className="flex min-h-12 items-center gap-3 rounded-xl bg-inset px-3 py-2">
                <label className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full">
                  <span aria-hidden className={cn("absolute inset-0 rounded-full", subjectMeta[subject].solid)} />
                  <input
                    type="color"
                    value={effective[subject]}
                    onChange={(event) => override(subject, event.target.value)}
                    aria-label={`Couleur de ${subject}`}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span aria-hidden className="relative text-2xs font-extrabold text-[rgb(11_12_16)]">
                    {subjectMeta[subject].short}
                  </span>
                </label>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{subject}</span>
                {custom ? (
                  <button
                    type="button"
                    onClick={() => clearOverride(subject)}
                    className="press inline-flex min-h-8 shrink-0 items-center rounded-full px-2.5 text-2xs font-bold text-subtle hover:bg-inset hover:text-ink max-lg:min-h-11"
                    aria-label={`Rendre à ${subject} la couleur de la palette`}
                  >
                    Palette
                  </button>
                ) : (
                  <span className="tabular shrink-0 text-2xs font-semibold uppercase text-subtle">{effective[subject]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
