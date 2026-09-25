"use client";

import Link from "next/link";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { IntentionEditor } from "@/components/work/intention-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Meter } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { explainPriority, type WorkItemPriority } from "@/lib/deadlines";
import { progressPercent, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";
import type { WorkItemPlan } from "@/lib/storage";

/**
 * UNE ÉCHÉANCE — une entrée de la frise, trois niveaux de lecture.
 *
 * À gauche : LE JOUR, composé comme une page de calendrier (« jeu. / 25 /
 *            sept. ») — c'est ce qu'un élève retient d'une échéance : « le
 *            DS est jeudi », pas « le DS est le 25 ».
 * Au centre : ce que c'est, ce qu'il en reste, pourquoi c'est là (phrase
 *            issue du moteur, jamais un texte décoratif), l'avancement.
 * En bas :   les actions.
 *
 * DEUX SIGNAUX, JAMAIS FONDUS EN UN SEUL :
 *
 *   « En retard »   un fait sur le passé — étiquette rouge.
 *   « Ne tient pas » une projection sur l'avenir — étiquette orange.
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
  onPlan,
}: {
  priority: WorkItemPriority;
  sessions: WorkSession[];
  onComplete: (id: string) => void;
  onAbandon: (id: string) => void;
  onPostpone: (id: string) => void;
  /** Plan « si… alors… » — voir lib/intentions.ts. */
  onPlan?: (id: string, plan: WorkItemPlan | null) => void;
}) {
  const { item, feasibility, remainingMinutes, overdue } = priority;
  const done = progressPercent(item, sessions);
  const explanation = explainPriority(priority);
  // Tout travail part au chronomètre, rattaché : TaekdHub mesure le temps
  // sans prétendre savoir ce qu'il y a dedans — l'élève travaille sur ses
  // propres feuilles.
  const workHref = `/timer?travail=${item.id}`;
  const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : null;

  return (
    <li className="flex gap-4 py-5 sm:gap-6">
      <div className={cn("w-12 shrink-0 pt-0.5 text-center sm:w-14", overdue ? "text-rose-300" : "text-ink")} aria-hidden>
        {due ? (
          <>
            <span className={cn("block text-2xs font-semibold", overdue ? "text-rose-300" : "text-subtle")}>{WEEKDAYS_SHORT[due.getDay()]}</span>
            <span className="t-figure-md block">{due.getDate()}</span>
            <span className={cn("block text-2xs font-semibold", overdue ? "text-rose-300" : "text-subtle")}>{MONTHS_SHORT[due.getMonth()]}</span>
          </>
        ) : (
          <span className="mt-2 block text-2xs font-semibold text-subtle">sans date</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="t-subhead min-w-0 flex-1">{item.title}</p>
          <p className="shrink-0 whitespace-nowrap text-right">
            <span className="tabular text-[0.9375rem] font-bold text-ink">{formatSpan(remainingMinutes * 60)}</span>
            <span className="block text-2xs text-subtle">à faire</span>
          </p>
        </div>

        <p className="t-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0">
            {WORK_ITEM_KIND_META[item.kind].label}
            {item.subject && ` · ${item.subject}`}
            {due && <span className="sr-only">{` · à rendre le ${formatDueDate(item.dueDate as string, item.dueTime)}`}</span>}
            {item.dueTime && <span aria-hidden>{` · ${item.dueTime.replace(":", " h ")}`}</span>}
          </span>
          {overdue && <Badge variant="danger">En retard</Badge>}
          {feasibility.level === "non casable" && <Badge variant="warning">Ne tient pas</Badge>}
          {feasibility.level === "juste" && <Badge variant="default">Marge nulle</Badge>}
          {item.important && <Badge variant="accent">Important</Badge>}
        </p>

        {explanation && <p className="t-meta mt-1.5 text-[0.8125rem]">{explanation}</p>}

        {done > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <Meter value={done} className="max-w-[12rem] flex-1" tone={done >= 100 ? "success" : "accent"} />
            <span className="tabular t-meta shrink-0 text-2xs font-semibold">{done} % fait</span>
          </div>
        )}

        {/* Un travail dont tout le temps estimé est passé n'a plus rien à
            « travailler » : la seule action qui ait du sens est de le
            clore. Proposer quand même « Travailler » et « Reporter »
            inviterait à agir sur un travail que le planning ne place déjà
            plus nulle part. Le lien est STYLÉ en bouton — jamais un bouton
            dans un lien (deux arrêts de tabulation pour une action). */}
        {onPlan && remainingMinutes > 0 && <IntentionEditor item={item} onPlan={onPlan} />}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {remainingMinutes > 0 ? (
            <>
              <Link href={workHref} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                Travailler <ArrowRight size={13} aria-hidden />
              </Link>
              <Button size="sm" variant="ghost" onClick={() => onPostpone(item.id)} aria-label={`Reporter « ${item.title} »`}>
                Reporter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onComplete(item.id)} aria-label={`Marquer « ${item.title} » comme terminé`}>
                <Check size={14} aria-hidden /> Terminé
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onComplete(item.id)}>
              <Check size={14} aria-hidden /> Marquer terminé
            </Button>
          )}
          <Button size="icon" variant="ghost" className="ml-auto" onClick={() => onAbandon(item.id)} aria-label={`Supprimer « ${item.title} »`}>
            <Trash2 size={15} aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const WEEKDAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/**
 * « jeudi 17 septembre », « jeudi 17 septembre, 8 h » — la version LUE de
 * la page de calendrier, pour les lecteurs d'écran.
 */
function formatDueDate(dueDate: string, dueTime: string | null): string {
  const date = new Date(`${dueDate}T00:00:00`);
  const base = `${WEEKDAYS[date.getDay()]} ${dateFormatter.format(date)}`;
  return dueTime ? `${base}, ${dueTime.replace(":", " h ")}` : base;
}
