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
 *
 * Refonte « Apple » : un creux gris arrondi (`.well`), centré, à la place
 * des deux filets — les sections vivent désormais dans des tuiles, et deux
 * traits horizontaux au milieu d'une tuile la coupaient en trois.
 */
export function Insufficient({ what, how, className }: { what: string; how?: string; className?: string }) {
  return (
    <div className={cn("well px-5 py-7 text-center", className)}>
      <p className="text-[0.9375rem] font-semibold text-ink">{what}</p>
      {how && <p className="t-meta mx-auto mt-1 max-w-[48ch]">{how}</p>}
    </div>
  );
}
