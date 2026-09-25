import { cn } from "@/lib/cn";

/**
 * SYSTÈME DE MISE EN PAGE — deux compositions, choisies selon la QUESTION
 * que l'écran doit résoudre (un écran n'écrit pas sa propre grille : deux
 * gabarits écrits sur place finissent par ne plus s'aligner).
 *
 *   `Split`       une colonne principale + un RAIL à droite sur grand
 *                 écran. Pour décider : « ce que je fais » à gauche, « où
 *                 j'en suis » à droite, simultanément (Échéances). Depuis la
 *                 refonte « Revolut clair », le rail est une TUILE blanche
 *                 collante (`.surface`), plus un volet séparé par un filet.
 *
 *   `Stack`       une colonne unique bornée à la mesure de lecture.
 *                 Pour lire ou saisir (la séance de révision).
 *
 * Le titre d'écran, lui, est `PageHero` (components/ui/page-hero.tsx),
 * posé DANS la colonne principale. En dessous de `lg`, tout se replie sur
 * une colonne, le rail en dernier.
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
    <div className="mx-auto max-w-[68rem] lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={railLabel}
        className="surface reveal mt-8 p-5 sm:p-6 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:mt-0 lg:h-fit"
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
