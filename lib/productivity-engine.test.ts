import { describe, expect, it } from "vitest";
import { buildDailyProductivityPlan, computeFreeWindows, type CalendarEvent } from "@/lib/productivity-engine";

const DAY_START = "2026-08-24T08:00:00.000Z";
const DAY_END = "2026-08-24T22:00:00.000Z";

function event(id: string, title: string, startsAt: string, endsAt: string): CalendarEvent {
  return { id, title, startsAt, endsAt, allDay: false, source: "apple-calendar" };
}

describe("computeFreeWindows", () => {
  it("merges overlapping busy events and returns usable gaps", () => {
    const windows = computeFreeWindows(DAY_START, DAY_END, [
      event("1", "Cours", "2026-08-24T09:00:00.000Z", "2026-08-24T10:00:00.000Z"),
      event("2", "Cours", "2026-08-24T09:45:00.000Z", "2026-08-24T11:00:00.000Z"),
      event("3", "Basket", "2026-08-24T18:30:00.000Z", "2026-08-24T20:00:00.000Z"),
    ]);

    expect(windows.map((window) => window.minutes)).toEqual([60, 450, 120]);
    expect(windows[0].startsAt).toBe("2026-08-24T08:00:00.000Z");
    expect(windows[1].startsAt).toBe("2026-08-24T11:00:00.000Z");
  });

  it("treats an all-day event as unavailable time by default", () => {
    const windows = computeFreeWindows(DAY_START, DAY_END, [
      { id: "holiday", title: "Vacances", startsAt: "2026-08-24T00:00:00.000Z", endsAt: "2026-08-25T00:00:00.000Z", allDay: true, source: "apple-calendar" },
    ]);

    expect(windows).toEqual([]);
  });
});

describe("buildDailyProductivityPlan", () => {
  it("prioritizes urgent and soon-due work while respecting calendar gaps", () => {
    const plan = buildDailyProductivityPlan({
      date: "2026-08-24",
      dayStart: DAY_START,
      dayEnd: DAY_END,
      now: "2026-08-24T08:00:00.000Z",
      events: [
        event("school", "Cours", "2026-08-24T09:00:00.000Z", "2026-08-24T12:00:00.000Z"),
        event("basket", "Basket", "2026-08-24T18:30:00.000Z", "2026-08-24T20:00:00.000Z"),
      ],
      tasks: [
        { id: "normal", title: "Anglais", estimatedMinutes: 30, priority: "normal", status: "todo", area: "personal", source: "manual" },
        { id: "urgent", title: "DM maths", estimatedMinutes: 60, priority: "urgent", status: "todo", area: "study", source: "manual" },
        { id: "soon", title: "Physique", estimatedMinutes: 45, dueAt: "2026-08-26T18:00:00.000Z", priority: "high", status: "todo", area: "study", source: "manual" },
      ],
    });

    expect(plan.blocks[0].taskId).toBe("urgent");
    expect(plan.blocks[1].taskId).toBe("soon");
    expect(plan.unscheduledTaskIds).toEqual([]);
    expect(plan.scheduledMinutes).toBe(135);
  });

  it("does not schedule completed tasks", () => {
    const plan = buildDailyProductivityPlan({
      date: "2026-08-24",
      dayStart: "2026-08-24T14:00:00.000Z",
      dayEnd: "2026-08-24T16:00:00.000Z",
      tasks: [
        { id: "done", title: "Déjà terminé", estimatedMinutes: 60, status: "done", priority: "urgent", area: "personal", source: "manual" },
        { id: "todo", title: "À faire", estimatedMinutes: 45, priority: "normal", status: "todo", area: "personal", source: "manual" },
      ],
      events: [],
    });

    expect(plan.blocks.map((block) => block.taskId)).toEqual(["todo"]);
  });

  it("reports work that does not fit instead of silently dropping it", () => {
    const plan = buildDailyProductivityPlan({
      date: "2026-08-24",
      dayStart: "2026-08-24T14:00:00.000Z",
      dayEnd: "2026-08-24T14:30:00.000Z",
      tasks: [
        { id: "a", title: "Grosse tâche", estimatedMinutes: 60, priority: "high", status: "todo", area: "personal", source: "manual" },
        { id: "b", title: "Petite tâche", estimatedMinutes: 20, priority: "normal", status: "todo", area: "personal", source: "manual" },
      ],
      events: [],
    });

    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].taskId).toBe("a");
    expect(plan.blocks[0].minutes).toBe(30);
    expect(plan.unscheduledTaskIds).toEqual(["b"]);
  });
});
