"use client";

import { Badge } from "@/components/ui/badge";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { MathInline } from "@/components/rich-math";
import { formatDuration } from "@/lib/utils";
import type { AttemptResult, WorkSession } from "@/lib/supabase/types";

/** Étiquette + couleur du résultat d'une tentative — un seul point de vérité pour tout affichage de `WorkSession.result`. */
const RESULT_BADGE: Record<AttemptResult, { label: string; variant: "success" | "warning" | "danger" }> = {
  réussi: { label: "Réussi", variant: "success" },
  partiel: { label: "Partiel", variant: "warning" },
  échoué: { label: "Échoué", variant: "danger" },
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Une ligne de journal — partagée entre l'écran Séances et la fiche exercice,
 * pour ne jamais dupliquer ce rendu. Purement présentationnel.
 *
 * L'animation d'entrée a disparu : cent lignes qui montent de 6 px en même
 * temps au chargement du journal, ce n'est pas une transition, c'est un
 * frémissement. La durée n'est plus non plus en couleur d'accent : dans une
 * colonne de cent valeurs, l'accent perd tout son sens et c'est le RÉSULTAT
 * (réussi / partiel / échoué) qui mérite la couleur.
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
    <li className="flex items-center gap-3 py-2.5">
      <SubjectAvatar subject={session.subject} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          {exerciseTitle ? <MathInline text={exerciseTitle} /> : session.subject}
        </p>
        <p className="t-meta mt-0.5 truncate">
          {dateFormatter.format(new Date(session.started_at))}
          {exerciseTitle && ` · ${session.subject}`}
          {chapterLabel && ` · ${chapterLabel}`}
        </p>
      </div>
      {resultBadge && <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>}
      <p className="tabular w-16 shrink-0 text-right text-sm text-ink">{formatDuration(session.duration_seconds)}</p>
    </li>
  );
}
