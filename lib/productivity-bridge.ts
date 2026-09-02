import { computeNextAction } from "@/lib/next-action";
import { computeDailyPlan } from "@/lib/plan";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";
import {
  buildDailyProductivityPlan,
  type CalendarEvent,
  type DailyProductivityPlan,
  type ProductivityTask,
} from "@/lib/productivity-engine";

export interface ProductivityInput {
  events: CalendarEvent[];
  tasks: ProductivityTask[];
}

/**
 * Convert the existing TaekdHub study model into the generic productivity
 * model. This is the boundary where academic intelligence becomes schedulable
 * work; Apple/other providers can plug in on the other side without knowing
 * anything about exercises or chapters.
 */
export function buildStudyProductivityTasks(
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  dailyGoalMinutes: number,
  now = new Date(),
): ProductivityTask[] {
  const plan = computeDailyPlan(exercises, sessions, chapters, dailyGoalMinutes, now);

  const tasks = plan.blocks.map((block, index) => ({
    id: `study-plan:${block.subject}:${index}`,
    title: block.label,
    estimatedMinutes: Math.max(15, block.estimatedMinutes || block.minutes),
    priority: index === 0 ? "high" : "normal",
    status: "todo",
    area: "study",
    source: "taekdhub",
    subject: block.subject,
  }));

  if (tasks.length > 0 || exercises.every((exercise) => exercise.archived)) return tasks;
  const fallback = computeNextAction(exercises, sessions, dailyGoalMinutes, now);
  return [{
    id: "study-plan:fallback",
    title: fallback.kind === "start-session" ? fallback.title : "Révision TaekdHub",
    estimatedMinutes: Math.max(15, fallback.minutes || dailyGoalMinutes),
    priority: "high",
    status: "todo",
    area: "study",
    source: "taekdhub",
  }];
}

/**
 * Full bridge used by a future Daily Copilot surface. It keeps the scheduler
 * deterministic and deliberately accepts external calendar events as input.
 */
export function buildDailyCopilotPlan(options: {
  date: string;
  dayStart: string;
  dayEnd: string;
  exercises: Exercise[];
  sessions: WorkSession[];
  chapters: Chapter[];
  dailyGoalMinutes: number;
  events?: CalendarEvent[];
  tasks?: ProductivityTask[];
  now?: string;
}): DailyProductivityPlan {
  const now = options.now ? new Date(options.now) : new Date();
  const studyTasks = buildStudyProductivityTasks(
    options.exercises,
    options.sessions,
    options.chapters,
    options.dailyGoalMinutes,
    now,
  );

  const nextAction = computeNextAction(
    options.exercises,
    options.sessions,
    options.dailyGoalMinutes,
    now,
  );

  const externalTasks = options.tasks ?? [];
  const mergedTasks: ProductivityTask[] = [
    ...externalTasks,
    ...studyTasks,
  ];

  // A non-startable next action should never create an artificial task. The
  // scheduler can still use the study queue and any external task queue.
  if (nextAction.kind !== "empty-bank" && mergedTasks.length === 0) {
    mergedTasks.push({
      id: "study-next-action",
      title: nextAction.title,
      estimatedMinutes: Math.max(15, nextAction.minutes),
      priority: "high",
      status: "todo",
      area: "study",
      source: "taekdhub",
    });
  }

  return buildDailyProductivityPlan({
    date: options.date,
    dayStart: options.dayStart,
    dayEnd: options.dayEnd,
    events: options.events ?? [],
    tasks: mergedTasks,
    now: options.now,
  });
}

/** Canonical empty provider payload used by integrations until a calendar connection exists. */
export function emptyProductivityInput(): ProductivityInput {
  return { events: [], tasks: [] };
}
