import { cn } from "@/lib/cn";
import { contestPaperStatusMeta } from "@/lib/contests";
import type { ContestPaperStatus } from "@/lib/storage";

/** Pastille de statut de progression d'un sujet — même grammaire visuelle que `statusMeta` (lib/study.ts) pour un exercice, jamais un nouveau vocabulaire de couleurs. */
export function ContestStatusBadge({ status, className }: { status: ContestPaperStatus; className?: string }) {
  const meta = contestPaperStatusMeta[status];
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium", meta.className, className)}>
      {meta.label}
    </span>
  );
}
