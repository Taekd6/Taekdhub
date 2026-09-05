"use client";

import { cn } from "@/lib/cn";

/**
 * SÉLECTEUR SEGMENTÉ — un choix parmi quelques options courtes.
 *
 * La pastille active est SURÉLEVÉE (fond de panneau + filet) plutôt que
 * teintée : deux gris pâles côte à côte, en thème clair, ne se distinguaient
 * pas. C'est aussi la convention que tout le monde reconnaît.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Nomme le groupe pour les lecteurs d'écran — les options seules ne disent pas de quoi elles sont l'alternative. */
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-inset p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "rounded-[0.4375rem] font-medium transition-colors",
              size === "sm"
                ? "min-h-7 px-2 text-2xs max-lg:min-h-10"
                : "min-h-8 px-2.5 text-[0.8125rem] max-lg:min-h-10",
              active
                ? "border border-line bg-panel text-ink"
                : "border border-transparent text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
