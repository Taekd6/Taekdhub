"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Group, Row } from "@/components/ui/grouped";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData } from "@/lib/storage";
import { applyPalette, applyThemeMode, DEFAULT_PALETTE, PALETTES, THEME_MODES, type PaletteId, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/cn";

/** Icône + libellé par mode — ordre d'affichage volontaire (clair, sombre, système), voir lib/theme.ts#THEME_MODES. */
const MODE_META: Record<ThemeMode, { label: string; icon: typeof Sun }> = {
  light: { label: "Clair", icon: Sun },
  dark: { label: "Sombre", icon: Moon },
  system: { label: "Système", icon: Monitor },
};

/**
 * APPARENCE — deux réglages, et seulement deux.
 *
 *   MODE      clair / sombre / système, en sélecteur segmenté.
 *   PALETTE   quatre PASTILLES EN DÉGRADÉ (Aurora, Sunset, Océan, Néon) : on
 *             choisit une ambiance, pas une couleur. Chaque pastille montre
 *             le dégradé de marque ET, en petit dessous, les deux premières
 *             cartes qu'il colore — ce qu'on verra vraiment à l'accueil.
 *
 * Plus de sélecteur de couleur libre : une palette est un ensemble réglé à
 * la main (encre lisible, boutons à 4,5:1, cartes accordées) qu'un hex
 * isolé ne peut pas reconstituer.
 */
export function ThemePicker() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const palette = ready ? preferences.palette : DEFAULT_PALETTE;
  const mode = ready ? preferences.themeMode : "light";

  // `usePrepahubData` n'est pas un contexte partagé : chaque composant monté a
  // sa propre instance, et `preferences` n'est donc qu'un INSTANTANÉ pris au
  // montage de celui-ci. On relit donc le disque au moment d'écrire, et on
  // n'y modifie que le champ que ce composant possède réellement. Les
  // variables CSS sont posées tout de suite sur `<html>` : aucune autre
  // instance ne « verrait » le changement avant un rechargement.
  function choose(id: PaletteId) {
    applyPalette(id);
    savePreferences({ ...localData.preferences(), palette: id });
  }

  function chooseMode(next: ThemeMode) {
    applyThemeMode(next);
    savePreferences({ ...localData.preferences(), themeMode: next });
  }

  return (
    <Group title="Apparence" footer="Une ambiance en dégradé pour les cartes, la courbe et les boutons. Le texte reste toujours lisible, quelle que soit la palette.">
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
                  "press flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold max-lg:min-h-11 sm:flex-none",
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
        <p className="text-[0.9375rem] font-bold text-ink">Palette</p>
        <div role="group" aria-label="Palette" className="mt-4 grid grid-cols-4 gap-3 sm:gap-4">
          {PALETTES.map((option) => {
            const active = option.id === palette;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                aria-pressed={active}
                aria-label={option.label}
                className="bounce-press group flex min-w-0 flex-col items-center gap-2 rounded-2xl py-1"
              >
                <span
                  className={cn(
                    "sheen relative grid aspect-square w-full max-w-[4.5rem] place-items-center overflow-hidden rounded-[1.25rem] ring-offset-[3px] ring-offset-panel",
                    active && "ring-[2.5px] ring-ink"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${option.c1}, ${option.c2})`,
                    boxShadow: `0 10px 22px -10px ${option.c1}`,
                  }}
                >
                  {/* Les deux premières cartes de la palette, en petit. */}
                  <span aria-hidden className="absolute bottom-2 right-2 flex gap-1">
                    {option.cards.slice(0, 2).map(([a, b]) => (
                      <span key={a} className="h-3 w-3 rounded-[5px] ring-2 ring-white/60" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
                    ))}
                  </span>
                  {active && (
                    <span className="pop grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#0b0b14]">
                      <Check size={16} strokeWidth={3.2} aria-hidden />
                    </span>
                  )}
                </span>
                <span aria-hidden className={cn("text-2xs font-bold", active ? "text-ink" : "text-subtle")}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Group>
  );
}
