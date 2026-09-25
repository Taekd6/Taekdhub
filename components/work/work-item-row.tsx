"use client";

import Link from "next/link";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { IntentionEditor } from "@/components/work/intention-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/progress";
import { DateBadge } from "@/components/ui/list-card";
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
  tone = 0,
  sessions,
  onComplete,
  onAbandon,
  onPostpone,
  onPlan,
}: {
  priority: WorkItemPriority;
  /** Rang dans sa liste : décale le dégradé de la pastille datée (`--dl-1..3`). */
  tone?: number;
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
    <li className="flex gap-3 py-4 sm:gap-4">
      {/* LA PASTILLE DATÉE en dégradé (celle de l'accueil), le jour de la
          semaine dessous ; rose sur fond rose quand c'est en retard. */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-1" aria-hidden>
        {overdue ? (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-rose-400/[0.14] text-rose-300">
            {due ? (
              <span className="flex flex-col items-center leading-none">
                <span className="text-base font-black tabular">{due.getDate()}</span>
                <span className="mt-0.5 text-[0.5625rem] font-extrabold">{MONTHS_SHORT[due.getMonth()].replace(".", "").toUpperCase()}</span>
              </span>
            ) : (
              "—"
            )}
          </span>
        ) : (
          <DateBadge date={due} tone={tone} />
        )}
        {due && <span className={cn("text-2xs font-bold", overdue ? "text-rose-300" : "text-subtle")}>{WEEKDAYS_SHORT[due.getDay()]}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 text-[0.9375rem] font-extrabold leading-snug text-ink">{item.title}</p>
          <p className="shrink-0 whitespace-nowrap text-right">
            <span className="tabular text-[0.9375rem] font-black text-ink">{formatSpan(remainingMinutes * 60)}</span>
            <span className="block text-2xs font-bold text-subtle">à faire</span>
          </p>
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-bold text-subtle">
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

        {explanation && <p className="mt-1 text-[0.8125rem] font-semibold text-muted">{explanation}</p>}

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

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {remainingMinutes > 0 ? (
            <>
              {/* Le geste de la rangée, en pastille à dégradé : il part au chrono. */}
              <Link
                href={workHref}
                className="grad-brand bounce-press inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold [box-shadow:0_8px_18px_-8px_var(--g1)] max-lg:min-h-11"
              >
                Travailler <ArrowRight size={14} strokeWidth={2.6} aria-hidden />
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
