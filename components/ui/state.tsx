import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * ÉTAT VIDE — dit ce qui manque ET comment le remplir.
 *
 * Un état vide qui se contente de « Aucun résultat » laisse l'élève dans une
 * impasse. Chaque appel doit fournir une action, ou expliquer pourquoi il n'y
 * en a pas.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  /**
   * Un dessin au trait (components/ui/illustrations.tsx) à la place de
   * l'icône : un état vide est le seul moment où l'écran n'a rien d'autre à
   * montrer, c'est là qu'une illustration a toute sa place.
   */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {illustration ? (
        <span aria-hidden className="mb-5 grid h-24 w-24 place-items-center rounded-[1.75rem] bg-inset text-ink">
          {illustration}
        </span>
      ) : Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-inset text-muted">
          <Icon size={20} strokeWidth={1.8} />
        </span>
      )}
      <p className="t-heading">{title}</p>
      {description && <p className="t-meta mt-2 max-w-[42ch]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * SQUELETTE DE CHARGEMENT — la forme de ce qui arrive, pas un spinner.
 *
 * Toutes les données de TaekdHub viennent de localStorage : l'attente se
 * compte en dizaines de millisecondes. Le squelette existe pour que la page
 * ne SAUTE pas quand elles arrivent — donc il doit avoir exactement la
 * hauteur du contenu réel. Un reflet lent le traverse (`.shimmer`) : la
 * seule boucle du système, et elle ne dure que le temps du chargement.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} aria-hidden />;
}

/**
 * MESSAGE D'ERREUR / D'AVERTISSEMENT en place — teinté, encadré, jamais une
 * fenêtre modale : il informe, il n'interrompt pas.
 */
export function Notice({
  tone = "warning",
  title,
  children,
  action,
  className,
}: {
  tone?: "warning" | "danger" | "info";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-accent/25 bg-accent/[0.06] text-ink",
    warning: "border-amber-400/30 bg-amber-400/[0.08] text-ink",
    danger: "border-rose-400/30 bg-rose-400/[0.08] text-ink",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5", tones[tone], className)}
    >
      <div className="min-w-0">
        {title && <p className="t-subhead">{title}</p>}
        {children && <div className={cn("t-meta", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
