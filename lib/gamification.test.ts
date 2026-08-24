import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/gamification";
import type { WorkSession } from "@/lib/supabase/types";

function makeSession(startedAt: string, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${startedAt}-${Math.random()}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: 600,
    note: null,
    created_at: startedAt,
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-20T18:00:00.000Z"); // jeudi

describe("computeStreak", () => {
  it("aucune séance : série nulle", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("séance aujourd'hui seulement : série de 1", () => {
    const sessions = [makeSession("2026-08-20T09:00:00.000Z")];
    expect(computeStreak(sessions, NOW)).toBe(1);
  });

  it("plusieurs jours consécutifs jusqu'à aujourd'hui : compte chaque jour", () => {
    const sessions = [
      makeSession("2026-08-20T09:00:00.000Z"),
      makeSession("2026-08-19T09:00:00.000Z"),
      makeSession("2026-08-18T09:00:00.000Z"),
    ];
    expect(computeStreak(sessions, NOW)).toBe(3);
  });

  it("rien aujourd'hui mais série continue hier : la série reste active, jamais remise à 0 avant la fin de la journée", () => {
    const sessions = [
      makeSession("2026-08-19T09:00:00.000Z"),
      makeSession("2026-08-18T09:00:00.000Z"),
      makeSession("2026-08-17T09:00:00.000Z"),
    ];
    expect(computeStreak(sessions, NOW)).toBe(3);
  });

  it("rien aujourd'hui ni hier : série réellement rompue, 0", () => {
    const sessions = [makeSession("2026-08-18T09:00:00.000Z"), makeSession("2026-08-17T09:00:00.000Z")];
    expect(computeStreak(sessions, NOW)).toBe(0);
  });

  it("un trou dans le passé n'affecte pas la série en cours (seule la série continue depuis aujourd'hui/hier compte)", () => {
    const sessions = [
      makeSession("2026-08-20T09:00:00.000Z"),
      makeSession("2026-08-19T09:00:00.000Z"),
      // trou le 18
      makeSession("2026-08-10T09:00:00.000Z"),
    ];
    expect(computeStreak(sessions, NOW)).toBe(2);
  });

  it("plusieurs séances le même jour ne comptent qu'une fois pour ce jour", () => {
    const sessions = [
      makeSession("2026-08-20T09:00:00.000Z"),
      makeSession("2026-08-20T14:00:00.000Z"),
      makeSession("2026-08-19T09:00:00.000Z"),
    ];
    expect(computeStreak(sessions, NOW)).toBe(2);
  });
});
