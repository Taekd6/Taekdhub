"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Group, Row } from "@/components/ui/grouped";
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
  // silencieusement les réglages faits entre-temps ailleurs sur la page. On
  // relit donc le disque au moment d'écrire, et on n'y modifie que le champ
  // que ce composant possède réellement.
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
   * Deux réglages, et seulement deux, en deux rangées d'une liste groupée :
   * le MODE en sélecteur segmenté façon iOS (piste grise, option retenue
   * surélevée), l'ACCENT en pastilles rondes, la retenue cochée et cerclée.
   */
  return (
    <Group
      title="Apparence"
      footer="Noir et blanc, et une seule couleur : celle des boutons, des liens et de ce qu'il faut regarder. Le texte posé dessus reste toujours lisible — la teinte est ajustée automatiquement selon le fond."
    >
      <Row label="Mode" stack>
        <div role="group" aria-label="Mode d'apparence" className="flex w-full items-center gap-0.5 rounded-full bg-inset p-1 sm:w-auto">
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
                <Icon size={15} strokeWidth={2.2} aria-hidden /> {meta.label}
              </button>
            );
          })}
        </div>
      </Row>

      <div className="py-4 pr-4 sm:pr-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.9375rem] font-semibold text-ink">Couleur d&apos;accent</p>
          {accent !== DEFAULT_ACCENT && (
            <button
              type="button"
              onClick={() => choose(DEFAULT_ACCENT)}
              className="press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-inset max-lg:min-h-11"
            >
              <RotateCcw size={13} aria-hidden /> Réinitialiser
            </button>
          )}
        </div>

        <div role="group" aria-label="Couleur d'accent" className="mt-4 grid grid-cols-4 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-1">
          {ACCENT_PRESETS.map((preset) => {
            const active = sameHex(preset.hex, accent);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => choose(preset.hex)}
                aria-pressed={active}
                aria-label={preset.label}
                className="press group flex min-w-0 flex-col items-center gap-2 rounded-2xl py-1 sm:w-[4.25rem]"
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full ring-offset-[3px] ring-offset-panel transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110 motion-reduce:group-hover:scale-100",
                    active && "ring-2 ring-ink"
                  )}
                  style={{ background: preset.hex }}
                >
                  {active && <Check size={18} strokeWidth={3} aria-hidden style={{ color: accentForegroundCss(preset.hex) }} />}
                </span>
                <span aria-hidden className={cn("text-2xs font-semibold", active ? "text-ink" : "text-subtle")}>
                  {preset.label}
                </span>
              </button>
            );
          })}

          <label className="press group flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-2xl py-1 sm:w-[4.25rem]">
            <span
              className={cn(
                "relative grid h-11 w-11 place-items-center overflow-hidden rounded-full ring-offset-[3px] ring-offset-panel transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100",
                !isPreset && "ring-2 ring-ink"
              )}
              style={{ background: "conic-gradient(from 90deg, #ff453a, #ff9f0a, #ffd60a, #30d158, #0a84ff, #bf5af2, #ff453a)" }}
            >
              <input
                type="color"
                value={accent}
                onChange={(event) => choose(event.target.value)}
                aria-label="Couleur d'accent personnalisée"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {!isPreset && (
                <span aria-hidden className="pointer-events-none grid h-7 w-7 place-items-center rounded-full" style={{ background: accent }}>
                  <Check size={14} strokeWidth={3} style={{ color: accentForegroundCss(accent) }} />
                </span>
              )}
            </span>
            <span aria-hidden className={cn("text-2xs font-semibold", !isPreset ? "text-ink" : "text-subtle")}>
              Autre
            </span>
          </label>
        </div>
      </div>
    </Group>
  );
}
