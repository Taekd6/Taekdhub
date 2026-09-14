"use client";

import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjectById } from "@/lib/domain/subjects";
import { useStore } from "@/lib/store/store";

/**
 * CHRONOMÈTRE EN COURS — une barre discrète, visible depuis tous les écrans.
 *
 * Il n'y a PLUS de page « chronomètre » : un chronomètre n'est pas une
 * destination, c'est un état. On le lance depuis la tâche qu'on commence, et
 * il reste sous les yeux tant qu'il tourne, où qu'on aille dans
 * l'application.
 *
 * Il survit au rechargement (le départ est persisté, voir lib/store/store.tsx) :
 * un onglet fermé par accident ne doit pas effacer deux heures de travail.
 */
export function TimerBar() {
  const { timer, stopTimer, cancelTimer, state } = useStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const task = timer.taskId ? state.tasks.find((item) => item.id === timer.taskId) : undefined;
  const subject = subjectById(state.subjects, timer.subjectId ?? task?.subjectId);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-elevated/95 backdrop-blur-[6px] lg:bottom-0"
    >
      <div className="mx-auto flex max-w-[var(--shell-max)] items-center gap-3 px-4 py-2.5 sm:px-6">
        <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse-soft rounded-full bg-accent-brand" />
        <span className="tabular text-sm font-medium text-ink">
          {hours > 0 && `${hours}:`}
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {task?.title ?? subject?.label ?? "Travail libre"}
        </span>
        <Button size="sm" variant="ghost" onClick={cancelTimer}>
          Annuler
        </Button>
        <Button size="sm" onClick={stopTimer}>
          <Square size={13} /> Arrêter
        </Button>
      </div>
    </div>
  );
}
