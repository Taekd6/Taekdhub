"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * LES DEUX CONTRÔLES PROPRES À L'ACCUEIL GUIDÉ.
 *
 * Tout le reste vient de components/ui/* (boutons, champs, sélecteur
 * segmenté, jauges) : l'accueil adopte donc le thème en vigueur sans rien
 * redéfinir. Seuls manquaient un compteur de DURÉE au doigt et les points de
 * progression — deux gestes que l'application n'avait nulle part ailleurs.
 */

/**
 * COMPTEUR DE DURÉE — « − 1 h 30 + ».
 *
 * Deux boutons ronds de 44 px au moins (la cible tactile admise), la valeur
 * au milieu en chiffres tabulaires pour qu'elle ne danse pas d'un cran à
 * l'autre. Pas de champ texte : taper « 1h30 » sur un téléphone est une
 * corvée, et la demi-heure suffit à tout exprimer ici.
 *
 * `size="lg"` : le grand compteur d'un écran à une seule question (objectif
 * du jour) ; `md` : une rangée dans une liste (matières, jours).
 *
 * Accessibilité : le groupe porte le nom (« Mathématiques »), chaque bouton
 * dit ce qu'il fait (« Retirer 30 min à Mathématiques »), et la valeur est
 * annoncée à chaque changement (`aria-live`).
 */
export function MinuteStepper({
  value,
  onChange,
  label,
  min = 0,
  max,
  step = 30,
  size = "md",
  emptyLabel,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Ce que règle le compteur — lu par les lecteurs d'écran. */
  label: string;
  min?: number;
  max: number;
  step?: number;
  size?: "md" | "lg";
  /** Texte affiché à zéro (« Pas suivie », « Repos ») plutôt que « 0 min ». */
  emptyLabel?: string;
  className?: string;
}) {
  const large = size === "lg";
  // Deux disques : « − » blanc à ombre douce, « + » en DÉGRADÉ de marque —
  // les boutons ronds de l'accueil. Ils rebondissent à l'appui.
  const button = cn(
    "bounce-press grid shrink-0 place-items-center rounded-full disabled:pointer-events-none disabled:opacity-30",
    large ? "h-16 w-16" : "h-11 w-11"
  );
  const minus = cn(button, "bg-[var(--action-bg)] text-ink [box-shadow:var(--action-lift)]");
  const plus = cn(button, "grad-brand [box-shadow:0_10px_22px_-10px_var(--g1)]");
  const shown = value === 0 && emptyLabel ? emptyLabel : formatMinutesSpan(value);

  return (
    <div role="group" aria-label={label} className={cn("flex shrink-0 items-center", large ? "gap-5" : "gap-1.5", className)}>
      <button
        type="button"
        className={minus}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Retirer ${step} min — ${label}`}
      >
        <Minus size={large ? 22 : 17} strokeWidth={2.5} aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn(
          "tabular text-center",
          large ? "t-card-figure min-w-[5ch]" : "min-w-[4.25rem] text-[0.9375rem] font-black",
          value === 0 && "text-subtle"
        )}
      >
        {shown}
      </output>
      <button
        type="button"
        className={plus}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`Ajouter ${step} min — ${label}`}
      >
        <Plus size={large ? 22 : 17} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

/**
 * POINTS DE PROGRESSION — un point par écran ; celui en cours s'étire en
 * pilule, ceux déjà vus restent teintés. La largeur glisse d'un état à
 * l'autre (coupé sous `prefers-reduced-motion` par la règle globale).
 *
 * L'étape en cours est aussi dite en toutes lettres (« Étape 2 sur 6 »)
 * pour les lecteurs d'écran : des points ne se lisent pas.
 */
/**
 * LA PROGRESSION DE L'ACCUEIL GUIDÉ — une barre en DÉGRADÉ qui avance d'un
 * écran à l'autre (transition douce sur la largeur), et le compte « 2/6 »
 * en 900 à côté. Remplace les points : une barre dit « presque fini » d'un
 * regard, sept points demandaient de compter.
 */
export function ProgressDots({ count, current }: { count: number; current: number }) {
  const percent = ((current + 1) / count) * 100;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="sr-only">
        Étape {current + 1} sur {count}
      </span>
      <span aria-hidden className="h-2.5 min-w-0 max-w-[16rem] flex-1 overflow-hidden rounded-full bg-hairline/[0.07]">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--g1),var(--g2))] transition-[width] duration-700 ease-[cubic-bezier(.16,1,.3,1)] [box-shadow:0_4px_12px_-4px_var(--g1)]"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span aria-hidden className="shrink-0 text-[0.8125rem] font-black tabular text-ink">
        {current + 1}/{count}
      </span>
    </div>
  );
}
