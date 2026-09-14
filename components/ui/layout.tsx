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
 *                 Pour DÉCIDER (« Aujourd'hui ») : ce que je fais à gauche,
 *                 où j'en suis à droite, simultanément.
 *
 *   `Stack`       une colonne unique bornée à la mesure de lecture.
 *                 Pour LIRE ou SAISIR (les réglages, un formulaire).
 *
 * Une troisième composition a existé — `Workbench`, un volet de navigation
 * persistant à côté d'une zone de travail — pour explorer la banque
 * d'exercices. La banque n'existe plus, et aucun écran de TaekdHub n'a plus
 * d'ensemble à parcourir de cette façon : elle a été retirée plutôt que
 * gardée « au cas où ». Les écrans de liste (Tâches, Calendrier) filtrent en
 * place, ce qui demande moins de place et fonctionne à l'identique sur
 * téléphone.
 *
 * En dessous de `lg`, les deux se replient sur une colonne — mais dans un
 * ORDRE choisi par l'appelant, pas dans l'ordre du DOM.
 */

/** Bandeau d'écran : le titre vit DANS la composition, pas au-dessus d'elle. */
export function PageBar({
  title,
  meta,
  lede,
  actions,
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
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="t-display">{title}</h1>
        {meta && <div className="t-meta mt-2">{meta}</div>}
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
