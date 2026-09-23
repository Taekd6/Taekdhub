import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * SECTION — l'unité de composition de tous les écrans.
 *
 *   `bare`    (défaut) titre + contenu, sans cadre — pour ce qui se lit dans
 *             le flux de la page.
 *   `panel`   une CARTE (`.surface` : voile + filet, 20 px de rayon). Le
 *             cas courant de la refonte « Nuit » : l'écran est une grille
 *             de cartes.
 *   `feature` la carte « qui compte » d'un écran, plus aérée, titre plus
 *             grand. Une par page au maximum, comme le bouton principal.
 *
 * FIN DU SUR-TITRE SYSTÉMATIQUE. `label` était une étiquette en capitales
 * posée au-dessus de CHAQUE titre (« LA SÉANCE » puis « Ce que tu devrais
 * travailler maintenant ») : deux lignes pour nommer un bloc, et neuf fois
 * par écran. Quand un titre existe, l'étiquette n'est plus affichée — elle
 * reste lue par les lecteurs d'écran, en tête du titre. Elle ne s'affiche
 * que SEULE, quand l'appelant ne fournit pas de titre. L'API ne change pas.
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
  index,
  children,
}: {
  as?: "section" | "div" | "article";
  variant?: "bare" | "panel" | "feature";
  /** Étiquette de rubrique — affichée seulement en l'absence de titre (voir plus haut). */
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Contrôle aligné à droite du titre (sélecteur, lien « tout voir »…). */
  action?: React.ReactNode;
  /** Barre basse séparée par un filet — la sortie de la section. */
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Rang dans la cascade d'entrée de l'écran (`.reveal`, app/globals.css).
   * Absent = pas d'animation d'entrée : un écran choisit lui-même s'il en veut.
   */
  index?: number;
  children?: React.ReactNode;
}) {
  const framed = variant !== "bare";
  const hasHeader = Boolean(label || title || description || action);

  return (
    <Tag
      className={cn(
        framed && "surface",
        variant === "panel" && "p-5 sm:p-6",
        variant === "feature" && "p-5 sm:p-8",
        index !== undefined && "reveal",
        className
      )}
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-x-5 gap-y-3",
            children && (variant === "feature" ? "mb-6" : "mb-4")
          )}
        >
          <div className="min-w-0">
            {label && !title && <p className="t-label">{label}</p>}
            {title && (
              <h2 className={variant === "feature" ? "t-title" : "t-heading"}>
                {label && <span className="sr-only">{label} — </span>}
                {title}
              </h2>
            )}
            {description && <p className="t-lede mt-1.5 max-w-[58ch]">{description}</p>}
          </div>
          {/* `shrink-0` protège l'action du rétrécissement quand elle tient sur
              la même ligne que le titre ; `max-w-full` l'empêche de dépasser
              la section quand elle passe à la ligne, et `max-sm:w-full` lui
              donne alors toute cette ligne (sinon le sélecteur de durée
              restait dimensionné sur son contenu et rognait « 60 min »). */}
          {action && <div className="max-w-full shrink-0 max-sm:w-full">{action}</div>}
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
 * LISTE — des rangées séparées par des filets, pas par des marges entre
 * cartes. Plus de filet au-dessus ni au-dessous : la liste vit désormais
 * dans une carte, dont le bord fait déjà ce travail.
 */
export function List({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("divide-y divide-line", className)}>{children}</ul>;
}

/**
 * Classes d'une rangée. `rowClass` pour une rangée inerte, `rowInteractive`
 * quand la rangée entière est cliquable — dans ce cas l'appelant les pose sur
 * son propre `<Link>`/`<button>`, pour ne jamais imbriquer un lien dans un
 * conteneur cliquable.
 */
export const rowClass = "flex min-w-0 items-center gap-3 px-2 py-3 text-left sm:px-3";

export const rowInteractive = cn(rowClass, "row-hover w-full cursor-pointer rounded-xl max-lg:min-h-[3.25rem]");

/** Compat : ancien nom, même valeur. */
export const rowInteractiveClass = rowInteractive;
