import { DEADLINES, HOLIDAY_PROGRAM, type Deadline, type ProgramSession } from "@/lib/holiday-program";
import type { WorkItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE PLANNING À COCHER (octobre 2026) — ce que l'élève veut voir d'un jour :
 * les choses à faire, cochées ou non. Rien d'autre.
 *
 * Quatre sources, un seul format d'affichage (`PlanItem`) :
 *   `seance`     une séance du programme (lib/holiday-program.ts) ;
 *   `echeance`   une échéance du calendrier (DS, colle, devoir…) ;
 *   `travail`    un travail daté saisi dans « Échéances » (`WorkItem`, lecture seule ici) ;
 *   `perso`      une tâche ajoutée à la main dans ce planning.
 *
 * Ce qui est coché vit dans UNE clé locale (`prepahub:plan`), séparée de tout
 * le reste : rien n'est écrit dans les travaux ni les séances, rien n'est
 * synchronisé (le navigateur seulement, pour l'instant — la synchronisation
 * demandera une décision sur la base).
 */

export const PLAN_KEY = "prepahub:plan";

export interface PlanTask {
  id: string;
  /** "AAAA-MM-JJ", heure locale. */
  date: string;
  title: string;
}

export interface PlanState {
  /** Identifiants d'éléments cochés (`s:…`, `d:…`, `w:…`, `t:…`). */
  done: Record<string, true>;
  tasks: PlanTask[];
}

export type PlanItemKind = "seance" | "echeance" | "travail" | "perso";

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  title: string;
  /** « 09:30–11:30 », « 13:00 », ou `null`. */
  time: string | null;
  detail: string | null;
  subject: Subject | null;
  done: boolean;
  /** Seules les tâches ajoutées à la main se suppriment. */
  removable: boolean;
  /** Page de la séance, quand il y en a une. */
  href: string | null;
}

export interface PlanDay {
  date: string;
  items: PlanItem[];
  /** Jour de repos prévu au programme : une phrase, rien à cocher. */
  rest: string | null;
}

export const EMPTY_PLAN: PlanState = { done: {}, tasks: [] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Relit l'état stocké sans jamais lever : tout ce qui est invalide est écarté. */
export function normalizePlan(raw: unknown): PlanState {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const done: Record<string, true> = {};
  if (typeof source.done === "object" && source.done !== null) {
    for (const [id, value] of Object.entries(source.done as Record<string, unknown>)) if (value === true) done[id] = true;
  }
  const tasks: PlanTask[] = [];
  if (Array.isArray(source.tasks)) {
    for (const entry of source.tasks) {
      if (typeof entry !== "object" || entry === null) continue;
      const { id, date, title } = entry as Record<string, unknown>;
      if (typeof id === "string" && typeof date === "string" && DATE.test(date) && typeof title === "string" && title.trim()) {
        tasks.push({ id, date, title: title.trim() });
      }
    }
  }
  return { done, tasks };
}

export function loadPlan(): PlanState {
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    return raw ? normalizePlan(JSON.parse(raw)) : EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
}

/** `false` si le navigateur refuse l'écriture (quota, stockage bloqué) : l'appelant le dit à l'élève. */
export function savePlan(state: PlanState): boolean {
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function toggleDone(state: PlanState, id: string): PlanState {
  const done = { ...state.done };
  if (done[id]) delete done[id];
  else done[id] = true;
  return { ...state, done };
}

export function addTask(state: PlanState, date: string, title: string, id: string): PlanState {
  const clean = title.trim();
  if (!clean || !DATE.test(date)) return state;
  return { ...state, tasks: [...state.tasks, { id, date, title: clean }] };
}

export function removeTask(state: PlanState, id: string): PlanState {
  const done = { ...state.done };
  delete done[`t:${id}`];
  return { done, tasks: state.tasks.filter((task) => task.id !== id) };
}

function sessionDetail(session: ProgramSession): string {
  return session.steps.map((step) => `${step.label} ${step.minutes} min`).join(" · ");
}

function timeRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  return end ? `${start}–${end}` : start;
}

export interface PlanSources {
  program?: readonly ProgramSession[];
  deadlines?: readonly Deadline[];
  workItems?: readonly WorkItem[];
}

/** Tout ce qu'il y a à faire un jour donné, trié par heure (sans heure en dernier), puis par source. */
export function buildDay(date: string, state: PlanState, sources: PlanSources = {}): PlanDay {
  const { program = HOLIDAY_PROGRAM, deadlines = DEADLINES, workItems = [] } = sources;
  const items: PlanItem[] = [];
  let rest: string | null = null;

  for (const session of program) {
    if (session.date !== date) continue;
    if (session.kind === "repos") {
      rest = session.note || session.title;
      continue;
    }
    const id = `s:${session.id}`;
    items.push({
      id,
      kind: "seance",
      title: session.title,
      time: timeRange(session.start, session.end),
      detail: sessionDetail(session),
      subject: session.subject,
      done: state.done[id] === true,
      removable: false,
      href: `/seance/${session.id}`,
    });
  }

  for (const deadline of deadlines) {
    if (deadline.date !== date) continue;
    const id = `d:${deadline.id}`;
    items.push({
      id,
      kind: "echeance",
      title: deadline.title,
      time: timeRange(deadline.start, deadline.end),
      detail: [deadline.place, deadline.note].filter(Boolean).join(" · ") || null,
      subject: deadline.subject,
      done: state.done[id] === true,
      removable: false,
      href: null,
    });
  }

  for (const item of workItems) {
    if (item.dueDate !== date || item.status === "abandonné") continue;
    const id = `w:${item.id}`;
    items.push({
      id,
      kind: "travail",
      title: item.title,
      time: item.dueTime,
      detail: null,
      subject: item.subject,
      done: state.done[id] === true || item.status === "terminé",
      removable: false,
      href: null,
    });
  }

  for (const task of state.tasks) {
    if (task.date !== date) continue;
    const id = `t:${task.id}`;
    items.push({ id, kind: "perso", title: task.title, time: null, detail: null, subject: null, done: state.done[id] === true, removable: true, href: null });
  }

  const order: Record<PlanItemKind, number> = { seance: 0, echeance: 1, travail: 2, perso: 3 };
  items.sort((a, b) => {
    if (a.time !== b.time) {
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time.localeCompare(b.time);
    }
    return order[a.kind] - order[b.kind];
  });

  return { date, items, rest };
}

/** Combien de choses restent à cocher ce jour-là (pastille de la bande de la semaine). */
export function openCount(day: PlanDay): number {
  return day.items.filter((item) => !item.done).length;
}

/** "AAAA-MM-JJ" du lundi de la semaine qui contient `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const offset = (d.getDay() + 6) % 7;
  return shiftDay(date, -offset);
}

export function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDay(start, index));
}
