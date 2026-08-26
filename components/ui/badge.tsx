import { cn } from "@/lib/cn";

/**
 * Les badges étaient en CAPITALES, gras, sur fond teinté : trois signaux
 * d'emphase pour une information de second rang, répétée jusqu'à quatre fois
 * par ligne de liste. À ce compte-là, plus rien ne ressort. Ils redeviennent
 * ce qu'ils sont : une étiquette discrète.
 */
const variants = {
  default: "bg-inset text-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-400/10 text-emerald-300",
  warning: "bg-amber-400/10 text-amber-300",
  danger: "bg-rose-400/10 text-rose-300",
  subject: "",
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
        "inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
