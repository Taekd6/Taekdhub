import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/gamification";
import type { WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`, subject: "Mathématiques", exercise_id: null,
    started_at: "2026-01-01T00:00:00.000Z", ended_at: null, duration_seconds: 600,
    note: null, created_at: "2026-01-01T00:00:00.000Z", result: null, hints_used: null, work_item_id: null,
    ...overrides,
  };
}

describe("Série (streak)", () => {
  const NOW = new Date("2026-03-10T18:00:00.000Z");
  const day = (offset: number, seconds: number) =>
    makeSession({
      id: `d-${offset}`,
      duration_seconds: seconds,
      started_at: new Date(NOW.getTime() - offset * 86400000).toISOString(),
    });

  it("compte les jours consécutifs d'au moins une minute", () => {
    expect(computeStreak([day(0, 900), day(1, 900), day(2, 900)], NOW)).toBe(3);
  });

  it("une visite de deux secondes ne tient pas la série", () => {
    expect(computeStreak([day(0, 2), day(1, 900)], NOW)).toBe(1);
  });

  it("ne remet pas la série à zéro tant que la journée n'a rien enregistré", () => {
    expect(computeStreak([day(1, 900), day(2, 900), day(3, 900)], NOW)).toBe(3);
  });

  it("une journée entièrement sautée casse bien la série", () => {
    expect(computeStreak([day(1, 900), day(3, 900)], NOW)).toBe(1);
  });
});
