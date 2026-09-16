"use client";

import { Badge } from "@/components/ui/badge";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { MathInline } from "@/components/rich-math";
import { formatSpan } from "@/lib/utils";
import type { AttemptResult, WorkSession } from "@/lib/supabase/types";

/** Étiquette + couleur du résultat d'une tentative — un seul point de vérité pour tout affichage de `WorkSession.result`. */
const RESULT_BADGE: Record<AttemptResult, { label: string; variant: "success" | "warning" | "danger" }> = {
  réussi: { label: "Réussi", variant: "success" },
  partiel: { label: "Partiel", variant: "warning" },
  échoué: { label: "Échoué", variant: "danger" },
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** Dans un journal DÉJÀ groupé par jour, la date est portée par l'en-tête du groupe : la ligne n'a plus qu'à dire l'heure. */
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

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
  /**
   * `true` quand la ligne vit sous un en-tête de jour (écran Séances) : la
   * date y est déjà écrite une fois pour tout le groupe, la répéter sur
   * chaque ligne ne fait que voler de la place au titre. La fiche exercice,
   * elle, aligne des séances de dates quelconques — elle garde la date.
   */
  dateInHeader = false,
}: {
  session: WorkSession;
  /** Titre de l'exercice lié, si `session.exercise_id` en référence un — omis pour une séance libre. */
  exerciseTitle?: string | null;
  chapterLabel?: string | null;
  dateInHeader?: boolean;
}) {
  const resultBadge = session.result ? RESULT_BADGE[session.result] : null;
  const when = (dateInHeader ? timeFormatter : dateFormatter).format(new Date(session.started_at));

  /*
   * DEUX LIGNES, PAS QUATRE COLONNES.
   *
   * Le titre, le résultat et la durée se partageaient la même ligne : à
   * 390 px, l'étiquette de résultat et la durée prenaient 120 px, et il
   * restait de quoi écrire « Translation des polynômes … » — le titre de
   * l'exercice, c'est-à-dire la seule chose qui permet de reconnaître la
   * séance, était systématiquement coupé.
   *
   * La DURÉE monte à droite du titre : c'est la valeur qu'on compare d'une
   * ligne à l'autre, elle mérite une colonne alignée. Le RÉSULTAT redescend
   * dans la ligne de métadonnées, avec l'heure et le chapitre — c'est un
   * fait de la séance au même titre qu'eux, pas une colonne.
   */
  return (
    <li className="flex items-start gap-3 py-2.5">
      <SubjectAvatar subject={session.subject} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-ink">
            {exerciseTitle ? <MathInline text={exerciseTitle} /> : session.subject}
          </p>
          <p className="tabular shrink-0 whitespace-nowrap text-right text-sm text-ink">
            {formatSpan(session.duration_seconds)}
          </p>
        </div>
        <p className="t-meta mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="min-w-0 truncate">
            {when}
            {exerciseTitle && ` · ${session.subject}`}
            {chapterLabel && ` · ${chapterLabel}`}
          </span>
          {resultBadge && <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>}
        </p>
      </div>
    </li>
  );
}
