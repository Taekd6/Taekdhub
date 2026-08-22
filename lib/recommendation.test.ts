import { describe, expect, it } from "vitest";
import { computeExerciseBankStats, computeRevisionUrgency, isNeverWorked, recommendExercises } from "@/lib/recommendation";
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
    answer: null,
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

  it("un exercice jamais travaillé, même à mastery 0 par défaut, n'affiche jamais 'Maîtrise faible' en plus de 'Jamais travaillé' (catégorie A ≠ B)", () => {
    const exercise = makeExercise({ mastery: 0, priority: 3, status: "à faire" });
    const [result] = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result.reasons).toContain("Jamais travaillé");
    expect(result.reasons).not.toContain("Maîtrise faible");
  });

  it("un exercice déjà engagé (au moins une tentative) mais toujours à mastery faible affiche 'Maîtrise faible', sans 'Jamais travaillé' (catégorie B)", () => {
    const exercise = makeExercise({ mastery: 0, attempts: 2, status: "en cours" });
    const [result] = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result.reasons).toContain("Maîtrise faible");
    expect(result.reasons).not.toContain("Jamais travaillé");
  });

  it("un échec récent suivi d'une réussite affiche 'Progrès récents' plutôt qu'un 'Réussi récemment' générique (catégorie D)", () => {
    const exercise = makeExercise({ status: "à revoir", mastery: 25, priority: 3 });
    const sessions = [
      makeSession(exercise.id, { started_at: "2026-08-09T10:00:00.000Z", result: "réussi" }),
      makeSession(exercise.id, { started_at: "2026-08-08T10:00:00.000Z", result: "échoué" }),
    ];
    const [result] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result.reasons).toContain("Progrès récents");
    expect(result.reasons).not.toContain("Réussi récemment");
  });
});

