import { describe, expect, it } from "vitest";
import { computeDayFlow } from "@/lib/day-flow";
import { emptyWeeklyPlan, setDayCellMinutes } from "@/lib/weekly-plan";
import type { WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-08-24T09:00:00.000Z",
    ended_at: null,
    duration_seconds: 0,
    note: null,
    created_at: "2026-08-24T09:00:00.000Z",
    result: null,
    ...overrides,
  };
}

// 2026-08-24 est un lundi (day 0).
const NOW = new Date("2026-08-24T18:00:00.000Z");

describe("computeDayFlow", () => {
  it("aucun plan pour aujourd'hui : aucun bloc, jamais 'terminé'", () => {
    const flow = computeDayFlow(emptyWeeklyPlan(), [], NOW);
    expect(flow.blocks).toEqual([]);
    expect(flow.allDone).toBe(false);
  });

  it("un bloc pas encore commencé : à venir", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 45);
    const flow = computeDayFlow(plan, [], NOW);
    expect(flow.blocks).toEqual([{ subject: "Mathématiques", plannedMinutes: 45, workedMinutes: 0, status: "à venir" }]);
    expect(flow.allDone).toBe(false);
  });

  it("un bloc entamé mais pas fini : en cours", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 45);
    const sessions = [makeSession({ subject: "Mathématiques", duration_seconds: 20 * 60 })];
    const flow = computeDayFlow(plan, sessions, NOW);
    expect(flow.blocks[0]).toMatchObject({ workedMinutes: 20, status: "en cours" });
    expect(flow.allDone).toBe(false);
  });

  it("réalisé >= prévu : terminé (même règle que computeWeeklyPlanRows)", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 45);
    const sessions = [makeSession({ subject: "Mathématiques", duration_seconds: 50 * 60 })];
    const flow = computeDayFlow(plan, sessions, NOW);
    expect(flow.blocks[0].status).toBe("terminé");
    expect(flow.allDone).toBe(true);
  });

  it("plusieurs matières : allDone seulement quand TOUTES sont terminées", () => {
    let plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 45);
    plan = setDayCellMinutes(plan, 0, "Physique", 45);
    const sessions = [makeSession({ subject: "Mathématiques", duration_seconds: 50 * 60 })];
    const flow = computeDayFlow(plan, sessions, NOW);
    expect(flow.allDone).toBe(false);
    const bothDone = [...sessions, makeSession({ subject: "Physique", duration_seconds: 50 * 60 })];
    expect(computeDayFlow(plan, bothDone, NOW).allDone).toBe(true);
  });

  it("ignore les séances d'un autre jour de la semaine", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 45);
    const sessions = [makeSession({ subject: "Mathématiques", duration_seconds: 50 * 60, started_at: "2026-08-23T09:00:00.000Z" })];
    const flow = computeDayFlow(plan, sessions, NOW);
    expect(flow.blocks[0]).toMatchObject({ workedMinutes: 0, status: "à venir" });
  });
});
