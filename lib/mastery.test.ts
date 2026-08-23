import { describe, expect, it } from "vitest";
import { computeKnowledgeState } from "@/lib/mastery";
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
    difficulty: 3 as Difficulty,
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

let sessionCounter = 0;
function makeSession(exerciseId: string | null, overrides: Partial<WorkSession> = {}): WorkSession {
  sessionCounter += 1;
  return {
    id: `s-${sessionCounter}`,
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

/** Jour calendaire N (2026-01-0N) à une heure fixe — pour contrôler la diversité temporelle sans ambiguïté de fuseau horaire. */
function day(n: number): string {
  return `2026-01-${String(n).padStart(2, "0")}T10:00:00.000Z`;
}

describe("computeKnowledgeState — Cas A à I du brief (PRINCIPE FONDAMENTAL + CAS PARTICULIERS)", () => {
  it("Cas A — aucun exercice/aucune tentative : inconnu", () => {
    const result = computeKnowledgeState([], []);
    expect(result.state).toBe("inconnu");
    expect(result.evidenceCount).toBe(0);
  });

  it("Cas A (variante) — des exercices existent mais aucune tentative avec résultat : inconnu, pas 'faible'", () => {
    const exercise = makeExercise({ mastery: 0 });
    const result = computeKnowledgeState([exercise], []);
    expect(result.state).toBe("inconnu");
  });

  it("Cas B — une seule réussite facile : ne déclare PAS 'maitrise', reste 'en_acquisition'", () => {
    const exercise = makeExercise({ difficulty: 1 as Difficulty });
    const sessions = [makeSession(exercise.id, { started_at: day(1), result: "réussi" })];
    const result = computeKnowledgeState([exercise], sessions);
    expect(result.state).toBe("en_acquisition");
    expect(result.state).not.toBe("maitrise");
  });

  it("Cas C — plusieurs exercices différents réussis sur plusieurs sessions : progression vers 'solide'", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
    ];
    const result = computeKnowledgeState(exercises, sessions);
    expect(result.state).toBe("solide");
  });

  it("Cas C (renforcé) — preuve nombreuse, diverse (3+ exercices) et étalée sur plusieurs jours : 'maitrise'", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" }), makeExercise({ id: "e3" })];
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
      makeSession("e3", { started_at: day(3), result: "réussi" }),
      makeSession("e1", { started_at: day(4), result: "réussi" }),
    ];
    const result = computeKnowledgeState(exercises, sessions);
    expect(result.state).toBe("maitrise");
  });

  it("« exercice A réussi trois fois » N'EST PAS une preuve aussi forte que « A, B, C réussis une fois chacun » (même nombre de réussites)", () => {
    const repeated = [makeExercise({ id: "r1" })];
    const repeatedSessions = [
      makeSession("r1", { started_at: day(1), result: "réussi" }),
      makeSession("r1", { started_at: day(2), result: "réussi" }),
      makeSession("r1", { started_at: day(3), result: "réussi" }),
    ];
    const diverse = [makeExercise({ id: "d1" }), makeExercise({ id: "d2" }), makeExercise({ id: "d3" })];
    const diverseSessions = [
      makeSession("d1", { started_at: day(1), result: "réussi" }),
      makeSession("d2", { started_at: day(2), result: "réussi" }),
      makeSession("d3", { started_at: day(3), result: "réussi" }),
    ];
    const repeatedResult = computeKnowledgeState(repeated, repeatedSessions);
    const diverseResult = computeKnowledgeState(diverse, diverseSessions);
    // La répétition du même exercice reste plafonnée sous "solide" (Cas I) ;
    // la diversité, elle, atteint "solide".
    expect(repeatedResult.state).not.toBe("solide");
    expect(repeatedResult.state).not.toBe("maitrise");
    expect(diverseResult.state).toBe("solide");
  });

  it("Cas D — plusieurs échecs récents sur des exercices différents : 'fragile', sans historique positif", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "échoué" }),
      makeSession("e2", { started_at: day(2), result: "échoué" }),
    ];
    const result = computeKnowledgeState(exercises, sessions);
    expect(result.state).toBe("fragile");
    expect(result.reason).not.toMatch(/jusqu'ici|historique/);
  });

  it("Cas E — échec après une longue réussite : 'fragile', mais la raison ne gomme PAS l'historique positif", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" }), makeExercise({ id: "e3" })];
    const sessions = [
      // Historique solide (plus ancien que la fenêtre récente de 3).
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
      makeSession("e3", { started_at: day(3), result: "réussi" }),
      // Fenêtre récente : deux échecs.
      makeSession("e1", { started_at: day(4), result: "échoué" }),
      makeSession("e2", { started_at: day(5), result: "échoué" }),
    ];
    const result = computeKnowledgeState(exercises, sessions);
    expect(result.state).toBe("fragile");
    expect(result.reason).toMatch(/jusqu'ici/);
  });

  it("Cas F — réussite après échecs (échec, échec, réussite, réussite) : progression détectée, jamais réduite à une moyenne", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "échoué" }),
      makeSession("e2", { started_at: day(2), result: "échoué" }),
      makeSession("e1", { started_at: day(3), result: "réussi" }),
      makeSession("e2", { started_at: day(4), result: "réussi" }),
    ];
    const result = computeKnowledgeState(exercises, sessions);
    // Les deux derniers résultats (fenêtre récente) sont des réussites : pas de fragilité.
    expect(result.state).not.toBe("fragile");
    expect(result.reason).toMatch(/progrès|progression/i);
  });

  it("Cas G — un exercice interrompu (aucun résultat enregistré) n'est jamais compté comme un échec", () => {
    const exercise = makeExercise({ id: "e1" });
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e1", { started_at: day(2), result: null }), // interrompu, jamais qualifié
    ];
    const result = computeKnowledgeState([exercise], sessions);
    expect(result.evidenceCount).toBe(1); // seule la tentative avec résultat compte
    expect(result.state).not.toBe("fragile");
  });

  it("Cas H — une session interrompue ne dégrade jamais l'état par rapport à l'état sans cette session", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const baseline = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
    ];
    const withInterruption = [...baseline, makeSession("e1", { started_at: day(3), result: null })];
    const baselineResult = computeKnowledgeState(exercises, baseline);
    const interruptedResult = computeKnowledgeState(exercises, withInterruption);
    expect(interruptedResult.state).toBe(baselineResult.state);
  });

  it("Cas I — un exercice répété (même exercice, plusieurs réussites) n'atteint jamais 'maitrise' à lui seul", () => {
    const exercise = makeExercise({ id: "e1" });
    const sessions = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e1", { started_at: day(2), result: "réussi" }),
      makeSession("e1", { started_at: day(3), result: "réussi" }),
      makeSession("e1", { started_at: day(4), result: "réussi" }),
      makeSession("e1", { started_at: day(5), result: "réussi" }),
    ];
    const result = computeKnowledgeState([exercise], sessions);
    expect(result.state).not.toBe("maitrise");
    expect(result.state).not.toBe("solide");
  });
});

