"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpRight, Check, Clock, MapPin, Moon, Plus } from "lucide-react";
import { GradientCard } from "@/components/ui/gradient-card";
import { Ring } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/calendar";
import type { WorkItem } from "@/lib/storage";
import { currentOrNext, eveningList, formatHm, localDay, nextExam, weekLoad, type DayColumn } from "@/lib/week-agenda";
import { createWorkItem, toggleWorkItemDone } from "@/lib/work-items";

/**
 * LES WIDGETS DE L'ACCUEIL (mission 18) — façon Revolut / Finary : une
 * grande valeur par tuile, une ligne de contexte, un geste. Tout vient de
 * l'agenda de l'élève et de ses tâches (lib/week-agenda.ts).
 */

const timeOf = (iso: string) => {
  const date = new Date(iso);
  return formatHm(date.getHours() * 60 + date.getMinutes());
};

/* ── CE SOIR ─────────────────────────────────────────────────────────── */

export function EveningWidget({ workItems, saveWorkItems, now, className }: { workItems: WorkItem[]; saveWorkItems: (items: WorkItem[]) => void; now: Date; className?: string }) {
  const entries = useMemo(() => eveningList(workItems, now), [workItems, now]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [adding, setAdding] = useState(false);
  const done = entries.filter((entry) => entry.done).length;
  const total = entries.length;
  const allDone = total > 0 && done === total;
  const next = entries.find((entry) => !entry.done);
  const evening = now.getHours() >= 17;

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const today = localDay(now);
    const item = createWorkItem({ title, kind: "autre", subject: null, estimatedMinutes: 45, dueDate: today }, now);
    saveWorkItems([{ ...item, plan: { day: today, time: time || null, place: null } }, ...workItems]);
    setTitle("");
    setTime("");
    setAdding(false);
  }

  return (
    <section aria-labelledby="ce-soir" className={cn("surface reveal relative overflow-hidden p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="t-label">{evening ? "Ce soir" : "Aujourd'hui"}</p>
          <h2 id="ce-soir" className={cn("mt-1 leading-none", allDone ? "t-figure-md" : "t-figure-lg")}>
            {total === 0 ? "Libre" : allDone ? "Tout est prêt." : `${done}/${total}`}
          </h2>
          <p className="t-meta mt-2">
            {total === 0
              ? "Rien de prévu. Pose une tâche, ou profite."
              : allDone
                ? evening
                  ? "Va dormir : demain se prépare ce soir, et c'est fait."
                  : "Tout est coché pour aujourd'hui."
                : next
                  ? `Ensuite : ${next.item.title}${next.time !== null ? ` à ${formatHm(next.time)}` : ""}`
                  : ""}
          </p>
        </div>
        {total > 0 && (
          <Ring value={(done / total) * 100} size={72} strokeWidth={7}>
            {allDone ? <Moon size={22} className="text-accent" aria-hidden /> : <span className="t-figure text-[0.9375rem]">{Math.round((done / total) * 100)}%</span>}
          </Ring>
        )}
      </div>

      {total > 0 && (
        <ol className="mt-5 space-y-1">
          {entries.map((entry, index) => (
            <li key={entry.item.id} className="row-slide flex min-h-12 items-center gap-3 rounded-2xl px-1" style={{ "--i": index } as CSSProperties}>
              <span className="tabular w-11 shrink-0 text-right text-[0.8125rem] font-bold text-muted">{entry.time !== null ? formatHm(entry.time) : "—"}</span>
              <span aria-hidden className={cn("h-8 w-[3px] shrink-0 rounded-full", entry.done ? "bg-[rgb(var(--hairline-rgb)/0.15)]" : "bg-[linear-gradient(var(--g1),var(--g2))]")} />
              <div className="min-w-0 flex-1">
                <p className={cn("t-body truncate font-bold", entry.done && "text-muted line-through decoration-2")}>{entry.item.title}</p>
                <p className="t-meta truncate">
                  {[entry.item.subject, entry.reason === "demain" ? "pour demain" : entry.reason === "aujourdhui" ? "pour aujourd'hui" : null].filter(Boolean).join(" · ") || " "}
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveWorkItems(toggleWorkItemDone(workItems, entry.item.id, new Date()))}
                aria-pressed={entry.done}
                aria-label={`${entry.done ? "Rouvrir" : "Terminé"} : ${entry.item.title}`}
                className={cn("tick press grid h-9 w-9 shrink-0 place-items-center rounded-full max-lg:h-11 max-lg:w-11", entry.done && "tick-on")}
              >
                {entry.done && <Check size={16} strokeWidth={3} aria-hidden />}
              </button>
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2">
          <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Quoi ?" maxLength={120} className="min-w-0 flex-1 basis-[10rem]" aria-label="Nouvelle tâche pour ce soir" />
          <Input type="time" value={time} step={900} onChange={(event) => setTime(event.target.value)} className="w-[7.5rem]" aria-label="Heure" />
          <Button type="submit" size="sm" disabled={!title.trim()}>
            Ajouter
          </Button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden /> Ajouter
          </Button>
          <Link href="/semaine" className="press inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[0.8125rem] font-semibold text-muted hover:text-ink max-lg:min-h-11">
            Ma semaine <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}

/* ── PROCHAINE ÉPREUVE ──────────────────────────────────────────────── */

const DAY_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function ExamWidget({ events, workItems, now, className }: { events: CalendarEvent[]; workItems: WorkItem[]; now: Date; className?: string }) {
  const exam = useMemo(() => nextExam(events, workItems, now), [events, workItems, now]);
  return (
    <GradientCard tone="review" href="/semaine" className={cn("p-4 text-white sm:p-6", className)} aria-label={exam ? `Prochaine épreuve : ${exam.title}` : "Aucune épreuve en vue"}>
      <div className="flex items-start justify-between">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-white/75 sm:text-[0.8125rem]">Prochaine épreuve</p>
        <ArrowUpRight size={18} className="text-white/70" aria-hidden />
      </div>
      {exam ? (
        <>
          <p className="t-card-figure mt-2 leading-none">{exam.days === 0 ? "Aujourd'hui" : exam.days === 1 ? "Demain" : `J-${exam.days}`}</p>
          <p className="t-subhead mt-3 truncate font-bold">{exam.title}</p>
          <p className="line-clamp-2 text-[0.8125rem] font-semibold first-letter:uppercase text-white/80 sm:text-[0.875rem]">
            {DAY_LONG.format(new Date(`${exam.day}T12:00:00`))}
            {exam.time ? ` · ${exam.time}` : ""}
          </p>
        </>
      ) : (
        <>
          <p className="t-card-figure mt-2 leading-none">—</p>
          <p className="mt-3 text-[0.9375rem] font-semibold text-white/85">Aucun DS ni khôlle dans les deux semaines.</p>
        </>
      )}
    </GradientCard>
  );
}

/* ── MAINTENANT ─────────────────────────────────────────────────────── */

export function NowWidget({ events, hasFeeds, now, className }: { events: CalendarEvent[]; hasFeeds: boolean; now: Date; className?: string }) {
  const slot = useMemo(() => currentOrNext(events, now), [events, now]);
  if (!hasFeeds) {
    return (
      <Link href="/settings#agendas" className={cn("surface lift reveal flex flex-col justify-between gap-3 p-5", className)}>
        <p className="t-label">Emploi du temps</p>
        <p className="t-body font-bold">Relie ton agenda Google ou iCloud : tes cours s&apos;affichent ici et dans ta semaine.</p>
        <span className="inline-flex items-center gap-1 text-[0.875rem] font-bold text-accent">
          Ajouter mon agenda <ArrowUpRight size={14} aria-hidden />
        </span>
      </Link>
    );
  }
  if (!slot) {
    return (
      <Link href="/semaine" className={cn("surface lift reveal flex flex-col justify-between gap-2 p-5", className)}>
        <p className="t-label">Cours</p>
        <p className="t-figure t-figure-sm leading-none">Terminé</p>
        <p className="t-meta">Plus rien dans l&apos;agenda aujourd&apos;hui.</p>
      </Link>
    );
  }
  const { event, status } = slot;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  const progress = status === "en cours" ? Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100)) : 0;
  const minutesLeft = Math.round(((status === "en cours" ? end : start) - now.getTime()) / 60000);
  return (
    <Link href="/semaine" className={cn("surface lift reveal flex min-w-0 flex-col gap-2 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="t-label">{status === "en cours" ? "En ce moment" : "Ensuite"}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[0.75rem] font-bold", status === "en cours" ? "bg-emerald-400/15 text-emerald-300" : "bg-inset text-muted")}>
          <Clock size={11} className="mr-1 inline -translate-y-px" aria-hidden />
          {minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)} h ${String(minutesLeft % 60).padStart(2, "0")}` : `${minutesLeft} min`}
          {status === "en cours" ? " restantes" : ""}
        </span>
      </div>
      <p className="t-figure t-figure-sm truncate leading-tight">{event.title}</p>
      <p className="t-meta">
        {timeOf(event.start)}–{timeOf(event.end)}
        {event.location && (
          <>
            {" · "}
            <MapPin size={11} className="inline -translate-y-px" aria-hidden /> {event.location}
          </>
        )}
      </p>
      {status === "en cours" && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset">
          <div className="bar-grad h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Link>
  );
}

/* ── LA SEMAINE EN UN COUP D'ŒIL ────────────────────────────────────── */

const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

export function WeekWidget({ columns, now, className }: { columns: DayColumn[]; now: Date; className?: string }) {
  const load = useMemo(() => weekLoad(columns), [columns]);
  const max = Math.max(1, ...load.map((day) => day.classMinutes));
  const today = localDay(now);
  const totalTasks = load.reduce((sum, day) => sum + day.taskCount, 0);
  const doneTasks = load.reduce((sum, day) => sum + day.doneCount, 0);
  return (
    <Link href="/semaine" className={cn("surface lift reveal block p-5 sm:p-6", className)} aria-label="Ouvrir ma semaine">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="t-label">Ma semaine</p>
          <p className="t-figure t-figure-sm mt-1 leading-none">
            {doneTasks}/{totalTasks} <span className="t-body font-semibold text-muted">tâches</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[0.875rem] font-bold text-accent">
          Ouvrir <ArrowUpRight size={14} aria-hidden />
        </span>
      </div>
      <div className="mt-5 grid h-28 grid-cols-7 items-end gap-2 sm:gap-3">
        {load.map((day, index) => {
          const isToday = day.day === today;
          const height = day.classMinutes > 0 ? Math.max(10, (day.classMinutes / max) * 100) : 4;
          return (
            <div key={day.day} className="flex h-full flex-col items-center justify-end gap-1.5">
              <div className="flex h-3 items-center gap-0.5" aria-hidden>
                {day.hasExam && <span className="h-2 w-2 rounded-full bg-rose-400" />}
                {Array.from({ length: Math.min(3, day.taskCount) }, (_, i) => (
                  <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < day.doneCount ? "bg-accent" : "bg-[rgb(var(--hairline-rgb)/0.25)]")} />
                ))}
              </div>
              <div className="relative w-full flex-1">
                <div className={cn("load-bar absolute bottom-0 left-1/2 w-full max-w-[2.75rem] -translate-x-1/2", !isToday && "opacity-40")} style={{ height: `${height}%`, "--i": index } as CSSProperties} />
              </div>
              <span className={cn("text-[0.75rem] font-semibold capitalize", isToday ? "font-bold text-accent" : "text-muted")}>{WEEKDAY.format(day.date).replace(".", "")}</span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
