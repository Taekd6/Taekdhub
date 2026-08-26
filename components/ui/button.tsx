import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // `bg-accent-solid` et non `bg-accent` : le bouton principal porte la
        // COULEUR DE MARQUE telle quelle dans les deux thèmes (avec
        // `text-accent-foreground`, noir ou blanc selon sa luminance). Seule
        // l'encre — texte, icônes, teintes fines — s'assombrit en thème clair.
        primary: "bg-accent-solid text-accent-solid-foreground hover:brightness-110 active:scale-[0.98]",
        secondary: "border border-hairline/[0.09] bg-inset text-zinc-100 hover:border-hairline/[0.14] hover:bg-hairline/[0.04]",
        ghost: "text-zinc-400 hover:bg-hairline/[0.04] hover:text-zinc-100",
        danger: "border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15",
      },
      /*
       * Hauteurs minimales explicites plutôt que « ce que le padding donne » :
       * mesuré au navigateur, `sm` tombait à 34 px et `icon` à 32 px, très en
       * dessous des ~44 px recommandés pour une cible tactile — or ces deux
       * tailles portent l'essentiel des actions sur mobile (raccourcis du
       * Dashboard, préréglages de durée, "Préparer maintenant"…).
       *
       * Le palier `max-lg:` ne s'applique QU'EN DESSOUS du point de rupture où
       * la barre latérale apparaît (lg) — c'est-à-dire exactement là où l'app
       * est utilisée au doigt. La densité du desktop (souris, cibles fines
       * acceptables) reste donc strictement inchangée : aucune régression
       * visuelle sur les listes denses d'exercices.
       */
      size: {
        sm: "min-h-9 px-3 py-2 text-xs max-lg:min-h-11",
        md: "min-h-10 px-4 py-2.5 text-sm max-lg:min-h-11",
        lg: "min-h-11 px-5 py-3 text-sm",
        icon: "h-10 w-10 p-0 max-lg:h-11 max-lg:w-11",
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
