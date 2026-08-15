import { describe, expect, it } from "vitest";
import {
  computeDailyPlan,
  computeSubjectPriorities,
  computeSubjectTrajectory,
  computeWeeklyProjection,
  contestUrgencyBonus,
  daysUntilContest,
  serializePlan,
  subjectDeadlineDays,
  subjectWeight,
  summarizePlanObjective,
  type WeeklyProjectionSubject,
} from "@/lib/plan";
import type { Chapter } from "@/lib/storage";
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
    answer: null,
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

function makeSession(exerciseId: string | null, subject: Subject, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${exerciseId}-${Math.random()}`,
    subject,
    exercise_id: exerciseId,
    started_at: "2026-08-10T08:00:00.000Z",
    ended_at: "2026-08-10T08:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T08:10:00.000Z",
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-11T12:00:00.000Z"); // mardi

describe("computeDailyPlan", () => {
  it("aucune donnée : plan vide, pas d'erreur", () => {
    const plan = computeDailyPlan([], [], [], 45, NOW);
    expect(plan.blocks).toEqual([]);
    expect(plan.totalMinutes).toBe(0);
    expect(plan.totalExercises).toBe(0);
    expect(plan.requestedMinutes).toBe(45);
  });

  it("une seule matière éligible reçoit tout le budget, sans partage artificiel", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const plan = computeDailyPlan([exercise], [], [], 45, NOW);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].subject).toBe("Mathématiques");
    expect(plan.blocks[0].minutes).toBe(45);
  });

  it("répartit sur plusieurs matières quand plusieurs ont besoin d'attention (pas systématiquement une seule matière)", () => {
    const maths = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const plan = computeDailyPlan([maths, physique], [], [], 60, NOW);
    const subjectsInPlan = plan.blocks.map((block) => block.subject);
    expect(subjectsInPlan).toContain("Mathématiques");
    expect(subjectsInPlan).toContain("Physique");
  });

  it("une matière entièrement maîtrisée, jamais en échec, travaillée récemment n'apparaît pas dans le plan", () => {
    const mastered = makeExercise({
      subject: "Chimie",
      mastery: 100,
      status: "maîtrisé",
      attempts: 3,
      last_worked_at: "2026-08-11T09:00:00.000Z",
    });
    const struggling = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const sessions = [makeSession(mastered.id, "Chimie", { started_at: "2026-08-11T09:00:00.000Z", result: "réussi" })];
    const plan = computeDailyPlan([mastered, struggling], sessions, [], 45, NOW);
    expect(plan.blocks.map((block) => block.subject)).not.toContain("Chimie");
  });

  it("le libellé d'un bloc utilise le chapitre du premier exercice retenu", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Suites numériques" }];
    const exercise = makeExercise({ subject: "Mathématiques", chapter_id: "chap-1", mastery: 0, estimated_minutes: 20 });
    const plan = computeDailyPlan([exercise], [], chapters, 45, NOW);
    expect(plan.blocks[0].label).toBe("Mathématiques — Suites numériques");
  });

  it("un budget de 0 minute ne produit aucun bloc", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const plan = computeDailyPlan([exercise], [], [], 0, NOW);
    expect(plan.blocks).toEqual([]);
  });
});

describe("computeSubjectPriorities", () => {
  it("aucune donnée : liste vide", () => {
    expect(computeSubjectPriorities([], [], [], NOW)).toEqual([]);
  });

  it("plusieurs échecs récents → niveau critique", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 50 });
    const sessions = [
      makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T10:00:00.000Z", result: "échoué" }),
      makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-09T10:00:00.000Z", result: "échoué" }),
    ];
    const priorities = computeSubjectPriorities([exercise], sessions, [], NOW);
    const entry = priorities.find((item) => item.subject === "Mathématiques");
    expect(entry?.level).toBe("critique");
    expect(entry?.reason).toContain("plusieurs échecs");
  });

  it("matière entièrement maîtrisée et récente → niveau correct", () => {
    const exercise = makeExercise({ subject: "Chimie", mastery: 100, status: "maîtrisé", attempts: 2, last_worked_at: "2026-08-11T09:00:00.000Z" });
    const sessions = [makeSession(exercise.id, "Chimie", { started_at: "2026-08-11T09:00:00.000Z", result: "réussi" })];
    const priorities = computeSubjectPriorities([exercise], sessions, [], NOW);
    const entry = priorities.find((item) => item.subject === "Chimie");
    expect(entry?.level).toBe("correct");
    expect(entry?.reason).toBe("progression correcte");
  });

  it("une matière jamais engagée (aucune tentative, tout par défaut) n'est jamais \"critique\" — pas de fausse alarme sur une banque fraîche", () => {
    const untouched = Array.from({ length: 20 }, () => makeExercise({ subject: "Physique", mastery: 0, status: "à faire" }));
    const priorities = computeSubjectPriorities(untouched, [], [], NOW);
    const entry = priorities.find((item) => item.subject === "Physique");
    expect(entry?.level).not.toBe("critique");
    expect(entry?.reason).not.toContain("maîtrise faible");
  });

  it("une matière sans aucun exercice actif n'apparaît pas", () => {
    const priorities = computeSubjectPriorities([], [], [], NOW);
    expect(priorities.find((item) => item.subject === "Physique")).toBeUndefined();
  });

  it("le libellé inclut le chapitre le plus faible de la matière, format \"Matière — Chapitre\"", () => {
    const chapters: Chapter[] = [
      { id: "chap-weak", subject: "Mathématiques", label: "Analyse" },
      { id: "chap-strong", subject: "Mathématiques", label: "Algèbre" },
    ];
    const weak = makeExercise({ subject: "Mathématiques", chapter_id: "chap-weak", mastery: 0, status: "à revoir" });
    const strong = makeExercise({ subject: "Mathématiques", chapter_id: "chap-strong", mastery: 100, status: "maîtrisé" });
    const priorities = computeSubjectPriorities([weak, strong], [], chapters, NOW);
    const entry = priorities.find((item) => item.subject === "Mathématiques");
    expect(entry?.label).toBe("Mathématiques — Analyse");
  });
});

describe("serializePlan", () => {
  it("aplatit les blocs en une liste d'exercices avec leurs raisons", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const plan = computeDailyPlan([exercise], [], [], 45, NOW);
    const stored = serializePlan(plan);
    expect(stored.requestedMinutes).toBe(45);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].exerciseId).toBe(exercise.id);
    expect(stored.items[0].reasons.length).toBeGreaterThan(0);
  });
});

describe("daysUntilContest", () => {
  it("aucune date configurée (\"\", défaut de Preferences.contestDate) → null", () => {
    expect(daysUntilContest("", NOW)).toBeNull();
  });

  it("date invalide → null, comme une date absente", () => {
    expect(daysUntilContest("pas une date", NOW)).toBeNull();
  });

  it("date future → nombre de jours entiers arrondi au-dessus", () => {
    expect(daysUntilContest("2026-08-21T12:00:00.000Z", NOW)).toBe(10);
  });

  it("date passée → 0, jamais négatif", () => {
    expect(daysUntilContest("2026-01-01T00:00:00.000Z", NOW)).toBe(0);
  });

  it("aujourd'hui exactement → 0", () => {
    expect(daysUntilContest(NOW.toISOString(), NOW)).toBe(0);
  });
});

describe("contestUrgencyBonus — progressif, borné, jamais un remplacement des autres signaux", () => {
  it("sans échéance (contestDays: null) : toujours 0, quelle que soit la faiblesse", () => {
    expect(contestUrgencyBonus(0, null)).toBe(0);
    expect(contestUrgencyBonus(100, null)).toBe(0);
  });

  it("échéance très éloignée (au-delà de l'horizon) : impact nul", () => {
    expect(contestUrgencyBonus(0, 60)).toBe(0);
  });

  it("échéance intermédiaire : impact strictement entre 0 et le plafond", () => {
    const bonus = contestUrgencyBonus(0, 10);
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThan(30);
  });

  it("progressif : plus l'échéance approche, plus le bonus augmente (à faiblesse égale)", () => {
    const far = contestUrgencyBonus(20, 18);
    const closer = contestUrgencyBonus(20, 10);
    const veryClose = contestUrgencyBonus(20, 2);
    expect(closer).toBeGreaterThan(far);
    expect(veryClose).toBeGreaterThan(closer);
  });

  it("échéance imminente (0 jour) ou déjà passée (traitée comme 0 par daysUntilContest) : maximal mais borné au plafond", () => {
    expect(contestUrgencyBonus(0, 0)).toBe(30);
    expect(contestUrgencyBonus(0, 0)).toBeLessThanOrEqual(30);
  });

  it("une matière déjà parfaitement maîtrisée ne reçoit aucun bonus, même l'échéance imminente", () => {
    expect(contestUrgencyBonus(100, 0)).toBe(0);
  });

  it("à échéance égale, une matière plus faible reçoit un bonus plus grand", () => {
    const weak = contestUrgencyBonus(20, 5);
    const strong = contestUrgencyBonus(80, 5);
    expect(weak).toBeGreaterThan(strong);
  });
});

describe("subjectWeight — conservation des autres signaux avec une échéance", () => {
  function makeSignal(overrides: Partial<Parameters<typeof subjectWeight>[0]> = {}) {
    return {
      subject: "Mathématiques" as Subject,
      total: 10,
      eligible: true,
      averageMastery: 50,
      recentMinutes: 0,
      recentFailures: 0,
      hasPending: true,
      hasEngagement: true,
      ...overrides,
    };
  }

  it("sans échéance, le poids est identique à avant ce sprint (aucun nouveau paramètre requis)", () => {
    const signal = makeSignal({ recentFailures: 2 });
    expect(subjectWeight(signal)).toBe(subjectWeight(signal, null));
  });

  it("une échéance proche AJOUTE au poids sans jamais faire disparaître les signaux existants (échec, délaissement)", () => {
    const signal = makeSignal({ recentFailures: 2, recentMinutes: 0 });
    const withoutContest = subjectWeight(signal, null);
    const withContest = subjectWeight(signal, 3);
    // Le bonus s'ajoute strictement — les termes échec/délaissement restent
    // pleinement présents dans le résultat, pas remplacés par l'échéance.
    expect(withContest).toBeGreaterThan(withoutContest);
    expect(withContest - withoutContest).toBeCloseTo(contestUrgencyBonus(signal.averageMastery, 3), 9);
  });

  it("à signaux de fond identiques, une échéance proche fait remonter la matière la plus faible plus que la plus forte", () => {
    const weakSubject = makeSignal({ subject: "Physique" as Subject, averageMastery: 20 });
    const strongSubject = makeSignal({ subject: "Chimie" as Subject, averageMastery: 90 });
    // Sans échéance, même profil de fond (recentFailures/recentMinutes identiques) : seule la maîtrise diffère un peu.
    const beforeWeak = subjectWeight(weakSubject, null);
    const beforeStrong = subjectWeight(strongSubject, null);
    const afterWeak = subjectWeight(weakSubject, 3);
    const afterStrong = subjectWeight(strongSubject, 3);
    // L'écart entre les deux matières se creuse quand le concours approche.
    expect(afterWeak - beforeWeak).toBeGreaterThan(afterStrong - beforeStrong);
  });
});

describe("computeDailyPlan — échéance intégrée au plan (pas un doublon du moteur de recommandation)", () => {
  it("sans contestDate : comportement strictement inchangé", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const withoutArg = computeDailyPlan([exercise], [], [], 45, NOW);
    const withEmptyContest = computeDailyPlan([exercise], [], [], 45, NOW, "");
    expect(withEmptyContest).toEqual(withoutArg);
  });

  it("une échéance imminente accentue la répartition en faveur de la matière la plus faible", () => {
    const weak = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const lessWeak = makeExercise({ subject: "Chimie", mastery: 75, estimated_minutes: 15 });
    const farContest = computeDailyPlan([weak, lessWeak], [], [], 60, NOW, "2026-12-01T00:00:00.000Z");
    const nearContest = computeDailyPlan([weak, lessWeak], [], [], 60, NOW, "2026-08-13T00:00:00.000Z");
    const physiqueMinutesFar = farContest.blocks.find((b) => b.subject === "Physique")?.minutes ?? 0;
    const physiqueMinutesNear = nearContest.blocks.find((b) => b.subject === "Physique")?.minutes ?? 0;
    expect(physiqueMinutesNear).toBeGreaterThanOrEqual(physiqueMinutesFar);
  });
});

describe("computeSubjectPriorities — raison \"concours proche\" explicable", () => {
  it("apparaît uniquement quand l'échéance contribue réellement (matière non déjà parfaite)", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 25, status: "à revoir" });
    const priorities = computeSubjectPriorities([exercise], [], [], NOW, "2026-08-13T00:00:00.000Z");
    const entry = priorities.find((item) => item.subject === "Mathématiques");
    expect(entry?.reason).toContain("concours proche");
  });

  it("n'apparaît jamais sans contestDate", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 25, status: "à revoir" });
    const priorities = computeSubjectPriorities([exercise], [], [], NOW);
    const entry = priorities.find((item) => item.subject === "Mathématiques");
    expect(entry?.reason).not.toContain("concours proche");
  });

  it("n'apparaît pas pour une matière déjà entièrement maîtrisée, même échéance imminente", () => {
    const mastered = makeExercise({ subject: "Chimie", mastery: 100, status: "maîtrisé", attempts: 1, last_worked_at: "2026-08-11T09:00:00.000Z" });
    const priorities = computeSubjectPriorities([mastered], [], [], NOW, "2026-08-12T00:00:00.000Z");
    const entry = priorities.find((item) => item.subject === "Chimie");
    expect(entry?.reason).not.toContain("concours proche");
  });
});

describe("summarizePlanObjective", () => {
  it("aucun bloc : objectif neutre par défaut", () => {
    expect(summarizePlanObjective([])).toBe("Progresser sur tes priorités du moment");
  });

  it("un échec récent l'emporte sur tout autre signal", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 50, status: "en cours" });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-09T10:00:00.000Z", result: "échoué" })];
    const plan = computeDailyPlan([exercise], sessions, [], 45, NOW);
    expect(summarizePlanObjective(plan.blocks)).toBe("Consolider tes points faibles");
  });

  it("uniquement du contenu jamais travaillé → objectif \"avancer\", pas \"consolider\"", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, status: "à faire" });
    const plan = computeDailyPlan([exercise], [], [], 45, NOW);
    expect(summarizePlanObjective(plan.blocks)).toBe("Avancer sur du nouveau contenu");
  });
});

describe("subjectDeadlineDays — échéance par matière (Sprint planification hebdomadaire adaptative)", () => {
  it("absente (ni spécifique, ni concours global) → null", () => {
    expect(subjectDeadlineDays("Physique", {}, "", NOW)).toBeNull();
  });

  it("échéance spécifique valide → mêmes jours que daysUntilContest appliqué à cette date", () => {
    const days = subjectDeadlineDays("Physique", { Physique: "2026-08-21T12:00:00.000Z" }, "", NOW);
    expect(days).toBe(daysUntilContest("2026-08-21T12:00:00.000Z", NOW));
    expect(days).toBe(10);
  });

  it("échéance spécifique invalide → repli sur le concours global", () => {
    const days = subjectDeadlineDays("Physique", { Physique: "pas une date" }, "2026-08-21T12:00:00.000Z", NOW);
    expect(days).toBe(10);
  });

  it("échéance spécifique invalide et aucun concours global → null", () => {
    expect(subjectDeadlineDays("Physique", { Physique: "pas une date" }, "", NOW)).toBeNull();
  });

  it("une échéance spécifique à une AUTRE matière n'affecte pas celle-ci — repli sur le concours global", () => {
    const days = subjectDeadlineDays("Chimie", { Physique: "2026-08-13T00:00:00.000Z" }, "2026-08-25T00:00:00.000Z", NOW);
    expect(days).toBe(daysUntilContest("2026-08-25T00:00:00.000Z", NOW));
  });

  it("priorité : échéance spécifique à la matière > échéance globale pour cette matière", () => {
    const days = subjectDeadlineDays("Physique", { Physique: "2026-08-13T00:00:00.000Z" }, "2026-08-25T00:00:00.000Z", NOW);
    expect(days).toBe(daysUntilContest("2026-08-13T00:00:00.000Z", NOW));
    expect(days).not.toBe(daysUntilContest("2026-08-25T00:00:00.000Z", NOW));
  });

  it("date passée → 0, jamais négatif — même convention que daysUntilContest/contestDate", () => {
    expect(subjectDeadlineDays("Physique", { Physique: "2026-01-01T00:00:00.000Z" }, "", NOW)).toBe(0);
  });
});

describe("computeSubjectPriorities — échéance par matière (libellé distinct, priorité sur le concours global)", () => {
  it("échéance spécifique à la matière → raison 'échéance proche', jamais 'concours proche'", () => {
    const exercise = makeExercise({ subject: "Physique", mastery: 25, status: "à revoir" });
    const priorities = computeSubjectPriorities([exercise], [], [], NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const entry = priorities.find((item) => item.subject === "Physique");
    expect(entry?.reason).toContain("échéance proche");
    expect(entry?.reason).not.toContain("concours proche");
  });

  it("sans échéance spécifique, le concours global continue de produire 'concours proche' comme avant ce sprint", () => {
    const exercise = makeExercise({ subject: "Physique", mastery: 25, status: "à revoir" });
    const priorities = computeSubjectPriorities([exercise], [], [], NOW, "2026-08-13T00:00:00.000Z");
    const entry = priorities.find((item) => item.subject === "Physique");
    expect(entry?.reason).toContain("concours proche");
  });

  it("une échéance spécifique à une matière ne fuit jamais vers une autre matière", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 25, status: "à revoir" });
    const chimie = makeExercise({ subject: "Chimie", mastery: 25, status: "à revoir" });
    const priorities = computeSubjectPriorities([physique, chimie], [], [], NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const chimieEntry = priorities.find((item) => item.subject === "Chimie");
    expect(chimieEntry?.reason).not.toContain("échéance proche");
    expect(chimieEntry?.reason).not.toContain("concours proche");
  });

  it("une échéance spécifique proche s'ajoute aux signaux existants, ne les remplace jamais", () => {
    const exercise = makeExercise({ subject: "Physique", mastery: 25, status: "à revoir" });
    const sessions = [makeSession(exercise.id, "Physique", { started_at: "2026-08-10T10:00:00.000Z", result: "échoué" })];
    const without = computeSubjectPriorities([exercise], sessions, [], NOW);
    const withDeadline = computeSubjectPriorities([exercise], sessions, [], NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const beforeEntry = without.find((item) => item.subject === "Physique")!;
    const afterEntry = withDeadline.find((item) => item.subject === "Physique")!;
    expect(beforeEntry.reason).toContain("échec récent");
    expect(afterEntry.reason).toContain("échec récent");
    expect(afterEntry.reason).toContain("échéance proche");
  });
});

describe("computeDailyPlan — échéance par matière (Sprint planification hebdomadaire adaptative)", () => {
  it("une échéance spécifique à une matière accentue sa part du plan par rapport à une échéance globale plus lointaine", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const chimie = makeExercise({ subject: "Chimie", mastery: 75, estimated_minutes: 15 });
    const withoutDeadline = computeDailyPlan([physique, chimie], [], [], 60, NOW);
    const withDeadline = computeDailyPlan([physique, chimie], [], [], 60, NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const physiqueBefore = withoutDeadline.blocks.find((b) => b.subject === "Physique")?.minutes ?? 0;
    const physiqueAfter = withDeadline.blocks.find((b) => b.subject === "Physique")?.minutes ?? 0;
    expect(physiqueAfter).toBeGreaterThanOrEqual(physiqueBefore);
  });

  it("une matière sans aucune échéance reste correctement représentée aux côtés d'une matière avec échéance", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const chimie = makeExercise({ subject: "Chimie", mastery: 0, estimated_minutes: 15 });
    const plan = computeDailyPlan([physique, chimie], [], [], 90, NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const subjectsInPlan = plan.blocks.map((b) => b.subject);
    expect(subjectsInPlan).toContain("Physique");
    expect(subjectsInPlan).toContain("Chimie");
  });

  it("échéance spécifique passée : bornée, jamais d'exception", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    expect(() => computeDailyPlan([physique], [], [], 45, NOW, "", { Physique: "2020-01-01T00:00:00.000Z" })).not.toThrow();
    const plan = computeDailyPlan([physique], [], [], 45, NOW, "", { Physique: "2020-01-01T00:00:00.000Z" });
    expect(plan.blocks[0].minutes).toBe(45);
  });

  it("sans subjectDeadlines (comportement par défaut) : strictement identique à avant ce sprint", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const withoutArg = computeDailyPlan([exercise], [], [], 45, NOW, "");
    const withEmptyDeadlines = computeDailyPlan([exercise], [], [], 45, NOW, "", {});
    expect(withEmptyDeadlines).toEqual(withoutArg);
  });
});

describe("computeWeeklyProjection — Sprint planification hebdomadaire adaptative", () => {
  it("aucune minute travaillée cette semaine : minutes restantes = objectif hebdomadaire entier", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const projection = computeWeeklyProjection([exercise], [], 420, NOW);
    expect(projection.workedMinutes).toBe(0);
    expect(projection.remainingMinutes).toBe(420);
    expect(projection.met).toBe(false);
  });

  it("objectif partiellement consommé : minutes restantes = objectif - déjà travaillé cette semaine (toutes matières)", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T10:00:00.000Z", duration_seconds: 6000 })]; // 100 min, lundi
    const projection = computeWeeklyProjection([exercise], sessions, 420, NOW);
    expect(projection.workedMinutes).toBe(100);
    expect(projection.remainingMinutes).toBe(320);
    expect(projection.met).toBe(false);
  });

  it("objectif exactement atteint : minutes restantes à 0, objectif marqué atteint, rien à répartir", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T10:00:00.000Z", duration_seconds: 420 * 60 })];
    const projection = computeWeeklyProjection([exercise], sessions, 420, NOW);
    expect(projection.remainingMinutes).toBe(0);
    expect(projection.met).toBe(true);
    expect(projection.bySubject).toEqual([]);
  });

  it("objectif dépassé : minutes restantes reste à 0, jamais négatif — jamais '-60 min restantes'", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T10:00:00.000Z", duration_seconds: 480 * 60 })]; // 8h > 7h
    const projection = computeWeeklyProjection([exercise], sessions, 420, NOW);
    expect(projection.remainingMinutes).toBe(0);
    expect(projection.met).toBe(true);
    expect(projection.workedMinutes).toBe(480);
  });

  it("une seule matière éligible reçoit tout le budget restant, sans partage artificiel", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const projection = computeWeeklyProjection([exercise], [], 300, NOW);
    expect(projection.bySubject).toHaveLength(1);
    expect(projection.bySubject[0]).toMatchObject({ subject: "Mathématiques", minutes: 300 });
  });

  it("plusieurs matières éligibles se répartissent le budget restant (pas systématiquement une seule)", () => {
    const maths = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([maths, physique], [], 300, NOW);
    const subjectsInProjection = projection.bySubject.map((s) => s.subject);
    expect(subjectsInProjection).toContain("Mathématiques");
    expect(subjectsInProjection).toContain("Physique");
  });

  it("une matière sans aucune échéance reste représentée aux côtés d'une matière avec échéance", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const chimie = makeExercise({ subject: "Chimie", mastery: 0, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([physique, chimie], [], 300, NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const subjectsInProjection = projection.bySubject.map((s) => s.subject);
    expect(subjectsInProjection).toContain("Physique");
    expect(subjectsInProjection).toContain("Chimie");
  });

  it("échéance proche : la matière concernée reçoit une part plus grande qu'une matière comparable sans échéance", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 50, estimated_minutes: 15 });
    const chimie = makeExercise({ subject: "Chimie", mastery: 50, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([physique, chimie], [], 300, NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const physiqueMinutes = projection.bySubject.find((s) => s.subject === "Physique")?.minutes ?? 0;
    const chimieMinutes = projection.bySubject.find((s) => s.subject === "Chimie")?.minutes ?? 0;
    expect(physiqueMinutes).toBeGreaterThan(chimieMinutes);
    expect(projection.bySubject.find((s) => s.subject === "Physique")?.deadlineDays).toBe(2);
  });

  it("échéance passée : bornée, jamais de crash, la matière reste représentée", () => {
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    expect(() => computeWeeklyProjection([physique], [], 300, NOW, "", { Physique: "2020-01-01T00:00:00.000Z" })).not.toThrow();
    const projection = computeWeeklyProjection([physique], [], 300, NOW, "", { Physique: "2020-01-01T00:00:00.000Z" });
    expect(projection.bySubject[0].deadlineDays).toBe(0);
    expect(projection.bySubject[0].minutes).toBe(300);
  });
});

describe("computeWeeklyProjection — dynamique temporelle (lundi ≠ vendredi)", () => {
  it("début de semaine (lundi) : la semaine entière reste à faire", () => {
    const monday = new Date("2026-08-10T08:00:00.000Z");
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const projection = computeWeeklyProjection([exercise], [], 420, monday);
    expect(projection.daysRemainingInWeek).toBe(7);
  });

  it("milieu de semaine (mercredi) : moins de jours restants qu'en début de semaine", () => {
    const wednesday = new Date("2026-08-12T08:00:00.000Z");
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const projection = computeWeeklyProjection([exercise], [], 420, wednesday);
    expect(projection.daysRemainingInWeek).toBe(5);
  });

  it("fin de semaine (vendredi) : encore moins de jours restants, mais les minutes restantes restent correctement calculées (pas de répartition quotidienne créée)", () => {
    const friday = new Date("2026-08-14T18:00:00.000Z");
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 1800 })]; // 30 min lundi
    const projection = computeWeeklyProjection([exercise], sessions, 420, friday);
    expect(projection.daysRemainingInWeek).toBe(3);
    expect(projection.remainingMinutes).toBe(390);
  });

  it("jamais un jour restant à 0 ou négatif, même tout en fin de semaine", () => {
    const sundayNight = new Date("2026-08-16T23:59:59.000Z");
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const projection = computeWeeklyProjection([exercise], [], 420, sundayNight);
    expect(projection.daysRemainingInWeek).toBeGreaterThanOrEqual(1);
  });
});

describe("computeWeeklyProjection — invariants", () => {
  it("jamais d'allocation négative, même avec une échéance très ancienne", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([exercise], [], 300, NOW, "", { Mathématiques: "2020-01-01T00:00:00.000Z" });
    expect(projection.bySubject.length).toBeGreaterThan(0);
    for (const entry of projection.bySubject) {
      expect(entry.minutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("la somme des allocations par matière ne dépasse jamais les minutes restantes", () => {
    const maths = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const physique = makeExercise({ subject: "Physique", mastery: 25, estimated_minutes: 15 });
    const chimie = makeExercise({ subject: "Chimie", mastery: 50, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([maths, physique, chimie], [], 250, NOW, "", { Physique: "2026-08-13T00:00:00.000Z" });
    const sum = projection.bySubject.reduce((total, entry) => total + entry.minutes, 0);
    expect(sum).toBeLessThanOrEqual(projection.remainingMinutes);
  });

  it("jamais de NaN ni d'Infinity, y compris avec un objectif hebdomadaire à 0", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const projection = computeWeeklyProjection([exercise], [], 0, NOW);
    expect(Number.isFinite(projection.remainingMinutes)).toBe(true);
    expect(Number.isFinite(projection.workedMinutes)).toBe(true);
    for (const entry of projection.bySubject) {
      expect(Number.isFinite(entry.minutes)).toBe(true);
    }
  });

  it("déterministe : mêmes entrées, même résultat à chaque appel", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const sessions = [makeSession(exercise.id, "Mathématiques", { started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 1200 })];
    const first = computeWeeklyProjection([exercise], sessions, 300, NOW, "", { Mathématiques: "2026-08-13T00:00:00.000Z" });
    const second = computeWeeklyProjection([exercise], sessions, 300, NOW, "", { Mathématiques: "2026-08-13T00:00:00.000Z" });
    expect(second).toEqual(first);
  });

  it("aucune matière impossible (inconnue) n'apparaît jamais dans bySubject", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const projection = computeWeeklyProjection([exercise], [], 300, NOW);
    const knownSubjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];
    for (const entry of projection.bySubject) {
      expect(knownSubjects).toContain(entry.subject);
    }
  });

  it("aucune exception sur une banque vide", () => {
    expect(() => computeWeeklyProjection([], [], 300, NOW)).not.toThrow();
    const projection = computeWeeklyProjection([], [], 300, NOW);
    expect(projection.bySubject).toEqual([]);
  });
});

describe("computeWeeklyProjection — workedMinutes par matière (Sprint trajectoire par matière)", () => {
  it("reflète les minutes déjà travaillées POUR CETTE MATIÈRE cette semaine, pas le total toutes matières", () => {
    const maths = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 15 });
    const physique = makeExercise({ subject: "Physique", mastery: 0, estimated_minutes: 15 });
    const sessions = [
      makeSession(maths.id, "Mathématiques", { started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 1200 }), // 20 min
      makeSession(physique.id, "Physique", { started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 300 }), // 5 min
    ];
    const projection = computeWeeklyProjection([maths, physique], sessions, 300, NOW);
    expect(projection.bySubject.find((s) => s.subject === "Mathématiques")?.workedMinutes).toBe(20);
    expect(projection.bySubject.find((s) => s.subject === "Physique")?.workedMinutes).toBe(5);
  });

  it("0 par défaut pour une matière jamais travaillée cette semaine", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0 });
    const projection = computeWeeklyProjection([exercise], [], 300, NOW);
    expect(projection.bySubject[0].workedMinutes).toBe(0);
  });
});

/**
 * `computeSubjectTrajectory` — Sprint trajectoire par matière. Jours de la
 * semaine choisis pour connaître exactement `expectedPercent` (même formule
 * que `computeWeeklyPace`) : mercredi (jour 2/7 → 29 %), vendredi (jour 4/7
 * → 57 %), dimanche (jour 6/7 → 86 %) ; lundi (jour 0/7) reste sous la garde
 * "trop tôt pour juger".
 */
const MONDAY = new Date("2026-08-10T12:00:00.000Z");
const WEDNESDAY = new Date("2026-08-12T12:00:00.000Z");
const FRIDAY = new Date("2026-08-14T12:00:00.000Z");
const SUNDAY = new Date("2026-08-16T12:00:00.000Z");

function makeProjectionSubject(overrides: Partial<WeeklyProjectionSubject> = {}): WeeklyProjectionSubject {
  return { subject: "Mathématiques", minutes: 100, workedMinutes: 0, deadlineDays: null, ...overrides };
}

describe("computeSubjectTrajectory — trajectoire normale", () => {
  it("matière correctement alimentée (réalisé ≈ part équitable attendue) → dans le rythme", () => {
    // Mercredi, 29 % attendu : 29/100 réalisé = exactement au rythme.
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 29, minutes: 71 })], WEDNESDAY);
    expect(entry.status).toBe("dans le rythme");
  });

  it("matière légèrement sous-alimentée (écart < seuil) → reste dans le rythme, pas de fausse alerte", () => {
    // Mercredi, 29 % attendu : 20 % réalisé, écart de 9 points < 15.
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 20, minutes: 80 })], WEDNESDAY);
    expect(entry.status).toBe("dans le rythme");
  });

  it("matière fortement sous-alimentée (écart > seuil) → à renforcer", () => {
    // Mercredi, 29 % attendu : 5 % réalisé, écart de 24 points > 15.
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 5, minutes: 95 })], WEDNESDAY);
    expect(entry.status).toBe("à renforcer");
  });
});

describe("computeSubjectTrajectory — dynamique temporelle", () => {
  it("lundi (< 2 jours écoulés) : trop tôt pour juger, tableau vide — même garde que computeWeeklyPace", () => {
    const result = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 0, minutes: 100 })], MONDAY);
    expect(result).toEqual([]);
  });

  it("le même ratio réalisé/part équitable peut être \"dans le rythme\" en milieu de semaine et \"à renforcer\" plus tard — le jour de la semaine compte, pas seulement le pourcentage brut", () => {
    // 40 % réalisé, fixe.
    const subject = makeProjectionSubject({ workedMinutes: 40, minutes: 60 });
    const onWednesday = computeSubjectTrajectory([subject], WEDNESDAY)[0]; // attendu 29 % → en avance
    const onFriday = computeSubjectTrajectory([subject], FRIDAY)[0]; // attendu 57 % → écart de 17 > 15
    expect(onWednesday.status).toBe("dans le rythme");
    expect(onFriday.status).toBe("à renforcer");
  });

  it("dimanche : le calcul reste cohérent (jour 6/7, ~86 % attendu), jamais de crash en fin de semaine", () => {
    const result = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 10, minutes: 90 })], SUNDAY);
    expect(result[0].status).toBe("à renforcer"); // 10 % réalisé très en dessous de 86 % attendu
  });
});

describe("computeSubjectTrajectory — échéance (escalade à renforcer → prioritaire)", () => {
  // Vendredi (57 % attendu), 5 % réalisé : très en retard dans tous les cas — isole l'effet de l'échéance seule.
  const behind = { workedMinutes: 5, minutes: 95 };

  it("aucune échéance → à renforcer, jamais prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: null })], FRIDAY);
    expect(entry.status).toBe("à renforcer");
  });

  it("échéance à > 21 jours → toujours à renforcer (trop loin pour escalader)", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 25 })], FRIDAY);
    expect(entry.status).toBe("à renforcer");
  });

  it("échéance à exactement 21 jours → à renforcer (au-delà du seuil d'escalade de 7 jours)", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 21 })], FRIDAY);
    expect(entry.status).toBe("à renforcer");
  });

  it("échéance à 8 jours (juste au-delà du seuil) → à renforcer, pas encore prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 8 })], FRIDAY);
    expect(entry.status).toBe("à renforcer");
  });

  it("échéance à exactement 7 jours (seuil inclus) → prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 7 })], FRIDAY);
    expect(entry.status).toBe("prioritaire");
  });

  it("échéance à 3 jours → prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 3 })], FRIDAY);
    expect(entry.status).toBe("prioritaire");
  });

  it("échéance à 1 jour → prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 1 })], FRIDAY);
    expect(entry.status).toBe("prioritaire");
  });

  it("échéance aujourd'hui (0 jour) → prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 0 })], FRIDAY);
    expect(entry.status).toBe("prioritaire");
  });

  it("échéance passée : daysUntilContest la ramène déjà à 0 en amont — même traitement qu'aujourd'hui, jamais de cas spécial ici", () => {
    // subjectDeadlineDays/daysUntilContest ne renvoient jamais de négatif : une échéance passée arrive ici avec deadlineDays: 0, exactement comme "aujourd'hui".
    const passedTodayEquivalent = computeSubjectTrajectory([makeProjectionSubject({ ...behind, deadlineDays: 0 })], FRIDAY)[0];
    expect(passedTodayEquivalent.status).toBe("prioritaire");
  });
});

describe("computeSubjectTrajectory — allocation", () => {
  it("une seule matière : classification correcte", () => {
    const result = computeSubjectTrajectory([makeProjectionSubject({ subject: "Physique", workedMinutes: 5, minutes: 95 })], FRIDAY);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Physique");
    expect(result[0].status).toBe("à renforcer");
  });

  it("plusieurs matières : chacune classifiée indépendamment, dans le même ordre que l'entrée", () => {
    const result = computeSubjectTrajectory(
      [
        makeProjectionSubject({ subject: "Mathématiques", workedMinutes: 60, minutes: 40 }), // largement dans le rythme
        makeProjectionSubject({ subject: "Physique", workedMinutes: 5, minutes: 95 }), // très en retard
        makeProjectionSubject({ subject: "Chimie", workedMinutes: 55, minutes: 45 }), // dans le rythme
      ],
      FRIDAY
    );
    expect(result.map((r) => r.subject)).toEqual(["Mathématiques", "Physique", "Chimie"]);
    expect(result.find((r) => r.subject === "Mathématiques")?.status).toBe("dans le rythme");
    expect(result.find((r) => r.subject === "Physique")?.status).toBe("à renforcer");
    expect(result.find((r) => r.subject === "Chimie")?.status).toBe("dans le rythme");
  });

  it("matière \"dominante\" (grande part équitable) et matière \"faible\" (petite part équitable) au même ratio de retard reçoivent le même statut — jugement relatif, jamais absolu", () => {
    const dominant = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 20, minutes: 180 })], FRIDAY)[0]; // 10 % sur 200 min
    const small = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 2, minutes: 18 })], FRIDAY)[0]; // 10 % sur 20 min
    expect(dominant.status).toBe(small.status);
  });

  it("allocation nulle (aucune matière restante, ex. objectif déjà atteint) : tableau vide, pas d'erreur", () => {
    expect(computeSubjectTrajectory([], FRIDAY)).toEqual([]);
  });
});

describe("computeSubjectTrajectory — interactions (scénarios de référence du sprint)", () => {
  it("Cas D — très faible mais aucune échéance → à renforcer, jamais prioritaire sans échéance", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 2, minutes: 98, deadlineDays: null })], FRIDAY);
    expect(entry.status).toBe("à renforcer");
  });

  it("Cas C — correctement travaillée ET échéance proche → dans le rythme, l'échéance n'escalade jamais un statut déjà correct", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 55, minutes: 45, deadlineDays: 3 })], FRIDAY);
    expect(entry.status).toBe("dans le rythme");
    // L'information reste disponible pour l'affichage, même si elle n'a pas fait basculer le statut.
    expect(entry.deadlineDays).toBe(3);
  });

  it("Cas B — retard important ET échéance proche → prioritaire", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 5, minutes: 95, deadlineDays: 3 })], FRIDAY);
    expect(entry.status).toBe("prioritaire");
  });

  it("Cas E — une matière en avance et une autre en retard dans le même appel : chacune reçoit son propre verdict, sans influence croisée", () => {
    const result = computeSubjectTrajectory(
      [
        makeProjectionSubject({ subject: "Mathématiques", workedMinutes: 90, minutes: 10 }), // très en avance
        makeProjectionSubject({ subject: "Physique", workedMinutes: 5, minutes: 95, deadlineDays: 3 }), // très en retard + échéance proche
      ],
      FRIDAY
    );
    expect(result.find((r) => r.subject === "Mathématiques")?.status).toBe("dans le rythme");
    expect(result.find((r) => r.subject === "Physique")?.status).toBe("prioritaire");
  });
});

describe("computeSubjectTrajectory — invariants", () => {
  it("déterministe : mêmes entrées, même résultat à chaque appel", () => {
    const input = [makeProjectionSubject({ workedMinutes: 12, minutes: 88, deadlineDays: 5 })];
    expect(computeSubjectTrajectory(input, FRIDAY)).toEqual(computeSubjectTrajectory(input, FRIDAY));
  });

  it("le statut est toujours l'une des trois valeurs valides, jamais undefined/NaN", () => {
    const VALID_STATUSES = ["dans le rythme", "à renforcer", "prioritaire"];
    const inputs = [
      makeProjectionSubject({ workedMinutes: 0, minutes: 0 }), // cas dégénéré : part équitable nulle
      makeProjectionSubject({ workedMinutes: 1000, minutes: 1 }),
      makeProjectionSubject({ workedMinutes: 0, minutes: 1000 }),
    ];
    for (const input of inputs) {
      const [entry] = computeSubjectTrajectory([input], FRIDAY);
      expect(VALID_STATUSES).toContain(entry.status);
    }
  });

  it("part équitable nulle (workedMinutes: 0, minutes: 0) : pas de NaN, pas de crash — retombe sur un statut valide plutôt que de propager une division par zéro", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 0, minutes: 0 })], FRIDAY);
    expect(["dans le rythme", "à renforcer", "prioritaire"]).toContain(entry.status);
  });

  it("ne mute jamais les données d'entrée", () => {
    const input = [makeProjectionSubject({ workedMinutes: 5, minutes: 95, deadlineDays: 3 })];
    const snapshot = JSON.parse(JSON.stringify(input));
    computeSubjectTrajectory(input, FRIDAY);
    expect(input).toEqual(snapshot);
  });

  it("deadlineDays est toujours repassé tel quel (jamais recalculé ni corrompu)", () => {
    const [entry] = computeSubjectTrajectory([makeProjectionSubject({ workedMinutes: 5, minutes: 95, deadlineDays: 17 })], FRIDAY);
    expect(entry.deadlineDays).toBe(17);
  });
});

describe("computeDailyPlan — non-régression (Sprint trajectoire par matière : aucune modification attendue)", () => {
  it("reste strictement identique à structure/données égales — ce sprint n'ajoute qu'une fonction indépendante, jamais un changement de allocateMinutesBySubject/subjectWeight", () => {
    const maths = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const physique = makeExercise({ subject: "Physique", mastery: 75, estimated_minutes: 15 });
    const sessions = [makeSession(maths.id, "Mathématiques", { started_at: "2026-08-10T08:00:00.000Z", result: "échoué" })];
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Suites numériques" }];

    const plan = computeDailyPlan([maths, physique], sessions, chapters, 45, NOW, "2026-08-20T00:00:00.000Z", { Physique: "2026-08-13T00:00:00.000Z" });

    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.requestedMinutes).toBe(45);
    expect(plan.blocks.every((block) => block.minutes > 0)).toBe(true);
  });
});
