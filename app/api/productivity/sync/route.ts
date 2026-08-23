import { NextResponse } from "next/server";
import { buildDailyProductivityPlan, type ProductivitySettings } from "@/lib/productivity-engine";
import { normalizeProductivitySyncRequest } from "@/lib/productivity-protocol";

export const runtime = "nodejs";

function dayBounds(timestamp: string) {
  const day = new Date(timestamp).toISOString().slice(0, 10);
  return { date: day, dayStart: `${day}T08:00:00.000Z`, dayEnd: `${day}T22:00:00.000Z` };
}

/** Apple Shortcuts transport endpoint. It stores nothing; persistence stays an explicit future adapter. */
export async function POST(request: Request) {
  const token = process.env.PRODUCTIVITY_SYNC_TOKEN;
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const input = normalizeProductivitySyncRequest(body);
    const raw = body as Record<string, unknown>;
    const planning = typeof raw.planning === "object" && raw.planning !== null ? raw.planning as Record<string, unknown> : {};
    const bounds = dayBounds(input.generatedAt);
    const plan = buildDailyProductivityPlan({
      ...bounds,
      dayStart: typeof planning.dayStart === "string" ? planning.dayStart : bounds.dayStart,
      dayEnd: typeof planning.dayEnd === "string" ? planning.dayEnd : bounds.dayEnd,
      events: input.events,
      tasks: input.tasks,
      now: input.generatedAt,
      timezone: input.timezone,
      settings: typeof planning.settings === "object" && planning.settings !== null ? planning.settings as Partial<ProductivitySettings> : undefined,
    });
    return NextResponse.json({ schemaVersion: input.schemaVersion, source: "taekdhub", generatedAt: plan.generatedAt, timezone: input.timezone, plan, blocks: plan.blocks, unscheduledTasks: input.tasks.filter((task) => plan.unscheduledTaskIds.includes(task.id)), summary: { scheduledMinutes: plan.scheduledMinutes, availableMinutes: plan.availableMinutes, priorityCount: Math.min(5, plan.decisions.length) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid productivity payload" }, { status: 400 });
  }
}
