import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * CHAMPS — un fond en creux plutôt qu'un cadre.
 *
 * Une bordure autour de chaque champ, dans une barre de filtres qui en aligne
 * huit, dessine huit rectangles vides avant même qu'on ait lu une étiquette.
 * Un léger creux dit « on écrit ici » sans ajouter de trait, et le filet ne
 * réapparaît qu'au survol et au focus, là où il sert vraiment.
 */
const fieldBase =
  "w-full rounded-lg border border-transparent bg-inset px-3 text-sm text-ink transition-colors placeholder:text-subtle hover:border-line focus:border-transparent";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "min-h-9 py-2 max-lg:min-h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "resize-y py-2.5 leading-7", className)}
      {...props}
    />
  );
}

/**
 * SÉLECTEUR — le chevron natif de chaque navigateur est différent, souvent
 * mal aligné et jamais à la bonne couleur. `appearance-none` + un chevron
 * dessiné garantissent le même contrôle partout, avec la place réservée à
 * droite pour lui.
 */
export function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * Classes de LARGEUR du contrôle (`w-auto`, `min-w-[10rem]`…).
   *
   * Elles doivent aller sur l'enveloppe, pas sur le `<select>` : le chevron
   * dessiné est positionné par rapport à l'enveloppe, si bien qu'un select
   * plus étroit qu'elle laissait le chevron flotter dans le vide, à plusieurs
   * dizaines de pixels du champ. Constaté au navigateur sur l'écran Séance.
   */
  wrapperClassName?: string;
}) {
  return (
    <span className={cn("relative inline-flex w-full items-center", wrapperClassName)}>
      <select className={cn(fieldBase, "min-h-9 appearance-none py-2 pr-8 max-lg:min-h-11", className)} {...props}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 text-subtle" />
    </span>
  );
}
