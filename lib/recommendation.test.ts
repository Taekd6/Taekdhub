import { describe, expect, it } from "vitest";
import { ASSISTED_HINTS_THRESHOLD, comfortDifficulty, computeExerciseBankStats, computeWorkingLevel, explainReasons, isNeverWorked, recommendExercises } from "@/lib/recommendation";
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
    correction_viewed: null,
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

    // UNE FOIS LE REPOS PASSÉ, plusieurs échecs pèsent bien plus qu'un seul :
    // c'est le sens du signal, et il est intact.
    //
    // La comparaison se fait volontairement APRÈS la période de repos. Tant
    // qu'on est dedans, l'ordre est désormais l'inverse — et c'est délibéré :
    // le repos imposé grandit avec l'enlisement (voir `recentAttemptPenalty`),
    // donc un exercice raté deux fois de suite hier passe TEMPORAIREMENT
    // derrière un exercice raté une seule fois. Sans cette inversion, un
    // rejeu de 90 jours sur la vraie banque proposait le même exercice
    // quatre-vingt-dix fois d'affilée à un élève qui échoue.
    const AFTER_REST = new Date("2026-08-25T12:00:00.000Z");
    const [singleRested] = recommendExercises([single], singleSessions, 10, { now: AFTER_REST });
    const [repeatedRested] = recommendExercises([repeated], repeatedSessions, 10, { now: AFTER_REST });
    expect(repeatedRested.score).toBeGreaterThan(singleRested.score);
  });

  it("un exercice raté plusieurs fois de suite cède temporairement sa place — le repos grandit avec l'enlisement", () => {
    // La contrepartie explicite du test ci-dessus. Le premier échec dit
    // « retente » ; le quatrième dit « ce n'est pas cet exercice le problème ».
    const once = makeExercise({ status: "à revoir", mastery: 0, attempts: 1, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const onceSessions = [makeSession(once.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" })];

    const stuck = makeExercise({ status: "à revoir", mastery: 0, attempts: 4, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const stuckSessions = [
      makeSession(stuck.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" }),
      makeSession(stuck.id, { started_at: "2026-08-08T00:00:00.000Z", result: "échoué" }),
      makeSession(stuck.id, { started_at: "2026-08-07T00:00:00.000Z", result: "échoué" }),
      makeSession(stuck.id, { started_at: "2026-08-06T00:00:00.000Z", result: "échoué" }),
    ];

    const [onceResult] = recommendExercises([once], onceSessions, 10, { now: NOW });
    const [stuckResult] = recommendExercises([stuck], stuckSessions, 10, { now: NOW });
    expect(stuckResult.score).toBeLessThan(onceResult.score);

    // Et il revient de lui-même : le repos décroît, il n'exclut jamais.
    const LATER = new Date("2026-08-25T12:00:00.000Z");
    const [stuckLater] = recommendExercises([stuck], stuckSessions, 10, { now: LATER });
    expect(stuckLater.score).toBeGreaterThan(stuckResult.score);
  });

  it("une réussite remet le compteur d'enlisement à zéro", () => {
    // `consecutiveFailureCount` s'arrête à la première tentative non échouée :
    // un élève qui débloque un exercice ne doit pas traîner la pénalité de ses
    // échecs précédents.
    const recovered = makeExercise({ status: "à revoir", mastery: 0, attempts: 4, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const recoveredSessions = [
      makeSession(recovered.id, { started_at: "2026-08-09T00:00:00.000Z", result: "réussi", hints_used: 0 }),
      makeSession(recovered.id, { started_at: "2026-08-08T00:00:00.000Z", result: "échoué" }),
      makeSession(recovered.id, { started_at: "2026-08-07T00:00:00.000Z", result: "échoué" }),
      makeSession(recovered.id, { started_at: "2026-08-06T00:00:00.000Z", result: "échoué" }),
    ];
    const stillStuck = makeExercise({ status: "à revoir", mastery: 0, attempts: 4, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const stillStuckSessions = [
      makeSession(stillStuck.id, { started_at: "2026-08-09T00:00:00.000Z", result: "échoué" }),
      makeSession(stillStuck.id, { started_at: "2026-08-08T00:00:00.000Z", result: "échoué" }),
      makeSession(stillStuck.id, { started_at: "2026-08-07T00:00:00.000Z", result: "échoué" }),
      makeSession(stillStuck.id, { started_at: "2026-08-06T00:00:00.000Z", result: "échoué" }),
    ];

    const [recoveredResult] = recommendExercises([recovered], recoveredSessions, 10, { now: NOW });
    const [stuckResult] = recommendExercises([stillStuck], stillStuckSessions, 10, { now: NOW });
    expect(recoveredResult.score).toBeGreaterThan(stuckResult.score);
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
 * Maîtrise silencieuse (audit moteur) — le pendant exact de "Réussite
 * assistée" ci-dessus, dans l'autre sens. `mastery`/`status` sont saisis à
 * la main (components/exercises/focus-view.tsx) ; rien ne les met à jour
 * après une séance. Un élève qui enchaîne des réussites AUTONOMES sans
 * jamais revenir déclarer l'exercice maîtrisé le voyait rester recommandé
 * indéfiniment à un score élevé — `masteryGap` (le plus gros terme du
 * score) ignorait ce signal pourtant déjà disponible dans l'historique.
 */
describe("Maîtrise silencieuse — un historique de réussites autonomes doit primer sur mastery/status jamais mis à jour", () => {
  // `last_worked_at` volontairement hors du repos de 3 jours (voir "Repos
  // après une tentative" ci-dessus) : sans ce recul, `recentAttemptPenalty`
  // masquerait à lui seul l'effet mesuré ici, sans rapport avec la
  // correction testée.
  function autonomousSuccesses(count: number, exerciseOverrides: Partial<Exercise> = {}) {
    const exercise = makeExercise({ status: "à faire", mastery: 0, attempts: count, last_worked_at: new Date(NOW.getTime() - 5 * 86400000).toISOString(), ...exerciseOverrides });
    const sessions = Array.from({ length: count }, (_, i) =>
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - (5 + i) * 86400000).toISOString() })
    );
    return { exercise, sessions };
  }

  it("3 réussites autonomes d'affilée, jamais déclarées : passe DERRIÈRE un exercice jamais travaillé", () => {
    const { exercise, sessions } = autonomousSuccesses(3);
    const fresh = makeExercise();
    const order = recommendExercises([exercise, fresh], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(fresh.id);
  });

  it("moins de 3 réussites autonomes : la correction ne s'applique pas encore, comportement inchangé", () => {
    const { exercise, sessions } = autonomousSuccesses(2);
    const fresh = makeExercise();
    const order = recommendExercises([exercise, fresh], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    // Toujours derrière un exercice jamais travaillé (successPenalty existant), mais sans la correction de maîtrise silencieuse en plus.
    expect(order[0]).toBe(fresh.id);
  });

  it("une réussite AIDÉE dans la série interrompt le streak autonome — la correction ne s'applique pas", () => {
    const exercise = makeExercise({ status: "à faire", mastery: 0, attempts: 3, last_worked_at: NOW.toISOString() });
    const sessions = [
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 0 * 86400000).toISOString() }),
      makeSession(exercise.id, { result: "réussi", hints_used: 3, started_at: new Date(NOW.getTime() - 1 * 86400000).toISOString() }),
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 2 * 86400000).toISOString() }),
    ];
    // Un seul résultat récent autonome (le plus récent) : le streak vaut 1, sous le seuil.
    const result = recommendExercises([exercise], sessions, 5, { now: NOW });
    expect(result.map((r) => r.exercise.id)).toContain(exercise.id);
  });

  it("un échec après la série de réussites autonomes annule immédiatement la correction — l'exercice redevient prioritaire", () => {
    // Échec à J-4 (hors repos de 3 jours, voir "Repos après une tentative" ci-dessus — sans quoi le repos masquerait la mesure) précédé de 3 réussites autonomes plus anciennes.
    const exercise = makeExercise({ status: "à faire", mastery: 0, attempts: 4, last_worked_at: new Date(NOW.getTime() - 4 * 86400000).toISOString() });
    const sessions = [
      makeSession(exercise.id, { result: "échoué", started_at: new Date(NOW.getTime() - 4 * 86400000).toISOString() }),
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 5 * 86400000).toISOString() }),
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 6 * 86400000).toISOString() }),
      makeSession(exercise.id, { result: "réussi", hints_used: 0, started_at: new Date(NOW.getTime() - 7 * 86400000).toISOString() }),
    ];
    const fresh = makeExercise();
    const order = recommendExercises([exercise, fresh], sessions, 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(exercise.id);
  });

  it("ne modifie jamais mastery/status réels de l'élève — correction de classement uniquement", () => {
    const { exercise, sessions } = autonomousSuccesses(5);
    recommendExercises([exercise], sessions, 5, { now: NOW });
    expect(exercise.mastery).toBe(0);
    expect(exercise.status).toBe("à faire");
  });
});

/**
 * Départage par difficulté (audit moteur) — sans lui, deux exercices "jamais
 * travaillé" du même chapitre ont un score RIGOUREUSEMENT identique tant que
 * `comfort` n'existe pas (moins de 3 tentatives qualifiées dans toute la
 * banque — le cas de tout nouvel élève) : l'ordre ne dépendait alors que de
 * la position dans le tableau source, pas de la difficulté. Mesuré sur la
 * vraie banque : 27 des 51 chapitres n'ont pas leur exercice le plus facile
 * en premier.
 */
describe("Départage par difficulté à score égal — un débutant voit le plus facile d'abord", () => {
  it("à score identique (cold start), le plus facile passe devant, quel que soit l'ordre du tableau source", () => {
    const hard = makeExercise({ difficulty: 5 });
    const easy = makeExercise({ difficulty: 1 });
    expect(recommendExercises([hard, easy], [], 2, { now: NOW }).map((r) => r.exercise.id)[0]).toBe(easy.id);
    expect(recommendExercises([easy, hard], [], 2, { now: NOW }).map((r) => r.exercise.id)[0]).toBe(easy.id);
  });

  it("un score réellement différent prime toujours sur la difficulté — jamais l'inverse", () => {
    const urgentButHard = makeExercise({ difficulty: 5, status: "à revoir", mastery: 0 });
    const freshButEasy = makeExercise({ difficulty: 1 });
    const order = recommendExercises([urgentButHard, freshButEasy], [], 2, { now: NOW }).map((r) => r.exercise.id);
    expect(order[0]).toBe(urgentButHard.id);
  });
});

/**
 * Audit transversal (chantier "boucle pédagogique complète") — robustesse
 * numérique du score. `normalizeExercise` (lib/storage.ts) garantit qu'aucune
 * date invalide ne sort jamais du stockage réel, mais `recommendExercises`
 * elle-même doit rester robuste : un seul exercice avec une date illisible ne
 * doit jamais transformer `NaN` en résultat de `.sort()` pour TOUTE la
 * banque (comparateur `(a,b) => b.score - a.score`, indéfini dès qu'un score
 * vaut `NaN`) — trouvé en audit avant correction de `daysSinceLastWorked`.
 */
describe("Robustesse — last_worked_at illisible (audit transversal)", () => {
  it("un last_worked_at qui n'est pas une date valide ne produit jamais un score NaN", () => {
    const corrupted = makeExercise({ status: "maîtrisé", mastery: 100, last_worked_at: "pas-une-date" });
    const score = recommendExercises([corrupted], [], 1, { now: NOW })[0]?.score;
    expect(Number.isNaN(score)).toBe(false);
  });

  it("un exercice à date illisible ne contamine pas le classement des autres exercices de la banque", () => {
    const corrupted = makeExercise({ status: "maîtrisé", mastery: 100, last_worked_at: "pas-une-date" });
    const healthy = makeExercise({ status: "à revoir", mastery: 25 });
    const result = recommendExercises([corrupted, healthy], [], 2, { now: NOW });
    for (const { score } of result) expect(Number.isNaN(score)).toBe(false);
  });
});

describe("Cas limites numériques — budget et durée (audit transversal)", () => {
  it("un budget de temps négatif ne sélectionne rien et ne lève jamais d'exception", () => {
    const exercise = makeExercise();
    expect(recommendExercises([exercise], [], 5, { now: NOW, availableMinutes: -10 })).toEqual([]);
  });

  it("une durée estimée nulle (estimated_minutes: 0) ne casse pas le calcul de durée — retombe sur une estimation dérivée, jamais 0 ni NaN", () => {
    const zero = makeExercise({ estimated_minutes: 0 });
    const [result] = recommendExercises([zero], [], 1, { now: NOW, availableMinutes: 30 });
    expect(result).toBeDefined();
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it("une durée estimée énorme n'entre simplement jamais dans un budget réaliste, sans planter", () => {
    const huge = makeExercise({ estimated_minutes: 100000 });
    expect(recommendExercises([huge], [], 5, { now: NOW, availableMinutes: 60 })).toEqual([]);
  });

  it("toute la banque déjà maîtrisée et fraîche : liste vide, jamais une erreur", () => {
    const done = Array.from({ length: 10 }, () => makeExercise({ status: "maîtrisé", mastery: 100, attempts: 3, last_worked_at: NOW.toISOString() }));
    expect(recommendExercises(done, [], 10, { now: NOW })).toEqual([]);
  });

  it("un seul exercice signalé au milieu d'une banque autrement à jour : remonte seul, sans erreur", () => {
    const target = makeExercise({ status: "à revoir", mastery: 25 });
    const done = Array.from({ length: 15 }, () => makeExercise({ status: "maîtrisé", mastery: 100, attempts: 2, last_worked_at: NOW.toISOString() }));
    const result = recommendExercises([target, ...done], [], 6, { now: NOW });
    expect(result.map((r) => r.exercise.id)).toEqual([target.id]);
  });
});

describe("Performance (audit transversal) — centaines d'exercices, milliers de séances", () => {
  it("reste rapide à une échelle réaliste (plusieurs années d'historique simulées)", () => {
    const exercises = Array.from({ length: 600 }, (_, i) =>
      makeExercise({ mastery: ([0, 25, 50, 75, 100] as const)[i % 5], status: (["à faire", "en cours", "à revoir", "maîtrisé"] as const)[i % 4] })
    );
    const sessions: WorkSession[] = [];
    for (let i = 0; i < 8000; i++) {
      const exercise = exercises[i % exercises.length];
      sessions.push(
        makeSession(exercise.id, {
          started_at: new Date(NOW.getTime() - (i % 900) * 86400000).toISOString(),
          result: (["réussi", "partiel", "échoué"] as const)[i % 3],
          hints_used: i % 4,
          correction_viewed: null,
        })
      );
    }
    const start = performance.now();
    recommendExercises(exercises, sessions, 6, { now: NOW, availableMinutes: 45 });
    const elapsed = performance.now() - start;
    // Marge généreuse (dix fois ce qui serait déjà perceptible) : ce test ne
    // doit échouer qu'en cas de vraie régression de complexité algorithmique,
    // jamais au moindre bruit de machine — voir lib/plan.test.ts pour
    // l'équivalent côté `computeDailyPlan`.
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("recommendExercises — un élève qui échoue ne s'enlise jamais sur un seul exercice", () => {
  /**
   * Régression mesurée sur la banque livrée avant correctif : en rejouant
   * 90 jours avec un élève qui rate ce qu'on lui propose, le moteur
   * proposait UN SEUL exercice distinct, quatre-vingt-dix fois de suite (et
   * 2 seulement à 30 min, 7 à 90 min). Le même élève, s'il réussit, en voyait
   * 57 à 303 : le moteur était sain, il ne savait simplement pas voir
   * l'enlisement.
   *
   * Cause : le repos après tentative était forfaitaire (3 jours, 50 points)
   * quel que soit le nombre d'échecs, alors que l'exercice bloqué menait de
   * 45 points APRÈS pénalité. Il revenait donc en tête chaque lendemain.
   */
  function replay(days: number, outcome: "échoué" | "réussi"): string[] {
    const exercises = Array.from({ length: 12 }, (unused, index) =>
      makeExercise({ id: `rep-${index}`, difficulty: 3, estimated_minutes: 20 })
    );
    const sessions: WorkSession[] = [];
    const seen: string[] = [];

    for (let day = days; day >= 1; day--) {
      const today = new Date(NOW.getTime() - day * 86400000);
      const [top] = recommendExercises(exercises, sessions, 1, { now: today });
      if (!top) break;
      seen.push(top.exercise.id);
      sessions.push(
        makeSession(top.exercise.id, {
          started_at: today.toISOString(),
          result: outcome,
          hints_used: outcome === "réussi" ? 0 : 3,
          correction_viewed: null,
        })
      );
      const live = exercises.find((item) => item.id === top.exercise.id)!;
      live.attempts += 1;
      live.last_worked_at = today.toISOString();
      live.status = outcome === "réussi" ? "maîtrisé" : "à revoir";
      if (outcome === "réussi") live.mastery = 100;
    }
    return seen;
  }

  it("21 jours d'échecs ne produisent jamais un seul et même exercice", () => {
    const seen = replay(21, "échoué");
    expect(seen.length).toBe(21);
    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  it("le même exercice n'est jamais proposé plus de trois jours de suite", () => {
    const seen = replay(21, "échoué");
    let run = 1;
    let worst = 1;
    for (let index = 1; index < seen.length; index++) {
      run = seen[index] === seen[index - 1] ? run + 1 : 1;
      worst = Math.max(worst, run);
    }
    expect(worst).toBeLessThanOrEqual(3);
  });

  it("le chemin de l'élève qui réussit reste intact : un exercice différent chaque jour", () => {
    const seen = replay(12, "réussi");
    expect(new Set(seen).size).toBe(seen.length);
  });
});
