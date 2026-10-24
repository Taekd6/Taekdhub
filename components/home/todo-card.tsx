"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { groupTodo, shortDay } from "@/lib/todo-view";
import { dayKey, subjects } from "@/lib/study";
import type { WorkItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";
import { abandonWorkItem, completeWorkItem, createWorkItem } from "@/lib/work-items";

/**
 * « À FAIRE » SUR L'ACCUEIL — la liste de l'élève, pas une recommandation :
 * il écrit une tâche (titre, date et matière facultatives), la coche quand
 * c'est fait, la supprime si elle ne sert plus. Rangée par échéance : en
 * retard, aujourd'hui, demain, cette semaine, plus tard, sans date.
 *
 * Ce sont les « travaux » (`workItems`) de la page Échéances : une tâche
 * ajoutée ici y apparaît, et inversement. Aucune durée n'est demandée (30 min
 * par défaut, jamais affichées) ; « Tout planifier » mène à la page Échéances.
 */
export function TodoCard({ workItems, saveWorkItems, className }: { workItems: WorkItem[]; saveWorkItems: (items: WorkItem[]) => void; className?: string }) {
  const today = dayKey(new Date());
  const groups = useMemo(() => groupTodo(workItems, today), [workItems, today]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState<Subject | "">("");

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    saveWorkItems([createWorkItem({ title, kind: "autre", subject: subject || null, estimatedMinutes: 30, dueDate: dueDate || null }), ...workItems]);
    setTitle("");
    setDueDate("");
  }

  return (
    <Section
      variant="panel"
      title="À faire"
      className={className}
      action={
        <Link href="/echeances" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Tout voir
        </Link>
      }
    >
      <form onSubmit={add} className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1 basis-[12rem]">
            <span className="sr-only">Nouvelle tâche</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ajouter une tâche…" maxLength={120} />
          </label>
          <Button type="submit" disabled={!title.trim()} className="shrink-0">
            Ajouter
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0">
            <span className="sr-only">Pour quand</span>
            <Input type="date" value={dueDate} min={today} onChange={(event) => setDueDate(event.target.value)} className="w-auto" />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Matière</span>
            <Select value={subject} onChange={(event) => setSubject(event.target.value as Subject | "")} wrapperClassName="w-auto min-w-[9rem]">
              <option value="">Sans matière</option>
              {subjects.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </form>

      {groups.length === 0 ? (
        <p className="t-body text-muted">Rien à faire pour l&apos;instant. Ajoute ta première tâche ci-dessus.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h3 className={cn("t-label mb-1", group.id === "retard" && "text-rose-300")}>
                {group.title} <span className="tabular text-subtle">· {group.items.length}</span>
              </h3>
              <ul className="divide-y divide-line">
                {group.items.map((entry) => (
                  <li key={entry.id} className="flex min-h-14 items-center gap-3 py-2">
                    <button
                      type="button"
                      aria-label={`Terminé : ${entry.title}`}
                      onClick={() => saveWorkItems(completeWorkItem(workItems, entry.id))}
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-line text-transparent hover:border-accent hover:text-accent max-lg:h-11 max-lg:w-11"
                    >
                      <Check size={16} aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="t-body truncate font-semibold">{entry.title}</p>
                      <p className="t-meta truncate">
                        {[entry.subject, entry.dueDate ? shortDay(entry.dueDate) + (entry.dueTime ? ` · ${entry.dueTime}` : "") : null].filter(Boolean).join(" · ") || " "}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Supprimer : ${entry.title}`}
                      onClick={() => saveWorkItems(abandonWorkItem(workItems, entry.id))}
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle hover:bg-inset hover:text-ink max-lg:h-11 max-lg:w-11"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Section>
  );
}
