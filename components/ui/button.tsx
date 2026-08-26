import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  // `transition-colors` et non `transition-all` : animer toutes les propriétés
  // fait bouger la taille au survol (padding, bordure) — un tremblement, pas
  // une réaction. `font-medium` plutôt que `semibold` : le gras appartient aux
  // titres, pas à chaque contrôle.
  "focus-ring inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // `bg-accent-solid` et non `bg-accent` : le bouton principal porte la
        // COULEUR DE MARQUE telle quelle dans les deux thèmes (avec
        // `text-accent-foreground`, noir ou blanc selon sa luminance). Seule
        // l'encre — texte, icônes, teintes fines — s'assombrit en thème clair.
        // UNE seule action pleine par écran : `primary` doit rester rare pour
        // rester lisible comme « c'est ici qu'on clique ».
        primary: "bg-accent-solid text-accent-solid-foreground hover:opacity-90 active:opacity-100",
        secondary: "border border-hairline/[0.14] bg-transparent text-ink hover:bg-inset",
        ghost: "text-muted hover:bg-inset hover:text-ink",
        danger: "border border-rose-500/25 text-rose-300 hover:bg-rose-500/10",
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
        sm: "min-h-8 gap-1.5 px-2.5 text-xs max-lg:min-h-11",
        md: "min-h-9 px-3.5 text-sm max-lg:min-h-11",
        lg: "min-h-11 px-5 text-sm",
        icon: "h-9 w-9 p-0 max-lg:h-11 max-lg:w-11",
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
