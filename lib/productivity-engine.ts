export type ProductivityArea = "study" | "taekdhub" | "admin" | "personal" | "sport" | "other";
export type ProductivitySource = "apple-calendar" | "apple-reminders" | "taekdhub" | "manual" | "other";
export type ProductivityTaskStatus = "todo" | "in-progress" | "done" | "skipped" | "deferred";
export type ProductivityTaskPriority = "low" | "normal" | "high" | "urgent";
export type PlannedBlockStatus = "planned" | "started" | "completed" | "skipped" | "delayed";

export interface CalendarEvent { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; source: ProductivitySource; calendar?: string; category?: string; }
export interface ProductivityTask {
  id: string; title: string; status: ProductivityTaskStatus; priority: ProductivityTaskPriority; dueAt?: string | null; estimatedMinutes: number; area: ProductivityArea; source: ProductivitySource;
  createdAt?: string; subject?: string; chapterId?: string; exerciseId?: string; metadata?: Record<string, unknown>;
}
export interface PlanningWindow { startsAt: string; endsAt: string; minutes: number; }
export interface PlanningDecision { taskId: string; score: number; factors: string[]; reason: string; generatedAt: string; }
export interface PlannedTaskBlock {
  id: string; taskId: string; task: ProductivityTask; title: string; startsAt: string; endsAt: string; minutes: number; duration: number; reason: string; source: ProductivitySource; status: PlannedBlockStatus;
}
export interface ProductivitySettings { minimumBlockMinutes: number; minimumBreakMinutes: number; maximumSessionMinutes: number; maximumDailyMinutes: number; reserveMinutes: number; allowAllDayWork: boolean; }
export const DEFAULT_PRODUCTIVITY_SETTINGS: ProductivitySettings = { minimumBlockMinutes: 25, minimumBreakMinutes: 10, maximumSessionMinutes: 90, maximumDailyMinutes: 240, reserveMinutes: 60, allowAllDayWork: false };
export interface DailyProductivityPlan {
  date: string; generatedAt: string; timezone?: string; availableMinutes: number; scheduledMinutes: number; unscheduledTaskIds: string[]; partiallyScheduledTaskIds: string[]; freeWindows: PlanningWindow[]; blocks: PlannedTaskBlock[]; decisions: PlanningDecision[];
}
export interface BuildPlanOptions {
  date: string; dayStart: string; dayEnd: string; events: CalendarEvent[]; tasks: ProductivityTask[]; now?: string; timezone?: string; settings?: Partial<ProductivitySettings>; minimumBlockMinutes?: number;
}

const MINUTES = 60_000;
function parseDate(value: string): number { const timestamp = new Date(value).getTime(); if (!Number.isFinite(timestamp)) throw new Error(`Invalid date: ${value}`); return timestamp; }
function minutesBetween(start: number, end: number): number { return Math.max(0, Math.floor((end - start) / MINUTES)); }
function iso(timestamp: number): string { return new Date(timestamp).toISOString(); }

function mergedBusyIntervals(dayStart: number, dayEnd: number, events: CalendarEvent[], allDayBlocksDay: boolean) {
  if (allDayBlocksDay && events.some((event) => event.allDay)) return [{ start: dayStart, end: dayEnd }];
  const intervals = events.filter((event) => !event.allDay).map((event) => ({ start: Math.max(dayStart, parseDate(event.startsAt)), end: Math.min(dayEnd, parseDate(event.endsAt)) })).filter((event) => event.end > event.start).sort((a, b) => a.start - b.start || a.end - b.end);
  return intervals.reduce<Array<{ start: number; end: number }>>((merged, interval) => { const previous = merged.at(-1); if (!previous || interval.start > previous.end) merged.push({ ...interval }); else previous.end = Math.max(previous.end, interval.end); return merged; }, []);
}

export function computeFreeWindows(dayStart: string, dayEnd: string, events: CalendarEvent[], minimumMinutes = DEFAULT_PRODUCTIVITY_SETTINGS.minimumBlockMinutes, allDayBlocksDay = true): PlanningWindow[] {
  const start = parseDate(dayStart); const end = parseDate(dayEnd); if (end <= start) return [];
  const windows: PlanningWindow[] = []; let cursor = start;
  for (const busy of mergedBusyIntervals(start, end, events, allDayBlocksDay)) { const minutes = minutesBetween(cursor, busy.start); if (minutes >= minimumMinutes) windows.push({ startsAt: iso(cursor), endsAt: iso(busy.start), minutes }); cursor = Math.max(cursor, busy.end); }
  const minutes = minutesBetween(cursor, end); if (minutes >= minimumMinutes) windows.push({ startsAt: iso(cursor), endsAt: iso(end), minutes }); return windows;
}

