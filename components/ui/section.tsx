import { cn } from "@/lib/cn";

/**
 * SECTION — l'unité de composition des pages.
 *
 * Chaque écran réinventait son propre en-tête de bloc : un `eyebrow`, parfois
 * une icône d'accent, un `CardTitle` de taille variable (`text-lg`, `text-xl`,
 * ou rien), une description tantôt présente tantôt absente, le tout enveloppé
 * dans une `Card` — y compris pour des blocs qui n'avaient aucune raison
 * d'être des cartes. Résultat : dix blocs de même poids visuel sur un écran,
 * et aucune hiérarchie lisible.
 *
 * Une section porte donc un RANG explicite :
 *
 *   `primary`   ce que l'écran veut faire faire. Un seul par page.
 *   `secondary` ce qui aide à décider. Encadré, discret.
 *   `quiet`     le détail. Pas de cadre du tout : un titre et du contenu.
 *
 * Le rang décide de l'encadrement et de la taille du titre — jamais l'écran
 * appelant, qui n'a aucun moyen de savoir ce que font les autres.
 */
export function Section({
  rank = "secondary",
  eyebrow,
  title,
  description,
  action,
  footer,
  className,
  children,
}: {
  rank?: "primary" | "secondary" | "quiet";
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Contrôle aligné à droite du titre (sélecteur de durée, lien « tout voir »…). */
  action?: React.ReactNode;
  /** Barre basse séparée par une règle — l'action de sortie de la section. */
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const framed = rank !== "quiet";
  return (
    <section
      className={cn(
        framed && "surface rounded-2xl",
        rank === "primary" && "p-5 sm:p-6",
        rank === "secondary" && "p-4 sm:p-5",
        className
      )}
    >
      {(title || eyebrow || action) && (
        <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", children && "mb-4")}>
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            {title && <h2 className={rank === "primary" ? "t-display" : "t-title"}>{title}</h2>}
            {description && <p className="t-meta mt-1.5 max-w-prose">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}

      {children}

      {footer && (
        <div className={cn("mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/[0.07] pt-4")}>{footer}</div>
      )}
    </section>
  );
}

/**
 * Rangée d'une liste dans une section — la tuile la plus courante de l'app
 * (exercice recommandé, chapitre à consolider, séance de l'historique).
 * `asChild` n'existe pas ici volontairement : quand la rangée est cliquable,
 * l'appelant met ces classes sur son propre `<Link>`, pour ne pas imbriquer
 * un lien dans un div cliquable.
 */
export const rowClass =
  "flex min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150";

export const rowInteractiveClass = cn(rowClass, "focus-ring hover:bg-inset");
