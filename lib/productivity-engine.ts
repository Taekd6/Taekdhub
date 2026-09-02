export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
}

export type ProductivityTaskStatus = "todo" | "done";
export type ProductivityTaskPriority = "low" | "normal" | "high" | "urgent";

export interface ProductivityTask {
  id: string;
  title: string;
  dueAt?: string | null;
  estimatedMinutes: number;
  priority?: ProductivityTaskPriority;
  status?: ProductivityTaskStatus;
  /** Optional category used later to distinguish study / admin / TaekdHub / personal work. */
  area?: string;
}

export interface PlanningWindow {
  startsAt: string;
  endsAt: string;
  minutes: number;
}

export interface PlannedTaskBlock {
  taskId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  minutes: number;
  reason: "urgent" | "due-soon" | "priority" | "fits-window";
}

export interface DailyProductivityPlan {
  date: string;
  availableMinutes: number;
  scheduledMinutes: number;
  unscheduledTaskIds: string[];
  freeWindows: PlanningWindow[];
  blocks: PlannedTaskBlock[];
}

const MIN_BLOCK_MINUTES = 15;
const MAX_EVENT_GAP_MINUTES = 24 * 60;

function parseDate(value: string): number {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid date: ${value}`);
  return timestamp;
}

function minutesBetween(startMs: number, endMs: number): number {
  return Math.max(0, Math.floor((endMs - startMs) / 60000));
}

function clampEnd(startMs: number, endMs: number): number {
  return Math.max(startMs, endMs);
}

export function computeFreeWindows(
  dayStart: string,
  dayEnd: string,
  events: CalendarEvent[],
  minimumMinutes = MIN_BLOCK_MINUTES,
): PlanningWindow[] {
  const startMs = parseDate(dayStart);
  const endMs = parseDate(dayEnd);
  if (endMs <= startMs) return [];

  const busy = events
    .filter((event) => !event.allDay)
    .map((event) => ({
      start: Math.max(startMs, parseDate(event.startsAt)),
      end: Math.min(endMs, parseDate(event.endsAt)),
    }))
    .filter((event) => event.end > event.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const event of busy) {
    const previous = merged.at(-1);
    if (!previous || event.start > previous.end) {
      merged.push(event);
    } else {
      previous.end = Math.max(previous.end, event.end);
    }
  }

  const windows: PlanningWindow[] = [];
  let cursor = startMs;
  for (const event of merged) {
    if (event.start > cursor) {
      const minutes = minutesBetween(cursor, event.start);
      if (minutes >= minimumMinutes) {
        windows.push({
          startsAt: new Date(cursor).toISOString(),
          endsAt: new Date(event.start).toISOString(),
          minutes,
        });
      }
    }
    cursor = Math.max(cursor, event.end);
  }

  if (cursor < endMs) {
    const minutes = minutesBetween(cursor, endMs);
    if (minutes >= minimumMinutes) {
      windows.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        minutes,
      });
    }
  }

  return windows.filter((window) => window.minutes <= MAX_EVENT_GAP_MINUTES);
}

function priorityWeight(priority: ProductivityTaskPriority | undefined): number {
  switch (priority) {
    case "urgent": return 400;
    case "high": return 300;
    case "normal": return 200;
    case "low": return 100;
    default: return 200;
  }
}

function taskScore(task: ProductivityTask, nowMs: number): number {
  if (task.status === "done") return Number.NEGATIVE_INFINITY;

  let score = priorityWeight(task.priority);
  if (task.dueAt) {
    const dueMs = parseDate(task.dueAt);
    const hoursUntilDue = (dueMs - nowMs) / 3600000;
    if (hoursUntilDue <= 24) score += 350;
    else if (hoursUntilDue <= 72) score += 220;
    else if (hoursUntilDue <= 168) score += 80;
  }

  score += Math.max(0, 60 - Math.min(task.estimatedMinutes, 60));
  return score;
}

function chooseReason(task: ProductivityTask, nowMs: number): PlannedTaskBlock["reason"] {
  if (task.priority === "urgent") return "urgent";
  if (task.dueAt) {
    const hoursUntilDue = (parseDate(task.dueAt) - nowMs) / 3600000;
    if (hoursUntilDue <= 72) return "due-soon";
  }
  if (task.priority === "high") return "priority";
  return "fits-window";
}

/**
 * Deterministic first-pass scheduler. It deliberately knows nothing about
 * Apple Calendar or Reminders: adapters can feed it normalized events/tasks.
 * This keeps external integrations replaceable and makes the planner easy to test.
 */
export function buildDailyProductivityPlan(options: {
  date: string;
  dayStart: string;
  dayEnd: string;
  events: CalendarEvent[];
  tasks: ProductivityTask[];
  now?: string;
  minimumBlockMinutes?: number;
}): DailyProductivityPlan {
  const nowMs = parseDate(options.now ?? options.dayStart);
  const freeWindows = computeFreeWindows(
    options.dayStart,
    options.dayEnd,
    options.events,
    options.minimumBlockMinutes ?? MIN_BLOCK_MINUTES,
  );

  const pending = options.tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({ task, score: taskScore(task, nowMs) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score);

  const blocks: PlannedTaskBlock[] = [];
  const scheduled = new Set<string>();

  for (const window of freeWindows) {
    let cursor = parseDate(window.startsAt);
    const windowEnd = parseDate(window.endsAt);

    while (cursor + MIN_BLOCK_MINUTES * 60000 <= windowEnd) {
      const candidate = pending.find(({ task }) => !scheduled.has(task.id));
      if (!candidate) break;

      const remainingMinutes = minutesBetween(cursor, windowEnd);
      const requested = Math.min(candidate.task.estimatedMinutes, remainingMinutes);
      if (requested < MIN_BLOCK_MINUTES) break;

      const blockEnd = clampEnd(cursor, cursor + requested * 60000);
      blocks.push({
        taskId: candidate.task.id,
        title: candidate.task.title,
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(blockEnd).toISOString(),
        minutes: minutesBetween(cursor, blockEnd),
        reason: chooseReason(candidate.task, nowMs),
      });
      scheduled.add(candidate.task.id);
      cursor = blockEnd;
    }
  }

  return {
    date: options.date,
    availableMinutes: freeWindows.reduce((sum, window) => sum + window.minutes, 0),
    scheduledMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    unscheduledTaskIds: pending.filter(({ task }) => !scheduled.has(task.id)).map(({ task }) => task.id),
    freeWindows,
    blocks,
  };
}
