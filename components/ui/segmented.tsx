"use client";

import { cn } from "@/lib/cn";

/**
 * SÉLECTEUR SEGMENTÉ — un choix parmi quelques options courtes.
 *
 * Une piste en creux, en pilule, et l'option retenue SURÉLEVÉE (`.chip-on`,
 * app/globals.css) plutôt que teintée : c'est la convention que tout le monde
 * reconnaît, et elle tient dans les deux thèmes.
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
      className={cn(
        // Pleine largeur sous `sm`, options réparties à parts égales : quatre
        // options de durée débordaient d'une colonne de 246 px à 320 px de
        // large. Une largeur imposée règle le débordement ET donne des cibles
        // plus larges au doigt, sans rien changer sur grand écran.
        "flex w-full items-center gap-0.5 rounded-full bg-inset p-1 sm:inline-flex sm:w-auto",
        className
      )}
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
              "press min-w-0 flex-1 truncate rounded-full font-bold sm:flex-none",
              /* La cible tactile est garantie par la hauteur (40 px sous
                 `lg`), pas par la largeur : le rembourrage peut se resserrer
                 sur un téléphone sans rogner « 60 min ». */
              size === "sm"
                ? "min-h-7 px-2 text-2xs max-lg:min-h-10 sm:px-2.5"
                : "min-h-8 px-2 text-[0.8125rem] max-lg:min-h-10 sm:px-3.5",
              active ? "chip-on" : "text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
