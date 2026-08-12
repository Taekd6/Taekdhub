import { describe, expect, it } from "vitest";
import { computeWeeklySummary } from "@/lib/week";
import type { WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  counter += 1;
  return {
    id: `s-${counter}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-01-07T10:00:00.000Z",
    ended_at: null,
    duration_seconds: 0,
    note: null,
    created_at: "2026-01-07T10:00:00.000Z",
    result: null,
    ...overrides,
  };
}

describe("computeWeeklySummary — pace", () => {
  const MONDAY_MORNING = new Date("2026-01-05T08:00:00.000Z");
  const WEDNESDAY = new Date("2026-01-07T18:00:00.000Z"); // 2 jours écoulés depuis lundi

  it("ne juge pas trop tôt dans la semaine (lundi/mardi) — pace: null quel que soit le temps travaillé", () => {
    const sessions = [makeSession({ started_at: "2026-01-05T09:00:00.000Z", duration_seconds: 6000 })];
    const summary = computeWeeklySummary([], sessions, 100, MONDAY_MORNING);
    expect(summary.pace).toBeNull();
  });

  it("dans le rythme : progression proche de ce qu'attend le jour de la semaine (mercredi ≈ 2/7)", () => {
    // objectif 100 min = 6000s, attendu ≈ 29% à J+2 → viser une progression proche de 29%.
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 1740 })];
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("dans le rythme");
  });

  it("en avance : progression nettement au-dessus de l'attendu du jour", () => {
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 3000 })]; // 50%
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("en avance");
  });

  it("à travailler : progression nettement en dessous de l'attendu du jour", () => {
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 300 })]; // 5%
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("à travailler");
  });

  it("aucun objectif configuré (0 min) — pace reste dans une valeur cohérente, jamais une exception", () => {
    const summary = computeWeeklySummary([], [], 0, WEDNESDAY);
    expect(summary.progressPercent).toBe(0);
    expect(() => summary.pace).not.toThrow();
  });
});
