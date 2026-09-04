import { describe, expect, it } from "vitest";
import { ASSISTED_HINTS_THRESHOLD, comfortDifficulty, computeExerciseBankStats, computeWorkingLevel, explainReasons, isNeverWorked, recommendExercises } from "@/lib/recommendation";
import type { AttemptResult, Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

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
  // Daté hors de la fenêtre de repos (voir `recentAttemptPenalty`) : la
  // question posée ici est « une réussite assistée remonte-t-elle ? », pas
  // « remonte-t-elle dès le lendemain ? » — auquel cas la réponse est non, et
  // c'est voulu : on ne redonne pas le jour même ce qui vient d'être fait.
  it("un exercice réussi aux indices passe devant un exercice jamais ouvert", () => {
    const assisted = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: new Date(NOW.getTime() - 4 * 86400000).toISOString() });
    const fresh = makeExercise();
    const sessions = [
      makeSession(assisted.id, { result: "réussi", hints_used: 4, started_at: new Date(NOW.getTime() - 4 * 86400000).toISOString() }),
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

/**
 * `computeWorkingLevel` publie ce que le moteur utilisait déjà sans jamais le
 * montrer. Il ne doit RIEN inventer : mêmes tentatives, même seuil d'aide.
 */
describe("computeWorkingLevel — la lecture publique de l'entrée du moteur", () => {
  it("ne publie rien tant que la fenêtre manque de tentatives qualifiées", () => {
    const exercise = makeExercise();
    expect(computeWorkingLevel([exercise], [makeSession(exercise.id, { result: "réussi", hints_used: 0 })])).toBeNull();
  });

  it("ne compte comme autonome qu'une réussite obtenue sous le seuil d'indices", () => {
    const exercises = Array.from({ length: 4 }, () => makeExercise({ difficulty: 3 }));
    const sessions = exercises.map((exercise, index) =>
      makeSession(exercise.id, { result: "réussi", hints_used: index < 2 ? 0 : ASSISTED_HINTS_THRESHOLD })
    );
    const level = computeWorkingLevel(exercises, sessions)!;
    expect(level.successes).toBe(4);
    expect(level.autonomousSuccesses).toBe(2);
  });

  it("une séance sans compteur d'indices n'est jamais créditée comme autonome", () => {
    const exercises = Array.from({ length: 3 }, () => makeExercise({ difficulty: 2 }));
    const sessions = exercises.map((exercise) => makeSession(exercise.id, { result: "réussi", hints_used: null }));
    const level = computeWorkingLevel(exercises, sessions)!;
    expect(level.successes).toBe(3);
    expect(level.autonomousSuccesses).toBe(0);
  });

  it("la difficulté moyenne publiée est celle des tentatives réellement examinées", () => {
    const exercises = [makeExercise({ difficulty: 1 }), makeExercise({ difficulty: 3 }), makeExercise({ difficulty: 5 })];
    const sessions = exercises.map((exercise) => makeSession(exercise.id, { result: "réussi", hints_used: 0 }));
    expect(computeWorkingLevel(exercises, sessions)!.averageDifficulty).toBe(3);
  });
});

/**
 * Sans repos après une tentative, un exercice échoué cumulait `masteryGap`,
 * le poids de « à revoir » et `failureBonus` : il repassait en tête chaque
 * jour, indéfiniment. Mesuré en rejouant 14 jours sur la vraie banque avec un
 * élève qui fait ce qu'on lui propose : 42 propositions pour 3 exercices
 * distincts — les mêmes trois, tous les jours, pendant deux semaines.
 */
describe("Repos après une tentative — le produit ne se répète pas d'un jour à l'autre", () => {
  const dayAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

  function attempted(days: number) {
    const exercise = makeExercise({ status: "à revoir", mastery: 25, attempts: 1, last_worked_at: dayAgo(days) });
    const session = makeSession(exercise.id, { result: "échoué", started_at: dayAgo(days) });
    return { exercise, session };
  }

  it("un exercice raté hier passe DERRIÈRE un exercice jamais ouvert", () => {
    const { exercise, session } = attempted(1);
    const fresh = makeExercise();
    const order = recommendExercises([exercise, fresh], [session], 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(fresh.id);
  });

  it("… et repasse devant une fois le repos écoulé", () => {
    const { exercise, session } = attempted(4);
    const fresh = makeExercise();
    const order = recommendExercises([exercise, fresh], [session], 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(exercise.id);
  });

  it("le repos ne l'exclut jamais : il reste proposé, seulement plus bas", () => {
    const { exercise, session } = attempted(0);
    const result = recommendExercises([exercise], [session], 5, { now: NOW });
    expect(result.map((r) => r.exercise.id)).toContain(exercise.id);
  });

  it("même échoué DEUX fois, il n'est pas reproposé dès le lendemain — le repos doit tenir contre le signal qu'il tempère", () => {
    // À 50 points de repos, `masteryGap` + statut + `failureBonus` (40 pour
    // deux échecs) repassaient devant un exercice jamais ouvert dès J+1 :
    // sur 14 jours de banque réelle, un même exercice proposé 10 jours sur 14.
    // Statut laissé tel quel ("à faire") : c'est l'état réel de la banque,
    // que l'élève ne repasse pas à la main en "à revoir" après chaque échec.
    const exercise = makeExercise({ mastery: 0, attempts: 2, last_worked_at: dayAgo(1) });
    const sessions = [
      makeSession(exercise.id, { result: "échoué", started_at: dayAgo(1) }),
      makeSession(exercise.id, { result: "échoué", started_at: dayAgo(2) }),
    ];
    const fresh = makeExercise();
    expect(recommendExercises([exercise, fresh], sessions, 2, { now: NOW })[0].exercise.id).toBe(fresh.id);

    // … mais deux jours après l'échec, il repasse bien devant : le repos
    // diffère, il n'enterre pas.
    const rested = makeExercise({ mastery: 0, attempts: 2, last_worked_at: dayAgo(2) });
    const restedSessions = [
      makeSession(rested.id, { result: "échoué", started_at: dayAgo(2) }),
      makeSession(rested.id, { result: "échoué", started_at: dayAgo(3) }),
    ];
    const otherFresh = makeExercise();
    expect(recommendExercises([rested, otherFresh], restedSessions, 2, { now: NOW })[0].exercise.id).toBe(rested.id);
  });

  it("entre deux exercices ratés, le plus ancien passe devant", () => {
    const recent = attempted(0);
    const older = attempted(2);
    const order = recommendExercises([recent.exercise, older.exercise], [recent.session, older.session], 2, { now: NOW }).map(
      (r) => r.exercise.id
    );
    expect(order[0]).toBe(older.exercise.id);
  });
});

/**
 * « Partiel » était le tiers du feedback qui ne servait à rien : aucune
 * raison, aucun terme de score. Déclarer « Partiel » ne changeait donc
 * strictement rien à la suite — et, pire, trois « Partiel » d'affilée
 * suffisaient à faire basculer TOUS les scores à NaN (voir
 * `comfortDifficulty`), figeant les propositions sur les mêmes exercices,
 * jour après jour. Rejoué sur la vraie banque, 14 jours : 42 propositions
 * pour 3 exercices distincts, les mêmes trois du premier au dernier jour.
 */
describe("Partiel — le résultat le plus fréquent doit compter", () => {
  const dayAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

  it("un exercice marqué maîtrisé puis rendu à moitié revient dans les propositions", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 3, last_worked_at: dayAgo(4) });
    const sessions = [makeSession(exercise.id, { result: "partiel", hints_used: 0, started_at: dayAgo(4) })];
    const [result] = recommendExercises([exercise], sessions, 5, { now: NOW });
    expect(result).toBeDefined();
    expect(result.reasons).toContain("Réussi à moitié");
  });

  it("… et il passe devant un exercice jamais ouvert — sinon il resterait retenu sans jamais être proposé", () => {
    const partial = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 3, last_worked_at: dayAgo(4) });
    const fresh = makeExercise();
    const sessions = [makeSession(partial.id, { result: "partiel", hints_used: 0, started_at: dayAgo(4) })];
    const order = recommendExercises([fresh, partial], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(partial.id);
  });

  it("à profil identique, l'urgence suit ce que la tentative prouve : échoué, puis partiel, puis réussi avec aide", () => {
    const profile = () => makeExercise({ status: "maîtrisé", mastery: 100, attempts: 1, last_worked_at: dayAgo(4) });
    const failed = profile();
    const partial = profile();
    const assisted = profile();
    const sessions = [
      makeSession(failed.id, { result: "échoué", hints_used: 0, started_at: dayAgo(4) }),
      makeSession(partial.id, { result: "partiel", hints_used: 0, started_at: dayAgo(4) }),
      makeSession(assisted.id, { result: "réussi", hints_used: ASSISTED_HINTS_THRESHOLD + 1, started_at: dayAgo(4) }),
    ];
    const order = recommendExercises([assisted, partial, failed], sessions, 3, { now: NOW }).map((r) => r.exercise.id);
    expect(order).toEqual([failed.id, partial.id, assisted.id]);
  });

  it("le repos vaut aussi pour le partiel : pas le lendemain, mais bien une fois le repos écoulé", () => {
    const attempted = (days: number) => {
      const exercise = makeExercise({ attempts: 1, last_worked_at: dayAgo(days) });
      return { exercise, session: makeSession(exercise.id, { result: "partiel", hints_used: 0, started_at: dayAgo(days) }) };
    };
    const yesterday = attempted(1);
    const freshA = makeExercise();
    expect(recommendExercises([yesterday.exercise, freshA], [yesterday.session], 2, { now: NOW })[0].exercise.id).toBe(freshA.id);

    const restedFor = attempted(4);
    const freshB = makeExercise();
    expect(recommendExercises([restedFor.exercise, freshB], [restedFor.session], 2, { now: NOW })[0].exercise.id).toBe(restedFor.exercise.id);
  });

  it("RÉGRESSION : une fenêtre entièrement composée de « partiel » donne un niveau de confort exploitable, jamais NaN", () => {
    const exercises = Array.from({ length: 3 }, () => makeExercise({ difficulty: 4 }));
    const sessions = exercises.map((exercise) => makeSession(exercise.id, { result: "partiel", hints_used: 0 }));
    const comfort = comfortDifficulty(exercises, sessions)!;
    expect(comfort).not.toBeNull();
    expect(Number.isNaN(comfort.target)).toBe(false);
    expect(comfort.target).toBe(4);
  });

  it("RÉGRESSION : trois « partiel » d'affilée ne figent pas le classement (tous les scores restent des nombres, le tri opère)", () => {
    const attempted = Array.from({ length: 3 }, () => makeExercise({ difficulty: 3, attempts: 1, last_worked_at: dayAgo(5) }));
    const sessions = attempted.map((exercise) => makeSession(exercise.id, { result: "partiel", hints_used: 0, started_at: dayAgo(5) }));
    const fresh = makeExercise({ difficulty: 3 });

    const results = recommendExercises([fresh, ...attempted], sessions, 10, { now: NOW });

    expect(results).toHaveLength(4);
    for (const result of results) expect(Number.isFinite(result.score)).toBe(true);
    // Les trois exercices à moitié traités passent devant celui qui n'a
    // jamais été ouvert : c'est exactement ce que le classement figé (NaN)
    // rendait impossible.
    expect(results.slice(0, 3).map((r) => r.exercise.id).sort()).toEqual(attempted.map((e) => e.id).sort());
    expect(results[3].exercise.id).toBe(fresh.id);
  });

  it("explainReasons traduit le partiel en une phrase, sans retomber sur le libellé brut", () => {
    expect(explainReasons(["Réussi à moitié", "Maîtrise faible"])).toBe("Tu ne l'avais traité qu'à moitié — on le reprend en entier.");
  });
});

