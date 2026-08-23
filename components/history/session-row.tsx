"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { subjectMeta } from "@/lib/study";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { AttemptResult, WorkSession } from "@/lib/supabase/types";

/** Étiquette + couleur du résultat d'une tentative — un seul point de vérité pour tout affichage de `WorkSession.result`. */
const RESULT_BADGE: Record<AttemptResult, { label: string; variant: "success" | "warning" | "danger" }> = {
  réussi: { label: "Réussi", variant: "success" },
  partiel: { label: "Partiel", variant: "warning" },
  échoué: { label: "Échoué", variant: "danger" },
};

/**
 * Une ligne de séance — partagée entre la page Historique et la section
 * "Séances" de la fiche exercice (Sprint 3F), pour ne jamais dupliquer ce
 * rendu. Purement présentationnel, ne modifie jamais `session`.
 */
export function SessionRow({
  session,
  exerciseTitle,
  chapterLabel,
}: {
  session: WorkSession;
  /** Titre de l'exercice lié, si `session.exercise_id` en référence un — omis pour une séance libre. */
  exerciseTitle?: string | null;
  chapterLabel?: string | null;
}) {
  const resultBadge = session.result ? RESULT_BADGE[session.result] : null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex items-center justify-between gap-3 rounded-xl p-4 transition hover:border-hairline/[0.12]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold", subjectMeta[session.subject].className)}>
          {subjectMeta[session.subject].short}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{exerciseTitle ?? session.subject}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.started_at))}
            {exerciseTitle && ` · ${session.subject}`}
            {chapterLabel && ` · ${chapterLabel}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {resultBadge && <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>}
        <p className="font-semibold tabular-nums text-accent-text">{formatDuration(session.duration_seconds)}</p>
      </div>
    </motion.article>
  );
}
