import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * EN-TÊTE D'ÉCRAN — style « Revolut clair » : un grand titre en 900, UNE
 * ligne grise dessous (« moins de blabla » : la phrase dit ce qu'on trouve
 * ici, jamais comment ça marche), et le petit dessin de la page posé dans
 * une pastille BLANCHE RONDE qui flotte, à droite.
 *
 * Le dessin (components/ui/illustrations.tsx) garde ses traits d'encre et
 * sa pointe d'accent : sur un disque en dégradé, l'accent disparaîtrait —
 * d'où le disque blanc, comme les boutons ronds de l'accueil. Il est
 * décoratif : le titre dit déjà ce que montre la page.
 *
 *   illustration  un nœud React — `<Illustration name=… />` ou
 *                 `<SubjectIllustration subject=… />`, 48 à 64 px.
 *   eyebrow       une pastille courte AU-DESSUS du titre (« Suivi par
 *                 matière »), pour un écran de détail. Facultative.
 *   actions       à droite du bloc sur grand écran, dessous sur téléphone.
 */
export function PageHero({
  title,
  lede,
  eyebrow,
  illustration,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  eyebrow?: React.ReactNode;
  illustration?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-2 inline-flex max-w-full items-center rounded-full bg-accent/10 px-3 py-1 text-[0.8125rem] font-extrabold text-accent">{eyebrow}</div>}
          <h1 className="t-display">{title}</h1>
          {lede && <p className="mt-1.5 max-w-[46ch] text-[0.9375rem] font-semibold leading-snug text-muted sm:text-base">{lede}</p>}
          {children}
        </div>
        {illustration && (
          <span
            aria-hidden
            className="floaty grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--action-bg)] text-ink [box-shadow:var(--action-lift)] sm:order-first sm:h-20 sm:w-20 [&_svg]:h-10 [&_svg]:w-10 sm:[&_svg]:h-12 sm:[&_svg]:w-12"
            style={{ "--i": 1 } as CSSProperties}
          >
            {illustration}
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
