import { cn } from "@/lib/cn";

/**
 * « PAS ENCORE ASSEZ DE DONNÉES » — une seule forme, partout.
 *
 * C'est le composant le plus employé de toute la page, et c'est voulu : un
 * élève qui ouvre TaekdHub la première semaine doit voir des sections qui
 * disent honnêtement ce qui leur manque, et non des courbes plates à zéro
 * présentées comme des mesures.
 *
 * Deux phrases, toujours dans cet ordre : CE QUI MANQUE, puis COMMENT LE
 * COMBLER. Un état vide qui ne dit pas quoi faire est une impasse — c'est
 * déjà la règle d'`EmptyState` (components/ui/state.tsx), reprise ici à
 * l'échelle d'une section plutôt que d'un écran.
 */
export function Insufficient({ what, how, className }: { what: string; how?: string; className?: string }) {
  return (
    <p className={cn("t-meta border-y border-line py-5", className)}>
      {what}
      {how && <span className="mt-1 block text-2xs">{how}</span>}
    </p>
  );
}
