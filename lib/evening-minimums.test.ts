import { describe, expect, it } from "vitest";
import { effectiveDailyGoal, eveningPlan } from "@/lib/evening-minimums";
import { normalizePreferences } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const prefs = normalizePreferences({ dailyGoalMinutes: 60 });
// 2026-09-28 est un lundi, 2026-09-29 un mardi.
const monday = new Date(2026, 8, 28, 21, 0);
const tuesday = new Date(2026, 8, 29, 21, 0);

function session(subject: Subject, start: Date, minutes: number): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject,
    exercise_id: null,
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + minutes * 60000).toISOString(),
    duration_seconds: minutes * 60,
    note: null,
    created_at: start.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

describe("minimum du soir", () => {
  it("par défaut : 2 h de maths et 1 h 30 de physique en semaine, sauf le mardi", () => {
    expect(prefs.eveningMinimums[0]).toEqual({ Mathématiques: 120, Physique: 90 });
    expect(prefs.eveningMinimums[1]).toEqual({});
    expect(prefs.eveningMinimums.slice(2, 5)).toEqual([
      { Mathématiques: 120, Physique: 90 },
      { Mathématiques: 120, Physique: 90 },
      { Mathématiques: 120, Physique: 90 },
    ]);
    expect(prefs.eveningMinimums[5]).toEqual({});
    expect(prefs.eveningMinimums[6]).toEqual({});
  });

  it("compte le temps de la journée par matière", () => {
    const plan = eveningPlan(prefs, [session("Mathématiques", new Date(2026, 8, 28, 12), 45), session("Mathématiques", new Date(2026, 8, 28, 19), 80), session("Physique", new Date(2026, 8, 28, 18), 30)], monday);
    expect(plan.entries.map((entry) => [entry.subject, entry.doneMinutes, entry.met])).toEqual([
      ["Mathématiques", 125, true],
      ["Physique", 30, false],
    ]);
    expect(plan.totalMinMinutes).toBe(210);
    expect(plan.allMet).toBe(false);
  });

  it("le mardi est libre", () => {
    expect(eveningPlan(prefs, [], tuesday).entries).toEqual([]);
    expect(effectiveDailyGoal(prefs, tuesday)).toBe(60);
  });

  it("l'objectif du jour ne descend jamais sous les minimums", () => {
    expect(effectiveDailyGoal(prefs, monday)).toBe(210);
    expect(effectiveDailyGoal({ ...prefs, dailyGoalMinutes: 300 }, monday)).toBe(300);
  });

  it("normalise une saisie abîmée : 0 retiré, plafond, 7 jours", () => {
    const custom = normalizePreferences({ eveningMinimums: [{ Mathématiques: 0, Physique: 9999, Latin: 30 }] }).eveningMinimums;
    expect(custom).toHaveLength(7);
    expect(custom[0]).toEqual({ Physique: 480 });
    expect(custom[1]).toEqual({});
  });
});
