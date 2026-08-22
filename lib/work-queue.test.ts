import { describe, expect, it } from "vitest";
import { addToQueue, removeFromQueue, reorderQueue, usableQueueEntries } from "@/lib/work-queue";
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

describe("addToQueue", () => {
  it("ajoute un exercice en fin de file", () => {
    expect(addToQueue([], "ex-1")).toEqual([{ exerciseId: "ex-1" }]);
    expect(addToQueue([{ exerciseId: "ex-1" }], "ex-2")).toEqual([{ exerciseId: "ex-1" }, { exerciseId: "ex-2" }]);
  });

  it("déplace en fin plutôt que doublonner si déjà présent", () => {
    const queue = [{ exerciseId: "ex-1" }, { exerciseId: "ex-2" }];
    expect(addToQueue(queue, "ex-1")).toEqual([{ exerciseId: "ex-2" }, { exerciseId: "ex-1" }]);
  });
});

describe("removeFromQueue", () => {
  it("retire un exercice quelle que soit sa position", () => {
    const queue = [{ exerciseId: "ex-1" }, { exerciseId: "ex-2" }, { exerciseId: "ex-3" }];
    expect(removeFromQueue(queue, "ex-2")).toEqual([{ exerciseId: "ex-1" }, { exerciseId: "ex-3" }]);
  });

  it("ne fait rien si l'exercice n'est pas dans la file", () => {
    const queue = [{ exerciseId: "ex-1" }];
    expect(removeFromQueue(queue, "ex-9")).toEqual(queue);
  });
});

describe("reorderQueue", () => {
  it("déplace un élément d'une position à une autre", () => {
    const queue = [{ exerciseId: "a" }, { exerciseId: "b" }, { exerciseId: "c" }];
    expect(reorderQueue(queue, 0, 2)).toEqual([{ exerciseId: "b" }, { exerciseId: "c" }, { exerciseId: "a" }]);
  });

  it("ignore les indices invalides sans modifier la file", () => {
    const queue = [{ exerciseId: "a" }, { exerciseId: "b" }];
    expect(reorderQueue(queue, -1, 1)).toEqual(queue);
    expect(reorderQueue(queue, 0, 5)).toEqual(queue);
    expect(reorderQueue(queue, 1, 1)).toEqual(queue);
  });
});

describe("usableQueueEntries", () => {
  it("résout les références en exercices réels, dans l'ordre de la file", () => {
    const exercises = [makeExercise({ id: "ex-1", title: "Un" }), makeExercise({ id: "ex-2", title: "Deux" })];
    const queue = [{ exerciseId: "ex-2" }, { exerciseId: "ex-1" }];
    const result = usableQueueEntries(queue, exercises);
    expect(result.map((entry) => entry.exercise.title)).toEqual(["Deux", "Un"]);
  });

  it("ignore silencieusement un exercice supprimé depuis son ajout à la file", () => {
    const exercises = [makeExercise({ id: "ex-1" })];
    const queue = [{ exerciseId: "ex-1" }, { exerciseId: "ex-deleted" }];
    expect(usableQueueEntries(queue, exercises)).toHaveLength(1);
  });

  it("ignore silencieusement un exercice archivé depuis son ajout à la file", () => {
    const exercises = [makeExercise({ id: "ex-1", archived: true })];
    const queue = [{ exerciseId: "ex-1" }];
    expect(usableQueueEntries(queue, exercises)).toEqual([]);
  });
});
