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
  const mode = ready ? preferences.themeMode : "system";

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

  return (
    <Section
      variant="panel"
      label="Apparence"
      title="Comment TaekdHub s'affiche"
      description="Le mode suit ton système par défaut ; la couleur d'accent s'applique instantanément à toute l'interface."
      className="max-w-2xl"
    >
      <div>
        <h3 className="t-subhead">Mode</h3>
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
                  "flex min-h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors max-lg:min-h-11",
                  active ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink"
                )}
              >
                <Icon size={15} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-7 border-t border-line pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="t-subhead">Couleur principale</h3>
            <p className="t-meta mt-1.5 max-w-[52ch]">
              Le texte posé sur l&apos;accent reste toujours lisible : la teinte est assombrie automatiquement quand le
              fond est clair.
            </p>
          </div>
          {accent !== DEFAULT_ACCENT && (
            <button
              type="button"
              onClick={() => choose(DEFAULT_ACCENT)}
              className="row-hover flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-subtle hover:text-ink max-lg:min-h-11"
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
              <span className={cn("text-2xs", active ? "text-ink" : "text-muted")}>{preset.label}</span>
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
          <span className={cn("text-2xs", !isPreset ? "text-ink" : "text-muted")}>Personnalisé</span>
        </label>
        </div>
      </div>
    </Section>
  );
}
