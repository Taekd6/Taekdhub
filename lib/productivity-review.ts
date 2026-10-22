import type { DailyProductivityPlan, PlannedTaskBlock } from "@/lib/productivity-engine";

export interface ProductivityDayReview { completedPriorities: number; totalPriorities: number; plannedMinutes: number; actualMinutes: number; deferredTaskIds: string[]; workedAreas: string[]; tomorrowFocus?: string; }

/** Compact, deterministic end-of-day review. Actual time is supplied by the execution layer when available. */
export function buildProductivityDayReview(plan: DailyProductivityPlan, blocks: PlannedTaskBlock[] = plan.blocks, actualMinutes?: number): ProductivityDayReview {
  const completed = blocks.filter((block) => block.status === "completed");
  const deferred = blocks.filter((block) => block.status === "skipped" || block.status === "delayed").map((block) => block.taskId);
  const priorities = plan.decisions.slice(0, 5).map((decision) => decision.taskId);
  const completedPriorities = new Set(completed.map((block) => block.taskId));
  const workedAreas = [...new Set(completed.map((block) => block.task.area))];
  return { completedPriorities: priorities.filter((id) => completedPriorities.has(id)).length, totalPriorities: priorities.length, plannedMinutes: plan.scheduledMinutes, actualMinutes: actualMinutes ?? completed.reduce((sum, block) => sum + block.minutes, 0), deferredTaskIds: [...new Set(deferred)], workedAreas, tomorrowFocus: deferred[0] };
}
