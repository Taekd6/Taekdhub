"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/sheet";
import { formatMinutes } from "@/lib/domain/date";
import { useStore } from "@/lib/store/store";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentForegroundCss, hexToRgb, THEME_MODES, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/cn";

const MODE_META: Record<ThemeMode, { label: string; icon: typeof Sun }> = {
  light: { label: "Clair", icon: Sun },
  dark: { label: "Sombre", icon: Moon },
  system: { label: "Système", icon: Monitor },
};

/**
 * PRÉFÉRENCES — identité, seuils, apparence.
 *
 * Trois réglages seulement, parce qu'il n'y a que trois choses qu'un élève ait
 * réellement envie de changer. Le seuil « journée tendue » en fait partie :
 * c'est lui qui décide à partir de quand TaekdHub avertit, et une alerte dont
 * on ne peut pas régler la sensibilité finit par être ignorée.
 */
export function PreferencesForm() {
  const { state, saveSettings } = useStore();
  const settings = state.settings;
  const accent = hexToRgb(settings.accent) ? settings.accent : DEFAULT_ACCENT;
  const isPreset = ACCENT_PRESETS.some((preset) => preset.hex.toLowerCase() === accent.toLowerCase());

  return (
    <>
      <Section label="Toi" title="Préférences">
        <div className="space-y-5">
          <Field label="Prénom" hint="Utilisé pour te saluer sur l'écran Aujourd'hui. Reste dans ton navigateur.">
            <Input
              value={settings.displayName}
              onChange={(event) => saveSettings({ displayName: event.target.value })}
              placeholder="Ton prénom"
              className="max-w-xs"
            />
          </Field>

          <Field
            label="Durée par défaut d'une tâche"
            hint="Utilisée quand tu n'estimes pas une tâche — le planning a toujours besoin d'un nombre."
          >
            <Input
              type="number"
              min={5}
              max={240}
              step={5}
              value={settings.defaultEstimateMinutes}
              onChange={(event) => saveSettings({ defaultEstimateMinutes: Math.min(240, Math.max(5, Number(event.target.value) || 45)) })}
              className="w-28"
            />
          </Field>

          <Field
            label={`Journée « tendue » à partir de ${Math.round(settings.tightLoadRatio * 100)} %`}
            hint={`Au-delà de cette part de ta capacité, TaekdHub t'avertit avant même le dépassement. Sur une soirée de 4 h, c'est ${formatMinutes(Math.round(240 * settings.tightLoadRatio))}.`}
          >
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={Math.round(settings.tightLoadRatio * 100)}
              onChange={(event) => saveSettings({ tightLoadRatio: Number(event.target.value) / 100 })}
              className="w-full max-w-xs accent-[rgb(var(--accent-rgb))]"
              aria-label="Seuil de journée tendue, en pourcentage"
            />
          </Field>
        </div>
      </Section>

      <Section label="Apparence" title="Thème et couleur">
        <div className="space-y-6">
          <div>
            <p className="t-label mb-2">Mode</p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_MODES.map((mode) => {
                const { label, icon: Icon } = MODE_META[mode];
                const active = settings.themeMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => saveSettings({ themeMode: mode })}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                      active ? "border-accent/40 bg-accent/[0.08] text-accent" : "row-hover border-line text-muted"
                    )}
                  >
                    <Icon size={15} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="t-label mb-2">Accent</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const active = preset.hex.toLowerCase() === accent.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => saveSettings({ accent: preset.hex })}
                    aria-pressed={active}
                    title={preset.label}
                    aria-label={preset.label}
                    className="grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-[rgb(var(--canvas-rgb))] transition-[box-shadow]"
                    style={{
                      background: preset.hex,
                      color: accentForegroundCss(preset.hex),
                      boxShadow: active ? `0 0 0 2px rgb(var(--ink-rgb) / 0.6)` : undefined,
                    }}
                  >
                    {active && <Check size={15} strokeWidth={2.5} />}
                  </button>
                );
              })}

              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
                <span>Personnalisée</span>
                <input
                  type="color"
                  value={accent}
                  onChange={(event) => saveSettings({ accent: event.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Couleur d'accent personnalisée"
                />
              </label>

              {(!isPreset || accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => saveSettings({ accent: DEFAULT_ACCENT })}
                  className="row-hover flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-subtle"
                >
                  <RotateCcw size={14} /> Défaut
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
