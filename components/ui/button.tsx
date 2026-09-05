import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * BOUTON — quatre intentions, trois tailles, aucune ombre.
 *
 * Règle de composition qui vaut pour tout l'écran : UN SEUL bouton `primary`
 * par vue. Dès qu'il y en a deux, aucun des deux ne veut plus dire « c'est
 * ici qu'on clique ». Tout le reste est `secondary` (filet) ou `ghost`
 * (texte seul).
 *
 * Le survol ne modifie ni la taille, ni la position, ni l'ombre : uniquement
 * le fond. Un bouton qui se soulève au passage de la souris fait bouger la
 * page sous le curseur — c'est du bruit, pas du retour d'information.
 * L'appui, lui, assombrit franchement : c'est le seul moment où l'on veut un
 * accusé de réception immédiat.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "rounded-lg bg-accent-solid text-accent-solid-foreground hover:opacity-[0.88] active:opacity-100",
        secondary:
          "rounded-lg border border-line bg-panel text-ink hover:bg-inset active:bg-inset",
        ghost: "rounded-lg text-muted hover:bg-inset hover:text-ink",
        danger: "rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10",
        /**
         * Lien-action : se lit comme du texte, se comporte comme un bouton.
         * Pour les sorties secondaires d'une section (« Tout voir »,
         * « Modifier »), qui n'ont aucune raison de porter un cadre.
         */
        link: "rounded text-accent underline-offset-[3px] hover:underline",
      },
      /*
       * Hauteurs minimales explicites. Sous `lg` (c'est-à-dire là où l'app est
       * utilisée au doigt), tout contrôle passe à 44 px — la cible tactile
       * admise. La densité du desktop reste inchangée.
       */
      size: {
        sm: "min-h-8 gap-1.5 px-2.5 text-[0.8125rem] max-lg:min-h-11",
        md: "min-h-9 px-3.5 text-sm max-lg:min-h-11",
        lg: "min-h-11 px-5 text-[0.9375rem]",
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
