import { describe, expect, it } from "vitest";
import { todaySecondsBySubject } from "@/lib/study";
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

const NOW = new Date("2026-08-24T18:00:00.000Z");

describe("todaySecondsBySubject", () => {
  it("regroupe le temps d'aujourd'hui par matière, ignore les autres jours", () => {
    const sessions = [
      makeSession({ subject: "Mathématiques", duration_seconds: 600, started_at: "2026-08-24T09:00:00.000Z" }),
      makeSession({ subject: "Mathématiques", duration_seconds: 300, started_at: "2026-08-24T11:00:00.000Z" }),
      makeSession({ subject: "Physique", duration_seconds: 900, started_at: "2026-08-24T14:00:00.000Z" }),
      makeSession({ subject: "Physique", duration_seconds: 1200, started_at: "2026-08-23T14:00:00.000Z" }), // hier, ignoré
    ];
    expect(todaySecondsBySubject(sessions, NOW)).toEqual({ Mathématiques: 900, Physique: 900 });
  });

  it("aucune séance aujourd'hui : objet vide, aucune matière forcée à 0", () => {
    expect(todaySecondsBySubject([], NOW)).toEqual({});
  });
});
