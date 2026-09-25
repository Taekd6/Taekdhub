import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ActionItem {
  label: string;
  icon: LucideIcon;
  /** Un lien (`/timer`, `#noter`)… */
  href?: string;
  /** …ou une action sur place. */
  onClick?: () => void;
  /** Le bouton en dégradé — un seul par rangée. */
  primary?: boolean;
}

/**
 * BOUTONS D'ACTION RONDS — la rangée « Chrono · Noter · Réviser · Erreur »
 * de la maquette : quatre disques de 58 px, leur nom dessous.
 *
 * Le PREMIER GESTE de l'écran est en dégradé de marque, avec une ombre de sa
 * couleur ; les autres sont blancs à ombre douce (du verre en sombre). Un
 * seul en dégradé, sinon aucun ne dit plus « commence par là ».
 *
 * L'élément cliquable est la COLONNE ENTIÈRE (disque + nom) : 58 px de haut
 * ne suffisent pas à un doigt qui vise le mot. Le disque monte et grossit
 * au survol, s'écrase à l'appui et revient en rebondissant — le geste
 * `bounce-press`, porté ici par le groupe pour que viser le mot l'anime
 * aussi.
 */
export function ActionButtons({ items, className }: { items: ActionItem[]; className?: string }) {
  return (
    <div className={cn("flex justify-around gap-2", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <span
              aria-hidden
              className={cn(
                "grid h-[3.625rem] w-[3.625rem] place-items-center rounded-full transition-transform duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:-translate-y-[3px] group-hover:scale-[1.06] group-active:scale-[.92] motion-reduce:transform-none",
                item.primary ? "grad-brand [box-shadow:0_10px_24px_-8px_var(--g1)]" : "bg-[var(--action-bg)] text-ink [box-shadow:var(--action-lift)]"
              )}
            >
              <Icon size={24} strokeWidth={2.2} />
            </span>
            <span className="text-[0.8125rem] font-bold text-ink">{item.label}</span>
          </>
        );
        const classes = "group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 outline-offset-4";
        if (item.href) {
          const anchor = item.href.startsWith("#");
          return anchor ? (
            <a key={item.label} href={item.href} className={classes}>
              {content}
            </a>
          ) : (
            <Link key={item.label} href={item.href} className={classes}>
              {content}
            </Link>
          );
        }
        return (
          <button key={item.label} type="button" onClick={item.onClick} className={classes}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
