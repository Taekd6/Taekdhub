import { describe, expect, it } from "vitest";
import { computeExerciseBankStats, isNeverWorked, recentGlobalPerformance, recommendExercises } from "@/lib/recommendation";
import type { Difficulty, Exercise, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

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

/**
 * Sprint "Reprise MP" — `recentGlobalPerformance` : fonction pure, calculée
 * une seule fois par appel à `recommendExercises` (voir sa doc), jamais par
 * exercice. Testée isolément avant `difficultyFitBonus` pour ne pas mélanger
 * les deux dans un même test.
 */
describe("recentGlobalPerformance", () => {
  it("aucune séance avec résultat : count=0, rate=0", () => {
    expect(recentGlobalPerformance([])).toEqual({ rate: 0, count: 0 });
    const onlyNullResult = [makeSession("ex-1", { result: null })];
    expect(recentGlobalPerformance(onlyNullResult)).toEqual({ rate: 0, count: 0 });
  });

  it("ignore les séances sans résultat, ne compte que celles avec un résultat renseigné", () => {
    const sessions = [
      makeSession("ex-1", { started_at: "2026-08-09T00:00:00.000Z", result: "réussi" }),
      makeSession("ex-2", { started_at: "2026-08-08T00:00:00.000Z", result: null }),
      makeSession("ex-3", { started_at: "2026-08-07T00:00:00.000Z", result: "échoué" }),
    ];
    expect(recentGlobalPerformance(sessions)).toEqual({ rate: 0.5, count: 2 });
  });

  it("se limite aux 8 séances avec résultat les plus récentes, toutes matières confondues", () => {
    // 10 échecs anciens, puis 8 réussites récentes : seules les 8 réussites
    // doivent compter, quel que soit l'ordre de la liste passée en entrée.
    const old = Array.from({ length: 10 }, (_, i) =>
      makeSession(`old-${i}`, { started_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, result: "échoué" })
    );
    const recent = Array.from({ length: 8 }, (_, i) =>
      makeSession(`recent-${i}`, { started_at: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, result: "réussi" })
    );
    expect(recentGlobalPerformance([...old, ...recent])).toEqual({ rate: 1, count: 8 });
  });
});

/**
 * Sprint "Reprise MP" — `difficultyFitBonus` (interne à urgencyScore, testé
 * via son effet observable sur l'ordre/le score renvoyé par
 * `recommendExercises`, jamais importé directement — même convention que le
 * reste de ce fichier, qui teste toujours le comportement public).
 *
 * Terme volontairement borné (±12, comparable à favoriteBonus) : il ne
 * décide jamais seul de l'inclusion (voir `evaluateExercise`, inchangé),
 * seulement de l'ORDRE parmi des candidats déjà retenus.
 */
describe("recommendExercises — ajustement de difficulté (Sprint Reprise MP)", () => {
  function makeExerciseWithDifficulty(difficulty: Difficulty, overrides: Partial<Exercise> = {}) {
    return makeExercise({ status: "à revoir", mastery: 25, priority: 3, difficulty, ...overrides });
  }

  it("reprise (aucun historique) : à urgence égale par ailleurs, une difficulté 1-2 devance une difficulté 4-5", () => {
    const easy = makeExerciseWithDifficulty(1);
    const hard = makeExerciseWithDifficulty(5);
    const result = recommendExercises([easy, hard], [], 10, { now: NOW });
    const easyResult = result.find((r) => r.exercise.id === easy.id)!;
    const hardResult = result.find((r) => r.exercise.id === hard.id)!;
    expect(easyResult.score).toBeGreaterThan(hardResult.score);
    expect(result.findIndex((r) => r.exercise.id === easy.id)).toBeLessThan(result.findIndex((r) => r.exercise.id === hard.id));
  });

  it("reprise : une difficulté 3 (zone neutre) n'est ni avantagée ni pénalisée par rapport au comportement historique", () => {
    // `attempts: 1` désactive neverWorkedBonus pour isoler exactement les
    // termes déjà couverts par les tests existants — avec `sessions = []`, le
    // terme de difficulté doit valoir 0 pour une difficulté 3 : le score doit
    // donc être IDENTIQUE à celui calculé avant ce sprint (aucune régression
    // numérique sur le cas par défaut, qui utilise partout difficulty: 3).
    const neutral = makeExerciseWithDifficulty(3, { attempts: 1 });
    const [result] = recommendExercises([neutral], [], 10, { now: NOW });
    // masteryGap(25)=45 + priorityWeight(3)=24 + statusWeight("à revoir")=40 = 109, aucun autre terme actif.
    expect(result.score).toBe(109);
  });

  it("bon élève (historique confirmé, réussite ≥ 80%) : une difficulté 4-5 est favorisée par rapport à une difficulté 1", () => {
    const goodStreak: WorkSession[] = Array.from({ length: 5 }, (_, i) =>
      makeSession(`other-${i}`, { started_at: `2026-08-0${i + 1}T00:00:00.000Z`, result: "réussi" })
    );
    const hard = makeExerciseWithDifficulty(5);
    const easy = makeExerciseWithDifficulty(1);
    const result = recommendExercises([hard, easy], goodStreak, 10, { now: NOW });
    const hardResult = result.find((r) => r.exercise.id === hard.id)!;
    const easyResult = result.find((r) => r.exercise.id === easy.id)!;
    expect(hardResult.score).toBeGreaterThan(easyResult.score);
  });

  it("élève en difficulté (historique confirmé, réussite ≤ 40%) : une difficulté 4-5 n'est jamais poussée davantage", () => {
    const strugglingHistory: WorkSession[] = [
      makeSession("other-1", { started_at: "2026-08-01T00:00:00.000Z", result: "échoué" }),
      makeSession("other-2", { started_at: "2026-08-02T00:00:00.000Z", result: "échoué" }),
      makeSession("other-3", { started_at: "2026-08-03T00:00:00.000Z", result: "échoué" }),
      makeSession("other-4", { started_at: "2026-08-04T00:00:00.000Z", result: "réussi" }),
      makeSession("other-5", { started_at: "2026-08-05T00:00:00.000Z", result: "échoué" }),
    ];
    const hard = makeExerciseWithDifficulty(5);
    const medium = makeExerciseWithDifficulty(3);
    const result = recommendExercises([hard, medium], strugglingHistory, 10, { now: NOW });
    const hardResult = result.find((r) => r.exercise.id === hard.id)!;
    const mediumResult = result.find((r) => r.exercise.id === medium.id)!;
    // La difficulté 5 ne doit jamais être avantagée face à une difficulté 3 ici (au mieux égale, jamais supérieure).
    expect(hardResult.score).toBeLessThanOrEqual(mediumResult.score);
  });

  it("zone neutre (historique confirmé, réussite entre 40% et 80%) : aucun effet du terme de difficulté", () => {
    const mixedHistory: WorkSession[] = [
      makeSession("other-1", { started_at: "2026-08-01T00:00:00.000Z", result: "réussi" }),
      makeSession("other-2", { started_at: "2026-08-02T00:00:00.000Z", result: "échoué" }),
      makeSession("other-3", { started_at: "2026-08-03T00:00:00.000Z", result: "réussi" }),
      makeSession("other-4", { started_at: "2026-08-04T00:00:00.000Z", result: "échoué" }),
      makeSession("other-5", { started_at: "2026-08-05T00:00:00.000Z", result: "réussi" }),
    ]; // 3/5 = 60%, dans la zone neutre (40%-80% exclus)
    const hard = makeExerciseWithDifficulty(5, { attempts: 1 });
    const [result] = recommendExercises([hard], mixedHistory, 10, { now: NOW });
    // masteryGap(25)=45 + priorityWeight(3)=24 + statusWeight("à revoir")=40 = 109, comme le test "zone neutre" ci-dessus.
    expect(result.score).toBe(109);
  });

  it("le terme de difficulté ne change jamais l'inclusion — un exercice non retenu par ailleurs reste exclu quelle que soit sa difficulté", () => {
    const masteredHard = makeExerciseWithDifficulty(5, { status: "maîtrisé", mastery: 100, priority: 1, attempts: 3, last_worked_at: NOW.toISOString() });
    const result = recommendExercises([masteredHard], [], 10, { now: NOW });
    expect(result).toHaveLength(0);
  });
});
