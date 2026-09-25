import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * EN-TÊTE DE BLOC — « Matières ····· Tout voir ». Un titre court en 900,
 * une sortie à l'encre de la palette. C'est tout : la maquette n'a ni
 * chapeau ni sous-titre (« moins de blabla »).
 */
export function BlockHeader({
  id,
  title,
  href,
  hrefLabel = "Tout voir",
  className,
}: {
  id?: string;
  title: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <h2 id={id} className="text-xl font-black tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {href && (
        <Link href={href} className="inline-flex min-h-10 shrink-0 items-center text-sm font-bold text-accent hover:underline max-lg:min-h-11">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * CARTE-LISTE — la carte « Échéances » de la maquette : une tuile blanche
 * (`.surface`), son en-tête, puis des rangées qui glissent au survol.
 */
export function ListCard({
  title,
  titleId,
  href,
  hrefLabel,
  index = 0,
  className,
  children,
}: {
  title: React.ReactNode;
  titleId?: string;
  href?: string;
  hrefLabel?: string;
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn("surface reveal px-1.5 py-2", className)}
      style={{ "--i": index } as CSSProperties}
    >
      <BlockHeader id={titleId} title={title} href={href} hrefLabel={hrefLabel} className="px-3 pb-1.5 pt-2.5" />
      {children}
    </section>
  );
}

const MONTHS_SHORT = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];

/**
 * PASTILLE DATÉE — le jour en gros, le mois en petit, sur un disque en
 * dégradé (`--dl-1..3` de la palette, repris en boucle par rang).
 */
export function DateBadge({ date, tone = 0 }: { date: Date | null; tone?: number }) {
  const color = `var(--dl-${(Math.abs(tone) % 3) + 1})`;
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 67%, transparent))` }}
    >
      {date ? (
        <span className="flex flex-col items-center leading-none">
          <span className="text-base font-black tabular">{date.getDate()}</span>
          <span className="mt-0.5 text-[0.5625rem] font-extrabold opacity-85">{MONTHS_SHORT[date.getMonth()]}</span>
        </span>
      ) : (
        <span className="text-base font-black">—</span>
      )}
    </span>
  );
}

/**
 * RANGÉE DE CARTE-LISTE — pastille à gauche, titre et sous-titre au milieu,
 * valeur en gras à droite. Un lien quand `href` est donné (la rangée
 * entière), qui glisse de 4 px au survol (`.row-slide`).
 */
export function ListRow({
  href,
  leading,
  title,
  sub,
  subClassName,
  value,
  ariaLabel,
}: {
  href?: string;
  leading: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  subClassName?: string;
  value?: React.ReactNode;
  ariaLabel?: string;
}) {
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-extrabold text-ink">{title}</span>
        {sub && <span className={cn("block truncate text-[0.8125rem] font-bold", subClassName ?? "text-subtle")}>{sub}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-[0.9375rem] font-black tabular text-ink">{value}</span>}
    </>
  );
  const classes = "row-slide flex min-h-[4.25rem] items-center gap-3 rounded-[1.125rem] px-3 py-3";
  return href ? (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      {content}
    </Link>
  ) : (
    <div className={classes} aria-label={ariaLabel}>
      {content}
    </div>
  );
}

/**
 * PASTILLE DE SCORE — une note (ou un pourcentage) posée sur un disque en
 * DÉGRADÉ, le chiffre en blanc et en 900. Le dégradé suit la valeur
 * ramenée sur 1 : vert → cyan au-dessus de 0,7 (`.score-hi`), le dégradé
 * de marque au milieu (`.score-mid`), orange → rose sous 0,5 (`.score-lo`,
 * celui des révisions : « à reprendre », jamais « rouge d'échec »).
 *
 * `ratio` null (note en attente) : disque en creux, tiret.
 */
export function ScoreBadge({
  ratio,
  children,
  size = "md",
  className,
}: {
  ratio: number | null;
  children: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  const tone = ratio === null ? "bg-inset text-muted" : ratio >= 0.7 ? "score-hi" : ratio >= 0.5 ? "score-mid" : "score-lo";
  return (
    <span
      className={cn(
        "score-badge tracking-[-0.02em]",
        tone,
        size === "md" ? "h-11 w-11 text-[0.9375rem]" : "h-14 w-14 text-lg",
        className
      )}
    >
      {children}
    </span>
  );
}
