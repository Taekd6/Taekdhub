"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentForegroundCss, applyAccent, applyThemeMode, THEME_MODES, type ThemeMode, hexToRgb } from "@/lib/theme";
import { patchPreferences } from "@/lib/storage";
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
  const mode = ready ? preferences.themeMode : "system";

  // `patchPreferences` (lib/storage.ts) plutôt que `{ ...preferences, accent }` :
  // `preferences` ici vient de la PROPRE instance de `usePrepahubData` de ce
  // composant, indépendante de celle de PreferencesForm rendu juste au-dessus
  // sur cette même page — enregistrer un prénom ou un objectif là-bas puis
  // choisir une couleur ici écraserait silencieusement ce changement avec
  // l'instantané périmé de ce composant. `patchPreferences` relit toujours la
  // dernière valeur réellement stockée avant d'appliquer ce seul champ.
  function choose(hex: string) {
    // Applique la variable CSS directement ici (en plus de la persistance) :
    // `usePrepahubData` n'est pas un contexte partagé, chaque composant monté
    // (ex. le logo de la sidebar) a sa propre instance qui ne "verrait" pas
    // ce changement avant un rechargement — `applyAccent` agit sur le DOM,
    // donc immédiatement visible partout, sans dépendre d'un re-rendu React.
    applyAccent(hex);
    savePreferences(patchPreferences({ accent: hex }));
  }

  function chooseMode(next: ThemeMode) {
    applyThemeMode(next);
    savePreferences(patchPreferences({ themeMode: next }));
  }

  return (
    <Card className="max-w-2xl p-6">
      <p className="eyebrow">Apparence</p>

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-200">Mode</h2>
        <div className="mt-3 flex flex-wrap gap-2">
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
                  "focus-ring flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition",
                  active ? "border-accent/40 bg-accent/10 text-accent" : "border-hairline/[0.09] text-zinc-400 hover:border-hairline/[0.14] hover:text-zinc-200"
                )}
              >
                <Icon size={15} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 border-t border-hairline/[0.06] pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Couleur principale</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-500">
              Le texte posé sur l&apos;accent reste toujours lisible — la teinte s&apos;applique instantanément, sur toute l&apos;interface.
            </p>
          </div>
          {accent !== DEFAULT_ACCENT && (
            <button
              type="button"
              onClick={() => choose(DEFAULT_ACCENT)}
              className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-hairline/[0.045] hover:text-zinc-300"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
        {ACCENT_PRESETS.map((preset) => {
          const active = sameHex(preset.hex, accent);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => choose(preset.hex)}
              aria-pressed={active}
              title={preset.label}
              className="focus-ring flex flex-col items-center gap-1.5 rounded-lg p-1"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-xl border-2 transition-transform hover:scale-105"
                style={{ background: preset.hex, borderColor: active ? "rgba(255,255,255,0.55)" : "transparent" }}
              >
                {active && <Check size={16} style={{ color: accentForegroundCss(preset.hex) }} />}
              </span>
              <span className={cn("text-2xs", active ? "text-zinc-200" : "text-zinc-500")}>{preset.label}</span>
            </button>
          );
        })}

        <label className="focus-ring flex flex-col items-center gap-1.5 rounded-lg p-1">
          <span
            className="grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-xl border-2"
            style={{ borderColor: !isPreset ? "rgba(255,255,255,0.55)" : "transparent" }}
          >
            <input
              type="color"
              value={accent}
              onChange={(event) => choose(event.target.value)}
              aria-label="Couleur d'accent personnalisée"
              className="h-12 w-12 cursor-pointer border-none bg-transparent p-0"
            />
          </span>
          <span className={cn("text-2xs", !isPreset ? "text-zinc-200" : "text-zinc-500")}>Personnalisé</span>
        </label>
        </div>
      </div>
    </Card>
  );
}
