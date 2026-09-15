"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Clock3, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { DueBadge, SubjectDot } from "@/components/tasks/task-bits";
import { categoryLabel } from "@/lib/domain/categories";
import { formatDay, formatMinutes, timeOf } from "@/lib/domain/date";
import { suggestPostponeOptions } from "@/lib/domain/scheduling";
import { subjectById } from "@/lib/domain/subjects";
import { actualMinutes, effortMinutes, isOpen, remainingMinutes } from "@/lib/domain/tasks";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { Task } from "@/lib/domain/types";

/**
 * FICHE DE TÂCHE — ce qu'on fait d'une tâche, pas ce qu'elle contient.
 *
 * Les quatre actions réelles, dans l'ordre où on les utilise : terminer,
 * enregistrer du temps, reporter, modifier. C'est aussi ici que vit le
 * REPORT INTELLIGENT : plutôt qu'un « remettre à demain » aveugle, TaekdHub
 * calcule où la tâche a réellement sa place (domain/scheduling.ts) et dit ce
 * que ce choix coûte.
 */
const QUICK_TIMES = [15, 30, 45, 60, 90] as const;

export function TaskDetail({
  open,
  task,
  onClose,
  onEdit,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}) {
  const { state, completeTask, reopenTask, cancelTask, deleteTask, logTime, postponeTask, scheduleTask, unscheduleTask } = useStore();
  const [customMinutes, setCustomMinutes] = useState("");
  const [logged, setLogged] = useState<number | null>(null);

  const live = task ? (state.tasks.find((item) => item.id === task.id) ?? task) : null;

  const options = useMemo(() => {
    if (!live || !isOpen(live)) return [];
    return suggestPostponeOptions(state, live);
  }, [live, state]);

  if (!live) return null;

  const subject = subjectById(state.subjects, live.subjectId);
  const spent = actualMinutes(live.id, state.timeEntries);
  const remaining = remainingMinutes(live, state.timeEntries);
  const openTask = isOpen(live);

  function log(minutes: number) {
    if (!live || minutes <= 0) return;
    logTime({ taskId: live.id, subjectId: live.subjectId, minutes });
    setLogged(minutes);
    setCustomMinutes("");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={live.title}
      width="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Supprimer"
            onClick={() => {
              deleteTask(live.id);
              onClose();
            }}
          >
            <Trash2 size={15} />
          </Button>
          <Button variant="secondary" onClick={() => onEdit(live)}>
            <Pencil size={14} /> Modifier
          </Button>
          {openTask ? (
            <Button
              className="ml-auto"
              onClick={() => {
                completeTask(live.id);
                onClose();
              }}
            >
              <Check size={15} /> Terminer
            </Button>
          ) : (
            <Button className="ml-auto" variant="secondary" onClick={() => reopenTask(live.id)}>
              <RotateCcw size={14} /> Rouvrir
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <SubjectDot subject={subject} />
          {subject && <Badge variant="bare">{subject.label}</Badge>}
          <Badge variant="bare">{categoryLabel(live.category)}</Badge>
          <DueBadge task={live} />
          {live.status === "done" && <Badge variant="success">Terminée</Badge>}
          {live.status === "cancelled" && <Badge>Abandonnée</Badge>}
        </div>

        {live.description && <p className="t-body text-muted">{live.description}</p>}

        {(live.source || live.sourceUrl) && (
          <p className="t-meta">
            Ressource :{" "}
            {live.sourceUrl ? (
              <a href={live.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                {live.source ?? live.sourceUrl}
              </a>
            ) : (
              live.source
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-4">
          <div>
            <p className="t-label">Estimée</p>
            <p className="t-figure-sm mt-1">{formatMinutes(effortMinutes(live))}</p>
          </div>
          <div>
            <p className="t-label">Travaillée</p>
            <p className="t-figure-sm mt-1">{formatMinutes(spent)}</p>
          </div>
          {openTask && (
            <div>
              <p className="t-label">Restant</p>
              <p className="t-figure-sm mt-1">{formatMinutes(remaining)}</p>
            </div>
          )}
        </div>

        {/* ── TEMPS RÉEL ────────────────────────────────────────────
            Le temps se déclare en un geste, sans chronomètre : la moitié du
            travail d'un élève se fait loin de l'écran, et un outil qui ne
            sait mesurer que ce qu'il a chronométré ne mesure presque rien. */}
        <section>
          <p className="t-label">Enregistrer du temps</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {QUICK_TIMES.map((minutes) => (
              <Button key={minutes} size="sm" variant="secondary" onClick={() => log(minutes)}>
                +{formatMinutes(minutes)}
              </Button>
            ))}
            <span className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
                placeholder="min"
                aria-label="Autre durée, en minutes"
                className="w-20"
              />
              <Button size="sm" variant="secondary" onClick={() => log(Number(customMinutes))} disabled={!Number(customMinutes)}>
                Ajouter
              </Button>
            </span>
          </div>
          {logged !== null && <p className="t-meta mt-2 text-emerald-300">{formatMinutes(logged)} enregistrées.</p>}
        </section>

        {/* ── CRÉNEAUX ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-3">
            <p className="t-label">Créneaux prévus</p>
            {live.slots.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => unscheduleTask(live.id)}>
                <X size={13} /> Retirer du calendrier
              </Button>
            )}
          </div>
          {live.slots.length === 0 ? (
            <p className="t-meta mt-1.5">Pas encore posée dans le calendrier.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {live.slots.map((slot) => (
                <li key={slot.start} className="t-meta flex items-center gap-2">
                  <CalendarClock size={13} className="text-subtle" />
                  {formatDay(slot.start)} · {timeOf(slot.start)} → {timeOf(slot.end)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── REPORTER ──────────────────────────────────────────────
            Trois jours qui ont RÉELLEMENT la place, dans l'ordre. Le premier
            est le meilleur au sens de TaekdHub ; les deux autres existent
            parce que l'élève sait des choses que l'application ignore. Aucun
            n'est un « demain » aveugle : chacun est calculé sur les créneaux
            libres restants. */}
        {openTask && options.length > 0 && (
          <section>
            <p className="t-label">{live.slots.length > 0 ? "Reporter à" : "Placer au calendrier"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((option) => (
                <button
                  key={option.day}
                  type="button"
                  onClick={() => {
                    // Poser une tâche qui n'avait aucun créneau n'est pas un
                    // report : ne pas incrémenter le compteur, sans quoi
                    // l'analyse des habitudes accuserait l'élève de reporter
                    // des tâches qu'il vient simplement de planifier.
                    if (live.slots.length > 0) postponeTask(live.id, option.slots);
                    else scheduleTask(live.id, option.slots);
                    onClose();
                  }}
                  className={cn(
                    "row-hover min-h-11 rounded-lg border px-3 text-left text-sm",
                    option.warning ? "border-amber-400/40 text-amber-200" : "border-line text-ink"
                  )}
                >
                  <span className="block font-medium">{option.message}</span>
                  {option.warning && <span className="block text-2xs">{option.warning}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {live.notes && (
          <section>
            <p className="t-label">Note</p>
            <p className="t-body mt-1 whitespace-pre-line text-muted">{live.notes}</p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {openTask && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                cancelTask(live.id);
                onClose();
              }}
            >
              Abandonner
            </Button>
          )}
          {live.postponedCount > 0 && (
            <span className="t-meta flex items-center gap-1.5">
              <Clock3 size={13} /> Reportée {live.postponedCount} fois
            </span>
          )}
        </div>
      </div>
    </Sheet>
  );
}
