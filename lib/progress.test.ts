import { describe, expect, it } from "vitest";
import { computeProgressBySubject } from "@/lib/progress";
import type { Exercise, Mastery, Priority } from "@/lib/supabase/types";

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

describe("computeProgressBySubject — matières sans contenu réel", () => {
  it("une matière avec des exercices apparaît", () => {
    const exercises = [makeExercise({ subject: "Mathématiques" })];
    const bySubject = computeProgressBySubject(exercises);
    expect(bySubject.map((entry) => entry.subject)).toContain("Mathématiques");
  });

  it("une matière sans aucun exercice n'apparaît pas", () => {
    const exercises = [makeExercise({ subject: "Mathématiques" })];
    const bySubject = computeProgressBySubject(exercises);
    expect(bySubject.map((entry) => entry.subject)).not.toContain("Anglais");
    expect(bySubject.map((entry) => entry.subject)).not.toContain("Français");
    expect(bySubject.map((entry) => entry.subject)).not.toContain("Informatique TC");
  });

  it("une matière avec des exercices mais aucune activité (0% partout) apparaît quand même — le filtre porte sur le contenu, pas sur l'activité", () => {
    const exercises = [makeExercise({ subject: "Physique", status: "à faire", mastery: 0 as Mastery })];
    const bySubject = computeProgressBySubject(exercises);
    const physique = bySubject.find((entry) => entry.subject === "Physique");
    expect(physique).toBeDefined();
    expect(physique?.total).toBe(1);
    expect(physique?.mastered).toBe(0);
    expect(physique?.completionRate).toBe(0);
  });

  it("plusieurs matières, certaines vides : seules celles avec contenu apparaissent", () => {
    const exercises = [
      makeExercise({ subject: "Mathématiques" }),
      makeExercise({ subject: "Mathématiques" }),
      makeExercise({ subject: "Physique" }),
    ];
    const bySubject = computeProgressBySubject(exercises);
    const subjectsPresent = bySubject.map((entry) => entry.subject);
    expect(subjectsPresent).toEqual(["Mathématiques", "Physique"]);
  });

  it("un exercice archivé ne compte pas comme contenu disponible pour sa matière", () => {
    const exercises = [makeExercise({ subject: "Chimie", archived: true })];
    const bySubject = computeProgressBySubject(exercises);
    expect(bySubject.map((entry) => entry.subject)).not.toContain("Chimie");
  });

  it("aucun exercice du tout → aucune matière", () => {
    expect(computeProgressBySubject([])).toEqual([]);
  });
});
