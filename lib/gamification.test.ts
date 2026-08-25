import { describe, expect, it } from "vitest";
import { totalXp, xpFromSession } from "@/lib/gamification";
import type { Exercise, Mastery, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title: `Exercice ${counter}`, statement: "",
    chapter_id: null, source: "Test", year: null, competition: null, programme_level: null,
    license_status: null, external_id: null, source_url: null, prerequisites: [],
    pedagogical_goal: null, level: null, type: "TD", difficulty: 3,
    mastery: 0 as Mastery, status: "à faire", estimated_minutes: null, attempts: 0, note: null,
    created_at: now, updated_at: now, tags: [], favorite: false, archived: false, hints: [],
    correction: null, last_worked_at: null, ...overrides,
  };
}

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`, subject: "Mathématiques", exercise_id: null,
    started_at: "2026-01-01T00:00:00.000Z", ended_at: null, duration_seconds: 600,
    note: null, created_at: "2026-01-01T00:00:00.000Z", result: null, hints_used: null,
    ...overrides,
  };
}

/**
 * L'XP ne doit récompenser que l'apprentissage prouvé. L'ancienne formule
 * accordait `minutes × 5` à toute séance : rester devant l'application sans
 * rien résoudre rapportait autant que résoudre. Ces tests verrouillent le
 * nouveau contrat.
 */
describe("XP — récompense l'apprentissage, pas le temps passé", () => {
  it("une séance longue sans aucun résultat ne rapporte RIEN", () => {
    expect(xpFromSession(makeSession({ duration_seconds: 3 * 3600 }))).toBe(0);
  });

  it("une séance courte mais réussie rapporte plus qu'une séance longue sans résultat", () => {
    const long = xpFromSession(makeSession({ duration_seconds: 7200 }));
    const short = xpFromSession(makeSession({ duration_seconds: 120, result: "réussi", hints_used: 0 }), 3);
    expect(short).toBeGreaterThan(long);
  });

  it("une réussite autonome rapporte davantage qu'une réussite très assistée", () => {
    const alone = xpFromSession(makeSession({ result: "réussi", hints_used: 0 }), 3);
    const assisted = xpFromSession(makeSession({ result: "réussi", hints_used: 3 }), 3);
    expect(alone).toBeGreaterThan(assisted);
    expect(assisted).toBeGreaterThan(0); // une progression guidée reste une progression
  });

  it("à autonomie égale, un exercice plus difficile rapporte davantage", () => {
    const easy = xpFromSession(makeSession({ result: "réussi", hints_used: 0 }), 1);
    const hard = xpFromSession(makeSession({ result: "réussi", hints_used: 0 }), 5);
    expect(hard).toBeGreaterThan(easy);
  });

  it("un échec ne rapporte rien mais ne retire rien", () => {
    expect(xpFromSession(makeSession({ result: "échoué" }), 4)).toBe(0);
  });

  it("une réussite partielle rapporte moins qu'une réussite complète, mais plus que rien", () => {
    const partial = xpFromSession(makeSession({ result: "partiel" }), 3);
    const full = xpFromSession(makeSession({ result: "réussi", hints_used: 0 }), 3);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(full);
  });

  it("MIGRATION : un historique pré-résultats ne rapporte rien rétroactivement (on ne sait pas ce qui s'y est passé)", () => {
    const legacy = Array.from({ length: 50 }, () => makeSession({ duration_seconds: 3600, result: null }));
    expect(totalXp([], legacy)).toBe(0);
  });

  it("totalXp pondère chaque séance par la difficulté de SON exercice", () => {
    const easy = makeExercise({ difficulty: 1 });
    const hard = makeExercise({ difficulty: 5 });
    const xpEasy = totalXp([easy], [makeSession({ exercise_id: easy.id, result: "réussi", hints_used: 0 })]);
    const xpHard = totalXp([hard], [makeSession({ exercise_id: hard.id, result: "réussi", hints_used: 0 })]);
    expect(xpHard).toBeGreaterThan(xpEasy);
  });
});