/**
 * `status`/`mastery` sont saisis à la main et vieillissent mal ; un résultat
 * de séance est un fait daté. Quand les deux se contredisent, c'est le fait
 * qui doit décider du CLASSEMENT (jamais des données de l'élève). Sans ce
 * plafond, un exercice coché « maîtrisé / 100 % » puis échoué tombait à ~-40
 * quand un exercice jamais ouvert vaut ~85 : il était bien retenu, avec la
 * raison « Échec récent », et pourtant jamais proposé.
 */
describe("Échec sur une fiche déclarée maîtrisée — le fait prime sur l'auto-évaluation", () => {
  const dayAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

  it("un exercice maîtrisé à 100 % puis échoué repasse devant un exercice jamais ouvert", () => {
    const failed = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 4, last_worked_at: dayAgo(4) });
    const fresh = makeExercise();
    const sessions = [makeSession(failed.id, { result: "échoué", hints_used: 0, started_at: dayAgo(4) })];
    const order = recommendExercises([fresh, failed], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(failed.id);
  });

  it("la fiche de l'élève n'est jamais réécrite : seul le classement en tient compte", () => {
    const failed = makeExercise({ status: "maîtrisé", mastery: 100, attempts: 4, last_worked_at: dayAgo(4) });
    const sessions = [makeSession(failed.id, { result: "échoué", hints_used: 0, started_at: dayAgo(4) })];
    recommendExercises([failed], sessions, 2, { now: NOW });
    expect(failed.status).toBe("maîtrisé");
    expect(failed.mastery).toBe(100);
  });
});

