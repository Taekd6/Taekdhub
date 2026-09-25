import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * LISTE GROUPÉE — les Réglages d'iOS : des rangées dans une tuile arrondie,
 * séparées par des filets qui ne touchent pas le bord gauche, un titre de
 * groupe AU-DESSUS de la tuile, une note explicative en gris AU-DESSOUS.
 * C'est la forme qu'un élève reconnaît immédiatement comme « des
 * réglages », et elle range vingt champs sans un seul cadre de plus.
 *
 *   `Group`  titre + tuile + note. Entre au défilement (`.reveal`).
 *   `Row`    une rangée : l'étiquette (et son aide) à gauche, le contrôle
 *            à droite. `stack` fait passer le contrôle SOUS l'étiquette sur
 *            téléphone — pour un sélecteur segmenté qui a besoin de toute la
 *            largeur.
 *
 * Une rangée fait au moins 52 px : une cible tactile confortable, même
 * quand elle ne contient qu'un texte.
 */
export function Group({
  title,
  footer,
  className,
  children,
  index,
  id,
}: {
  /** Ancre (`/settings#budgets`) — la section se place alors sous la barre haute. */
  id?: string;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Rang dans la cascade d'entrée. */
  index?: number;
}) {
  return (
    <section id={id} className={cn("reveal scroll-mt-[calc(var(--nav-h)+1.5rem)]", className)} style={{ "--i": index ?? 0 } as CSSProperties}>
      {title && <h2 className="mb-2.5 px-1 text-xl font-black tracking-[-0.02em] text-ink">{title}</h2>}
      {/* Le filet commence après la marge gauche, comme sur iOS : chaque
          rangée porte la marge, la liste porte les filets. */}
      <div className="surface overflow-hidden">
        <div className="divide-y divide-line pl-4 sm:pl-5">{children}</div>
      </div>
      {footer && <div className="mt-2 max-w-[62ch] px-1 text-[0.8125rem] font-semibold leading-snug text-muted sm:px-5">{footer}</div>}
    </section>
  );
}

export function Row({
  label,
  hint,
  icon,
  children,
  stack = false,
  className,
  htmlFor,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Pastille ou petite illustration devant l'étiquette. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  stack?: boolean;
  className?: string;
  /** Associe l'étiquette au champ (`id`) de la rangée. */
  htmlFor?: string;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div
      className={cn(
        "flex min-h-[3.25rem] gap-x-4 gap-y-3 py-3 pr-4 sm:pr-5",
        stack ? "flex-col items-stretch sm:flex-row sm:items-center sm:justify-between" : "items-center justify-between",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon}
        <span className="min-w-0">
          <Label htmlFor={htmlFor} className="block text-[0.9375rem] font-bold leading-snug text-ink">
            {label}
          </Label>
          {hint && <span className="t-meta mt-0.5 block text-[0.8125rem]">{hint}</span>}
        </span>
      </span>
      {children !== undefined && <span className={cn("flex min-w-0 items-center gap-2", !stack && "shrink-0")}>{children}</span>}
    </div>
  );
}
