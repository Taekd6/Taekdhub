import { describe, expect, it } from "vitest";
import { buildDailyCopilotPlan, buildStudyProductivityTasks, emptyProductivityInput } from "@/lib/productivity-bridge";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

const chapters: Chapter[] = [];
const sessions: WorkSession[] = [];

const exercise = (id: string, subject: Exercise["subject"]): Exercise => ({
  id,
  subject,
  title: `Exercice ${id}`,
  statement: "Énoncé",
  chapter_id: null,
  source: "Personnel",
  year: null,
  competition: null,
  programme_level: null,
  license_status: null,
  external_id: null,
  source_url: null,
  prerequisites: [],
  pedagogical_goal: null,
  level: 3,
  type: "Personnel",
  difficulty: 3,
  priority: 3,
  mastery: 25,
  status: "à revoir",
  estimated_minutes: 30,
  attempts: 1,
  note: null,
  created_at: "2026-08-23T08:00:00.000Z",
  updated_at: "2026-08-23T08:00:00.000Z",
  tags: [],
  favorite: false,
  archived: false,
  hints: [],
  correction: null,
  last_worked_at: "2026-08-22T08:00:00.000Z",
});

describe("productivity bridge", () => {
  it("converts the existing study plan into generic productivity tasks", () => {
    const tasks = buildStudyProductivityTasks(
      [exercise("1", "Mathématiques"), exercise("2", "Physique")],
      sessions,
      chapters,
      45,
      new Date("2026-08-23T08:00:00.000Z"),
    );

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]).toMatchObject({ area: "study", status: "todo" });
  });

  it("lets calendar events constrain the generated study plan", () => {
    const plan = buildDailyCopilotPlan({
      date: "2026-08-23",
      dayStart: "2026-08-23T08:00:00.000Z",
      dayEnd: "2026-08-23T12:00:00.000Z",
      exercises: [exercise("1", "Mathématiques")],
      sessions,
      chapters,
      dailyGoalMinutes: 90,
      events: [
        {
          id: "busy",
          title: "Cours",
          startsAt: "2026-08-23T09:00:00.000Z",
          endsAt: "2026-08-23T10:30:00.000Z",
          allDay: false,
          source: "apple-calendar",
        },
      ],
      now: "2026-08-23T08:00:00.000Z",
    });

    expect(plan.freeWindows).toHaveLength(2);
    expect(plan.blocks.every((block) => block.endsAt <= "2026-08-23T09:00:00.000Z" || block.startsAt >= "2026-08-23T10:30:00.000Z")).toBe(true);
  });

  it("exposes a stable empty integration payload", () => {
    expect(emptyProductivityInput()).toEqual({ events: [], tasks: [] });
  });
});
