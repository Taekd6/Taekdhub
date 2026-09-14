import { DEFAULT_AVAILABILITY } from "@/lib/domain/availability";
import { createTask, type NewTaskInput } from "@/lib/domain/tasks";
import { DEFAULT_SUBJECTS } from "@/lib/domain/subjects";
import { DEFAULT_SETTINGS, STATE_VERSION } from "@/lib/store/schema";
import type { AppState, Task, TimeEntry } from "@/lib/domain/types";

/**
 * Fabriques de test — un état complet se construit en une ligne, pour que
 * chaque test dise ce qu'il vérifie et rien d'autre.
 *
 * `NOW` est figé un LUNDI (2026-09-14, 17:00 locale) : toute la logique de
 * semaine, de capacité et d'échéance dépend du jour de la semaine, et un test
 * qui passe le mardi mais pas le samedi ne vaut rien.
 */
export const NOW = new Date("2026-09-14T17:00:00");

export function makeTask(input: Partial<NewTaskInput> & { title?: string } = {}, overrides: Partial<Task> = {}): Task {
  const task = createTask({ title: "Tâche", ...input }, NOW);
  return { ...task, ...overrides };
}

export function makeState(partial: Partial<AppState> = {}): AppState {
  return {
    version: STATE_VERSION,
    tasks: [],
    timeEntries: [],
    goals: [],
    routines: [],
    subjects: DEFAULT_SUBJECTS.map((subject) => ({ ...subject })),
    availability: { weekly: { ...DEFAULT_AVAILABILITY.weekly }, exceptions: [] },
    settings: { ...DEFAULT_SETTINGS },
    ...partial,
  };
}

export function makeEntry(minutes: number, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    startedAt: NOW.toISOString(),
    minutes,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

/** Un instant local ce jour-là (ou n décalé), à l'heure donnée — évite les `new Date("...")` illisibles dans les tests. */
export function at(dayOffset: number, time = "18:00"): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + dayOffset);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function slot(dayOffset: number, time: string, minutes: number) {
  const start = at(dayOffset, time);
  return { start, end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString() };
}
