import { describe, expect, it } from "vitest";
import { computePreparationPlan, computePreparationSnapshot } from "@/lib/preparation-os";
import type { Exercise, WorkSession } from "@/lib/supabase/types";
import type { Chapter } from "@/lib/storage";

let id = 0;
const exercise = (subject: Exercise["subject"], difficulty: Exercise["difficulty"] = 2, mastery: Exercise["mastery"] = 0): Exercise => ({
  id: `prep-${++id}`, subject, title: `Ex ${id}`, statement: "", chapter_id: null, source: "test", year: null,
  competition: null, programme_level: null, license_status: null, external_id: null, source_url: null,
  prerequisites: [], pedagogical_goal: null, level: null, type: "TD", difficulty, mastery,
  status: mastery === 100 ? "maîtrisé" : "à faire", estimated_minutes: 20, attempts: mastery === 100 ? 1 : 0,
  note: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", tags: [], favorite: false,
  archived: false, hints: [], correction: null, last_worked_at: mastery === 100 ? "2026-08-29T00:00:00.000Z" : null,
});
const session = (exerciseId: string): WorkSession => ({ id: `s-${exerciseId}`, subject: "Mathématiques", exercise_id: exerciseId, started_at: "2026-08-29T10:00:00.000Z", ended_at: "2026-08-29T10:20:00.000Z", duration_seconds: 1200, note: null, created_at: "2026-08-29T10:00:00.000Z", result: "réussi", hints_used: 0 });
const chapters: Chapter[] = [];

describe("preparation-os", () => {
  it("exposes each active subject with its real pending and mastery facts", () => {
    const maths = exercise("Mathématiques", 2, 100); const physics = exercise("Physique");
    const snapshot = computePreparationSnapshot([maths, physics], [session(maths.id)], chapters, new Date("2026-08-30T12:00:00.000Z"));
    expect(snapshot.subjects.find((s) => s.subject === "Mathématiques")?.completionRate).toBe(100);
    expect(snapshot.subjects.find((s) => s.subject === "Physique")?.pending).toBe(1);
  });
  it("does not claim a gap for a fully mastered subject", () => {
    const maths = exercise("Mathématiques", 2, 100);
    expect(computePreparationSnapshot([maths], [session(maths.id)], chapters).gaps).toEqual([]);
  });
  it("covers multiple subjects when the budget permits", () => {
    const xs = [exercise("Mathématiques"), exercise("Physique"), exercise("Chimie")];
    const plan = computePreparationPlan(xs, [], chapters, 60, new Date("2026-08-30T12:00:00.000Z"));
    expect(new Set(plan.items.map((item) => item.subject)).size).toBe(3);
    expect(plan.allocatedMinutes).toBe(60);
  });
  it("never exceeds the requested budget", () => {
    const xs = Array.from({ length: 8 }, () => exercise("Mathématiques"));
    const plan = computePreparationPlan(xs, [], chapters, 45);
    expect(plan.allocatedMinutes).toBeLessThanOrEqual(45);
  });
});
