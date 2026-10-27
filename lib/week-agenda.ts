import type { CalendarEvent, CalendarEventKind } from "@/lib/calendar";
import type { WorkItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LA SEMAINE (mission 18) — ce que montrent la vue `/semaine` et les widgets
 * de l'accueil : l'emploi du temps (lu dans les agendas, lib/calendar.ts) et
 * les tâches de l'élève (`WorkItem`), au même endroit.
 *
 * Fonctions PURES, en heure LOCALE de l'appareil (celle de l'élève). Rien
 * n'est stocké : tout se recalcule à chaque affichage.
 */

export type BlockKind = CalendarEventKind | "tache";

export interface AgendaBlock {
  id: string;
  title: string;
  /** "AAAA-MM-JJ" local. */
  day: string;
  /** Minutes depuis minuit, heure locale. */
  startMin: number;
  endMin: number;
  kind: BlockKind;
  subject: Subject | null;
  location: string | null;
  /** Tâche seulement. */
  workItemId?: string;
  done?: boolean;
}

export interface DayColumn {
  day: string;
  date: Date;
  blocks: AgendaBlock[];
  /** Événements sur la journée (férié, sortie…). */
  allDay: Array<{ id: string; title: string }>;
  /** Tâches datées de ce jour mais sans heure : en tête de colonne. */
  untimed: WorkItem[];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Lundi 0 h de la semaine de `date`, heure locale. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

function parseHm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

export const formatHm = (minutes: number) => `${Math.floor(minutes / 60)}h${minutes % 60 ? pad(minutes % 60) : ""}`;

const isOpen = (item: WorkItem) => item.status === "à faire" || item.status === "en cours";

/** Le jour d'une tâche dans la semaine : le jour planifié, sinon l'échéance. */
export function taskDay(item: WorkItem): string | null {
  return item.plan?.day ?? item.dueDate;
}

/** L'heure d'une tâche : celle du plan, sinon l'heure d'échéance. */
export function taskTime(item: WorkItem): number | null {
  return parseHm(item.plan ? item.plan.time : item.dueTime);
}

function taskBlock(item: WorkItem, day: string, start: number): AgendaBlock {
  const duration = Math.min(180, Math.max(20, item.estimatedMinutes || 30));
  return {
    id: `task:${item.id}`,
    title: item.title,
    day,
    startMin: start,
    endMin: Math.min(24 * 60, start + duration),
    kind: "tache",
    subject: item.subject,
    location: null,
    workItemId: item.id,
    done: item.status === "terminé",
  };
}

/** Une semaine de 7 colonnes, lundi → dimanche. Les tâches abandonnées n'apparaissent pas ; les terminées restent, cochées. */
export function buildWeek(monday: Date, events: CalendarEvent[], workItems: WorkItem[]): DayColumn[] {
  const columns: DayColumn[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return { day: localDay(date), date, blocks: [], allDay: [], untimed: [] };
  });
  const byDay = new Map(columns.map((column) => [column.day, column]));

  for (const event of events) {
    if (event.allDay) {
      // Une journée entière peut en couvrir plusieurs : [start, end[.
      for (const column of columns) if (column.day >= event.start && column.day < (event.end > event.start ? event.end : `${event.start}~`)) column.allDay.push({ id: event.id, title: event.title });
      continue;
    }
    const start = new Date(event.start);
    const end = new Date(event.end);
    const column = byDay.get(localDay(start));
    if (!column) continue;
    const startMin = minutesOf(start);
    const endMin = localDay(end) === column.day ? Math.max(startMin + 15, minutesOf(end)) : 24 * 60;
    column.blocks.push({ id: event.id, title: event.title, day: column.day, startMin, endMin, kind: event.kind, subject: event.subject, location: event.location });
  }

  for (const item of workItems) {
    if (item.status === "abandonné") continue;
    const day = taskDay(item);
    const column = day ? byDay.get(day) : undefined;
    if (!column) continue;
    const time = taskTime(item);
    if (time === null) column.untimed.push(item);
    else column.blocks.push(taskBlock(item, column.day, time));
  }

  for (const column of columns) column.blocks.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  return columns;
}

/**
 * Placement côte à côte des blocs qui se chevauchent : chaque bloc reçoit sa
 * voie (`lane`) et le nombre de voies de son groupe (`lanes`).
 */
export function layoutLanes(blocks: AgendaBlock[]): Array<AgendaBlock & { lane: number; lanes: number }> {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: Array<AgendaBlock & { lane: number; lanes: number }> = [];
  let group: Array<AgendaBlock & { lane: number; lanes: number }> = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = group.reduce((max, block) => Math.max(max, block.lane + 1), 1);
    for (const block of group) block.lanes = lanes;
    result.push(...group);
    group = [];
  };
  for (const block of sorted) {
    if (group.length > 0 && block.startMin >= groupEnd) flush();
    const laneEnds: number[] = [];
    for (const placed of group) laneEnds[placed.lane] = Math.max(laneEnds[placed.lane] ?? -1, placed.endMin);
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) lane = laneEnds.length;
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.endMin);
  }
  if (group.length > 0) flush();
  return result;
}

