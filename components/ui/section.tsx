import { cn } from "@/lib/cn";

/**
 * SECTION — l'unité de composition de tous les écrans.
 *
 * Le système précédent encadrait par défaut : chaque bloc devenait une carte,
 * et un écran finissait en pile de rectangles de poids identique. Ici,
 * l'encadrement est l'EXCEPTION.
 *
 *   `bare`    (défaut) titre + filet + contenu. Aucun cadre. C'est la mise en
 *             page éditoriale : ce sont les FILETS et les blancs qui
 *             structurent, pas les boîtes.
 *   `panel`   une surface encadrée. Réservée à ce qui doit se lire comme un
 *             objet détaché du flux : le bloc d'action principal d'un écran,
 *             un encart de saisie.
 *   `feature` la seule section « qui compte » d'un écran. Une par page au
 *             maximum, comme le bouton principal.
 *
 * Le rang décide de l'encadrement ET de la taille du titre — jamais l'écran
 * appelant, qui ne sait pas ce que font les autres sections autour de lui.
 */
export function Section({
  as: Tag = "section",
  variant = "bare",
  label,
  title,
  description,
  action,
  footer,
  className,
  bodyClassName,
  children,
}: {
  as?: "section" | "div" | "article";
  variant?: "bare" | "panel" | "feature";
  /** Étiquette de rubrique, en capitales discrètes. */
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Contrôle aligné à droite du titre (sélecteur, lien « tout voir »…). */
  action?: React.ReactNode;
  /** Barre basse séparée par un filet — la sortie de la section. */
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  const framed = variant !== "bare";
  const hasHeader = Boolean(label || title || description || action);

  return (
    <Tag
      className={cn(
        framed && "surface",
        variant === "panel" && "p-4 sm:p-5",
        variant === "feature" && "p-5 sm:p-7",
        className
      )}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex flex-wrap items-end justify-between gap-x-5 gap-y-2",
            children && (variant === "feature" ? "mb-5" : "mb-3")
          )}
        >
          <div className="min-w-0">
            {label && <p className="t-label mb-1.5">{label}</p>}
            {title &&
              (variant === "feature" ? (
                <h2 className="t-display">{title}</h2>
              ) : (
                <h2 className="t-heading">{title}</h2>
              ))}
            {/* Le chapeau est composé en italique serif (`t-lede`), pas en
                sans-serif gris : deux lignes d'italique sous un titre disent
                « ceci commente ce qui précède » sans avoir besoin d'être plus
                petites ni plus pâles. C'est ce qui donne une voix à l'écran
                au lieu d'une légende. */}
            {description && <p className="t-lede mt-2 max-w-[54ch]">{description}</p>}
          </div>
          {/* `shrink-0` protège l'action du rétrécissement quand elle tient sur
              la même ligne que le titre ; `max-w-full` l'empêche de dépasser
              la section quand elle passe à la ligne. Mesuré à 320 px : le
              sélecteur de durée de la séance mesurait 266 px dans une colonne
              de 246 px, et débordait du cadre. */}
          {action && <div className="max-w-full shrink-0">{action}</div>}
        </header>
      )}

      <div className={bodyClassName}>{children}</div>

      {footer && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {footer}
        </div>
      )}
    </Tag>
  );
}

/**
 * LISTE — le second motif universel : des rangées séparées par des filets,
 * pas par des marges entre cartes. Une liste de trente exercices reste alors
 * une liste, et non trente objets empilés.
 */
export function List({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("divide-y divide-line border-y border-line", className)}>{children}</ul>;
}

/**
 * Classes d'une rangée. `rowClass` pour une rangée inerte, `rowInteractive`
 * quand la rangée entière est cliquable — dans ce cas l'appelant les pose sur
 * son propre `<Link>`/`<button>`, pour ne jamais imbriquer un lien dans un
 * conteneur cliquable.
 */
export const rowClass = "flex min-w-0 items-center gap-3 px-1 py-3 text-left sm:px-2";

export const rowInteractive = cn(
  rowClass,
  "row-hover w-full cursor-pointer rounded-md max-lg:min-h-[3.25rem]"
);

/** Compat : ancien nom, même valeur. */
export const rowInteractiveClass = rowInteractive;
