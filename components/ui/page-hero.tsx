import { cn } from "@/lib/cn";

/**
 * EN-TÊTE ILLUSTRÉ — le haut d'une page d'apple.com : un petit dessin, un
 * grand titre gras, une phrase en gris. Rien d'autre.
 *
 * Le dessin (components/ui/illustrations.tsx) passe AU-DESSUS du titre sur
 * téléphone et à sa GAUCHE sur grand écran, où il y a la place. Il est
 * décoratif : le titre dit déjà ce que montre la page.
 *
 *   illustration  un nœud React — `<Illustration name=… />` ou
 *                 `<SubjectIllustration subject=… />`, 48 à 64 px.
 *   eyebrow       une ligne courte AU-DESSUS du titre (« Suivi par
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
    <header className={cn("reveal flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {illustration && (
          <span aria-hidden className="grid h-20 w-20 shrink-0 place-items-center rounded-[1.75rem] bg-inset text-ink sm:h-24 sm:w-24">
            {illustration}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="t-label mb-1.5">{eyebrow}</div>}
          <h1 className="t-display">{title}</h1>
          {lede && <p className="t-lede mt-2 max-w-[56ch]">{lede}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
