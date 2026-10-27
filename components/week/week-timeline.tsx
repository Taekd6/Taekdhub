"use client";

import { Check, MapPin, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { formatHm, layoutLanes, localDay, type AgendaBlock, type BlockKind, type DayColumn } from "@/lib/week-agenda";

export const KIND_LABEL: Record<BlockKind, string> = { cours: "Cours", td: "TD", tp: "TP", ds: "DS", colle: "Khôlle", perso: "Perso", tache: "Tâche" };

const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/**
 * LA GRILLE DE LA SEMAINE — heures à gauche, une colonne par jour affiché.
 * Cours et rendez-vous viennent des agendas ; les tâches (dégradé) se cochent
 * d'un tap. Un tap sur un créneau vide propose d'y poser une tâche.
 */
export function WeekTimeline({
  columns,
  range,
  now,
  onToggleTask,
  onSlot,
  hideHeader = false,
  className,
}: {
  hideHeader?: boolean;
  columns: DayColumn[];
  range: { from: number; to: number };
  now: Date;
  onToggleTask: (workItemId: string) => void;
  onSlot: (day: string, minute: number) => void;
  className?: string;
}) {
  const hours = [];
  for (let m = range.from; m < range.to; m += 60) hours.push(m);
  const total = range.to - range.from;
  const today = localDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pct = (minute: number) => `${((minute - range.from) / total) * 100}%`;

  return (
    <div className={cn("surface overflow-hidden p-2 sm:p-3", className)}>
      {/* En-têtes des jours */}
      <div className={cn("grid gap-1 pl-11", hideHeader && "hidden")} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => {
          const isToday = column.day === today;
          return (
            <div key={column.day} className="flex flex-col items-center pb-2 pt-1">
              <span className={cn("t-meta capitalize", isToday && "font-bold text-accent")}>{WEEKDAY.format(column.date).replace(".", "")}</span>
              <span className={cn("tabular t-subhead grid h-9 w-9 place-items-center rounded-full font-bold", isToday ? "grad-btn text-white" : "text-ink")}>{column.date.getDate()}</span>
              {column.allDay.map((entry) => (
                <span key={entry.id} className="mt-1 w-full truncate rounded-md bg-inset px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold text-muted">
                  {entry.title}
                </span>
              ))}
              {column.untimed.length > 0 && (
                <span className="mt-1 w-full truncate rounded-md bg-accent-dim px-1.5 py-0.5 text-center text-[0.6875rem] font-bold text-accent">
                  {column.untimed.length} sans heure
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Corps : heures + colonnes */}
      <div className={cn("relative flex", hideHeader && "mt-2")} style={{ height: `calc(var(--hour-h) * ${total / 60})`, "--hour-h": "3.25rem" } as CSSProperties}>
        <div className="relative w-11 shrink-0">
          {hours.map((minute) => (
            <span key={minute} className="tabular absolute right-2 -translate-y-1/2 text-[0.6875rem] font-semibold text-subtle" style={{ top: pct(minute) }}>
              {minute > range.from ? formatHm(minute) : ""}
            </span>
          ))}
        </div>
        <div className="hour-grid relative grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((column) => (
            <DayLane key={column.day} column={column} range={range} pct={pct} onToggleTask={onToggleTask} onSlot={onSlot} />
          ))}
          {columns.some((column) => column.day === today) && nowMin >= range.from && nowMin <= range.to && (
            <div
              aria-hidden
              className="now-line pointer-events-none absolute z-10"
              style={{
                top: pct(nowMin),
                left: `${(columns.findIndex((column) => column.day === today) / columns.length) * 100}%`,
                width: `${100 / columns.length}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DayLane({
  column,
  range,
  pct,
  onToggleTask,
  onSlot,
}: {
  column: DayColumn;
  range: { from: number; to: number };
  pct: (minute: number) => string;
  onToggleTask: (workItemId: string) => void;
  onSlot: (day: string, minute: number) => void;
}) {
  const placed = layoutLanes(column.blocks);
  return (
    <div
      className="group/lane relative cursor-cell rounded-lg transition-colors hover:bg-inset"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / rect.height;
        const minute = Math.round((range.from + ratio * (range.to - range.from)) / 30) * 30;
        onSlot(column.day, Math.min(range.to - 30, Math.max(range.from, minute)));
      }}
      role="presentation"
    >
      {placed.map((block) => (
        <Block key={block.id} block={block} top={pct(block.startMin)} height={`calc(${pct(block.endMin)} - ${pct(block.startMin)} - 2px)`} onToggleTask={onToggleTask} />
      ))}
    </div>
  );
}

function Block({ block, top, height, onToggleTask }: { block: AgendaBlock & { lane: number; lanes: number }; top: string; height: string; onToggleTask: (id: string) => void }) {
  const short = block.endMin - block.startMin <= 50;
  const style: CSSProperties = { top, height, left: `calc(${(block.lane / block.lanes) * 100}% + 1px)`, width: `calc(${100 / block.lanes}% - 2px)` };
  const body = (
    <>
      <span className={cn("block truncate font-bold leading-tight", short ? "text-[0.6875rem]" : "text-[0.75rem]")}>
        {block.kind === "tache" && block.done && <Check size={11} className="mr-0.5 inline -translate-y-px" aria-hidden />}
        {block.title}
      </span>
      {!short && (
        <span className={cn("mt-0.5 block truncate text-[0.6875rem] font-semibold", block.kind === "tache" ? "text-white/80" : "text-muted")}>
          {formatHm(block.startMin)}–{formatHm(block.endMin)}
          {block.location && (
            <>
              {" "}
              <MapPin size={10} className="inline -translate-y-px" aria-hidden /> {block.location}
            </>
          )}
        </span>
      )}
    </>
  );
  const className = cn("blk absolute overflow-hidden px-1.5 py-1 text-left", `blk-${block.kind}`, block.done && "blk-done");
  if (block.kind === "tache" && block.workItemId) {
    return (
      <button type="button" className={cn(className, "press")} style={style} onClick={() => onToggleTask(block.workItemId!)} aria-label={`${block.done ? "Rouvrir" : "Terminé"} : ${block.title}`} aria-pressed={block.done}>
        {body}
      </button>
    );
  }
  return (
    <div className={className} style={style} title={`${KIND_LABEL[block.kind]} · ${block.title}`}>
      {body}
    </div>
  );
}

/** Le bouton « + » flottant d'une colonne vide, pour la vue jour sur téléphone. */
export function AddSlotHint() {
  return (
    <span className="pointer-events-none inline-flex items-center gap-1 text-[0.75rem] font-semibold text-subtle">
      <Plus size={12} aria-hidden /> Touche un créneau pour y poser une tâche
    </span>
  );
}
