import { cn } from "@/lib/cn";

/**
 * MARQUE DE L'APP — un arc ouvert et un point, jamais fermés en cercle
 * complet : la même grammaire que l'anneau d'objectif du Dashboard
 * (`CircularProgress`), qui lui non plus ne se referme qu'une fois la
 * journée finie. Un état vide n'est pas un échec, c'est un cercle qui n'a
 * pas encore de raison de se fermer — la même idée visuelle porte les deux
 * situations plutôt que d'inventer une deuxième illustration.
 *
 * SVG inline, pas d'image : quelques octets, aucune requête, et la couleur
 * suit l'accent choisi par l'élève (lib/theme.ts) dans les deux thèmes.
 * Rotation lente uniquement — jamais de mouvement qui capte l'attention sur
 * un écran qui, par définition, n'a rien d'autre à montrer ; coupée par
 * `motion-reduce` pour qui a demandé moins de mouvement.
 */
function OrbitMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-14 w-14", className)} aria-hidden="true">
      <circle cx="32" cy="32" r="26" className="stroke-hairline/[0.09]" strokeWidth="3" fill="none" />
      <circle
        cx="32"
        cy="32"
        r="26"
        stroke="rgb(var(--accent-rgb))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="40 200"
        fill="none"
        className="origin-center motion-safe:animate-[spin_7s_linear_infinite] motion-reduce:opacity-70"
      />
      <circle
        cx="32"
        cy="6"
        r="3"
        fill="rgb(var(--accent-rgb))"
        style={{ transformOrigin: "32px 32px" }}
        className="motion-safe:animate-[spin_7s_linear_infinite] motion-reduce:hidden"
      />
    </svg>
  );
}

/**
 * État vide unifié — remplace les demi-douzaines de variantes ad hoc
 * (icône Lucide + titre + description, chacune avec ses propres tailles et
 * espacements) qui s'étaient accumulées écran par écran. Une seule marque,
 * une seule hiérarchie : c'est aussi ce qui rend un état "rien à montrer"
 * reconnaissable comme TaekdHub plutôt qu'interchangeable avec n'importe
 * quel gabarit.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <OrbitMark />
      <p className="mt-4 text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