/** Plage horaire à afficher : 7 h → 23 h, élargie si un bloc en déborde. */
export function hourRange(columns: DayColumn[]): { from: number; to: number } {
  let from = 7 * 60;
  let to = 23 * 60;
  for (const column of columns)
    for (const block of column.blocks) {
      from = Math.min(from, Math.floor(block.startMin / 60) * 60);
      to = Math.max(to, Math.ceil(block.endMin / 60) * 60);
    }
  return { from: Math.max(0, from), to: Math.min(24 * 60, to) };
}

/* ── Widgets de l'accueil ──────────────────────────────────────────────── */

export interface EveningEntry {
  item: WorkItem;
  time: number | null;
  done: boolean;
  /** Pourquoi ce soir : planifié ce soir, dû aujourd'hui, ou dû demain. */
  reason: "plan" | "aujourdhui" | "demain";
}

/**
 * CE SOIR — ce qui est à faire aujourd'hui : planifié aujourd'hui, ou dû
 * aujourd'hui ou demain (sans plan à une autre date). Les tâches cochées
 * aujourd'hui restent affichées, barrées : voir le chemin parcouru compte.
 */
export function eveningList(workItems: WorkItem[], now: Date): EveningEntry[] {
  const today = localDay(now);
  const tomorrow = localDay(addDays(now, 1));
  const entries: EveningEntry[] = [];
  for (const item of workItems) {
    if (item.status === "abandonné") continue;
    const done = item.status === "terminé";
    if (done && (!item.completedAt || localDay(new Date(item.completedAt)) !== today)) continue;
    let reason: EveningEntry["reason"] | null = null;
    if (item.plan) reason = item.plan.day === today ? "plan" : null;
    else if (item.dueDate === today) reason = "aujourdhui";
    else if (item.dueDate === tomorrow) reason = "demain";
    if (!reason) continue;
    entries.push({ item, time: taskTime(item), done, reason });
  }
  return entries.sort((a, b) => (a.time ?? 24 * 60) - (b.time ?? 24 * 60) || Number(a.done) - Number(b.done) || a.item.createdAt.localeCompare(b.item.createdAt));
}

/** Le cours en cours, sinon le prochain d'aujourd'hui, sinon `null`. */
export function currentOrNext(events: CalendarEvent[], now: Date): { event: CalendarEvent; status: "en cours" | "à venir" } | null {
  const today = localDay(now);
  const timed = events.filter((event) => !event.allDay && localDay(new Date(event.start)) === today).sort((a, b) => a.start.localeCompare(b.start));
  for (const event of timed) {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    if (start <= now.getTime() && now.getTime() < end) return { event, status: "en cours" };
    if (start > now.getTime()) return { event, status: "à venir" };
  }
  return null;
}

export interface UpcomingExam {
  title: string;
  day: string;
  days: number;
  time: string | null;
  source: "agenda" | "tache";
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Le prochain DS ou khôlle, d'après l'agenda ET les échéances de l'élève. */
export function nextExam(events: CalendarEvent[], workItems: WorkItem[], now: Date, kinds: ReadonlyArray<"ds" | "colle"> = ["ds", "colle"]): UpcomingExam | null {
  const today = localDay(now);
  const candidates: UpcomingExam[] = [];
  for (const event of events) {
    if (!kinds.includes(event.kind as "ds" | "colle")) continue;
    if (/pr[ée]paration/i.test(event.title)) continue;
    const start = new Date(event.allDay ? `${event.start}T00:00:00` : event.start);
    if (!event.allDay && start.getTime() < now.getTime()) continue;
    const day = event.allDay ? event.start : localDay(start);
    if (day < today) continue;
    candidates.push({ title: event.title, day, days: dayDiff(today, day), time: event.allDay ? null : formatHm(minutesOf(start)), source: "agenda" });
  }
  for (const item of workItems) {
    if (!isOpen(item) || !item.dueDate || item.dueDate < today) continue;
    if (!(kinds as readonly string[]).includes(item.kind)) continue;
    candidates.push({ title: item.title, day: item.dueDate, days: dayDiff(today, item.dueDate), time: item.dueTime ? item.dueTime.replace(":", "h") : null, source: "tache" });
  }
  candidates.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? ""));
  return candidates[0] ?? null;
}

/** Charge de chaque jour (minutes de cours + de tâches), pour la mini-semaine de l'accueil. */
export function weekLoad(columns: DayColumn[]): Array<{ day: string; date: Date; classMinutes: number; taskCount: number; doneCount: number; hasExam: boolean }> {
  return columns.map((column) => ({
    day: column.day,
    date: column.date,
    // La JOURNÉE seulement (avant 18 h) : le soir, l'agenda porte aussi les créneaux de travail de l'élève.
    classMinutes: column.blocks.filter((block) => block.kind !== "tache" && block.kind !== "perso" && block.startMin < 18 * 60).reduce((sum, block) => sum + (Math.min(block.endMin, 18 * 60) - block.startMin), 0),
    taskCount: column.blocks.filter((block) => block.kind === "tache").length + column.untimed.length,
    doneCount: column.blocks.filter((block) => block.kind === "tache" && block.done).length + column.untimed.filter((item) => item.status === "terminé").length,
    hasExam: column.blocks.some((block) => (block.kind === "ds" || block.kind === "colle") && !/pr[ée]paration/i.test(block.title)) || column.untimed.some((item) => item.kind === "ds" || item.kind === "colle"),
  }));
}
