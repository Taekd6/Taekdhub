"use client";

import { cn } from "@/lib/cn";

/**
 * PASTILLES DE FILTRE — les « chips » d'apple.com (Store, Support) : une
 * rangée de pilules, celle qui est retenue SURÉLEVÉE (`.chip-on`), les
 * autres en creux gris.
 *
 * Pourquoi pas le sélecteur segmenté (components/ui/segmented.tsx) : il
 * range toutes les options dans UNE piste, qui se partage la largeur. Au-delà
 * de quatre options, sur un téléphone, les libellés se coupent (« Cou… ») ou
 * se réduisent à une lettre (« M », « P ») qu'il faut deviner. Les pastilles
 * PASSENT À LA LIGNE : chaque option garde son mot entier.
 *
 *   options   `{ value, label, count? }[]` — `count` s'écrit en gris après
 *             le libellé (« Maths 12 »).
 *   ariaLabel nom du groupe (« Matière », « Période »…).
 *
 * Accessibilité : un groupe de boutons à bascule (`aria-pressed`), 44 px de
 * haut sous `lg`, focus visible par la règle globale.
 */
export function FilterPills<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "press inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[0.8125rem] font-semibold max-lg:min-h-11",
              active ? "chip-on" : "bg-inset text-muted hover:text-ink"
            )}
          >
            {option.label}
            {option.count !== undefined && <span className={cn("tabular font-medium", active ? "text-muted" : "text-subtle")}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
