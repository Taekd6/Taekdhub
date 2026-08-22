import { describe, expect, it } from "vitest";
import { groupSessionsByDay, recentDaySummaries } from "@/lib/history";
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

/**
 * Sprint poste de pilotage — répond directement à "sur quoi ai-je travaillé
 * mardi ?" en regroupant l'historique par jour civil, plutôt qu'une liste
 * chronologique plate à parcourir séance par séance.
 */
describe("groupSessionsByDay", () => {
  it("aucune séance : aucun groupe", () => {
    expect(groupSessionsByDay([], NOW)).toEqual([]);
  });

  it("regroupe les séances du même jour civil ensemble, dans l'ordre d'apparition", () => {
    const sessions = [
      makeSession({ id: "s1", started_at: "2026-08-10T08:00:00.000Z" }),
      makeSession({ id: "s2", started_at: "2026-08-10T14:00:00.000Z" }),
      makeSession({ id: "s3", started_at: "2026-08-09T08:00:00.000Z" }),
    ];
    const groups = groupSessionsByDay(sessions, NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Aujourd'hui");
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(groups[1].label).toBe("Hier");
    expect(groups[1].sessions.map((s) => s.id)).toEqual(["s3"]);
  });

  it("libellé du jour de la semaine pour une séance de moins de 7 jours (ex. mardi)", () => {
    // 2026-08-10 est un lundi ; 2026-08-04 (6 jours avant) est donc un mardi.
    const sessions = [makeSession({ started_at: "2026-08-04T08:00:00.000Z" })];
    const groups = groupSessionsByDay(sessions, NOW);
    expect(groups[0].label).toBe("Mardi");
  });

  it("ne perd et n'invente aucune séance : le total réparti égale l'entrée", () => {
    const sessions = [
      makeSession({ id: "a", started_at: "2026-08-10T08:00:00.000Z" }),
      makeSession({ id: "b", started_at: "2026-08-09T08:00:00.000Z" }),
      makeSession({ id: "c", started_at: "2026-08-08T08:00:00.000Z" }),
    ];
    const groups = groupSessionsByDay(sessions, NOW);
    const flattened = groups.flatMap((group) => group.sessions);
    expect(flattened).toHaveLength(3);
    expect(new Set(flattened.map((s) => s.id))).toEqual(new Set(["a", "b", "c"]));
  });
});
