import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * BOUTON — des pilules, comme chez Apple. Aucune ombre.
 *
 * Règle de composition qui vaut pour tout l'écran : UN SEUL bouton `primary`
 * par vue. Dès qu'il y en a deux, aucun des deux ne veut plus dire « c'est
 * ici qu'on clique ».
 *
 *   `primary`    aplat d'accent, texte BLANC (l'aplat est assombri juste
 *                assez pour que le blanc tienne 4,5:1 — lib/theme.ts#accentSolid).
 *   `secondary`  aplat gris (#2c2c2e en sombre, #e8e8ed en clair), sans
 *                filet : la « pilule grise » des boutons secondaires d'Apple.
 *   `ghost`      texte seul, fond gris au survol.
 *   `danger`     texte rouge système sur un voile rouge très léger.
 *   `link`       texte à l'accent — « En savoir plus › ».
 *
 * TOUS en pilule : sur apple.com, un bouton est rond ou n'est pas un
 * bouton. Retour d'appui : le bouton s'ENFONCE (`.press`, 97 %). Le survol
 * éclaircit (sombre) ou fonce (clair) d'un cran, rien de plus.
 */
const buttonVariants = cva(
  "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent-solid text-accent-solid-foreground hover:brightness-110 active:brightness-95",
        secondary: "bg-zinc-800 text-ink hover:bg-zinc-700",
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