/**
 * La diversification doit DÉPARTAGER des candidats comparables, pas passer
 * devant l'urgence. Le round-robin strict à deux niveaux, lui, repoussait le
 * deuxième exercice le plus urgent derrière le meilleur de chacune des six
 * autres matières : un élève qui venait d'échouer sur trois exercices de
 * maths n'en revoyait qu'un seul dans une séance de cinq.
 */
describe("Diversité — elle départage, elle ne prime pas sur l'urgence", () => {
  const dayAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

  it("plusieurs échecs dans un même chapitre ne sont pas noyés sous un exercice frais de chaque autre matière", () => {
    const failed = Array.from({ length: 3 }, () =>
      makeExercise({ subject: "Mathématiques", chapter_id: "chap-faible", status: "à revoir", mastery: 0, attempts: 2, last_worked_at: dayAgo(4) })
    );
    const sessions = failed.map((exercise) => makeSession(exercise.id, { result: "échoué", hints_used: 0, started_at: dayAgo(4) }));
    const fresh = (["Physique", "Chimie", "Français", "Anglais"] as Subject[]).map((subject) => makeExercise({ subject }));

    const top = recommendExercises([...failed, ...fresh], sessions, 5, { now: NOW });
    const failedIds = new Set(failed.map((exercise) => exercise.id));

    expect(top.filter((r) => failedIds.has(r.exercise.id)).length).toBeGreaterThanOrEqual(2);
    // … sans pour autant monopoliser la séance : les autres matières restent servies.
    expect(top.some((r) => !failedIds.has(r.exercise.id))).toBe(true);
  });

  it("à scores égaux (banque neuve), la rotation entre matières reste stricte", () => {
    const maths = Array.from({ length: 4 }, () => makeExercise({ subject: "Mathématiques" }));
    const physique = Array.from({ length: 2 }, () => makeExercise({ subject: "Physique" }));
    const subjects = recommendExercises([...maths, ...physique], [], 4, { now: NOW }).map((r) => r.exercise.subject);
    expect(subjects).toEqual(["Mathématiques", "Physique", "Mathématiques", "Physique"]);
  });

  it("aucun candidat n'est perdu ni dupliqué par la diversification", () => {
    const bank = [
      ...Array.from({ length: 5 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "chap-A" })),
      ...Array.from({ length: 2 }, () => makeExercise({ subject: "Physique", chapter_id: null })),
      ...Array.from({ length: 3 }, () => makeExercise({ subject: "Chimie", chapter_id: "chap-C", mastery: 25 })),
    ];
    const all = recommendExercises(bank, [], bank.length, { now: NOW });
    expect(new Set(all.map((r) => r.exercise.id)).size).toBe(bank.length);
  });
});

