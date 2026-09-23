"use client";

import Link from "next/link";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/subject-avatar";
import { explainPriority, type WorkItemPriority } from "@/lib/deadlines";
import { progressPercent, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * UNE ÉCHÉANCE — une rangée, trois niveaux de lecture.
 *
 * Ligne 1 : ce que c'est, et ce qu'il en reste.
 * Ligne 2 : pourquoi c'est là (phrase issue du moteur, jamais un texte
 *           décoratif), plus le seul signal coloré de la rangée.
 * Ligne 3 : les actions, quand il y en a.
 *
 * DEUX SIGNAUX, JAMAIS FONDUS EN UN SEUL :
 *
 *   « En retard »   un fait sur le passé — étiquette rouge.
 *   « Ne tient pas » une projection sur l'avenir — étiquette ambre.
 *
 * Un travail peut porter les deux, l'un, ou aucun, et ils ne veulent pas dire
 * la même chose : le premier appelle à rattraper, le second à arbitrer. Les
 * confondre — le piège classique du « urgent = rouge » — les rendrait tous
 * deux inutiles.
 */
export function WorkItemRow({
  priority,
  sessions,
  onComplete,
  onAbandon,
  onPostpone,
}: {
  priority: WorkItemPriority;
  sessions: WorkSession[];
  onComplete: (id: string) => void;
  onAbandon: (id: string) => void;
  onPostpone: (id: string) => void;
}) {
  const { item, feasibility, remainingMinutes, overdue } = priority;
  const done = progressPercent(item, sessions);
  const explanation = explainPriority(priority);
  // Tout travail part au chronomètre, rattaché : TaekdHub mesure le temps
  // sans prétendre savoir ce qu'il y a dedans — l'élève travaille sur ses
  // propres feuilles.
  const workHref = `/timer?travail=${item.id}`;

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        {item.subject ? (
          <SubjectAvatar subject={item.subject} size="sm" />
        ) : (
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-2xs text-subtle" aria-hidden>
            ·
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-ink">{item.title}</p>
            <p className="tabular shrink-0 whitespace-nowrap text-sm text-ink">{formatSpan(remainingMinutes * 60)}</p>
          </div>

          <p className="t-meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate">
              {WORK_ITEM_KIND_META[item.kind].short}
              {item.dueDate && ` · ${formatDueDate(item.dueDate, item.dueTime)}`}
            </span>
            {overdue && <Badge variant="danger">En retard</Badge>}
            {feasibility.level === "non casable" && <Badge variant="warning">Ne tient pas</Badge>}
            {feasibility.level === "juste" && <Badge variant="default">Marge nulle</Badge>}
            {item.important && <Badge variant="accent">Important</Badge>}
          </p>

          {explanation && <p className="t-meta mt-1 text-2xs">{explanation}</p>}

          {done > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Meter value={done} className="max-w-[10rem] flex-1" tone={done >= 100 ? "success" : "accent"} />
              <span className="tabular t-meta shrink-0 text-2xs">{done} %</span>
            </div>
          )}

          {/* Un travail dont tout le temps estimé est passé n'a plus rien à
              « travailler » : la seule action qui ait du sens est de le
              clore. Proposer quand même « Travailler » et « Reporter »
              inviterait à agir sur un travail que le planning ne place déjà
              plus nulle part. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {remainingMinutes > 0 ? (
              <>
                <Link href={workHref}>
                  <Button size="sm" variant="secondary">
                    Travailler <ArrowRight size={13} />
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => onPostpone(item.id)}>
                  Reporter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onComplete(item.id)} aria-label={`Marquer « ${item.title} » comme terminé`}>
                  <Check size={14} /> Terminé
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onComplete(item.id)}>
                <Check size={14} /> Marquer terminé
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto"
              onClick={() => onAbandon(item.id)}
              aria-label={`Supprimer « ${item.title} »`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/**
 * « jeudi 17 septembre », « jeudi 17 septembre, 8 h ».
 *
 * Le jour de la semaine passe EN PREMIER parce que c'est ce qu'un élève
 * retient d'une échéance — « le DS est lundi », pas « le DS est le 21 ».
 */
function formatDueDate(dueDate: string, dueTime: string | null): string {
  const date = new Date(`${dueDate}T00:00:00`);
  const base = `${WEEKDAYS[date.getDay()]} ${dateFormatter.format(date)}`;
  return dueTime ? `${base}, ${dueTime.replace(":", " h ")}` : base;
}
