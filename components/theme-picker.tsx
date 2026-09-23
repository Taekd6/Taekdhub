"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Section } from "@/components/ui/section";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData } from "@/lib/storage";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentForegroundCss, applyAccent, applyThemeMode, THEME_MODES, type ThemeMode, hexToRgb } from "@/lib/theme";
import { cn } from "@/lib/cn";

function sameHex(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

/** Icône + libellé par mode — ordre d'affichage volontaire (clair, sombre, système), voir lib/theme.ts#THEME_MODES. */
const MODE_META: Record<ThemeMode, { label: string; icon: typeof Sun }> = {
  light: { label: "Clair", icon: Sun },
  dark: { label: "Sombre", icon: Moon },
  system: { label: "Système", icon: Monitor },
};

export function ThemePicker() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const accent = ready && hexToRgb(preferences.accent) ? preferences.accent : DEFAULT_ACCENT;
  const isPreset = ACCENT_PRESETS.some((preset) => sameHex(preset.hex, accent));
  const mode = ready ? preferences.themeMode : "dark";

  // `usePrepahubData` n'est pas un contexte partagé : chaque composant monté a
  // sa propre instance, et `preferences` n'est donc qu'un INSTANTANÉ pris au
  // montage de celui-ci. Repartir de cet instantané pour sauvegarder écrasait
  // silencieusement les réglages faits entre-temps ailleurs sur la page :
  // choisir une couleur d'accent ici, puis changer l'objectif quotidien dans
  // le formulaire juste au-dessus, et la couleur revenait à sa valeur
  // précédente. On relit donc le disque au moment d'écrire, et on n'y modifie
  // que le champ que ce composant possède réellement.
  function choose(hex: string) {
    // Applique la variable CSS directement ici (en plus de la persistance) :
    // aucune autre instance ne "verrait" ce changement avant un rechargement —
    // `applyAccent` agit sur le DOM, donc immédiatement visible partout.
    applyAccent(hex);
    savePreferences({ ...localData.preferences(), accent: hex });
  }

  function chooseMode(next: ThemeMode) {
    applyThemeMode(next);
    savePreferences({ ...localData.preferences(), themeMode: next });
  }

  /*
   * Deux réglages, et seulement deux : le mode, en sélecteur segmenté
   * façon iOS (piste grise, option retenue surélevée), et l'accent, en
   * pastilles rondes. Les « Couleurs par matière » de la refonte « Nuit »
   * ont disparu avec les couleurs elles-mêmes (lib/subject-colors.ts).
   */
  return (
    <Section
      variant="panel"
      title="Apparence"
      description="Noir et blanc, et une seule couleur : celle des boutons, des liens et de ce qu'il faut regarder."
      className="max-w-2xl"
    >
      <div>
        <h3 className="t-subhead">Mode</h3>
        <div role="group" aria-label="Mode d'apparence" className="mt-3 inline-flex w-full items-center gap-0.5 rounded-full bg-inset p-1 sm:w-auto">
          {THEME_MODES.map((option) => {
            const meta = MODE_META[option];
            const Icon = meta.icon;
            const active = mode === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseMode(option)}
                aria-pressed={active}
                className={cn(
                  "press flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold max-lg:min-h-11 sm:flex-none",
                  active ? "chip-on" : "text-muted hover:text-ink"
                )}
              >
                <Icon size={15} strokeWidth={2.2} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="t-subhead">Couleur d&apos;accent</h3>
            <p className="t-meta mt-1 max-w-[52ch]">
              Le texte posé dessus reste toujours lisible : la teinte est ajustée automatiquement selon le fond.
            </p>
          </div>
          {accent !== DEFAULT_ACCENT && (
            <button
              type="button"
              onClick={() => choose(DEFAULT_ACCENT)}
              className="press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-inset max-lg:min-h-11"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-2 gap-y-3">
          {ACCENT_PRESETS.map((preset) => {
            const active = sameHex(preset.hex, accent);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => choose(preset.hex)}
                aria-pressed={active}
                title={preset.label}
                className="press group flex w-16 flex-col items-center gap-2 rounded-2xl py-1"
              >
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full ring-offset-[3px] ring-offset-panel transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110",
                    active && "ring-2 ring-ink/80"
                  )}
                  style={{ background: preset.hex }}
                >
                  {active && <Check size={16} strokeWidth={3} style={{ color: accentForegroundCss(preset.hex) }} />}
                </span>
                <span className={cn("text-2xs font-semibold", active ? "text-ink" : "text-subtle")}>{preset.label}</span>
              </button>
            );
          })}

          <label className="press group flex w-16 cursor-pointer flex-col items-center gap-2 rounded-2xl py-1">
            <span
              className={cn(
                "grid h-10 w-10 place-items-center overflow-hidden rounded-full ring-offset-[3px] ring-offset-panel transition-transform duration-300 group-hover:scale-110",
                !isPreset && "ring-2 ring-ink/80"
              )}
            >
              <input
                type="color"
                value={accent}
                onChange={(event) => choose(event.target.value)}
                aria-label="Couleur d'accent personnalisée"
                className="h-12 w-12 cursor-pointer border-none bg-transparent p-0"
              />
            </span>
            <span className={cn("text-2xs font-semibold", !isPreset ? "text-ink" : "text-subtle")}>Autre</span>
          </label>
        </div>
      </div>
    </Section>
  );
}
