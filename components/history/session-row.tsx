"use client";

import { SubjectAvatar } from "@/components/subject-avatar";
import { formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** Dans un journal DÉJÀ groupé par jour, la date est portée par l'en-tête du groupe : la ligne n'a plus qu'à dire l'heure. */
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

/**
 * Une ligne de journal — purement présentationnelle.
 *
 * Ce que la ligne dit, dans l'ordre : le travail planifié que la séance
 * servait (s'il y en a un), sinon la note que l'élève a laissée, sinon la
 * matière. L'ancienne version titrait la ligne par l'exercice de la banque
 * et affichait le résultat de la tentative (réussi / partiel / échoué) ; la
 * banque retirée, ces deux informations n'existent plus pour une séance
 * nouvelle, et celles des anciennes séances ne sont plus affichées.
 *
 * L'animation d'entrée a disparu : cent lignes qui montent de 6 px en même
 * temps au chargement du journal, ce n'est pas une transition, c'est un
 * frémissement.
 */
export function SessionRow({
  session,
  workItemTitle,
  /**
   * `true` quand la ligne vit sous un en-tête de jour (écran Séances) : la
   * date y est déjà écrite une fois pour tout le groupe, la répéter sur
   * chaque ligne ne fait que voler de la place au titre.
   */
  dateInHeader = false,
}: {
  session: WorkSession;
  /** Titre du travail planifié lié (`session.work_item_id`), s'il existe encore. */
  workItemTitle?: string | null;
  dateInHeader?: boolean;
}) {
  const when = (dateInHeader ? timeFormatter : dateFormatter).format(new Date(session.started_at));
  const note = session.note?.trim() || null;
  const title = workItemTitle ?? note ?? session.subject;

  /*
   * DEUX LIGNES, PAS QUATRE COLONNES.
   *
   * La DURÉE est à droite du titre : c'est la valeur qu'on compare d'une
   * ligne à l'autre, elle mérite une colonne alignée. L'heure, la matière et
   * la note (quand elle n'est pas déjà le titre) descendent dans la ligne de
   * métadonnées.
   */
  return (
    <li className="flex items-start gap-3 py-2.5">
      <SubjectAvatar subject={session.subject} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-ink">{title}</p>
          <p className="tabular shrink-0 whitespace-nowrap text-right text-sm text-ink">
            {formatSpan(session.duration_seconds)}
          </p>
        </div>
        <p className="t-meta mt-0.5 min-w-0 truncate">
          {when}
          {title !== session.subject && ` · ${session.subject}`}
          {workItemTitle && note && ` · ${note}`}
        </p>
      </div>
    </li>
  );
}
