import { describe, expect, it } from "vitest";
import { computeReadinessBySubject } from "@/lib/readiness";
import type { Exercise, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`,
    subject: "Mathématiques",
    title: `Exercice ${counter}`,
    statement: "",
    chapter_id: null,
    source: "Test",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    priority: 3 as Priority,
    mastery: 0 as Mastery,
    status: "à faire",
    estimated_minutes: null,
    attempts: 0,
    note: null,
    created_at: now,
    updated_at: now,
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    answer: null,
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T12:00:00.000Z");

describe("computeReadinessBySubject — signaux échéance/plan (Sprint Study OS Phase 5)", () => {
  it("sans signaux, comportement strictement inchangé (aucun exercice signalé → prêt)", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, priority: 2, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const withoutArg = computeReadinessBySubject([exercise], [], NOW);
    const withEmpty = computeReadinessBySubject([exercise], [], NOW, {});
    expect(withEmpty).toEqual(withoutArg);
    expect(withoutArg[0].level).toBe("prêt");
  });

  it("une échéance de chapitre imminente ne laisse plus une matière 'Prêt' à tort — corrige la contradiction avec le Hero du Dashboard", () => {
    // Exercice neutre : sans signal, non signalé (donc "prêt" par défaut).
    const exercise = makeExercise({ chapter_id: "c-continuite", status: "à faire", priority: 2, mastery: 50, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const withoutSignal = computeReadinessBySubject([exercise], [], NOW);
    expect(withoutSignal[0].level).toBe("prêt");

    const withSignal = computeReadinessBySubject([exercise], [], NOW, {
      chapterDeadlines: new Map([["c-continuite", { days: 2, label: "ton DS de Mathématiques dans 2 j" }]]),
    });
    expect(withSignal[0].level).not.toBe("prêt");
    expect(withSignal[0].flaggedCount).toBe(1);
  });
});
