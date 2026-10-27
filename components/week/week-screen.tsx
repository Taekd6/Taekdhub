"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/state";
import { cn } from "@/lib/cn";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { addDays, buildWeek, hourRange, localDay, mondayOf, type DayColumn } from "@/lib/week-agenda";
import { toggleWorkItemDone } from "@/lib/work-items";
import { TaskQuickAdd } from "@/components/week/task-quick-add";
import { WeekTimeline } from "@/components/week/week-timeline";
import { TaskDetail } from "@/components/week/task-detail";

const RANGE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Une minute qui avance — pour la ligne « maintenant ». */
function useNow(stepMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

/**
 * MA SEMAINE (mission 18) — l'emploi du temps lu dans les agendas de l'élève,
 * ses tâches posées dessus, DS et khôlles en couleur. Sept colonnes sur iPad
 * et ordinateur ; un jour à la fois sur téléphone, avec le sélecteur de jours.
 */
export function WeekScreen() {
  const { workItems, saveWorkItems, preferences, ready } = usePrepahubData();
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const monday = useMemo(() => addDays(mondayOf(now), offset * 7), [now, offset]);
  // Deux semaines lues : la grille en montre une, le « prochain DS » regarde aussi la suivante.
  const horizon = useMemo(() => addDays(monday, 14), [monday]);
  const calendar = useCalendarEvents(preferences.calendarFeeds, monday, horizon);
  const columns = useMemo(() => buildWeek(monday, calendar.events, workItems), [monday, calendar.events, workItems]);
  const range = useMemo(() => hourRange(columns), [columns]);
  const todayIndex = columns.findIndex((column) => column.day === localDay(now));
  const [selected, setSelected] = useState<number | null>(null);
  const dayIndex = selected ?? (todayIndex >= 0 ? todayIndex : 0);
  const [slot, setSlot] = useState<{ day: string; time: string | null } | null>(null);


  const [openId, setOpenId] = useState<string | null>(null);
  const weekTasks = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const column of columns) {
      for (const block of column.blocks) if (block.kind === "tache") { total += 1; if (block.done) done += 1; }
      for (const item of column.untimed) { total += 1; if (item.status === "terminé") done += 1; }
    }
    return { total, done };
  }, [columns]);
  const toggle = (id: string) => saveWorkItems(toggleWorkItemDone(workItems, id));
  const open = (id: string) => setOpenId(id);
  const openSlot = (day: string, minute: number) => setSlot({ day, time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` });

  if (!ready) {
    return (
      <div className="mx-auto max-w-[76rem] space-y-4">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-[38rem] w-full rounded-[1.75rem]" />
      </div>
    );
  }

  const noFeeds = preferences.calendarFeeds.length === 0;

  return (
    <div className="mx-auto max-w-[76rem]">
      {/* ── En-tête : un bandeau vivant, comme le ciel de l'accueil (mission 24) ── */}
      <header className="sky sky-semaine reveal relative isolate mb-5 overflow-hidden rounded-[var(--radius-tile)] text-white">
        <div aria-hidden className="sky-layer sky-a" />
        <div aria-hidden className="sky-layer sky-b" />
        <div aria-hidden className="sky-grain" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-white/75">{offset === 0 ? "Cette semaine" : offset === 1 ? "La semaine prochaine" : offset === -1 ? "La semaine dernière" : "Semaine"}</p>
            <h1 className="t-display mt-1">
              {RANGE_FMT.format(monday)} – {RANGE_FMT.format(addDays(monday, 6))}
            </h1>
            {weekTasks.total > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="relative h-2 w-40 overflow-hidden rounded-full bg-white/25">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.round((weekTasks.done / weekTasks.total) * 100)}%` }} />
                </span>
                <span className="text-[0.875rem] font-bold text-white/90">
                  {weekTasks.done}/{weekTasks.total} tâches cochées
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="sky-chip press !p-0 h-10 w-10 justify-center" aria-label="Semaine précédente" onClick={() => setOffset((value) => value - 1)}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="sky-chip press h-10 disabled:opacity-50" onClick={() => setOffset(0)} disabled={offset === 0}>
              Aujourd&apos;hui
            </button>
            <button type="button" className="sky-chip press !p-0 h-10 w-10 justify-center" aria-label="Semaine suivante" onClick={() => setOffset((value) => value + 1)}>
              <ChevronRight size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="press inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[0.875rem] font-bold text-[#1e1b4b] [box-shadow:0_10px_24px_-10px_rgba(15,23,42,.6)]"
              onClick={() => openSlot(columns[dayIndex].day, columns[dayIndex].day === localDay(now) ? Math.min(23 * 60, Math.max(18 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)) : 18 * 60)}
            >
              <CalendarPlus size={16} aria-hidden /> Tâche
            </button>
          </div>
        </div>
      </header>

      {noFeeds && (
        <div className="surface reveal mb-5 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="t-body font-bold">Relie ton emploi du temps</p>
            <p className="t-meta">Colle l&apos;adresse iCal de ton agenda Google (ou iCloud) : tes cours apparaissent ici, à jour, sans rien recopier.</p>
          </div>
          <Link href="/settings#agendas" className={buttonVariants({ size: "sm" })}>
            Ajouter mon agenda
          </Link>
        </div>
      )}
      {calendar.errors.length > 0 && calendar.events.length === 0 && (
        <div role="status" className="reveal mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-[0.875rem] font-semibold text-amber-300">
          <span>{calendar.errors.map((error) => `${error.label} : ${error.message}`).join(" · ")}</span>
          <Button variant="ghost" size="sm" onClick={calendar.refresh}>
            <RefreshCw size={14} aria-hidden /> Réessayer
          </Button>
        </div>
      )}

      {/* ── Téléphone : un jour à la fois ── */}
      <div className="md:hidden">
        <div className="mb-3 grid grid-cols-7 gap-1" role="tablist" aria-label="Jour affiché">
          {columns.map((column, index) => (
            <button
              key={column.day}
              type="button"
              role="tab"
              aria-selected={index === dayIndex}
              onClick={() => setSelected(index)}
              className={cn("press flex min-w-0 flex-col items-center rounded-2xl px-1 py-2", index === dayIndex ? "grad-btn text-white" : "surface text-ink")}
            >
              <span className="text-[0.6875rem] font-semibold capitalize opacity-80">{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(column.date).replace(".", "")}</span>
              <span className="tabular t-subhead font-bold">{column.date.getDate()}</span>
              <span className={cn("mt-0.5 h-1 w-1 rounded-full", dayHasExam(column) ? "bg-rose-400" : column.blocks.some((b) => b.kind === "tache") || column.untimed.length ? (index === dayIndex ? "bg-white" : "bg-accent") : "bg-transparent")} />
            </button>
          ))}
        </div>
        <p className="t-body mb-2 font-bold capitalize">{DAY_FMT.format(columns[dayIndex].date)}</p>
        <Untimed column={columns[dayIndex]} onToggle={toggle} />
        <WeekTimeline hideHeader columns={[columns[dayIndex]]} range={range} now={now} onToggleTask={open} onSlot={openSlot} />
      </div>

      {/* ── iPad et ordinateur : la semaine ── */}
      <div className="hidden md:block">
        <WeekTimeline columns={columns} range={range} now={now} onToggleTask={open} onSlot={openSlot} />
        {columns.some((column) => column.untimed.length > 0) && (
          <section className="surface mt-5 p-5" aria-label="Sans heure cette semaine">
            <h2 className="t-heading mb-3">Sans heure cette semaine</h2>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((column) => column.untimed.length > 0 && <Untimed key={column.day} column={column} onToggle={toggle} showDay />)}
            </div>
          </section>
        )}
      </div>

      <p className="t-meta mt-4 text-center">
        {calendar.loading ? "Je relis tes agendas…" : calendar.stale ? "Copie hors ligne de tes agendas." : "Touche un créneau vide pour y poser une tâche ; touche une tâche pour la cocher."}
      </p>

      <TaskDetail item={openId ? (workItems.find((item) => item.id === openId) ?? null) : null} workItems={workItems} saveWorkItems={saveWorkItems} onClose={() => setOpenId(null)} />
      <TaskQuickAdd open={slot !== null} day={slot?.day ?? localDay(now)} time={slot?.time ?? null} onClose={() => setSlot(null)} onAdd={(item) => saveWorkItems([item, ...workItems])} />
    </div>
  );
}

function dayHasExam(column: DayColumn) {
  return column.blocks.some((block) => (block.kind === "ds" || block.kind === "colle") && !/pr[ée]paration/i.test(block.title));
}

function Untimed({ column, onToggle, showDay = false }: { column: DayColumn; onToggle: (id: string) => void; showDay?: boolean }) {
  if (column.untimed.length === 0) return null;
  return (
    <ul className="mb-3">
      {column.untimed.map((item) => {
        const done = item.status === "terminé";
        return (
          <li key={item.id} className="flex min-h-11 items-center gap-3 py-1">
            <button type="button" onClick={() => onToggle(item.id)} aria-pressed={done} aria-label={`${done ? "Rouvrir" : "Terminé"} : ${item.title}`} className={cn("tick press grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.75rem]", done && "tick-on")}>
              {done ? "✓" : ""}
            </button>
            <span className={cn("t-body min-w-0 flex-1 truncate font-semibold", done && "text-muted line-through")}>{item.title}</span>
            {showDay && <span className="t-meta shrink-0 capitalize">{new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(column.date)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

