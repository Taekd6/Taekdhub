import { cn } from "@/lib/cn";

/**
 * SYSTÈME DE MISE EN PAGE.
 *
 * Ce qui manquait jusqu'ici : TOUS les écrans étaient la même colonne
 * centrée, un en-tête en haut puis des sections empilées de haut en bas. On
 * pouvait changer les polices, les couleurs et les composants — la structure
 * restait identique d'un écran à l'autre, et surtout identique à ce qu'elle
 * avait toujours été. Un empilement vertical impose deux choses fausses :
 *
 *   — il n'existe qu'UN axe de lecture, donc toute information secondaire
 *     coûte un défilement à l'information principale ;
 *   — sur un écran de 1440 px, la moitié droite est vide pendant qu'on fait
 *     défiler la moitié gauche.
 *
 * Deux compositions, choisies selon la QUESTION que l'écran doit résoudre :
 *
 *   `Split`       une colonne principale + un rail secondaire.
 *                 Pour décider : « ce que je fais » à gauche, « où j'en
 *                 suis » à droite, simultanément (échéances, journal…).
 *
 *   `Stack`       une colonne unique bornée à la mesure de lecture.
 *                 Pour lire ou saisir (réglages, un formulaire).
 *
 * Une troisième, `Workbench` (volet de navigation collant + zone de
 * travail), n'avait qu'un usage : le navigateur de l'ancienne banque
 * d'exercices. Elle est partie avec la banque.
 *
 * En dessous de `lg`, les deux se replient sur une colonne.
 */

/** Bandeau d'écran : le titre vit DANS la composition, pas au-dessus d'elle. */
export function PageBar({
  title,
  meta,
  lede,
  actions,
  rank = "display",
  className,
}: {
  title: React.ReactNode;
  /** Une ligne de DONNÉES : un compte, une date, un fil d'Ariane. Composée en sans-serif, comme le reste du chrome. */
  meta?: React.ReactNode;
  /**
   * Une PHRASE, qui explique ce que fait l'écran. Composée en italique serif
   * (`t-lede`) : c'est de la prose, pas une légende de tableau, et la
   * distinguer typographiquement du chrome évite qu'elle se lise comme une
   * métadonnée de plus.
   */
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * `display` (défaut) — le titre EST la question de l'écran, il est composé
   * en grand.
   *
   * `quiet` — le titre n'est qu'une civilité : l'écran a déjà un élément
   * dominant plus bas, et deux `t-display` empilés ne désignent plus rien.
   * C'est le cas de l'accueil, où la question n'est pas « qui es-tu » mais
   * « que fais-tu maintenant » : la salutation passe en titre de section et
   * sa métadonnée se range sur la même ligne, ce qui rend au bloc « La
   * séance » les ~120 px qu'il perdait — sur un téléphone, exactement de quoi
   * ramener le bouton « Commencer » au-dessus de la ligne de flottaison.
   */
  rank?: "display" | "quiet";
  className?: string;
}) {
  const quiet = rank === "quiet";

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className={cn("min-w-0", quiet && "flex flex-wrap items-baseline gap-x-3 gap-y-1")}>
        <h1 className={quiet ? "t-heading" : "t-display"}>{title}</h1>
        {meta && <div className={cn("t-meta", quiet ? "min-w-0" : "mt-2")}>{meta}</div>}
        {lede && <p className="t-lede mt-2 max-w-[58ch]">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * COLONNE PRINCIPALE + RAIL.
 *
 * Le rail passe SOUS le contenu principal en dessous de `lg` — jamais
 * au-dessus : sur un téléphone, la première chose à l'écran doit rester
 * l'action, pas les compteurs.
 */
export function Split({
  children,
  rail,
  railLabel,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  railLabel: string;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={railLabel}
        className="mt-10 border-t border-line pt-8 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:mt-0 lg:h-fit lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
      >
        {rail}
      </aside>
    </div>
  );
}

/** Colonne unique bornée à la mesure de lecture — écrans de saisie et de lecture. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("measure-wide", className)}>{children}</div>;
}
