import { describe, expect, it } from "vitest";
import { adaptDailyProductivityPlan } from "@/lib/productivity-adaptation";
import { buildDailyProductivityPlan, type ProductivityTask } from "@/lib/productivity-engine";
import { normalizeProductivitySyncRequest } from "@/lib/productivity-protocol";
import { buildProductivityDayReview } from "@/lib/productivity-review";

const task = (id: string, priority: ProductivityTask["priority"] = "normal"): ProductivityTask => ({ id, title: id, priority, status: "todo", estimatedMinutes: 45, area: "personal", source: "manual" });

describe("productivity lifecycle", () => {
  it("preserves completed work when a day is replanned", () => {
    const plan = buildDailyProductivityPlan({ date: "2026-08-24", dayStart: "2026-08-24T08:00:00Z", dayEnd: "2026-08-24T18:00:00Z", now: "2026-08-24T08:00:00Z", tasks: [task("a", "urgent"), task("b")], events: [], settings: { reserveMinutes: 0 } });
    const adapted = adaptDailyProductivityPlan(plan, { date: plan.date, dayEnd: "2026-08-24T18:00:00Z", now: "2026-08-24T09:00:00Z", tasks: [task("a"), task("b")], events: [], event: { type: "BLOCK_COMPLETED", at: "2026-08-24T09:00:00Z", blockId: plan.blocks[0].id }, settings: { reserveMinutes: 0 } });
    expect(adapted.blocks.find((block) => block.taskId === "a")?.status).toBe("completed");
    expect(adapted.blocks.filter((block) => block.taskId === "a")).toHaveLength(1);
  });

  it("validates an incomplete shortcuts payload and drops invalid provider entries", () => {
    const input = normalizeProductivitySyncRequest({ schemaVersion: "1.0", timestamp: "2026-08-24T08:00:00Z", timezone: "Europe/Paris", events: [{ title: "bad" }], reminders: [{ title: "Valid" }] });
    expect(input.events).toEqual([]);
    expect(input.tasks[0].title).toBe("Valid");
  });

  it("summarizes completion and deferred work", () => {
    const plan = buildDailyProductivityPlan({ date: "2026-08-24", dayStart: "2026-08-24T08:00:00Z", dayEnd: "2026-08-24T12:00:00Z", tasks: [task("a")], events: [], settings: { reserveMinutes: 0 } });
    const review = buildProductivityDayReview(plan, [{ ...plan.blocks[0], status: "completed" }]);
    expect(review.completedPriorities).toBe(1);
    expect(review.actualMinutes).toBe(plan.blocks[0].minutes);
  });
});
