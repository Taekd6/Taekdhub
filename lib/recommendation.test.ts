import { describe, expect, it } from "vitest";
import { computeExerciseBankStats, isNeverWorked, recommendExercises } from "@/lib/recommendation";
import type { Exercise, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

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
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

function makeSession(exerciseId: string, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${exerciseId}-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: exerciseId,
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T00:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-01-01T00:10:00.000Z",
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T12:00:00.000Z");

describe("recommendExercises — inclusion et raisons", () => {
  it("inclut un exercice jamais travaillé, avec la raison correspondante", () => {
    const exercise = makeExercise();
    const [result] = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result.exercise.id).toBe(exercise.id);
    expect(result.reasons).toContain("Jamais travaillé");
  });

  it("exclut un exercice maîtrisé, retravaillé récemment, sans autre signal", () => {
    const exercise = makeExercise({
      status: "maîtrisé",
      mastery: 100,
      priority: 1,
      attempts: 3,
      last_worked_at: "2026-08-09T00:00:00.000Z",
    });
    const sessions = [makeSession(exercise.id)];
    const result = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it("n'inclut jamais un exercice pour la seule raison qu'il est favori", () => {
    const exercise = makeExercise({
      status: "maîtrisé",
      mastery: 100,
      priority: 1,
      favorite: true,
      attempts: 3,
      last_worked_at: "2026-08-09T00:00:00.000Z",
    });
    const sessions = [makeSession(exercise.id)];
    const result = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it("archivé : jamais recommandé, même sinon éligible", () => {
    const exercise = makeExercise({ archived: true });
    const result = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result).toHaveLength(0);
  });
});

describe("recommendExercises — favoris", () => {
  it("ajoute la raison Favori et fait remonter un exercice favori parmi deux exercices par ailleurs identiques", () => {
    const plain = makeExercise({ status: "à revoir", mastery: 25, priority: 3 });
    const favorite = makeExercise({ status: "à revoir", mastery: 25, priority: 3, favorite: true });
    const result = recommendExercises([plain, favorite], [], 10, { now: NOW });

    const favoriteResult = result.find((r) => r.exercise.id === favorite.id)!;
    const plainResult = result.find((r) => r.exercise.id === plain.id)!;
    expect(favoriteResult.reasons).toContain("Favori");
    expect(plainResult.reasons).not.toContain("Favori");
    expect(favoriteResult.score).toBeGreaterThan(plainResult.score);
    expect(result.findIndex((r) => r.exercise.id === favorite.id)).toBeLessThan(result.findIndex((r) => r.exercise.id === plain.id));
  });
});

describe("recommendExercises — diversité de chapitre", () => {
  it("alterne les chapitres plutôt que de vider le premier chapitre en premier", () => {
    // 4 exercices très urgents dans le chapitre A (mastery 0, jamais
    // travaillé), 2 exercices dans le chapitre B avec un score légèrement
    // inférieur (mastery non nulle) — sans diversification, les 4 du
    // chapitre A occuperaient tout le top 4 avant même de voir B.
    const chapterA = Array.from({ length: 4 }, (_, i) => makeExercise({ chapter_id: "chap-A", mastery: 0, priority: 5 }));
    const chapterB = Array.from({ length: 2 }, (_, i) => makeExercise({ chapter_id: "chap-B", mastery: 25, priority: 4 }));

    const result = recommendExercises([...chapterA, ...chapterB], [], 4, { now: NOW });

    expect(result).toHaveLength(4);
    const chapters = result.map((r) => r.exercise.chapter_id);
    // Les deux chapitres doivent apparaître dans les 4 premiers — c'est
    // précisément ce que le tri par score seul ne garantirait pas ici.
    expect(new Set(chapters)).toEqual(new Set(["chap-A", "chap-B"]));
    expect(chapters.filter((c) => c === "chap-B").length).toBeGreaterThan(0);
  });

  it("ne perd aucun candidat : un chapitre épuisé n'empêche pas de remplir la limite avec les autres", () => {
    const single = makeExercise({ chapter_id: "chap-solo", mastery: 0 });
    const others = Array.from({ length: 3 }, () => makeExercise({ chapter_id: "chap-multi", mastery: 0 }));
    const result = recommendExercises([single, ...others], [], 4, { now: NOW });
    expect(result).toHaveLength(4);
  });

  it("traite les exercices sans chapitre comme un groupe à part, par matière", () => {
    const noChapterMaths = makeExercise({ chapter_id: null, subject: "Mathématiques", mastery: 0 });
    const noChapterPhysique = makeExercise({ chapter_id: null, subject: "Physique", mastery: 0 });
    const result = recommendExercises([noChapterMaths, noChapterPhysique], [], 2, { now: NOW });
    expect(result).toHaveLength(2);
  });
});

describe("recommendExercises — budget de temps (comportement existant préservé)", () => {
  it("ne dépasse jamais le budget disponible", () => {
    const exercises = [
      makeExercise({ mastery: 0, estimated_minutes: 20 }),
      makeExercise({ mastery: 0, estimated_minutes: 15 }),
      makeExercise({ mastery: 0, estimated_minutes: 10 }),
    ];
    const result = recommendExercises(exercises, [], 10, { now: NOW, availableMinutes: 25 });
    const total = result.reduce((sum, r) => sum + (r.exercise.estimated_minutes ?? 0), 0);
    expect(total).toBeLessThanOrEqual(25);
  });
});

describe("isNeverWorked / computeExerciseBankStats — smoke tests de non-régression", () => {
  it("isNeverWorked vrai seulement sans tentative ni minute", () => {
    expect(isNeverWorked(makeExercise({ attempts: 0 }), 0)).toBe(true);
    expect(isNeverWorked(makeExercise({ attempts: 1 }), 0)).toBe(false);
    expect(isNeverWorked(makeExercise({ attempts: 0 }), 5)).toBe(false);
  });

  it("computeExerciseBankStats agrège sans lever d'exception sur une banque vide", () => {
    const stats = computeExerciseBankStats([], [], NOW);
    expect(stats).toEqual({ toReviewCount: 0, averageMastery: 0, averagePriority: 0, neverWorkedCount: 0 });
  });
});
