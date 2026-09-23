import { describe, expect, it } from "vitest";
import { computeDailyObjective, computeStatusLine } from "@/lib/daily-objective";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/*
 * Repris tels quels de l'ancien lib/next-action.test.ts : l'objectif du jour
 * a survécu au retrait de la banque d'exercices, ses tests aussi.
 */

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: null,
    started_at: "2026-08-10T08:00:00.000Z",
    ended_at: "2026-08-10T08:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T08:10:00.000Z",
    result: null,
    hints_used: null,
    work_item_id: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T12:00:00.000Z");

describe("computeDailyObjective", () => {
  it("aucune séance aujourd'hui : 0 travaillé, tout l'objectif restant", () => {
    const objective = computeDailyObjective([], 45, NOW);
    expect(objective).toEqual({ goalMinutes: 45, workedMinutes: 0, remainingMinutes: 45, percent: 0, met: false });
  });

  it("objectif partiellement atteint : temps travaillé et restant cohérents", () => {
    const sessions = [makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 23 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.workedMinutes).toBe(23);
    expect(objective.remainingMinutes).toBe(22);
    expect(objective.percent).toBe(Math.round((23 / 45) * 100));
    expect(objective.met).toBe(false);
  });

  it("objectif dépassé : remainingMinutes reste à 0, jamais négatif", () => {
    const sessions = [makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 60 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.remainingMinutes).toBe(0);
    expect(objective.percent).toBe(100);
    expect(objective.met).toBe(true);
  });

  it("les séances d'hier ne comptent pas dans l'objectif du jour", () => {
    const sessions = [makeSession({ started_at: "2026-08-09T09:00:00.000Z", duration_seconds: 3600 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.workedMinutes).toBe(0);
  });
});

describe("computeStatusLine", () => {
  it("objectif atteint : message positif", () => {
    const sessions = [makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 60 * 60 })];
    expect(computeStatusLine(computeDailyObjective(sessions, 45, NOW))).toMatch(/atteint/);
  });

  it("rien travaillé aujourd'hui : message dédié", () => {
    expect(computeStatusLine(computeDailyObjective([], 45, NOW))).toBe("Tu n'as encore rien travaillé aujourd'hui.");
  });

  it("progression partielle : reprend le temps travaillé et restant", () => {
    const sessions = [makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 20 * 60 })];
    const line = computeStatusLine(computeDailyObjective(sessions, 45, NOW));
    expect(line).toContain("20 min");
    expect(line).toContain("25 min");
  });
});
