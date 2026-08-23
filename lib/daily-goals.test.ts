import { describe, expect, it } from "vitest";
import { computeDailyObjectiveBreakdown } from "@/lib/daily-goals";
import type { Subject, WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: null,
    started_at: "2026-08-22T09:00:00.000Z",
    ended_at: "2026-08-22T09:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-22T09:10:00.000Z",
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-22T18:00:00.000Z");

describe("computeDailyObjectiveBreakdown", () => {
  it("aucun objectif configuré : bySubject vide, exercises null", () => {
    const result = computeDailyObjectiveBreakdown([], {}, null, NOW);
    expect(result.bySubject).toEqual([]);
    expect(result.exercises).toBeNull();
  });

  it("un objectif par matière, rien travaillé aujourd'hui : 0 min, non atteint", () => {
    const result = computeDailyObjectiveBreakdown([], { Mathématiques: 90 }, null, NOW);
    expect(result.bySubject).toEqual([{ subject: "Mathématiques", goalMinutes: 90, workedMinutes: 0, met: false }]);
  });

  it("temps travaillé aujourd'hui sur la matière, sous l'objectif", () => {
    const sessions = [makeSession({ subject: "Mathématiques", started_at: "2026-08-22T09:00:00.000Z", duration_seconds: 30 * 60 })];
    const result = computeDailyObjectiveBreakdown(sessions, { Mathématiques: 90 }, null, NOW);
    expect(result.bySubject[0]).toEqual({ subject: "Mathématiques", goalMinutes: 90, workedMinutes: 30, met: false });
  });

  it("objectif atteint ou dépassé sur une matière", () => {
    const sessions = [makeSession({ subject: "Physique", started_at: "2026-08-22T09:00:00.000Z", duration_seconds: 120 * 60 })];
    const result = computeDailyObjectiveBreakdown(sessions, { Physique: 60 }, null, NOW);
    expect(result.bySubject[0].met).toBe(true);
    expect(result.bySubject[0].workedMinutes).toBe(120);
  });

  it("seules les matières avec un objectif > 0 configuré apparaissent, jamais les 7 matières", () => {
    const result = computeDailyObjectiveBreakdown([], { Mathématiques: 60, Physique: 30 }, null, NOW);
    expect(result.bySubject.map((entry) => entry.subject)).toEqual(["Mathématiques", "Physique"]);
  });

  it("une séance d'hier n'est jamais comptée dans l'objectif du jour", () => {
    const sessions = [makeSession({ subject: "Mathématiques", started_at: "2026-08-21T09:00:00.000Z", duration_seconds: 3600 })];
    const result = computeDailyObjectiveBreakdown(sessions, { Mathématiques: 60 }, null, NOW);
    expect(result.bySubject[0].workedMinutes).toBe(0);
  });

  it("objectif de nombre d'exercices : compte les exercices DISTINCTS travaillés aujourd'hui", () => {
    const sessions = [
      makeSession({ exercise_id: "ex-1", started_at: "2026-08-22T08:00:00.000Z" }),
      makeSession({ exercise_id: "ex-1", started_at: "2026-08-22T09:00:00.000Z" }), // même exercice, deux séances : compté une seule fois
      makeSession({ exercise_id: "ex-2", started_at: "2026-08-22T10:00:00.000Z" }),
      makeSession({ exercise_id: null, started_at: "2026-08-22T11:00:00.000Z" }), // séance libre, sans exercice : jamais comptée
    ];
    const result = computeDailyObjectiveBreakdown(sessions, {}, 3, NOW);
    expect(result.exercises).toEqual({ goal: 3, worked: 2, met: false });
  });

  it("objectif de nombre d'exercices atteint", () => {
    const sessions = [
      makeSession({ exercise_id: "ex-1", started_at: "2026-08-22T08:00:00.000Z" }),
      makeSession({ exercise_id: "ex-2", started_at: "2026-08-22T09:00:00.000Z" }),
    ];
    const result = computeDailyObjectiveBreakdown(sessions, {}, 2, NOW);
    expect(result.exercises?.met).toBe(true);
  });
});
