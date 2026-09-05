import { cn } from "@/lib/cn";

/**
 * ÉTIQUETTE — information de second rang, jamais d'emphase.
 *
 * Pas de capitales, pas de gras, pas de pastille colorée par défaut : une
 * ligne de liste peut en porter trois, et trois signaux d'emphase côte à côte
 * n'en font aucun. Seules les variantes de STATUT sont teintées, parce que
 * là, la couleur EST l'information.
 */
const variants = {
  /** Le cas normal : un filet, pas un aplat. */
  default: "border border-line text-muted",
  /** Sans cadre du tout — pour une méta déjà entourée de texte. */
  bare: "text-subtle",
  accent: "border border-accent/25 bg-accent/[0.08] text-accent",
  success: "border border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-300",
  warning: "border border-amber-400/25 bg-amber-400/[0.10] text-amber-300",
  danger: "border border-rose-400/25 bg-rose-400/[0.10] text-rose-300",
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
        "inline-flex items-center gap-1 rounded-[0.3125rem] px-[0.3125rem] py-[0.0625rem] text-2xs leading-4",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