function scoreTask(task: ProductivityTask, now: number): { score: number; factors: string[]; reason: string } {
  const factors: string[] = []; let score = { low: 20, normal: 45, high: 75, urgent: 120 }[task.priority]; factors.push(`priorité ${task.priority}`);
  if (task.dueAt) { const hours = (parseDate(task.dueAt) - now) / 3_600_000; if (hours <= 0) { score += 160; factors.push("échéance dépassée"); } else if (hours <= 24) { score += 140; factors.push("échéance dans les 24 h"); } else if (hours <= 72) { score += 30; factors.push("échéance proche"); } else if (hours <= 168) { score += 15; factors.push("échéance cette semaine"); } }
  if (task.createdAt) { const ageDays = Math.max(0, (now - parseDate(task.createdAt)) / 86_400_000); if (ageDays >= 7) { score += Math.min(30, Math.floor(ageDays)); factors.push("tâche ancienne"); } }
  if (task.area === "study") { score += 4; factors.push("besoin académique"); } if (task.estimatedMinutes <= 45) score += 5;
  return { score, factors, reason: factors.find((factor) => factor.includes("échéance")) ?? factors[0] };
}

/** Deterministic scheduler: external systems are normalized before entering here. */
export function buildDailyProductivityPlan(options: BuildPlanOptions): DailyProductivityPlan {
  const settings = { ...DEFAULT_PRODUCTIVITY_SETTINGS, ...options.settings, minimumBlockMinutes: options.minimumBlockMinutes ?? options.settings?.minimumBlockMinutes ?? DEFAULT_PRODUCTIVITY_SETTINGS.minimumBlockMinutes };
  const now = parseDate(options.now ?? options.dayStart);
  const freeWindows = computeFreeWindows(options.dayStart, options.dayEnd, options.events, settings.minimumBlockMinutes, !settings.allowAllDayWork);
  const ranked = options.tasks.filter((task) => task.status !== "done" && task.status !== "skipped").map((task) => ({ task, ...scoreTask(task, now) })).sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));
  const remaining = new Map(ranked.map(({ task }) => [task.id, Math.max(settings.minimumBlockMinutes, Math.round(task.estimatedMinutes))])); const blocks: PlannedTaskBlock[] = []; const decisions: PlanningDecision[] = []; let scheduledMinutes = 0;
  const preserveReserve = freeWindows.reduce((sum, window) => sum + window.minutes, 0) > settings.maximumDailyMinutes;
  for (const [windowIndex, window] of freeWindows.entries()) {
    let cursor = parseDate(window.startsAt); const isFinalWindow = windowIndex === freeWindows.length - 1;
    const usableEnd = Math.max(cursor, parseDate(window.endsAt) - (preserveReserve && isFinalWindow ? settings.reserveMinutes * MINUTES : 0));
    while (cursor + settings.minimumBlockMinutes * MINUTES <= usableEnd && scheduledMinutes < settings.maximumDailyMinutes) {
      const candidate = ranked.find(({ task }) => (remaining.get(task.id) ?? 0) >= settings.minimumBlockMinutes); if (!candidate) break;
      const allowed = Math.min(settings.maximumSessionMinutes, settings.maximumDailyMinutes - scheduledMinutes, minutesBetween(cursor, usableEnd)); const duration = Math.min(remaining.get(candidate.task.id)!, allowed); if (duration < settings.minimumBlockMinutes) break;
      const end = cursor + duration * MINUTES;
      blocks.push({ id: `${candidate.task.id}:${cursor}`, taskId: candidate.task.id, task: candidate.task, title: candidate.task.title, startsAt: iso(cursor), endsAt: iso(end), minutes: duration, duration, reason: candidate.reason, source: candidate.task.source, status: "planned" });
      decisions.push({ taskId: candidate.task.id, score: candidate.score, factors: candidate.factors, reason: `${candidate.reason}; créneau de ${duration} min disponible`, generatedAt: iso(now) }); remaining.set(candidate.task.id, remaining.get(candidate.task.id)! - duration); scheduledMinutes += duration; cursor = end + settings.minimumBreakMinutes * MINUTES;
    }
  }
  const scheduledTaskIds = new Set(blocks.map((block) => block.taskId));
  const partialTaskIds = ranked.filter(({ task }) => scheduledTaskIds.has(task.id) && (remaining.get(task.id) ?? 0) > 0).map(({ task }) => task.id);
  return { date: options.date, generatedAt: iso(now), timezone: options.timezone, availableMinutes: freeWindows.reduce((sum, window) => sum + window.minutes, 0), scheduledMinutes, unscheduledTaskIds: ranked.filter(({ task }) => !scheduledTaskIds.has(task.id)).map(({ task }) => task.id), partiallyScheduledTaskIds: partialTaskIds, freeWindows, blocks, decisions };
}