/** Décale `NOW` de `n` jours dans le passé (n > 0) ou le futur (n < 0), en ISO — pour construire des historiques lisibles par nombre de jours plutôt que par date en dur. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}

describe("computeRevisionUrgency — scénarios de référence (Étape 3)", () => {
  it("A — jamais travaillé (pas d'historique) : urgence nulle, sans crash", () => {
    const exercise = makeExercise();
    expect(computeRevisionUrgency(exercise, [], NOW)).toBe(0);
  });

  it("B — réussi une fois hier : révision proche, encore dans l'intervalle théorique (urgence nulle)", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { started_at: daysAgo(1), result: "réussi" })];
    expect(computeRevisionUrgency(exercise, sessions, NOW)).toBe(0);
  });

  it("C — réussi deux fois consécutives : l'intervalle toléré s'allonge par rapport à une seule réussite", () => {
    const single = makeExercise();
    const singleSessions = [makeSession(single.id, { started_at: daysAgo(4), result: "réussi" })];

    const double = makeExercise();
    const doubleSessions = [
      makeSession(double.id, { started_at: daysAgo(4), result: "réussi" }),
      makeSession(double.id, { started_at: daysAgo(10), result: "réussi" }),
    ];

    // 4 jours dépasse l'intervalle d'une seule réussite (3 j) mais pas celui
    // de deux réussites consécutives (6 j) — la même absence de 4 jours est
    // traitée différemment selon la série.
    expect(computeRevisionUrgency(single, singleSessions, NOW)).toBeGreaterThan(0);
    expect(computeRevisionUrgency(double, doubleSessions, NOW)).toBe(0);
  });

  it("D — réussi cinq fois : intervalle nettement plus long qu'à trois réussites, mais plafonné au-delà de 4", () => {
    const buildStreak = (id: string, count: number) =>
      Array.from({ length: count }, (_, i) => makeSession(id, { started_at: daysAgo(25 + i), result: "réussi" }));

    const threeSuccesses = makeExercise();
    const fourSuccesses = makeExercise();
    const fiveSuccesses = makeExercise();

    const urgency3 = computeRevisionUrgency(threeSuccesses, buildStreak(threeSuccesses.id, 3), NOW);
    const urgency4 = computeRevisionUrgency(fourSuccesses, buildStreak(fourSuccesses.id, 4), NOW);
    const urgency5 = computeRevisionUrgency(fiveSuccesses, buildStreak(fiveSuccesses.id, 5), NOW);

    // Plus la série est longue, moins l'urgence est élevée pour le même délai
    // (intervalle plus grand) — jusqu'au plafond, où 4 et 5 réussites se
    // valent strictement (pas de croissance sans limite).
    expect(urgency4).toBeLessThan(urgency3);
    expect(urgency5).toBe(urgency4);
  });

  it("E — cinq réussites puis échec récent : l'urgence de révision adaptative redevient nulle (portée par le signal d'échec, pas ici — voir Sprint 5)", () => {
    const exercise = makeExercise({ status: "à revoir", mastery: 25 });
    const sessions = [
      makeSession(exercise.id, { started_at: daysAgo(1), result: "échoué" }),
      makeSession(exercise.id, { started_at: daysAgo(5), result: "réussi" }),
      makeSession(exercise.id, { started_at: daysAgo(10), result: "réussi" }),
      makeSession(exercise.id, { started_at: daysAgo(15), result: "réussi" }),
      makeSession(exercise.id, { started_at: daysAgo(20), result: "réussi" }),
    ];
    expect(computeRevisionUrgency(exercise, sessions, NOW)).toBe(0);

    // Le signal global reste fort — porté par "Échec récent" (Sprint 5), pas
    // recompté ici : pas de double comptage entre les deux mécanismes.
    const [result] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result.reasons).toContain("Échec récent");
  });

  it("F — cinq réussites puis longue absence : l'urgence augmente progressivement avec le temps, sans dépasser le plafond", () => {
    const exercise = makeExercise();
    const buildSessions = (lastSuccessDaysAgo: number) =>
      Array.from({ length: 5 }, (_, i) => makeSession(exercise.id, { started_at: daysAgo(lastSuccessDaysAgo + i * 3), result: "réussi" }));

    const moderateAbsence = computeRevisionUrgency(exercise, buildSessions(40), NOW);
    const longAbsence = computeRevisionUrgency(exercise, buildSessions(100), NOW);

    expect(moderateAbsence).toBeGreaterThan(0);
    expect(longAbsence).toBeGreaterThan(moderateAbsence);
    expect(longAbsence).toBeLessThanOrEqual(30);
  });

  it("G — réussites espacées par un échec : seule la série la plus récente compte, pas le total historique", () => {
    // Chronologiquement : réussite, réussite, échec, réussite (la plus
    // ancienne en premier) — donc la série CONSÉCUTIVE la plus récente vaut
    // 1, jamais 3.
    const exercise = makeExercise();
    const sessions = [
      makeSession(exercise.id, { started_at: daysAgo(4), result: "réussi" }), // la plus récente
      makeSession(exercise.id, { started_at: daysAgo(8), result: "échoué" }),
      makeSession(exercise.id, { started_at: daysAgo(12), result: "réussi" }),
      makeSession(exercise.id, { started_at: daysAgo(16), result: "réussi" }),
    ];

    const onlyOneSuccess = makeExercise();
    const onlyOneSuccessSessions = [makeSession(onlyOneSuccess.id, { started_at: daysAgo(4), result: "réussi" })];

    // Même délai (4 j), même urgence qu'avec une seule réussite isolée : le
    // total historique (3 réussites) n'a aucune influence sur l'intervalle.
    expect(computeRevisionUrgency(exercise, sessions, NOW)).toBe(computeRevisionUrgency(onlyOneSuccess, onlyOneSuccessSessions, NOW));
  });

  it("H — exercice difficile : l'intervalle se resserre par rapport à un exercice facile, sans énorme bonus", () => {
    const easy = makeExercise({ difficulty: 1 as Difficulty });
    const hard = makeExercise({ difficulty: 5 as Difficulty });
    const sessionsFor = (id: string) => [makeSession(id, { started_at: daysAgo(3), result: "réussi" })];

    const easyUrgency = computeRevisionUrgency(easy, sessionsFor(easy.id), NOW);
    const hardUrgency = computeRevisionUrgency(hard, sessionsFor(hard.id), NOW);

    // 3 jours dépasse l'intervalle resserré d'un exercice difficile (2.4 j)
    // mais pas celui d'un exercice facile (3.6 j).
    expect(hardUrgency).toBeGreaterThan(0);
    expect(easyUrgency).toBe(0);
    // Ajustement raisonnable, jamais démesuré : quelques points, pas le plafond entier.
    expect(hardUrgency).toBeLessThan(5);
  });

  it("I — déterminisme : même historique et même date de référence (y compris future) → même résultat à chaque appel", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { started_at: daysAgo(10), result: "réussi" })];
    const future = new Date(NOW.getTime() + 365 * 86400000);

    expect(computeRevisionUrgency(exercise, sessions, future)).toBe(computeRevisionUrgency(exercise, sessions, future));
    expect(computeRevisionUrgency(exercise, sessions, NOW)).toBe(computeRevisionUrgency(exercise, sessions, NOW));
  });

  it("J — historique invalide (date corrompue) : aucune exception, résultat toujours un nombre borné", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { started_at: "pas-une-date", result: "réussi" })];
    const urgency = computeRevisionUrgency(exercise, sessions, NOW);
    expect(Number.isFinite(urgency)).toBe(true);
    expect(urgency).toBeGreaterThanOrEqual(0);
    expect(urgency).toBeLessThanOrEqual(30);
  });
});

describe("computeRevisionUrgency — propriétés (Étape 4)", () => {
  it("monotonie : à historique identique, l'urgence ne diminue jamais quand le temps passe", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { started_at: daysAgo(30), result: "réussi" })];
    let previous = -Infinity;
    for (let daysLater = 0; daysLater <= 120; daysLater += 10) {
      const now = new Date(NOW.getTime() + daysLater * 86400000);
      const urgency = computeRevisionUrgency(exercise, sessions, now);
      expect(urgency).toBeGreaterThanOrEqual(previous);
      previous = urgency;
    }
  });

  it("réussites : à délai identique, une série plus longue ne donne jamais une urgence plus élevée", () => {
    const buildStreak = (id: string, count: number) =>
      Array.from({ length: count }, (_, i) => makeSession(id, { started_at: daysAgo(15 + i), result: "réussi" }));
    let previous = Infinity;
    for (const streakLength of [1, 2, 3, 4, 5]) {
      const exercise = makeExercise();
      const urgency = computeRevisionUrgency(exercise, buildStreak(exercise.id, streakLength), NOW);
      expect(urgency).toBeLessThanOrEqual(previous);
      previous = urgency;
    }
  });

  it("échec : à historique comparable, un échec récent redonne une urgence globale (score) plus élevée qu'une réussite récente", () => {
    const withFailure = makeExercise({ status: "à revoir", mastery: 25 });
    const withSuccess = makeExercise({ status: "à revoir", mastery: 25 });
    const sessionsFailure = [makeSession(withFailure.id, { started_at: daysAgo(1), result: "échoué" })];
    const sessionsSuccess = [makeSession(withSuccess.id, { started_at: daysAgo(1), result: "réussi" })];

    const [failureResult] = recommendExercises([withFailure], sessionsFailure, 10, { now: NOW });
    const [successResult] = recommendExercises([withSuccess], sessionsSuccess, 10, { now: NOW });

    expect(failureResult.score).toBeGreaterThan(successResult.score);
  });

  it("cap : l'urgence reste toujours dans ses bornes, même pour un délai extrême", () => {
    const exercise = makeExercise();
    const sessions = [makeSession(exercise.id, { started_at: daysAgo(1), result: "réussi" })];
    const farFuture = new Date(NOW.getTime() + 20 * 365 * 86400000);
    const urgency = computeRevisionUrgency(exercise, sessions, farFuture);
    expect(urgency).toBeGreaterThanOrEqual(0);
    expect(urgency).toBeLessThanOrEqual(30);
  });

  it("déterminisme : même entrée et même date → toujours la même sortie", () => {
    const exercise = makeExercise({ difficulty: 4 as Difficulty });
    const sessions = [
      makeSession(exercise.id, { started_at: daysAgo(2), result: "réussi" }),
      makeSession(exercise.id, { started_at: daysAgo(6), result: "réussi" }),
    ];
    const results = Array.from({ length: 5 }, () => computeRevisionUrgency(exercise, sessions, NOW));
    expect(new Set(results).size).toBe(1);
  });

  it("robustesse : historiques vides ou corrompus n'entraînent jamais d'exception", () => {
    const exercise = makeExercise();
    expect(() => computeRevisionUrgency(exercise, [], NOW)).not.toThrow();
    expect(() => computeRevisionUrgency(exercise, [makeSession("autre-exercice-id", { result: "réussi" })], NOW)).not.toThrow();
    expect(() => computeRevisionUrgency(exercise, [makeSession(exercise.id, { started_at: "", result: "réussi" })], NOW)).not.toThrow();
    expect(() => computeRevisionUrgency(exercise, [makeSession(exercise.id, { result: null })], NOW)).not.toThrow();
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
 * Sprint Study OS Phase 4 — signal d'échéance par chapitre (DS/khôlle). Sans
 * `options.chapterDeadlines`, comportement strictement inchangé (déjà
 * couvert par tous les tests ci-dessus, qui n'en fournissent jamais).
 */
