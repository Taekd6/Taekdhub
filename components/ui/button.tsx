import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * BOUTON — quatre intentions, quatre tailles, aucune ombre.
 *
 * Règle de composition qui vaut pour tout l'écran : UN SEUL bouton `primary`
 * par vue. Dès qu'il y en a deux, aucun des deux ne veut plus dire « c'est
 * ici qu'on clique ».
 *
 *   `primary`    aplat d'accent, texte sombre, en PILULE — la signature de
 *                la maquette « Nuit ». Seule forme pleinement ronde des
 *                boutons : on la reconnaît de loin.
 *   `secondary`  voile discret + filet, coins de contrôle (12 px).
 *   `ghost`      texte seul, fond au survol.
 *
 * Retour d'appui : le bouton s'ENFONCE (`.press`, 97 %) — c'est le seul
 * moment où l'on veut un accusé de réception immédiat. Pas de reflet qui
 * boucle, pas de lévitation au survol : le survol éclaircit, point.
 */
const buttonVariants = cva(
  "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-bold disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "rounded-full bg-accent-solid text-accent-solid-foreground hover:brightness-110 active:brightness-95",
        secondary: "rounded-lg border border-line bg-inset text-ink hover:border-hairline/[0.14] hover:bg-hairline/[0.07]",
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
       * Hauteurs minimales explicites. Sous `lg` (là où l'app est utilisée au
       * doigt), tout contrôle passe à 44 px — la cible tactile admise.
       */
      size: {
        sm: "min-h-9 gap-1.5 px-3.5 text-[0.8125rem] max-lg:min-h-11",
        md: "min-h-10 px-4 text-sm max-lg:min-h-11",
        lg: "min-h-12 px-6 text-[0.9375rem]",
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
