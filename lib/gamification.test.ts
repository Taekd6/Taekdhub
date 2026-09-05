import { describe, expect, it } from "vitest";
import { computeStreak, totalXp, xpFromSession } from "@/lib/gamification";
import type { Exercise, Mastery, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title: `Exercice ${counter}`, statement: "",
    chapter_id: null, source: "Test", year: null, competition: null, programme_level: null,
    license_status: null, external_id: null,
  epreuve: null,
  filieres: [],
  exercise_number: null,
  provenance: "originale", source_url: null, prerequisites: [],
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

/**
 * Un système de points se juge à ce qu'on peut en tirer SANS travailler.
 * Ces tests verrouillent les trois chemins qui rapportaient gros pour rien —
 * ils doivent échouer si l'un d'eux se rouvre.
 */
describe("XP — failles d'exploitation", () => {
  it("cocher « maîtrisé » sans aucune trace de travail ne rapporte RIEN", () => {
    const declared = makeExercise({ status: "maîtrisé", difficulty: 5 });
    expect(totalXp([declared], [])).toBe(0);
  });

  it("… mais rapporte dès qu'une réussite autonome le prouve", () => {
    const proven = makeExercise({ status: "maîtrisé", difficulty: 5 });
    const xp = totalXp([proven], [makeSession({ exercise_id: proven.id, result: "réussi", hints_used: 0, duration_seconds: 900 })]);
    expect(xp).toBe(5 * 25 + 5 * 10);
  });

  it("une réussite prouvée seulement à coups d'indices ne débloque pas l'XP de maîtrise", () => {
    const assisted = makeExercise({ status: "maîtrisé", difficulty: 4 });
    const xp = totalXp([assisted], [makeSession({ exercise_id: assisted.id, result: "réussi", hints_used: 3, duration_seconds: 900 })]);
    expect(xp).toBe(4 * 5);
  });

  it("ouvrir puis refermer le focus en deux secondes en cochant « Réussi » ne rapporte RIEN", () => {
    const exercise = makeExercise({ difficulty: 5 });
    const farmed = Array.from({ length: 20 }, () =>
      makeSession({ exercise_id: exercise.id, result: "réussi", hints_used: 0, duration_seconds: 2 })
    );
    expect(totalXp([exercise], farmed)).toBe(0);
  });

  it("réussir vingt fois le même exercice ne paie que deux fois, la seconde à moitié prix", () => {
    const exercise = makeExercise({ difficulty: 3 });
    const repeats = Array.from({ length: 20 }, (_, index) =>
      makeSession({
        id: `rep-${index}`,
        exercise_id: exercise.id,
        result: "réussi",
        hints_used: 0,
        duration_seconds: 900,
        started_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      })
    );
    expect(totalXp([exercise], repeats)).toBe(3 * 10 + 3 * 10 * 0.5);
  });

  it("réussir vingt exercices DIFFÉRENTS paie vingt fois — la quantité de travail réel reste récompensée", () => {
    const exercises = Array.from({ length: 20 }, () => makeExercise({ difficulty: 3 }));
    const sessions = exercises.map((exercise) =>
      makeSession({ exercise_id: exercise.id, result: "réussi", hints_used: 0, duration_seconds: 900 })
    );
    expect(totalXp(exercises, sessions)).toBe(20 * 3 * 10);
  });
});

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
