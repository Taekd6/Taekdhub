"use client";

import { Check, MoreHorizontal, Play, Square } from "lucide-react";
import { useState } from "react";
import { SubjectDot, PriorityMark, TaskMeta } from "@/components/tasks/task-bits";
import { Button } from "@/components/ui/button";
import { rowClass } from "@/components/ui/section";
import { subjectById } from "@/lib/domain/subjects";
import { isOpen, remainingMinutes } from "@/lib/domain/tasks";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { Task } from "@/lib/domain/types";

/**
 * RANGÉE DE TÂCHE — le motif le plus répété de l'application.
 *
 * Une seule action est offerte au doigt sans détour : TERMINER. C'est
 * l'action que l'on fait dix fois par jour ; tout le reste (modifier,
 * reporter, replanifier, supprimer) passe par l'ouverture de la tâche, qui
 * est un geste rare.
 *
 * La case à cocher est un vrai bouton de 44 px sur mobile, pas une case de
 * 16 px : terminer une tâche depuis son lit, d'une main, doit marcher du
 * premier coup.
 */
export function TaskRow({
  task,
  onOpen,
  showTimer = false,
  className,
  now = new Date(),
}: {
  task: Task;
  onOpen?: (task: Task) => void;
  /** Affiche le bouton « démarrer le chronomètre » — réservé aux écrans d'action (Aujourd'hui). */
  showTimer?: boolean;
  className?: string;
  now?: Date;
}) {
  const { state, completeTask, reopenTask, startTimer, stopTimer, timer } = useStore();
  const [justDone, setJustDone] = useState(false);
  const subject = subjectById(state.subjects, task.subjectId);
  const minutes = remainingMinutes(task, state.timeEntries);
  const open = isOpen(task);
  const running = timer?.taskId === task.id;

  return (
    <li className={cn(rowClass, "gap-2.5", className)}>
      <button
        type="button"
        aria-label={open ? `Terminer « ${task.title} »` : `Rouvrir « ${task.title} »`}
        aria-pressed={!open}
        onClick={() => {
          if (open) {
            setJustDone(true);
            completeTask(task.id);
          } else {
            setJustDone(false);
            reopenTask(task.id);
          }
        }}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors max-lg:h-11 max-lg:w-11 max-lg:rounded-lg",
          open ? "border-line text-transparent hover:border-accent hover:text-accent" : "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
        )}
      >
        <Check size={13} strokeWidth={2.5} className="max-lg:hidden" />
        <Check size={17} strokeWidth={2.5} className="lg:hidden" />
      </button>

      <button
        type="button"
        onClick={() => onOpen?.(task)}
        className="min-w-0 flex-1 text-left"
        disabled={!onOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          <SubjectDot subject={subject} />
          <span className={cn("min-w-0 truncate text-[0.9375rem]", !open && "text-subtle line-through")}>{task.title}</span>
          <PriorityMark task={task} />
        </span>
        {open && <TaskMeta task={task} subject={subject} minutes={minutes} now={now} />}
        {justDone && !open && (
          <span className="t-meta mt-1 block text-emerald-300">Terminée — pense à noter le temps passé.</span>
        )}
      </button>

      {showTimer && open && (
        <Button
          size="icon"
          variant={running ? "primary" : "ghost"}
          aria-label={running ? "Arrêter le chronomètre" : "Démarrer le chronomètre"}
          title={running ? "Arrêter le chronomètre" : "Démarrer le chronomètre"}
          onClick={() => (running ? stopTimer() : startTimer({ taskId: task.id, subjectId: task.subjectId }))}
        >
          {running ? <Square size={14} /> : <Play size={14} />}
        </Button>
      )}

      {onOpen && (
        <Button size="icon" variant="ghost" aria-label={`Ouvrir « ${task.title} »`} onClick={() => onOpen(task)} className="max-sm:hidden">
          <MoreHorizontal size={15} />
        </Button>
      )}
    </li>
  );
}
