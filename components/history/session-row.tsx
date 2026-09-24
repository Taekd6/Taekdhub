"use client";

import { SubjectAvatar } from "@/components/subject-avatar";
import { cn } from "@/lib/cn";
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
 * matière. (L'ancienne version titrait la ligne par l'exercice de la banque
 * et affichait le résultat de la tentative ; la banque retirée, ces deux
 * informations n'existent plus.)
 *
 * EN FRISE : l'heure à gauche, dans une colonne alignée ; la pastille de la
 * matière posée sur un FIL vertical qui relie les séances du jour (il
 * s'arrête à la dernière) ; le titre et la matière ; la durée à droite, en
 * gras tabulaire — c'est la valeur qu'on compare d'une ligne à l'autre. La
 * rangée entière s'éclaire au survol.
 */
export function SessionRow({
  session,
  workItemTitle,
  /**
   * `true` quand la ligne vit sous un en-tête de jour (écran Séances) : la
   * date y est déjà écrite une fois pour tout le groupe.
   */
  dateInHeader = false,
  /** Dernière séance du jour : le fil s'arrête à sa pastille. */
  last = false,
}: {
  session: WorkSession;
  /** Titre du travail planifié lié (`session.work_item_id`), s'il existe encore. */
  workItemTitle?: string | null;
  dateInHeader?: boolean;
  last?: boolean;
}) {
  const when = (dateInHeader ? timeFormatter : dateFormatter).format(new Date(session.started_at));
  const note = session.note?.trim() || null;
  const title = workItemTitle ?? note ?? session.subject;

  return (
    <li className="row-hover relative flex items-center gap-3 rounded-xl px-3 py-3 sm:gap-4 sm:px-4">
      <span className={cn("tabular shrink-0 text-[0.8125rem] font-semibold text-subtle", dateInHeader ? "w-11" : "hidden")}>{dateInHeader && when}</span>
      <span className="relative flex shrink-0 self-stretch">
        {/* Le fil : du centre de la pastille jusqu'à la ligne suivante. */}
        {!last && <span aria-hidden className="absolute left-1/2 top-1/2 h-[calc(100%+1.5rem)] w-px -translate-x-1/2 bg-line" />}
        <span className="relative my-auto">
          <SubjectAvatar subject={session.subject} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-ink">{title}</p>
        <p className="t-meta mt-0.5 truncate text-[0.8125rem]">
          {!dateInHeader && `${when} · `}
          {title !== session.subject ? session.subject : "Séance"}
          {workItemTitle && note && ` · ${note}`}
        </p>
      </div>
      <p className="tabular shrink-0 whitespace-nowrap text-right text-[0.9375rem] font-bold text-ink">{formatSpan(session.duration_seconds)}</p>
    </li>
  );
}
