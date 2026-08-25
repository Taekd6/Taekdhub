import { describe, expect, it } from "vitest";
import { comfortDifficulty, computeExerciseBankStats, explainReasons, isNeverWorked, recommendExercises } from "@/lib/recommendation";
import type { Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

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
    hints_used: null,
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
    const plain = makeExercise({ status: "à revoir", mastery: 25 });
    const favorite = makeExercise({ status: "à revoir", mastery: 25, favorite: true });
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
    const chapterA = Array.from({ length: 4 }, () => makeExercise({ chapter_id: "chap-A", mastery: 0 }));
    const chapterB = Array.from({ length: 2 }, () => makeExercise({ chapter_id: "chap-B", mastery: 25 }));

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
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" })];
    const [result] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toBeDefined();
    expect(result.reasons).toContain("Échec récent");
  });

  it("plusieurs échecs récents remplacent la raison par 'Plusieurs échecs' et augmentent le score par rapport à un seul échec", () => {
    const single = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const singleSessions = [makeSession(single.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" })];

    const repeated = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
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
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi" })];
    const result = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it("une série de réussites fait redescendre le score d'un exercice déjà retenu par ailleurs, sans jamais l'exclure", () => {
    const noStreak = makeExercise({ status: "à revoir", mastery: 25 });
    const withStreak = makeExercise({ status: "à revoir", mastery: 25 });
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
    const exercise = makeExercise({ mastery: 50, status: "à faire" });
    const [result] = recommendExercises([exercise], [], 10, { now: NOW });
    expect(result.reasons).toEqual(["Jamais travaillé"]);
  });
});

describe("comfortDifficulty — progression de difficulté", () => {
  /** Une tentative qualifiée sur un exercice de difficulté donnée, datée pour que l'ordre de récence soit déterministe. */
  function attempt(difficulty: number, result: "réussi" | "échoué" | "partiel", daysAgo: number, hintsUsed: number | null = 0) {
    const exercise = makeExercise({ difficulty: difficulty as Exercise["difficulty"] });
    const started = new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
    return { exercise, session: makeSession(exercise.id, { result, started_at: started, hints_used: hintsUsed }) };
  }

  it("moins de 3 tentatives qualifiées : aucun niveau déduit (on n'invente pas un niveau sans preuve)", () => {
    const a = attempt(2, "réussi", 1);
    const b = attempt(2, "réussi", 2);
    expect(comfortDifficulty([a.exercise, b.exercise], [a.session, b.session])).toBeNull();
  });

  it("série de réussites : la cible monte d'un cran au-dessus du niveau réussi", () => {
    const attempts = [attempt(2, "réussi", 1), attempt(2, "réussi", 2), attempt(2, "réussi", 3)];
    const comfort = comfortDifficulty(attempts.map((a) => a.exercise), attempts.map((a) => a.session))!;
    expect(comfort.target).toBe(3);
    expect(comfort.steppedUp).toBe(true);
    expect(comfort.successStreak).toBe(3);
  });

  it("échecs récents : la cible redescend d'un cran, sans jamais passer sous 1", () => {
    const attempts = [attempt(1, "échoué", 1), attempt(1, "échoué", 2), attempt(1, "échoué", 3)];
    const comfort = comfortDifficulty(attempts.map((a) => a.exercise), attempts.map((a) => a.session))!;
    expect(comfort.target).toBe(1);
    expect(comfort.steppedUp).toBe(false);
  });

  it("la cible reste bornée à 5 même après une série de réussites au niveau maximum", () => {
    const attempts = [attempt(5, "réussi", 1), attempt(5, "réussi", 2), attempt(5, "réussi", 3)];
    expect(comfortDifficulty(attempts.map((a) => a.exercise), attempts.map((a) => a.session))!.target).toBe(5);
  });

  it("ignore les séances sans résultat et celles dont l'exercice n'existe plus", () => {
    const a = attempt(3, "réussi", 1);
    const orphan = makeSession("exercice-supprimé", { result: "réussi" });
    const unqualified = makeSession(a.exercise.id, { result: null });
    expect(comfortDifficulty([a.exercise], [a.session, orphan, unqualified])).toBeNull();
  });
});

describe("recommendExercises — effet de la progression de difficulté", () => {
  it("à signaux par ailleurs identiques, l'exercice au niveau visé passe devant celui qui en est loin", () => {
    // Historique : trois réussites d'affilée en difficulté 2 → cible 3.
    const history = [1, 2, 3].map((daysAgo) => {
      const solved = makeExercise({ difficulty: 2, status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
      return {
        exercise: solved,
        session: makeSession(solved.id, { result: "réussi" as const, hints_used: 0, started_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString() }),
      };
    });

    const atTarget = makeExercise({ difficulty: 3, mastery: 0, status: "à faire" });
    const farAbove = makeExercise({ difficulty: 5, mastery: 0, status: "à faire" });

    const exercises = [...history.map((h) => h.exercise), farAbove, atTarget];
    const sessions = history.map((h) => h.session);
    const result = recommendExercises(exercises, sessions, 10, { now: NOW });

    const targetRank = result.findIndex((r) => r.exercise.id === atTarget.id);
    const aboveRank = result.findIndex((r) => r.exercise.id === farAbove.id);
    expect(targetRank).toBeGreaterThanOrEqual(0);
    expect(targetRank).toBeLessThan(aboveRank);
  });

  it("un exercice hors du niveau visé reste proposé — déprioritisé, jamais exclu", () => {
    const history = [1, 2, 3].map((daysAgo) => {
      const solved = makeExercise({ difficulty: 1, status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
      return { exercise: solved, session: makeSession(solved.id, { result: "réussi" as const, hints_used: 0, started_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString() }) };
    });
    const hard = makeExercise({ difficulty: 5, mastery: 0, status: "à faire" });
    const result = recommendExercises([...history.map((h) => h.exercise), hard], history.map((h) => h.session), 10, { now: NOW });
    expect(result.some((r) => r.exercise.id === hard.id)).toBe(true);
  });

  it("cold start (aucun résultat enregistré) : classement stable, la difficulté ne joue aucun rôle", () => {
    const easy = makeExercise({ difficulty: 1, mastery: 0 });
    const hard = makeExercise({ difficulty: 5, mastery: 0 });
    const result = recommendExercises([easy, hard], [], 10, { now: NOW });
    // Mêmes signaux, aucune donnée de niveau : les deux scores doivent rester égaux.
    expect(result[0].score).toBe(result[1].score);
  });

  it("la justification cite le nombre réel de réussites consécutives", () => {
    const history = [1, 2, 3].map((daysAgo) => {
      const solved = makeExercise({ difficulty: 2, status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
      return { exercise: solved, session: makeSession(solved.id, { result: "réussi" as const, hints_used: 0, started_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString() }) };
    });
    const next = makeExercise({ difficulty: 3, mastery: 0, status: "à faire" });
    const result = recommendExercises([...history.map((h) => h.exercise), next], history.map((h) => h.session), 10, { now: NOW });
    const pick = result.find((r) => r.exercise.id === next.id)!;
    expect(pick.reasons.some((reason) => reason.startsWith("Palier suivant"))).toBe(true);
    expect(explainReasons(pick.reasons)).toBe("Tu as réussi 3 exercices d'affilée : on monte d'un cran de difficulté.");
  });
});

describe("indices — un signal pédagogique à part entière", () => {
  const solvedAlone = { status: "maîtrisé" as const, mastery: 100 as Mastery, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" };

  it("une réussite très assistée repropose l'exercice, même si TOUS les autres signaux sont au vert", () => {
    // Sans le signal d'indices, cet exercice serait considéré acquis et
    // n'apparaîtrait jamais : maîtrisé, maîtrise 100, travaillé hier, réussi.
    const exercise = makeExercise(solvedAlone);
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi", hints_used: 3 })];
    const [pick] = recommendExercises([exercise], sessions, 10, { now: NOW });
    expect(pick).toBeDefined();
    expect(pick.reasons).toContain("Réussi avec aide");
    expect(explainReasons(pick.reasons)).toBe("Tu l'avais réussi, mais avec les indices — on vérifie que c'est acquis.");
  });

  it("une réussite autonome (0 indice) laisse l'exercice tranquille", () => {
    const exercise = makeExercise(solvedAlone);
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi", hints_used: 0 })];
    expect(recommendExercises([exercise], sessions, 10, { now: NOW })).toHaveLength(0);
  });

  it("un seul indice reste sous le seuil : pas encore un signal de fragilité", () => {
    const exercise = makeExercise(solvedAlone);
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi", hints_used: 1 })];
    expect(recommendExercises([exercise], sessions, 10, { now: NOW })).toHaveLength(0);
  });

  it("MIGRATION : une séance antérieure au champ (hints_used null) ne repropose rien — on n'invente pas une fragilité", () => {
    const exercise = makeExercise(solvedAlone);
    const sessions = [makeSession(exercise.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi", hints_used: null })];
    expect(recommendExercises([exercise], sessions, 10, { now: NOW })).toHaveLength(0);
  });

  it("des réussites assistées ne font PAS monter la difficulté (réussir guidé ne prouve pas qu'on est prêt au cran suivant)", () => {
    const attempts = [1, 2, 3].map((daysAgo) => {
      const ex = makeExercise({ difficulty: 2 });
      return { ex, session: makeSession(ex.id, { result: "réussi" as const, hints_used: 3, started_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString() }) };
    });
    const comfort = comfortDifficulty(attempts.map((a) => a.ex), attempts.map((a) => a.session))!;
    expect(comfort.steppedUp).toBe(false);
    expect(comfort.successStreak).toBe(0);
  });

  it("MIGRATION : un historique entièrement pré-indices ne déclenche jamais de montée de palier", () => {
    const attempts = [1, 2, 3].map((daysAgo) => {
      const ex = makeExercise({ difficulty: 2 });
      return { ex, session: makeSession(ex.id, { result: "réussi" as const, hints_used: null, started_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString() }) };
    });
    expect(comfortDifficulty(attempts.map((a) => a.ex), attempts.map((a) => a.session))!.steppedUp).toBe(false);
  });
});

describe("explainReasons — phrase de contexte 'pourquoi cet exercice ?'", () => {
  it("aucune raison : null, jamais de phrase générique inventée", () => {
    expect(explainReasons([])).toBeNull();
  });

  it("une seule raison connue : la phrase correspondante", () => {
    expect(explainReasons(["Jamais travaillé"])).toBe("Tu n'as pas encore travaillé cet exercice.");
    expect(explainReasons(["Marqué à revoir"])).toBe("Tu l'as toi-même marqué à revoir.");
  });

  it("plusieurs raisons : la plus décisive (échecs) prime sur les signaux plus faibles", () => {
    const sentence = explainReasons(["Maîtrise faible", "Priorité élevée", "Plusieurs échecs"]);
    expect(sentence).toBe("Tu as échoué plusieurs fois récemment dessus — ça mérite une nouvelle tentative.");
  });

  it("raison dynamique 'Non retravaillé depuis N j' : le nombre de jours est repris dans la phrase", () => {
    expect(explainReasons(["Non retravaillé depuis 12 j"])).toBe("Tu ne l'as pas retravaillé depuis 12 jours, alors qu'il était maîtrisé.");
    expect(explainReasons(["Non retravaillé depuis 1 j"])).toBe("Tu ne l'as pas retravaillé depuis 1 jour, alors qu'il était maîtrisé.");
  });

  it("raisons synthétiques (reprise de séance, séance libre) reconnues comme les raisons réelles", () => {
    expect(explainReasons(["Séance reprise"])).toMatch(/reprend/);
    expect(explainReasons(["Séance libre"])).toMatch(/Choisi par toi/);
  });

  it("une raison sans règle dédiée (ex. 'Favori' seul, cas normalement impossible en pratique) retombe sur le texte brut plutôt que de planter", () => {
    expect(explainReasons(["Favori"])).toBe("Favori");
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
    expect(stats).toEqual({ toReviewCount: 0, averageMastery: 0, neverWorkedCount: 0 });
  });
});

/**
 * Le signal « réussi avec aide » a longtemps existé sans jamais servir : il
 * entrait bien dans les raisons, mais l'exercice concerné — typiquement passé
 * en « maîtrisé » avec une maîtrise déclarée haute — tombait autour de -30 au
 * classement quand un exercice jamais ouvert tourne à +85. Sur 402 exercices,
 * il n'apparaissait donc jamais. Ces tests verrouillent la remontée.
 */
describe("Réussite assistée — un signal qui doit vraiment remonter", () => {
  it("un exercice réussi aux indices passe devant un exercice jamais ouvert", () => {
    const assisted = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: new Date(NOW.getTime() - 86400000).toISOString() });
    const fresh = makeExercise();
    const sessions = [
      makeSession(assisted.id, { result: "réussi", hints_used: 4, started_at: new Date(NOW.getTime() - 86400000).toISOString() }),
    ];
    const order = recommendExercises([fresh, assisted], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(assisted.id);
  });

  it("… mais reste derrière un échec constaté : un échec est plus urgent qu'une réussite fragile", () => {
    const assisted = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: new Date(NOW.getTime() - 86400000).toISOString() });
    const failed = makeExercise({ status: "à revoir", mastery: 25, attempts: 2, last_worked_at: new Date(NOW.getTime() - 86400000).toISOString() });
    const sessions = [
      makeSession(assisted.id, { result: "réussi", hints_used: 4, started_at: new Date(NOW.getTime() - 86400000).toISOString() }),
      makeSession(failed.id, { result: "échoué", started_at: new Date(NOW.getTime() - 86400000).toISOString() }),
    ];
    const order = recommendExercises([assisted, failed], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(failed.id);
  });

  it("une réussite autonome ne bénéficie d'aucune remontée", () => {
    const solo = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: new Date(NOW.getTime() - 86400000).toISOString() });
    const fresh = makeExercise();
    const sessions = [makeSession(solo.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 86400000).toISOString() })];
    const order = recommendExercises([solo, fresh], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(fresh.id);
  });
});
