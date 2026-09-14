"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBar } from "@/components/ui/layout";
import { SegmentedControl } from "@/components/ui/segmented";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/state";
import { SubjectDot } from "@/components/tasks/task-bits";
import { useComposer } from "@/components/tasks/composer";
import { capacityMinutes, rangesForDay } from "@/lib/domain/availability";
import { isDeadlineCategory } from "@/lib/domain/categories";
import {
  addDays,
  dateFromDayKey,
  dayKey,
  dayKeyRange,
  formatDay,
  formatMinutes,
  formatMinutesCompact,
  formatMonth,
  startOfWeek,
  timeOf,
} from "@/lib/domain/date";
import { subjectById } from "@/lib/domain/subjects";
import { isOpen, isOverdue, slotsOnDay } from "@/lib/domain/tasks";
import { computeDayLoad, type DayLoad } from "@/lib/domain/workload";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { AppState, Task } from "@/lib/domain/types";

/**
 * ============================================================================
 * CALENDRIER — jour, semaine, mois. Trois échelles, une seule grammaire.
 * ============================================================================
 *
 * Ce qui apparaît est toujours de deux natures, et elles ne se confondent
 * jamais :
 *
 *   LES CRÉNEAUX    du travail posé à une heure précise. Ils se déplacent.
 *   LES ÉCHÉANCES   une date à laquelle quelque chose est DÛ (DM à rendre,
 *                   DS, khôlle). Elles ne se déplacent pas ; elles se
 *                   préparent.
 *
 * Confondre les deux est l'erreur la plus fréquente des agendas scolaires :
 * un DS affiché « de 8 h à 12 h » ressemble alors à une plage de travail
 * qu'on pourrait bouger. Ici, une échéance est une ligne repère avec une
 * pastille, un créneau est un bloc.
 *
 * Aucune grille horaire au pixel : une journée d'élève se lit comme une
 * LISTE (18:00 → 19:30, puis 19:30 → 21:00), pas comme un tableau Outlook.
 * La grille verticale coûte énormément d'espace pour n'ajouter, à ces
 * densités, qu'une information que la liste donne déjà.
 */

type View = "jour" | "semaine" | "mois";

export function CalendarScreen() {
  const { state, ready } = useStore();
  const { add, open } = useComposer();
  const [view, setView] = useState<View>("semaine");
  const [anchor, setAnchor] = useState(() => new Date());

  const now = useMemo(() => new Date(), []);

  function shift(direction: 1 | -1) {
    setAnchor((current) => {
      if (view === "jour") return addDays(current, direction);
      if (view === "semaine") return addDays(current, direction * 7);
      const next = new Date(current);
      next.setMonth(next.getMonth() + direction, 1);
      return next;
    });
  }

  const title =
    view === "jour"
      ? capitalize(formatDay(anchor))
      : view === "semaine"
        ? weekTitle(anchor)
        : capitalize(formatMonth(anchor));

  return (
    <div className="space-y-7">
      <PageBar
        title="Calendrier"
        meta={title}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" aria-label="Période précédente" onClick={() => shift(-1)}>
                <ChevronLeft size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
                Aujourd&apos;hui
              </Button>
              <Button size="icon" variant="ghost" aria-label="Période suivante" onClick={() => shift(1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
            <Button onClick={() => add({ dueDate: dayKey(anchor) })} className="max-sm:hidden">
              <Plus size={15} /> Ajouter
            </Button>
          </div>
        }
      />

      <SegmentedControl
        ariaLabel="Échelle du calendrier"
        options={[
          { value: "jour", label: "Jour" },
          { value: "semaine", label: "Semaine" },
          { value: "mois", label: "Mois" },
        ]}
        value={view}
        onChange={setView}
      />

      {ready && view !== "mois" && (
        <p className="t-meta flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-amber-400" /> Échéance — à rendre ou à passer ce jour-là
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="well h-3 w-4" /> Créneau de travail — déplaçable
          </span>
        </p>
      )}

      {!ready ? null : view === "jour" ? (
        <DayView state={state} day={dayKey(anchor)} now={now} onOpen={open} onAdd={add} />
      ) : view === "semaine" ? (
        <WeekView state={state} anchor={anchor} now={now} onOpen={open} onAdd={add} />
      ) : (
        <MonthView state={state} anchor={anchor} now={now} onSelectDay={(key) => { setAnchor(dateFromDayKey(key)); setView("jour"); }} />
      )}
    </div>
  );
}

/* ─────────────────────────── SÉLECTION DES ÉLÉMENTS ─────────────────────────── */

interface DayItems {
  slots: { task: Task; start: string; end: string }[];
  deadlines: Task[];
  load: DayLoad;
}

function itemsForDay(state: AppState, key: string): DayItems {
  const slots = state.tasks
    .filter(isOpen)
    .flatMap((task) => slotsOnDay(task, key).map((slot) => ({ task, start: slot.start, end: slot.end })))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const deadlines = state.tasks
    .filter((task) => isOpen(task) && task.dueAt && dayKey(task.dueAt) === key)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());

  return { slots, deadlines, load: computeDayLoad(state, key) };
}

