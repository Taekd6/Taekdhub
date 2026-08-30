import { describe, expect, it } from "vitest";
import { recentDaySummaries } from "@/lib/history";
import type { Subject, WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: null,
    started_at: "2026-08-10T09:00:00.000Z",
    ended_at: "2026-08-10T09:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T09:10:00.000Z",
    result: null,
    hints_used: null,
    correction_viewed: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T18:00:00.000Z");

describe("recentDaySummaries", () => {
  it("aucune séance : liste vide", () => {
    expect(recentDaySummaries([], NOW)).toEqual([]);
  });

  it("regroupe le temps et le nombre de séances par jour, le plus récent d'abord", () => {
    const sessions = [
      makeSession({ started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 1500 }),
      makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 1200 }),
      makeSession({ started_at: "2026-08-09T08:00:00.000Z", duration_seconds: 1920 }),
    ];
    const days = recentDaySummaries(sessions, NOW);
    expect(days).toHaveLength(2);
    expect(days[0].label).toBe("Aujourd'hui");
    expect(days[0].seconds).toBe(2700);
    expect(days[0].sessionCount).toBe(2);
    expect(days[1].label).toBe("Hier");
    expect(days[1].seconds).toBe(1920);
    expect(days[1].sessionCount).toBe(1);
  });

  it("respecte la limite fournie", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ started_at: `2026-08-${String(10 - i).padStart(2, "0")}T08:00:00.000Z` })
    );
    const days = recentDaySummaries(sessions, NOW, 3);
    expect(days).toHaveLength(3);
  });
});
