"use client";

import { AlertTriangle, CalendarClock, Clock3, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/domain/categories";
import { formatMinutes, formatRelativeDay, timeOf } from "@/lib/domain/date";
import { dueInfo, isOverdue } from "@/lib/domain/tasks";
import { SUBJECT_TONE_CLASS } from "@/lib/domain/subjects";
import { cn } from "@/lib/cn";
import type { Subject, Task } from "@/lib/domain/types";

/**
 * VOCABULAIRE VISUEL commun à tous les écrans.
 *
 * Une tâche se lit de la même façon dans « Aujourd'hui », dans le calendrier
 * et dans la liste complète. Sans ces briques partagées, chaque écran
 * réinventerait sa pastille de matière et son étiquette d'échéance, et trois
 * versions légèrement différentes du même signal cohabiteraient — c'est
 * exactement ce qui rend une interface « pas tout à fait fiable » sans qu'on
 * sache dire pourquoi.
 */

/** Pastille de matière — une lettre, une teinte. Muette pour les lecteurs d'écran quand le libellé est déjà à côté. */
export function SubjectDot({ subject, className }: { subject?: Subject; className?: string }) {
  if (!subject) {
    return (
      <span
        aria-hidden
        className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[0.3125rem] bg-inset text-2xs text-subtle", className)}
      >
        ·
      </span>
    );
  }
  return (
    <span
      title={subject.label}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-[0.3125rem] text-2xs font-semibold",
        SUBJECT_TONE_CLASS[subject.tone],
        className
      )}
    >
      {subject.short}
    </span>
  );
}

/**
 * ÉCHÉANCE — l'information la plus lue de l'application, donc la seule
 * autorisée à être colorée dans une ligne de liste.
 *
 * Trois niveaux seulement : dépassée (rouge), aujourd'hui ou demain (ambre),
 * plus loin (neutre). Cinq teintes graduées ne se distinguent plus dans une
 * liste de trente lignes, et l'urgence cesse d'être un signal.
 */
export function DueBadge({ task, now = new Date() }: { task: Task; now?: Date }) {
  const info = dueInfo(task, now);
  if (info.state === "none") return null;

  const late = info.state === "overdue";
  const pressing = info.state === "today" || info.state === "tomorrow";
  const label = late
    ? `En retard de ${Math.abs(info.days ?? 0)} j`
    : task.dueDateOnly
      ? formatRelativeDay(task.dueAt!, now)
      : `${formatRelativeDay(task.dueAt!, now)} ${timeOf(task.dueAt!)}`;

  return (
    <Badge variant={late ? "danger" : pressing ? "warning" : "default"}>
      {late ? <AlertTriangle size={11} /> : <CalendarClock size={11} />}
      {label}
    </Badge>
  );
}

/** Durée estimée (ou restante) — toujours en clair, jamais une icône seule. */
export function EffortBadge({ minutes }: { minutes: number }) {
  return (
    <Badge variant="bare">
      <Clock3 size={11} /> {formatMinutes(minutes)}
    </Badge>
  );
}

/**
 * LIEN VERS LA RESSOURCE — le rappel permanent que le contenu vit AILLEURS.
 * TaekdHub organise le travail, il n'héberge ni énoncés ni corrigés.
 */
export function SourceLink({ task }: { task: Task }) {
  if (!task.source && !task.sourceUrl) return null;
  const label = task.source ?? "Ressource";
  if (!task.sourceUrl) return <Badge variant="bare">{label}</Badge>;
  return (
    <a
      href={task.sourceUrl}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1 rounded text-2xs text-accent hover:underline"
    >
      <Link2 size={11} /> {label}
    </a>
  );
}

export function CategoryBadge({ task }: { task: Task }) {
  if (task.category === "autre") return null;
  return <Badge variant="bare">{categoryLabel(task.category)}</Badge>;
}

/** Marqueur de priorité — deux niveaux seulement sont montrés : haute et critique. Le reste est le cas normal, et le cas normal ne se signale pas. */
export function PriorityMark({ task }: { task: Task }) {
  if (task.priority < 3) return null;
  return (
    <span
      title={task.priority === 4 ? "Priorité critique" : "Priorité haute"}
      aria-label={task.priority === 4 ? "Priorité critique" : "Priorité haute"}
      className={cn("shrink-0 text-xs font-semibold", task.priority === 4 ? "text-rose-300" : "text-amber-300")}
    >
      {task.priority === 4 ? "!!" : "!"}
    </span>
  );
}

/** Tout ce qui se dit d'une tâche en une ligne de métadonnées. */
export function TaskMeta({ task, subject, minutes, now }: { task: Task; subject?: Subject; minutes: number; now?: Date }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <DueBadge task={task} now={now} />
      <EffortBadge minutes={minutes} />
      <CategoryBadge task={task} />
      {subject && <Badge variant="bare">{subject.label}</Badge>}
      <SourceLink task={task} />
      {task.postponedCount >= 2 && <Badge variant="warning">Reportée {task.postponedCount}×</Badge>}
    </div>
  );
}

export function taskToneClass(task: Task, now: Date = new Date()): string {
  return isOverdue(task, now) ? "text-rose-300" : "";
}