describe("computeKnowledgeState — difficulté (réutilise Exercise.difficulty, aucun nouveau système)", () => {
  it("une réussite sur un exercice difficile pèse plus qu'une réussite sur un exercice facile", () => {
    const easy = [makeExercise({ id: "easy1", difficulty: 1 as Difficulty }), makeExercise({ id: "easy2", difficulty: 1 as Difficulty })];
    const hard = [makeExercise({ id: "hard1", difficulty: 5 as Difficulty }), makeExercise({ id: "hard2", difficulty: 5 as Difficulty })];
    // Même structure de preuve (2 exercices, 1 réussite chacun, 1 échec partagé plus tard ne change rien ici) :
    // seule la difficulté diffère — le score pondéré interne doit en tenir compte (vérifié indirectement via le passage du seuil "maitrise").
    const easySessions = [
      makeSession("easy1", { started_at: day(1), result: "réussi" }),
      makeSession("easy2", { started_at: day(2), result: "réussi" }),
      makeSession("easy1", { started_at: day(3), result: "partiel" }),
      makeSession("easy2", { started_at: day(4), result: "partiel" }),
    ];
    const hardSessions = [
      makeSession("hard1", { started_at: day(1), result: "réussi" }),
      makeSession("hard2", { started_at: day(2), result: "réussi" }),
      makeSession("hard1", { started_at: day(3), result: "partiel" }),
      makeSession("hard2", { started_at: day(4), result: "partiel" }),
    ];
    const easyResult = computeKnowledgeState(easy, easySessions);
    const hardResult = computeKnowledgeState(hard, hardSessions);
    // Le mélange réussi/partiel reste sous le seuil "maitrise" pour les deux,
    // mais la version difficile doit être au moins aussi favorable — jamais pire.
    const rank: Record<string, number> = { inconnu: 0, en_acquisition: 1, fragile: 1, solide: 2, maitrise: 3 };
    expect(rank[hardResult.state]).toBeGreaterThanOrEqual(rank[easyResult.state]);
  });
});

