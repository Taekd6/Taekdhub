import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * « POURQUOI ÇA MARCHE » — l'explication repliée d'une fonctionnalité
 * fondée sur une étude.
 *
 * REPLIÉE par défaut : l'élève vient saisir, pas lire. Mais une
 * fonctionnalité qui demande un geste quotidien doit pouvoir dire pourquoi,
 * en trois phrases, avec ses sources — et ses LIMITES, dites aussi
 * clairement que le reste. Aucune promesse de résultat : ce qu'une étude
 * montre en moyenne sur des groupes ne garantit rien à un élève en
 * particulier.
 *
 * `<details>` natif : ouvrable au clavier, lu correctement par les lecteurs
 * d'écran, sans une ligne d'état React.
 */
export function WhyItWorks({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <details className={cn("group", className)}>
      <summary className="t-meta inline-flex cursor-pointer list-none items-center gap-1 text-2xs hover:text-ink max-lg:min-h-11 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={12} aria-hidden className="transition-transform group-open:rotate-90" />
        Pourquoi ça marche
      </summary>
      <div className="t-meta mt-2 space-y-1.5 text-2xs leading-relaxed">{children}</div>
    </details>
  );
}
