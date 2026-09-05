import { cn } from "@/lib/cn";

/**
 * INDICATEUR — un chiffre et ce qu'il mesure.
 *
 * Volontairement SANS cadre, sans icône et sans fond. Un « stat card » avec
 * son icône dans un carré arrondi est le signe distinctif du tableau de bord
 * générique ; quatre d'entre eux alignés occupent un écran entier pour dire
 * quatre nombres. Ici, le chiffre est composé en serif à taille réelle et
 * séparé de son voisin par un simple filet vertical : la donnée est
 * l'élément, pas son emballage.
 */
export function Stat({
  label,
  value,
  detail,
  tone,
  size = "md",
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = {
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
  } as const;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="t-label">{label}</p>
      <p
        className={cn(
          "mt-1.5",
          size === "sm" && "t-figure-sm",
          size === "md" && "t-figure-md",
          size === "lg" && "t-figure-lg",
          tone ? tones[tone] : "text-ink"
        )}
      >
        {value}
      </p>
      {detail && <p className="t-meta mt-1">{detail}</p>}
    </div>
  );
}

/**
 * RANGÉE D'INDICATEURS — séparés par des filets verticaux plutôt que par des
 * cartes. Se replie proprement en grille sur mobile.
 */
export function StatRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:items-start sm:gap-x-0",
        "[&>*]:sm:border-l [&>*]:sm:border-line [&>*]:sm:pl-6 [&>*]:sm:pr-6 [&>*:first-child]:sm:border-l-0 [&>*:first-child]:sm:pl-0",
        className
      )}
    >
      {children}
    </div>
  );
}
