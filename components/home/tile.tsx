import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Illustration, type IllustrationName } from "@/components/ui/illustrations";
import { cn } from "@/lib/cn";

/**
 * TUILE DE L'ACCUEIL — la tuile d'apple.com : un dessin, un titre court, un
 * contenu, et UNE sortie nommée en bas (« Tout voir › »).
 *
 * Pourquoi pas `Section variant="panel"` : la tuile porte un DESSIN au-dessus
 * de son titre (les « petites photos » demandées), et sa sortie est épinglée
 * en BAS — trois tuiles côte à côte doivent aligner leurs liens sur la même
 * ligne, quelle que soit la longueur de leur contenu. `Section` pose son
 * action à droite du titre, ce qui convient à un bloc de lecture, pas à une
 * tuile qu'on parcourt du regard.
 *
 * La tuile elle-même n'est PAS un lien : elle contient déjà des liens
 * (chaque échéance, « Réviser »), et deux éléments interactifs imbriqués
 * font deux arrêts de tabulation pour une action. La cible est la sortie du
 * bas, bien visible, à l'accent.
 */
export function HomeTile({
  illustration,
  title,
  meta,
  href,
  hrefLabel,
  index = 0,
  className,
  bodyClassName,
  children,
}: {
  illustration: IllustrationName;
  title: string;
  /** Une donnée courte à droite du titre (« 2 dues », « 90 / 180 min »). */
  meta?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  index?: number;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn("surface reveal flex min-w-0 flex-col p-6 sm:p-8", className)}
      style={{ "--i": index } as CSSProperties}
      aria-labelledby={`tuile-${illustration}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Illustration name={illustration} size={44} className="text-muted" />
          <h2 id={`tuile-${illustration}`} className="t-heading mt-4">
            {title}
          </h2>
        </div>
        {meta && <div className="t-meta shrink-0 pt-1 text-right font-semibold">{meta}</div>}
      </header>
      <div className={cn("mt-5 flex-1", bodyClassName)}>{children}</div>
      {href && hrefLabel && (
        <footer className="mt-6">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-0.5 rounded-full text-[0.9375rem] font-semibold text-accent hover:underline lg:min-h-9"
          >
            {hrefLabel} <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
          </Link>
        </footer>
      )}
    </article>
  );
}

/**
 * EN-TÊTE DE CHAPITRE — entre deux groupes de tuiles, un titre posé sur le
 * fond, sans cadre, comme les intertitres d'apple.com (« Pourquoi Mac. »).
 * Il rythme la page : on sait où commence la semaine, où commencent les
 * matières, sans qu'une carte de plus ait à le dire.
 */
export function ChapterHeading({
  id,
  title,
  lede,
  aside,
}: {
  id: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="reveal flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <h2 id={id} className="t-title">
          {title}
        </h2>
        {lede && <p className="t-lede mt-2 max-w-[52ch]">{lede}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
