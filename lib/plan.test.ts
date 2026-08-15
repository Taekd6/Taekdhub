import { describe, expect, it } from "vitest";
import {
  computeDailyPlan,
  computeSubjectPriorities,
  contestUrgencyBonus,
  daysUntilContest,
  serializePlan,
  subjectWeight,
  summarizePlanObjective,
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
