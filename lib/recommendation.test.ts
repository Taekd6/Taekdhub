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
    const chapterA = Array.from({ length: 4 }, () => makeExercise({ chapter_id: "chap-A", mastery: 0, priority: 5 }));
    const chapterB = Array.from({ length: 2 }, () => makeExercise({ chapter_id: "chap-B", mastery: 25, priority: 4 }));

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

describe("recommendExercises — signaux échec/réussite (Sprint 5)", () => {
  it("un échec récent suffit à inclure un exercice par ailleurs neutre, avec la raison 'Échec récent'", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" })];
    const [result] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toBeDefined();
    expect(result.reasons).toContain("Échec récent");
  });

  it("plusieurs échecs récents remplacent la raison par 'Plusieurs échecs' et augmentent le score par rapport à un seul échec", () => {
    const single = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const singleSessions = [makeSession(single.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" })];

    const repeated = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const repeatedSessions = [
      makeSession(repeated.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" }),
      makeSession(repeated.id, { started_at: "2026-08-08T00:00:00.000Z", result: "échoué" }),
      makeSession(repeated.id, { started_at: "2026-08-07T00:00:00.000Z", result: "réussi" }),
    ];

    const [singleResult] = recommendExercises([single], singleSessions, 10, { now: NOW });
    const [repeatedResult] = recommendExercises([repeated], repeatedSessions, 10, { now: NOW });

    expect(singleResult.reasons).toContain("Échec récent");
    expect(repeatedResult.reasons).toContain("Plusieurs échecs");
    expect(repeatedResult.reasons).not.toContain("Échec récent");
    expect(repeatedResult.score).toBeGreaterThan(singleResult.score);
  });

  it("une réussite récente n'inclut jamais un exercice à elle seule (même logique que Favori)", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi" })];
    const result = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it("une série de réussites fait redescendre le score d'un exercice déjà retenu par ailleurs, sans jamais l'exclure", () => {
    const noStreak = makeExercise({ status: "à revoir", mastery: 25, priority: 3 });
    const withStreak = makeExercise({ status: "à revoir", mastery: 25, priority: 3 });
    const streakSessions = [
      makeSession(withStreak.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi" }),
      makeSession(withStreak.id, { started_at: "2026-08-08T00:00:00.000Z", result: "réussi" }),
      makeSession(withStreak.id, { started_at: "2026-08-07T00:00:00.000Z", result: "réussi" }),
    ];

    const result = recommendExercises([noStreak, withStreak], streakSessions, 10, { now: NOW });
    const noStreakResult = result.find((r) => r.exercise.id === noStreak.id)!;
    const withStreakResult = result.find((r) => r.exercise.id === withStreak.id)!;

    expect(withStreakResult.reasons).toContain("Réussi récemment");
    expect(withStreakResult.score).toBeLessThan(noStreakResult.score);
    // Toujours retenu — "à revoir" reste "à revoir" malgré les réussites.
    expect(withStreakResult).toBeDefined();
  });

  it("une séance sans résultat (result: null) n'a aucun effet — comportement 'jamais tenté'/'à revoir' inchangé", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { result: null })];
    const [result] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result.reasons).not.toContain("Échec récent");
    expect(result.reasons).not.toContain("Plusieurs échecs");
    expect(result.reasons).not.toContain("Réussi récemment");
  });

  it("un exercice jamais travaillé garde exactement 'Jamais travaillé', sans signal échec/réussite parasite", () => {
    const exercise = makeExercise({ mastery: 50, priority: 3, status: "à faire" });
    const [result] = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result.reasons).toEqual(["Jamais travaillé"]);
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

/**
 * Audit bout-en-bout /exercises ↔ recommandations ↔ Plan du jour ↔
 * SessionRunner : `recommendExercises` est une fonction pure (aucun effet de
 * bord, aucune source d'aléa) — son déterminisme découle normalement de sa
 * seule transparence référentielle, mais ce sont justement les bornes de
 * `limit` (0, 1, taille exacte, au-delà de la taille réelle) qui n'avaient
 * jamais été testées explicitement alors que `selectWithinBudget` et
 * `diversifyByChapter` bouclent tous les deux sur ces valeurs.
 */
describe("recommendExercises — déterminisme", () => {
  it("deux appels avec exactement les mêmes entrées renvoient la même sélection, dans le même ordre", () => {
    const exercises = [
      makeExercise({ priority: 5, mastery: 25 }),
      makeExercise({ priority: 2, mastery: 50, status: "à revoir" }),
      makeExercise({ priority: 4, mastery: 0, favorite: true }),
    ];
    const first = recommendExercises(exercises, [], 10, { now: NOW });
    const second = recommendExercises(exercises, [], 10, { now: NOW });
    expect(second.map((r) => r.exercise.id)).toEqual(first.map((r) => r.exercise.id));
    expect(second.map((r) => r.score)).toEqual(first.map((r) => r.score));
  });

  it("changer uniquement le budget de temps ne change que ce qui tient dedans, jamais l'ordre des candidats retenus", () => {
    const exercises = [
      makeExercise({ priority: 5, mastery: 0, estimated_minutes: 10 }),
      makeExercise({ priority: 4, mastery: 0, estimated_minutes: 10 }),
      makeExercise({ priority: 3, mastery: 0, estimated_minutes: 10 }),
    ];
    const wide = recommendExercises(exercises, [], 10, { now: NOW, availableMinutes: 30 });
    const narrow = recommendExercises(exercises, [], 10, { now: NOW, availableMinutes: 10 });
    expect(narrow.map((r) => r.exercise.id)).toEqual(wide.slice(0, narrow.length).map((r) => r.exercise.id));
  });
});

describe("recommendExercises — bornes de limit", () => {
  it("limit = 0 renvoie un tableau vide, jamais une exception", () => {
    const exercises = [makeExercise({ priority: 5, mastery: 0 })];
    expect(recommendExercises(exercises, [], 0, { now: NOW })).toEqual([]);
    expect(recommendExercises(exercises, [], 0, { now: NOW, availableMinutes: 60 })).toEqual([]);
  });

  it("limit = 1 renvoie exactement le meilleur candidat", () => {
    const weak = makeExercise({ priority: 5, mastery: 0 });
    const mild = makeExercise({ priority: 2, mastery: 50, status: "à revoir" });
    const [result] = recommendExercises([mild, weak], [], 1, { now: NOW });
    expect(recommendExercises([mild, weak], [], 1, { now: NOW })).toHaveLength(1);
    expect(result.exercise.id).toBe(weak.id);
  });

  it("limit égale au nombre d'éligibles : tous renvoyés, aucun doublon", () => {
    const exercises = Array.from({ length: 5 }, () => makeExercise({ priority: 5, mastery: 0 }));
    const result = recommendExercises(exercises, [], exercises.length, { now: NOW });
    expect(result).toHaveLength(5);
    expect(new Set(result.map((r) => r.exercise.id)).size).toBe(5);
  });

  it("limit supérieure au nombre d'éligibles : renvoie tous les éligibles, sans jamais fabriquer une entrée vide", () => {
    const exercises = Array.from({ length: 3 }, () => makeExercise({ priority: 5, mastery: 0 }));
    const result = recommendExercises(exercises, [], 999, { now: NOW });
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.exercise !== undefined)).toBe(true);
  });

  it("aucun exercice éligible : tableau vide, pas d'exception, quelle que soit la limite", () => {
    // `attempts > 0` : sans ça, `isNeverWorked` resterait vrai malgré status/mastery
    // (voir evaluateExercise, lib/recommendation.ts) — "Jamais travaillé" est un
    // critère d'inclusion indépendant du statut, intentionnellement.
    const mastered = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 3, last_worked_at: NOW.toISOString() });
    expect(recommendExercises([mastered], [], 10, { now: NOW })).toEqual([]);
    expect(recommendExercises([], [], 10, { now: NOW })).toEqual([]);
  });

  it("un exercice archivé n'est jamais compté dans une limite large, même s'il serait par ailleurs éligible", () => {
    const archived = makeExercise({ priority: 5, mastery: 0, archived: true });
    const eligible = makeExercise({ priority: 5, mastery: 0 });
    const result = recommendExercises([archived, eligible], [], 10, { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].exercise.id).toBe(eligible.id);
  });
});
