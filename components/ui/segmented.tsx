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
              // `min-h-8`/`max-lg:min-h-11` : même raison que les tailles de
              // `Button` (voir components/ui/button.tsx) — mesuré à 28 px de
              // haut à l'origine, puis 40, toujours sous les 44 px que ce
              // même dépôt s'impose ailleurs. C'est le contrôle qui règle la
              // durée de la séance du jour : il se touche debout.
              "focus-ring min-h-8 rounded-[0.4rem] px-2.5 text-xs font-medium transition-colors max-lg:min-h-11",
              // Pastille SURÉLEVÉE plutôt que teintée : une teinte d'accent à
              // 15 % se distinguait à peine de la piste en thème clair (deux
              // gris pâles côte à côte). Un fond de panneau plus une ombre
              // courte se lisent immédiatement dans les deux thèmes — c'est
              // aussi la convention que tout le monde reconnaît.
              active
                ? "bg-panel text-ink shadow-[0_1px_2px_rgba(0,0,0,.14)]"
                : "text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
