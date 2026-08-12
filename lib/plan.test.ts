import { describe, expect, it } from "vitest";
import { computeDailyPlan, computeSubjectPriorities, serializePlan, summarizePlanObjective } from "@/lib/plan";
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
