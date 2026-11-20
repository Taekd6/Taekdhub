"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { chapterForTask } from "@/lib/seance";
import type { WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/**
 * SÉANCE DU JOUR — ce qui est prévu aujourd'hui (échéance aujourd'hui ou
 * dépassée, pas terminé), dans l'ordre, chaque tâche avec son raccourci :
 * Anki, le chapitre d'Exos qui lui correspond (repéré par les mots du titre
 * et de la note), et un bouton « Fait ».
 */
export function SeanceDuJour() {
  const { workItems, saveWorkItems, ready } = usePrepahubData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = mounted ? dayKey(new Date()) : "";

  const items = useMemo(
    () =>
      workItems
        .filter((item) => item.status !== "terminé" && item.status !== "abandonné" && item.dueDate === today)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")),
    [workItems, today]
  );
  const late = useMemo(() => workItems.filter((item) => item.status !== "terminé" && item.status !== "abandonné" && item.dueDate !== null && item.dueDate < today).length, [workItems, today]);
  const done = useMemo(() => workItems.filter((item) => item.status === "terminé" && item.dueDate === today).length, [workItems, today]);

  if (!mounted || !ready) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const finish = (item: WorkItem) => saveWorkItems(workItems.map((entry) => (entry.id === item.id ? { ...entry, status: "terminé" as const } : entry)));
  const minutes = items.reduce((n, item) => n + item.estimatedMinutes, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Séance du jour</h1>
        <p className="text-sm text-muted-foreground">
          {items.length ? `${items.length} tâche${items.length > 1 ? "s" : ""} · ≈ ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : "Rien de prévu aujourd'hui."}
          {done ? ` · ${done} déjà faite${done > 1 ? "s" : ""}` : ""}
          {late ? ` · ${late} en retard des jours précédents (dans Échéances)` : ""}
        </p>
      </div>
      <ol className="space-y-3">
        {items.map((item, index) => {
          const chapter = chapterForTask(item);
          const anki = /anki/i.test(item.title);
          const href = chapter ? `/exos/${chapter.id}` : anki ? "/anki" : `/echeances?t=${item.id}`;
          
          return (
            <li key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-surface">
              <Link href={href} className="flex items-start gap-3 p-4 active:opacity-70">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">≈ {item.estimatedMinutes} min{item.dueTime ? ` · ${item.dueTime}` : ""}</span>
                  {item.note && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{item.note}</span>}
                </span>
                <span aria-hidden="true" className="self-center text-xl text-muted-foreground">›</span>
              </Link>
              <div className="flex flex-wrap gap-2 border-t px-4 py-3">
                {anki && (
                  <Link href="/anki" className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                    Anki
                  </Link>
                )}
                {chapter && (
                  <Link href={`/exos/${chapter.id}`} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                    Exos · {chapter.title}
                  </Link>
                )}
                <button type="button" onClick={() => finish(item)} className="ml-auto rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                  Fait ✓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
