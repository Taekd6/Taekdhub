"use client";

import { CalendarClock, Check, Clock, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { WorkItem } from "@/lib/storage";
import { addDays, localDay } from "@/lib/week-agenda";
import { toggleWorkItemDone, updateWorkItem } from "@/lib/work-items";

const KIND: Record<WorkItem["kind"], string> = { dm: "DM", ds: "DS", colle: "Khôlle", exercices: "Exercices", chapitre: "Cours", concours: "Concours", autre: "Tâche" };
const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dayLabel = (day: string) => DAY.format(new Date(`${day}T12:00:00`));

/** Une ligne de la note : puce, lien cliquable, ou texte. */
function NoteLine({ line }: { line: string }) {
  const bullet = /^\s*[-•]\s+/.test(line);
  const text = line.replace(/^\s*[-•]\s+/, "");
  const parts = text.split(/(https?:\/\/\S+)/g);
  const content = parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all font-semibold text-accent underline underline-offset-2">
        {part.replace(/^https?:\/\//, "").slice(0, 48)}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
  if (!text.trim()) return <div className="h-2" />;
  return bullet ? (
    <li className="ml-5 list-disc">{content}</li>
  ) : (
    <p>{content}</p>
  );
}

/**
 * LE CONTENU D'UNE TÂCHE (mission 23, demande de l'élève : « je clique sur une
 * séance de demain et je vois le contenu ») — ce qu'il y a à faire (la note
 * posée par Claude : exos, chapitres, liens), quand, pour quand, et trois
 * gestes : cocher, reporter à demain, rouvrir.
 */
export function TaskDetail({ item, workItems, saveWorkItems, onClose }: { item: WorkItem | null; workItems: WorkItem[]; saveWorkItems: (items: WorkItem[]) => void; onClose: () => void }) {
  if (!item) return null;
  const done = item.status === "terminé";
  const planned = item.plan?.day ?? null;
  const lines = (item.note ?? "").split("\n");

  function postpone() {
    if (!item) return;
    const from = item.plan?.day ?? localDay(new Date());
    const next = localDay(addDays(new Date(`${from}T12:00:00`), 1));
    saveWorkItems(updateWorkItem(workItems, item.id, { plan: { day: next, time: item.plan?.time ?? null, place: item.plan?.place ?? null }, updatedAt: new Date().toISOString() }));
    onClose();
  }

  return (
    <Dialog
      open
      title={item.title}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {!done && (
            <Button variant="secondary" size="sm" onClick={postpone}>
              <RotateCcw size={15} aria-hidden /> Demain
            </Button>
          )}
          <Button
            size="sm"
            variant={done ? "secondary" : "primary"}
            onClick={() => {
              saveWorkItems(toggleWorkItemDone(workItems, item.id));
              onClose();
            }}
          >
            {done ? <Undo2 size={15} aria-hidden /> : <Check size={15} aria-hidden />} {done ? "Rouvrir" : "C'est fait"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {item.subject && <span className="rounded-full bg-accent-dim px-2.5 py-1 text-[0.8125rem] font-bold text-accent">{item.subject}</span>}
          <span className="rounded-full bg-inset px-2.5 py-1 text-[0.8125rem] font-semibold text-muted">{KIND[item.kind]}</span>
          {item.important && <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-[0.8125rem] font-bold text-rose-300">Important</span>}
          {done && <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[0.8125rem] font-bold text-emerald-300">Fait</span>}
        </div>
        <dl className="grid gap-2 text-[0.9375rem]">
          {planned && (
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-subtle" aria-hidden />
              <dt className="sr-only">Quand</dt>
              <dd className="font-semibold first-letter:uppercase">
                {dayLabel(planned)}
                {item.plan?.time ? ` à ${item.plan.time.replace(":", "h")}` : ""}
              </dd>
            </div>
          )}
          {item.dueDate && (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-subtle" aria-hidden />
              <dt className="sr-only">Pour quand</dt>
              <dd className="text-muted">
                Pour le {dayLabel(item.dueDate)}
                {item.dueTime ? ` (${item.dueTime.replace(":", "h")})` : ""} · environ {item.estimatedMinutes >= 60 ? `${Math.floor(item.estimatedMinutes / 60)} h${item.estimatedMinutes % 60 ? ` ${item.estimatedMinutes % 60}` : ""}` : `${item.estimatedMinutes} min`}
              </dd>
            </div>
          )}
        </dl>
        <div className="well space-y-1.5 p-4 text-[0.9375rem] leading-relaxed">
          {item.note?.trim() ? (
            <ul className="space-y-1.5">
              {lines.map((line, index) => (
                <NoteLine key={index} line={line} />
              ))}
            </ul>
          ) : (
            <p className="text-muted">Pas encore de contenu. Demande à Claude de préparer cette séance.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