/* ─────────────────────────── JOUR ─────────────────────────── */

function DayView({
  state,
  day,
  now,
  onOpen,
  onAdd,
}: {
  state: AppState;
  day: string;
  now: Date;
  onOpen: (task: Task) => void;
  onAdd: (defaults: { dueDate: string }) => void;
}) {
  const { slots, deadlines, load } = itemsForDay(state, day);
  const ranges = rangesForDay(state.availability, day);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-line py-4">
        <span className="t-meta">
          Disponible : <strong className="font-medium text-ink">{formatMinutes(load.capacityMinutes)}</strong>
          {ranges.length > 0 && <span className="text-subtle"> ({ranges.map((range) => `${range.start}–${range.end}`).join(", ")})</span>}
        </span>
        <span className="t-meta">
          Planifié : <strong className="font-medium text-ink">{formatMinutes(load.plannedMinutes)}</strong>
        </span>
        <LoadBadge load={load} />
      </div>

      {deadlines.length > 0 && (
        <Section label="Échéances" title="Dû ce jour-là">
          <ul className="divide-y divide-line border-y border-line">
            {deadlines.map((task) => (
              <DeadlineRow key={task.id} task={task} state={state} onOpen={onOpen} now={now} />
            ))}
          </ul>
        </Section>
      )}

      <Section label="Programme" title="Créneaux posés">
        {slots.length === 0 ? (
          <EmptyState
            title="Rien de posé ce jour-là"
            description="Ajoute une tâche pour ce jour, ou lance une planification automatique depuis Planning."
            action={
              <Button onClick={() => onAdd({ dueDate: day })}>
                <Plus size={15} /> Ajouter
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {slots.map((item) => (
              <li key={`${item.task.id}-${item.start}`} className="flex items-start gap-3 px-1 py-3">
                <span className="tabular w-[5rem] shrink-0 pt-0.5 text-sm text-muted">
                  {timeOf(item.start)}
                  <span className="block text-2xs text-subtle">{timeOf(item.end)}</span>
                </span>
                <button type="button" onClick={() => onOpen(item.task)} className="min-w-0 flex-1 text-left">
                  <span className="flex min-w-0 items-center gap-2">
                    <SubjectDot subject={subjectById(state.subjects, item.task.subjectId)} />
                    <span className="min-w-0 truncate text-[0.9375rem]">{item.task.title}</span>
                  </span>
                  <span className="t-meta mt-0.5 block">
                    {formatMinutes((new Date(item.end).getTime() - new Date(item.start).getTime()) / 60_000)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function DeadlineRow({ task, state, onOpen, now }: { task: Task; state: AppState; onOpen: (task: Task) => void; now: Date }) {
  const late = isOverdue(task, now);
  return (
    <li>
      <button type="button" onClick={() => onOpen(task)} className="row-hover flex w-full items-center gap-3 px-1 py-3 text-left">
        <span
          aria-hidden
          className={cn("h-7 w-[3px] shrink-0 rounded-full", late ? "bg-rose-400" : isDeadlineCategory(task.category) ? "bg-amber-400" : "bg-accent-brand")}
        />
        <SubjectDot subject={subjectById(state.subjects, task.subjectId)} />
        <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{task.title}</span>
        {!task.dueDateOnly && task.dueAt && <span className="tabular shrink-0 text-sm text-muted">{timeOf(task.dueAt)}</span>}
        {isDeadlineCategory(task.category) && <Badge variant="warning">Évaluation</Badge>}
      </button>
    </li>
  );
}

/* ─────────────────────────── SEMAINE ─────────────────────────── */

function WeekView({
  state,
  anchor,
  now,
  onOpen,
  onAdd,
}: {
  state: AppState;
  anchor: Date;
  now: Date;
  onOpen: (task: Task) => void;
  onAdd: (defaults: { dueDate: string }) => void;
}) {
  const keys = dayKeyRange(startOfWeek(anchor), 7);
  const todayKey = dayKey(now);

  return (
    /* Sept colonnes sur grand écran, une pile sur mobile : une grille de sept
       colonnes sur 390 px donne des colonnes de 50 px, où plus aucun titre
       n'est lisible. La pile garde le même contenu, dans le même ordre. */
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:min-h-[26rem] lg:grid-cols-7">
      {keys.map((key) => {
        const { slots, deadlines, load } = itemsForDay(state, key);
        const isToday = key === todayKey;
        const date = dateFromDayKey(key);

        return (
          /* Hauteur fixe seulement à partir de `lg`, où les sept colonnes
             doivent s'aligner. Empilée sur téléphone, la même hauteur donnait
             sept blocs de 144 px pour une ligne de contenu chacun : il fallait
             quatre défilements pour voir sa semaine. */
          <div key={key} className={cn("bg-panel p-2.5 lg:min-h-[9rem]", isToday && "bg-accent/[0.05]")}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-sm", isToday ? "font-semibold text-ink" : "text-muted")}>
                {new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}{" "}
                <span className="tabular">{date.getDate()}</span>
              </span>
              <span className={cn("tabular text-2xs", loadToneClass(load))}>
                {load.plannedMinutes > 0 ? formatMinutesCompact(load.plannedMinutes) : ""}
                {load.capacityMinutes > 0 && load.plannedMinutes > 0 ? `/${formatMinutesCompact(load.capacityMinutes)}` : ""}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {deadlines.map((task) => (
                <button
                  key={`due-${task.id}`}
                  type="button"
                  onClick={() => onOpen(task)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1 text-left text-2xs",
                    isOverdue(task, now)
                      ? "border-rose-400 bg-rose-400/10 text-rose-200"
                      : isDeadlineCategory(task.category)
                        ? "border-amber-400 bg-amber-400/20 font-medium text-amber-200"
                        : "border-amber-400/60 bg-amber-400/[0.08]"
                  )}
                >
                  {!task.dueDateOnly && task.dueAt && <span className="tabular shrink-0">{timeOf(task.dueAt)}</span>}
                  <span className="min-w-0 truncate">{task.title}</span>
                </button>
              ))}

              {slots.map((item) => (
                <button
                  key={`${item.task.id}-${item.start}`}
                  type="button"
                  onClick={() => onOpen(item.task)}
                  className="well row-hover flex w-full items-center gap-1.5 px-1.5 py-1 text-left text-2xs"
                >
                  <span className="tabular shrink-0 text-subtle">{timeOf(item.start)}</span>
                  <span className="min-w-0 truncate">{item.task.title}</span>
                </button>
              ))}

              {slots.length === 0 && deadlines.length === 0 && (
                <button
                  type="button"
                  onClick={() => onAdd({ dueDate: key })}
                  className="w-full rounded-md py-1 text-left text-2xs text-subtle hover:text-accent"
                >
                  + Ajouter
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── MOIS ─────────────────────────── */

function MonthView({
  state,
  anchor,
  now,
  onSelectDay,
}: {
  state: AppState;
  anchor: Date;
  now: Date;
  onSelectDay: (key: string) => void;
}) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const keys = dayKeyRange(gridStart, 42);
  const todayKey = dayKey(now);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
          <span key={label} className="t-label py-2">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {keys.map((key) => {
          const date = dateFromDayKey(key);
          const outside = date.getMonth() !== anchor.getMonth();
          const { deadlines, load } = itemsForDay(state, key);
          const capacity = capacityMinutes(state.availability, key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={cn(
                "row-hover flex min-h-[4.5rem] flex-col items-start gap-1 bg-panel p-1.5 text-left sm:min-h-[6rem]",
                outside && "opacity-40",
                key === todayKey && "bg-accent/[0.06]"
              )}
            >
              <span className={cn("tabular text-2xs", key === todayKey ? "font-semibold text-ink" : "text-muted")}>
                {date.getDate()}
              </span>

              {/* Au mois, on ne montre que les GROSSES informations : les
                  évaluations, et une jauge de charge. Lister les créneaux
                  produirait une bouillie illisible à cette densité. */}
              {deadlines.slice(0, 2).map((task) => (
                <span
                  key={task.id}
                  className={cn(
                    "w-full truncate rounded px-1 text-[0.625rem] leading-4",
                    isDeadlineCategory(task.category) ? "bg-amber-400/15 text-amber-200" : "bg-inset text-muted"
                  )}
                >
                  {task.title}
                </span>
              ))}
              {deadlines.length > 2 && <span className="text-[0.625rem] text-subtle">+{deadlines.length - 2}</span>}

              {load.plannedMinutes > 0 && (
                <span className="mt-auto flex w-full items-center gap-1">
                  <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-hairline/[0.10]">
                    <span
                      className={cn("block h-full rounded-full", loadBarClass(load))}
                      style={{ width: `${Math.min(100, capacity > 0 ? (load.plannedMinutes / capacity) * 100 : 100)}%` }}
                    />
                  </span>
                  <span className="tabular text-[0.625rem] text-subtle">{formatMinutesCompact(load.plannedMinutes)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── SIGNAUX DE CHARGE ─────────────────────────── */

export function LoadBadge({ load }: { load: DayLoad }) {
  if (load.status === "empty") return <Badge variant="bare">Rien de prévu</Badge>;
  if (load.status === "over")
    return <Badge variant="danger">Surchargé de {formatMinutes(load.overflowMinutes)}</Badge>;
  if (load.status === "tight") return <Badge variant="warning">Tendu</Badge>;
  return <Badge variant="success">{formatMinutes(load.freeMinutes)} de marge</Badge>;
}

function loadToneClass(load: DayLoad): string {
  if (load.status === "over") return "text-rose-300";
  if (load.status === "tight") return "text-amber-300";
  return "text-subtle";
}

function loadBarClass(load: DayLoad): string {
  if (load.status === "over") return "bg-rose-400";
  if (load.status === "tight") return "bg-amber-400";
  return "bg-accent-brand";
}

function weekTitle(anchor: Date): string {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const format = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  return `${format.format(start)} → ${format.format(end)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
