import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:brightness-110 active:scale-[0.98]",
        secondary: "border border-hairline/[0.09] bg-black/20 text-zinc-100 hover:border-hairline/[0.14] hover:bg-hairline/[0.04]",
        ghost: "text-zinc-400 hover:bg-hairline/[0.045] hover:text-zinc-100",
        danger: "border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15",
      },
      size: {
        sm: "px-3 py-2 text-xs",
        md: "px-4 py-2.5 text-sm",
        lg: "px-5 py-3 text-sm",
        // 44px (Sprint Mobile UX + PWA Foundation, Étape 4) — cible tactile
        // confortable par défaut ; l'icône elle-même reste petite (16-18px
        // selon l'usage), seule la zone cliquable grandit.
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