describe("recommendExercises — signal d'échéance par chapitre", () => {
  it("un exercice autrement non signalé remonte grâce à l'échéance de son chapitre — et l'explique", () => {
    // "à faire" mais déjà travaillé récemment (donc pas "jamais travaillé"),
    // priorité/maîtrise neutres : aucune raison de l'inclure sans le signal.
    const exercise = makeExercise({ chapter_id: "c-continuite", status: "à faire", priority: 2, mastery: 50, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const withoutSignal = recommendExercises([exercise], [], 6, { now: NOW });
    expect(withoutSignal).toEqual([]);

    const withSignal = recommendExercises([exercise], [], 6, {
      now: NOW,
      chapterDeadlines: new Map([["c-continuite", { days: 3, label: "ton DS de Mathématiques dans 3 j" }]]),
    });
    expect(withSignal.some((r) => r.exercise.id === exercise.id)).toBe(true);
    expect(withSignal[0].reasons).toContain("Prioritaire : ton DS de Mathématiques dans 3 j");
  });

  it("un exercice déjà maîtrisé n'est jamais remonté par la seule échéance", () => {
    const exercise = makeExercise({ chapter_id: "c-continuite", status: "maîtrisé", mastery: 100, priority: 2, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const result = recommendExercises([exercise], [], 6, {
      now: NOW,
      chapterDeadlines: new Map([["c-continuite", { days: 3, label: "ton DS de Mathématiques dans 3 j" }]]),
    });
    expect(result).toEqual([]);
  });

  it("un exercice d'un AUTRE chapitre n'est jamais affecté par l'échéance", () => {
    const exercise = makeExercise({ chapter_id: "c-autre", status: "à faire", priority: 2, mastery: 50, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const result = recommendExercises([exercise], [], 6, {
      now: NOW,
      chapterDeadlines: new Map([["c-continuite", { days: 3, label: "ton DS de Mathématiques dans 3 j" }]]),
    });
    expect(result).toEqual([]);
  });

  it("un exercice à revoir reste prioritaire même sans échéance — la hiérarchie existante n'est jamais écrasée", () => {
    const toReview = makeExercise({ id: "ex-revoir", status: "à revoir", chapter_id: "c-autre" });
    const withDeadline = makeExercise({ id: "ex-deadline", chapter_id: "c-continuite", status: "à faire", priority: 2, mastery: 50, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const result = recommendExercises([toReview, withDeadline], [], 6, {
      now: NOW,
      chapterDeadlines: new Map([["c-continuite", { days: 1, label: "ton DS dans 1 j" }]]), // échéance très proche, presque plein bonus
    });
    expect(result[0].exercise.id).toBe("ex-revoir");
  });
});

/**
 * Sprint Study OS Phase 4 — signal de retard sur le plan hebdomadaire. Sans
 * `options.subjectPlanGap`, comportement strictement inchangé.
 */
describe("recommendExercises — signal de retard sur le plan hebdomadaire", () => {
  it("n'ajoute JAMAIS de raison à lui seul (jamais un critère d'inclusion) — un exercice sans autre raison reste absent", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, priority: 2, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const result = recommendExercises([exercise], [], 6, { now: NOW, subjectPlanGap: { Mathématiques: 90 } });
    expect(result).toEqual([]);
  });

  it("explique un exercice déjà retenu par ailleurs, quand sa matière est en retard sur le plan", () => {
    const exercise = makeExercise({ status: "à revoir", subject: "Physique" });
    const result = recommendExercises([exercise], [], 6, { now: NOW, subjectPlanGap: { Physique: 60 } });
    expect(result[0].reasons).toContain("En retard sur ton plan de la semaine");
  });

  it("n'affecte pas un exercice d'une autre matière", () => {
    const exercise = makeExercise({ status: "à revoir", subject: "Chimie" });
    const result = recommendExercises([exercise], [], 6, { now: NOW, subjectPlanGap: { Physique: 60 } });
    expect(result[0].reasons).not.toContain("En retard sur ton plan de la semaine");
  });

  it("fait remonter en priorité une matière en retard entre deux exercices par ailleurs équivalents", () => {
    const behindSubject = makeExercise({ id: "ex-behind", subject: "Physique", status: "à revoir" });
    const onTrackSubject = makeExercise({ id: "ex-ontrack", subject: "Chimie", status: "à revoir" });
    const result = recommendExercises([onTrackSubject, behindSubject], [], 6, { now: NOW, subjectPlanGap: { Physique: 90 } });
    expect(result[0].exercise.id).toBe("ex-behind");
  });
});