/**
 * LA question du produit : « déclarer Réussi / Partiel / Échoué change-t-il
 * réellement les exercices suivants ? ». Un seul et même exercice, un seul et
 * même profil de fiche — seul le résultat déclaré change.
 */
describe("Boucle de feedback — le résultat déclaré change réellement la suite", () => {
  const dayAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

  function scoreAfter(result: AttemptResult | null, hintsUsed: number | null): number {
    const exercise = makeExercise({ status: "en cours", mastery: 25, attempts: 1, last_worked_at: dayAgo(4) });
    const sessions = [makeSession(exercise.id, { result, hints_used: hintsUsed, started_at: dayAgo(4) })];
    return recommendExercises([exercise], sessions, 1, { now: NOW })[0].score;
  }

  it("échoué remonte, partiel remonte moins, réussi en autonomie redescend — et l'étape passée ne bouge rien", () => {
    const skipped = scoreAfter(null, null);
    expect(scoreAfter("échoué", 0)).toBeGreaterThan(scoreAfter("partiel", 0));
    expect(scoreAfter("partiel", 0)).toBeGreaterThan(skipped);
    expect(scoreAfter("réussi", 0)).toBeLessThan(skipped);
    // « Passer » l'étape du résultat doit rester neutre : même score que si
    // le champ n'existait pas (séance antérieure, séance libre…).
    expect(scoreAfter(null, null)).toBe(skipped);
  });

  it("chaque résultat produit une raison différente et lisible", () => {
    const reasonsFor = (result: AttemptResult, hintsUsed: number) => {
      const exercise = makeExercise({ status: "en cours", mastery: 50, attempts: 1, last_worked_at: dayAgo(4) });
      const sessions = [makeSession(exercise.id, { result, hints_used: hintsUsed, started_at: dayAgo(4) })];
      return recommendExercises([exercise], sessions, 1, { now: NOW })[0].reasons;
    };
    expect(reasonsFor("échoué", 0)).toContain("Échec récent");
    expect(reasonsFor("partiel", 0)).toContain("Réussi à moitié");
    expect(reasonsFor("réussi", ASSISTED_HINTS_THRESHOLD)).toContain("Réussi avec aide");
    expect(reasonsFor("réussi", 0)).toContain("Réussi récemment");
  });
});
