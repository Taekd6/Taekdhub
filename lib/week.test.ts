import { describe, expect, it } from "vitest";
import { computeWeeklySummary } from "@/lib/week";
import type { Exercise, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  counter += 1;
  return {
    id: `s-${counter}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-01-07T10:00:00.000Z",
    ended_at: null,
    duration_seconds: 0,
    note: null,
    created_at: "2026-01-07T10:00:00.000Z",
    result: null,
    ...overrides,
  };
}

let exerciseCounter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  exerciseCounter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${exerciseCounter}`,
    subject: "Mathématiques",
    title: `Exercice ${exerciseCounter}`,
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

describe("computeWeeklySummary — pace", () => {
  const MONDAY_MORNING = new Date("2026-01-05T08:00:00.000Z");
  const WEDNESDAY = new Date("2026-01-07T18:00:00.000Z"); // 2 jours écoulés depuis lundi

  it("ne juge pas trop tôt dans la semaine (lundi/mardi) — pace: null quel que soit le temps travaillé", () => {
    const sessions = [makeSession({ started_at: "2026-01-05T09:00:00.000Z", duration_seconds: 6000 })];
    const summary = computeWeeklySummary([], sessions, 100, MONDAY_MORNING);
    expect(summary.pace).toBeNull();
  });

  it("dans le rythme : progression proche de ce qu'attend le jour de la semaine (mercredi ≈ 2/7)", () => {
    // objectif 100 min = 6000s, attendu ≈ 29% à J+2 → viser une progression proche de 29%.
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 1740 })];
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("dans le rythme");
  });

  it("en avance : progression nettement au-dessus de l'attendu du jour", () => {
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 3000 })]; // 50%
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("en avance");
  });

  it("à travailler : progression nettement en dessous de l'attendu du jour", () => {
    const sessions = [makeSession({ started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 300 })]; // 5%
    const summary = computeWeeklySummary([], sessions, 100, WEDNESDAY);
    expect(summary.pace).toBe("à travailler");
  });

  it("aucun objectif configuré (0 min) — pace reste dans une valeur cohérente, jamais une exception", () => {
    const summary = computeWeeklySummary([], [], 0, WEDNESDAY);
    expect(summary.progressPercent).toBe(0);
    expect(() => summary.pace).not.toThrow();
  });
});

describe("computeWeeklySummary — bySubject ne montre que les matières avec du contenu réel", () => {
  const WEDNESDAY = new Date("2026-01-07T18:00:00.000Z");

  it("A. matière avec des exercices mais 0 minute cette semaine → apparaît quand même", () => {
    const exercises = Array.from({ length: 20 }, () => makeExercise({ subject: "Mathématiques" }));
    const summary = computeWeeklySummary(exercises, [], 100, WEDNESDAY);
    const maths = summary.bySubject.find((entry) => entry.subject === "Mathématiques");
    expect(maths).toBeDefined();
    expect(maths?.seconds).toBe(0);
  });

  it("B. matière sans aucun exercice et 0 minute → n'apparaît pas", () => {
    const exercises = [makeExercise({ subject: "Mathématiques" })];
    const summary = computeWeeklySummary(exercises, [], 100, WEDNESDAY);
    const subjectsPresent = summary.bySubject.map((entry) => entry.subject);
    expect(subjectsPresent).not.toContain("Anglais");
    expect(subjectsPresent).not.toContain("Français");
    expect(subjectsPresent).not.toContain("Informatique TC");
  });

  it("C. matière avec des exercices et une activité réelle cette semaine → apparaît avec le bon temps", () => {
    const exercises = Array.from({ length: 20 }, () => makeExercise({ subject: "Mathématiques" }));
    const sessions = [makeSession({ subject: "Mathématiques", started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 35 * 60 })];
    const summary = computeWeeklySummary(exercises, sessions, 100, WEDNESDAY);
    const maths = summary.bySubject.find((entry) => entry.subject === "Mathématiques");
    expect(maths).toBeDefined();
    expect(maths?.seconds).toBe(35 * 60);
  });

  it("ne filtre jamais sur `seconds > 0` : une matière sans activité reste distincte d'une matière sans contenu", () => {
    const exercises = [makeExercise({ subject: "Physique" })];
    // Une séance existe pour une matière SANS exercice actif (cas limite : exercice supprimé/archivé
    // depuis) — son temps doit rester compté dans le total, mais la matière elle-même ne doit pas
    // réapparaître dans bySubject uniquement parce qu'elle a du temps enregistré.
    const sessions = [makeSession({ subject: "Chimie", started_at: "2026-01-07T09:00:00.000Z", duration_seconds: 600 })];
    const summary = computeWeeklySummary(exercises, sessions, 100, WEDNESDAY);
    const subjectsPresent = summary.bySubject.map((entry) => entry.subject);
    expect(subjectsPresent).toEqual(["Physique"]);
    expect(summary.totalSeconds).toBe(600);
  });
});
