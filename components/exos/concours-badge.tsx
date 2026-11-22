import { concoursBadge } from "@/lib/exo-concours";
import type { ExoEntry } from "@/lib/exos";

/** Pastille colorée du concours d'un exo (CCINP, Centrale, Mines, X-ENS, e3a, PT, BEOS). Rien si le concours n'est pas reconnu. */
export function ConcoursBadge({ entry }: { entry: Pick<ExoEntry, "concours" | "titre" | "source"> }) {
  const badge = concoursBadge(entry);
  if (!badge) return null;
  return (
    <span className="x-cb" style={{ "--cb": badge.color } as React.CSSProperties} title={badge.label}>
      {badge.label}
    </span>
  );
}
