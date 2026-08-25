"use client";

import { cn } from "@/lib/cn";

/**
 * Sélecteur segmenté (« pilule ») — un seul choix parmi quelques options
 * courtes, présentées côte à côte dans un conteneur commun.
 *
 * Extrait d'une duplication littérale : le Dashboard (durée du plan du jour)
 * et l'écran d'aperçu de séance (dimensionner par temps / par nombre)
 * portaient exactement le même balisage et les mêmes classes, copiés à
 * l'identique. Les faire diverger visuellement n'était qu'une question de
 * temps — et surtout, les DEUX oubliaient `focus-ring` : le contrôle était
 * invisible au clavier, alors que tous les autres boutons de l'app le
 * signalent.
 *
 * Volontairement limité à ce cas précis : les puces du sélecteur de thème
 * (Réglages) sont un autre motif — chips bordées qui passent à la ligne, sur
 * plusieurs rangées — et n'ont rien à gagner à entrer de force ici.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Nomme le groupe pour les lecteurs d'écran (ex. « Durée du plan ») — les boutons seuls ne disent pas de quoi ils sont l'option. */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1 rounded-xl border border-hairline/[0.09] bg-black/20 p-1", className)}
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
              // `min-h-9`/`max-lg:min-h-10` : même raison que les tailles de
              // `Button` (voir components/ui/button.tsx) — mesuré à 28 px de
              // haut avant correction, bien trop court au doigt.
              "focus-ring min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition max-lg:min-h-10",
              active ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
