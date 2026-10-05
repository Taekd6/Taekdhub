import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * BOUTON — des pilules (refonte « Liquid Glass »), en semi-gras comme chez Apple.
 *
 * Règle de composition qui vaut pour tout l'écran : UN SEUL bouton `primary`
 * par vue. Dès qu'il y en a deux, aucun des deux ne veut plus dire « c'est
 * ici qu'on clique ».
 *
 *   `primary`    le DÉGRADÉ des boutons de la palette (`.grad-btn`), texte
 *                BLANC — deux teintes profondes choisies pour tenir 4,5:1
 *                (lib/theme.ts#Palette.solid) —, avec une ombre de sa couleur.
 *   `secondary`  pilule de VERRE (`--action-bg` flouté, reflet en haut) : le
 *                bouton secondaire d'iOS 26.
 *   `ghost`      texte seul, fond gris au survol.
 *   `danger`     texte rouge système sur un voile rouge très léger.
 *   `link`       texte à l'accent — « En savoir plus › ».
 *
 * TOUS en pilule. Retour d'appui : le bouton s'ENFONCE (`.press`, 97 %).
 */
const buttonVariants = cva(
  "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.016em] transition-[transform,filter,background-color,box-shadow] duration-300 ease-[cubic-bezier(.32,.72,0,1)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "grad-btn [box-shadow:0_10px_24px_-10px_var(--btn-g1)] hover:brightness-110 active:brightness-95",
        secondary: "bg-[var(--action-bg)] text-ink backdrop-blur-xl backdrop-saturate-150 [box-shadow:var(--action-lift)] hover:bg-[var(--surface-border-hover)]",
        ghost: "text-muted hover:bg-inset hover:text-ink",
        danger: "bg-rose-400/[0.12] text-rose-300 hover:bg-rose-400/[0.18]",
        /**
         * Lien-action : se lit comme du texte, se comporte comme un bouton.
         * Pour les sorties secondaires d'une section (« Tout voir »,
         * « Modifier »), qui n'ont aucune raison de porter un cadre.
         */
        link: "rounded-md text-accent underline-offset-[3px] hover:underline",
      },
      /*
       * Hauteurs minimales explicites. Sous `lg` (là où l'app est utilisée au
       * doigt), tout contrôle passe à 44 px — la cible tactile admise.
       */
      size: {
        sm: "min-h-9 gap-1.5 px-4 text-[0.8125rem] max-lg:min-h-11",
        md: "min-h-10 px-5 text-[0.9375rem] max-lg:min-h-11",
        lg: "min-h-12 px-7 text-base",
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