describe("computeKnowledgeState — transitions demandées par le brief", () => {
  it("inconnu → en_acquisition", () => {
    const exercise = makeExercise({ id: "e1" });
    const before = computeKnowledgeState([exercise], []);
    expect(before.state).toBe("inconnu");
    const after = computeKnowledgeState([exercise], [makeSession("e1", { started_at: day(1), result: "réussi" })]);
    expect(after.state).toBe("en_acquisition");
  });

  it("en_acquisition → solide", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const before = computeKnowledgeState(exercises, [makeSession("e1", { started_at: day(1), result: "réussi" })]);
    expect(before.state).toBe("en_acquisition");
    const after = computeKnowledgeState(exercises, [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
    ]);
    expect(after.state).toBe("solide");
  });

  it("solide → fragile récent", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const solidSessions = [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
    ];
    const before = computeKnowledgeState(exercises, solidSessions);
    expect(before.state).toBe("solide");
    const afterFailures = [
      ...solidSessions,
      makeSession("e1", { started_at: day(3), result: "échoué" }),
      makeSession("e2", { started_at: day(4), result: "échoué" }),
    ];
    const after = computeKnowledgeState(exercises, afterFailures);
    expect(after.state).toBe("fragile");
  });

  it("fragile → en_acquisition (de nouvelles réussites poussent les échecs hors de la fenêtre récente)", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" })];
    const fragileSessions = [
      makeSession("e1", { started_at: day(1), result: "échoué" }),
      makeSession("e2", { started_at: day(2), result: "échoué" }),
    ];
    const before = computeKnowledgeState(exercises, fragileSessions);
    expect(before.state).toBe("fragile");
    const recovered = [
      ...fragileSessions,
      makeSession("e1", { started_at: day(3), result: "réussi" }),
      makeSession("e2", { started_at: day(4), result: "réussi" }),
      makeSession("e1", { started_at: day(5), result: "réussi" }),
    ];
    const after = computeKnowledgeState(exercises, recovered);
    expect(after.state).not.toBe("fragile");
  });

  it("en_acquisition → maitrise (preuve qui s'accumule : diversité + volume + étalement dans le temps)", () => {
    const exercises = [makeExercise({ id: "e1" }), makeExercise({ id: "e2" }), makeExercise({ id: "e3" })];
    const before = computeKnowledgeState(exercises, [makeSession("e1", { started_at: day(1), result: "réussi" })]);
    expect(before.state).toBe("en_acquisition");
    const after = computeKnowledgeState(exercises, [
      makeSession("e1", { started_at: day(1), result: "réussi" }),
      makeSession("e2", { started_at: day(2), result: "réussi" }),
      makeSession("e3", { started_at: day(3), result: "réussi" }),
      makeSession("e1", { started_at: day(4), result: "réussi" }),
    ]);
    expect(after.state).toBe("maitrise");
  });
});

describe("computeKnowledgeState — explications (jamais de score exposé)", () => {
  it("chaque état a une raison non vide, sans chiffre ni jargon", () => {
    const cases: Array<[Exercise[], WorkSession[]]> = [
      [[], []],
      [[makeExercise({ id: "a" })], [makeSession("a", { started_at: day(1), result: "réussi" })]],
      [
        [makeExercise({ id: "a" }), makeExercise({ id: "b" })],
        [makeSession("a", { started_at: day(1), result: "échoué" }), makeSession("b", { started_at: day(2), result: "échoué" })],
      ],
    ];
    for (const [exercises, sessions] of cases) {
      const result = computeKnowledgeState(exercises, sessions);
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.reason).not.toMatch(/%|\d+\.\d+/);
    }
  });
});
