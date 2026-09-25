import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * SECTION — l'unité de composition de tous les écrans.
 *
 *   `bare`    (défaut) titre + contenu, sans cadre — pour ce qui se lit dans
 *             le flux de la page.
 *   `panel`   une TUILE (`.surface` : aplat gris, 24 px de rayon, sans
 *             cadre visible) — les tuiles d'apple.com. Marge intérieure
 *             généreuse : 24 px, 32 px dès `sm`.
 *   `feature` la tuile « qui compte » d'un écran, encore plus aérée, titre
 *             plus grand. Une par page au maximum, comme le bouton principal.
 *
 * ENTRÉE AU DÉFILEMENT. Une section encadrée monte en fondu quand elle
 * entre dans l'écran (`.reveal`, armé par components/ui/reveal.tsx), même
 * sans `index` : c'est le geste d'apple.com, et il doit valoir pour tout
 * l'écran sans que chaque page ait à le demander. `index` ne sert plus qu'à
 * DÉCALER les tuiles voisines d'une même rangée.
 *
 * FIN DU SUR-TITRE SYSTÉMATIQUE. `label` était une étiquette en capitales
 * posée au-dessus de CHAQUE titre (« LA SÉANCE » puis « Ce que tu devrais
 * travailler maintenant ») : deux lignes pour nommer un bloc, et neuf fois
 * par écran. Quand un titre existe, l'étiquette n'est plus affichée — elle
 * reste lue par les lecteurs d'écran, en tête du titre. Elle ne s'affiche
 * que SEULE, quand l'appelant ne fournit pas de titre. L'API ne change pas.
 *
 * L'ACTION À DROITE DU TITRE (« Modifier », « Toutes ») reste sur la ligne
 * du titre, comme la sortie « Tout voir » des cartes-listes de l'accueil :
 * passée à la ligne, elle flottait seule sous le titre. Seule une action
 * LARGE (`wideAction` — un sélecteur segmenté) passe dessous sur
 * téléphone, où elle prend toute la ligne.
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
  wideAction = false,
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
   * Rang dans la cascade d'entrée (`.reveal`, app/globals.css) — décale
   * l'entrée de 70 ms par rang. Absent : une section encadrée entre quand
   * même (rang 0), une section `bare` n'a pas d'animation.
   */
  index?: number;
  /** L'action est un sélecteur (segmenté, pastilles) : elle passe sous le titre sur téléphone. */
  wideAction?: boolean;
  children?: React.ReactNode;
}) {
  const framed = variant !== "bare";
  const hasHeader = Boolean(label || title || description || action);
  const rank = index ?? (framed ? 0 : undefined);

  return (
    <Tag
      className={cn(
        framed && "surface",
        variant === "panel" && "p-6 sm:p-8",
        variant === "feature" && "p-6 sm:p-10",
        rank !== undefined && "reveal",
        className
      )}
      style={rank !== undefined ? ({ "--i": rank } as CSSProperties) : undefined}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex items-start justify-between gap-x-4 gap-y-3",
            wideAction && "flex-wrap",
            children && (variant === "feature" ? "mb-8" : "mb-5")
          )}
        >
          <div className="min-w-0 flex-1">
            {label && !title && <p className="t-label">{label}</p>}
            {title && (
              <h2 className={variant === "feature" ? "t-title" : "t-heading"}>
                {label && <span className="sr-only">{label} — </span>}
                {title}
              </h2>
            )}
            {description && <p className={cn(variant === "panel" ? "text-[0.875rem] font-semibold leading-snug text-muted" : "t-lede", "mt-1 max-w-[58ch]")}>{description}</p>}
          </div>
          {/* `shrink-0` protège l'action du rétrécissement quand elle tient sur
              la même ligne que le titre ; `max-w-full` l'empêche de dépasser
              la section quand elle passe à la ligne, et `max-sm:w-full` lui
              donne alors toute cette ligne (sinon le sélecteur de durée
              restait dimensionné sur son contenu et rognait « 60 min »). */}
          {action && <div className={cn("max-w-full shrink-0 [&>a]:min-h-8", wideAction ? "max-sm:w-full" : "-mt-1 -mr-2")}>{action}</div>}
        </header>
      )}

      <div className={bodyClassName}>{children}</div>

      {footer && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
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
export const rowClass = "flex min-w-0 items-center gap-3 px-2 py-3.5 text-left sm:px-3";

export const rowInteractive = cn(rowClass, "row-hover w-full cursor-pointer rounded-xl max-lg:min-h-[3.25rem]");

/** Compat : ancien nom, même valeur. */
export const rowInteractiveClass = rowInteractive;
