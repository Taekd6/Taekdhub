import { cn } from "@/lib/cn";

/**
 * ÉTIQUETTE — information de second rang, en pastille.
 *
 * Pas de capitales : une ligne de liste peut en porter trois, et trois
 * signaux d'emphase côte à côte n'en font aucun. Le cas normal est un simple
 * creux ; seules les variantes de STATUT sont teintées, parce que là, la
 * couleur EST l'information.
 */
const variants = {
  /** Le cas normal : un creux discret, pas un cadre. */
  default: "bg-inset text-muted",
  /** Sans fond du tout — pour une méta déjà entourée de texte. */
  bare: "px-0 text-subtle",
  accent: "bg-accent/[0.12] text-accent",
  success: "bg-emerald-400/[0.14] text-emerald-300",
  warning: "bg-amber-400/[0.14] text-amber-300",
  danger: "bg-rose-400/[0.14] text-rose-300",
};

export function Badge({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold leading-4",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
