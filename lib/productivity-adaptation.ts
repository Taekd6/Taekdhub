import { buildDailyProductivityPlan, type BuildPlanOptions, type CalendarEvent, type DailyProductivityPlan, type PlannedTaskBlock, type ProductivityTask } from "@/lib/productivity-engine";

export type ProductivityEventType = "BLOCK_COMPLETED" | "BLOCK_SKIPPED" | "BLOCK_DELAYED" | "BLOCK_STARTED_LATE" | "NEW_EVENT" | "TASK_COMPLETED" | "TASK_ADDED";
export interface ProductivityEvent { type: ProductivityEventType; at: string; blockId?: string; taskId?: string; task?: ProductivityTask; calendarEvent?: CalendarEvent; }

function changedBlocks(plan: DailyProductivityPlan, event: ProductivityEvent): PlannedTaskBlock[] {
  return plan.blocks.map((block) => {
    if (event.blockId !== block.id && event.taskId !== block.taskId) return block;
    if (event.type === "BLOCK_COMPLETED" || event.type === "TASK_COMPLETED") return { ...block, status: "completed" };
    if (event.type === "BLOCK_SKIPPED") return { ...block, status: "skipped" };
    return { ...block, status: "delayed" };
  });
}

/** Rebuild only the unfinished portion of a day. Completed blocks are retained verbatim and task IDs stay unique. */
export function adaptDailyProductivityPlan(plan: DailyProductivityPlan, options: Omit<BuildPlanOptions, "tasks" | "events" | "dayStart"> & { tasks: ProductivityTask[]; events: BuildPlanOptions["events"]; event: ProductivityEvent }): DailyProductivityPlan {
  const blocks = changedBlocks(plan, options.event);
  const completedTaskIds = new Set(blocks.filter((block) => block.status === "completed").map((block) => block.taskId));
  const pendingTasks = [...options.tasks, ...(options.event.type === "TASK_ADDED" && options.event.task ? [options.event.task] : [])]
    .filter((task, index, all) => !completedTaskIds.has(task.id) && all.findIndex((candidate) => candidate.id === task.id) === index)
    .map((task) => completedTaskIds.has(task.id) ? { ...task, status: "done" as const } : task);
  const futureEvents = options.event.type === "NEW_EVENT" && options.event.calendarEvent ? [...options.events, options.event.calendarEvent] : options.events;
  const future = buildDailyProductivityPlan({ ...options, dayStart: options.event.at, events: futureEvents, tasks: pendingTasks });
  const retained = blocks.filter((block) => block.status === "completed" || new Date(block.endsAt).getTime() <= new Date(options.event.at).getTime());
  const retainedTaskIds = new Set(retained.map((block) => block.taskId));
  const rescheduled = future.blocks.filter((block) => !retainedTaskIds.has(block.taskId));
  return { ...future, blocks: [...retained, ...rescheduled], scheduledMinutes: [...retained, ...rescheduled].reduce((sum, block) => sum + block.minutes, 0) };
}
