"use client";

import { Check, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentForegroundCss, applyAccent, hexToRgb } from "@/lib/theme";
import { cn } from "@/lib/cn";

function sameHex(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export function ThemePicker() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const accent = ready && hexToRgb(preferences.accent) ? preferences.accent : DEFAULT_ACCENT;
  const isPreset = ACCENT_PRESETS.some((preset) => sameHex(preset.hex, accent));

  function choose(hex: string) {
    // Applique la variable CSS directement ici (en plus de la persistance) :
    // `usePrepahubData` n'est pas un contexte partagé, chaque composant monté
    // (ex. le logo de la sidebar) a sa propre instance qui ne "verrait" pas
    // ce changement avant un rechargement — `applyAccent` agit sur le DOM,
    // donc immédiatement visible partout, sans dépendre d'un re-rendu React.
    applyAccent(hex);
    savePreferences({ ...preferences, accent: hex });
  }

  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Apparence</p>
          <h2 className="mt-2 text-lg font-semibold">Choisis ta couleur d&apos;accent.</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Le texte posé sur l&apos;accent reste toujours lisible — la teinte s&apos;applique instantanément, sur toute l&apos;interface.
          </p>
        </div>
        {accent !== DEFAULT_ACCENT && (
          <button
            type="button"
            onClick={() => choose(DEFAULT_ACCENT)}
            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-300"
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
    </Card>
  );
}
