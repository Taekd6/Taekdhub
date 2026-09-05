import { describe, expect, it } from "vitest";
import { defaultExerciseFilters, filterExercises, tagOptionsForFilters } from "@/lib/exercise-filters";
import type { Exercise, Mastery } from "@/lib/supabase/types";

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
  epreuve: null,
  filiere: null,
  exercise_number: null,
  provenance: "originale",
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

describe("filterExercises — sous-thème (tag)", () => {
  it("\"Toutes\" (défaut) ne filtre rien sur le sous-thème", () => {
    const a = makeExercise({ tags: ["intégration par parties"] });
    const b = makeExercise({ tags: [] });
    const result = filterExercises([a, b], defaultExerciseFilters);
    expect(result).toHaveLength(2);
  });

  it("un sous-thème choisi ne retient que les exercices portant exactement ce tag", () => {
    const withTag = makeExercise({ tags: ["changement de variable", "intégration"] });
    const withoutTag = makeExercise({ tags: ["primitives usuelles"] });
    const result = filterExercises([withTag, withoutTag], { ...defaultExerciseFilters, tag: "changement de variable" });
    expect(result.map((e) => e.id)).toEqual([withTag.id]);
  });

  it("se combine avec les autres filtres (chapitre, difficulté…) plutôt que de les remplacer", () => {
    const match = makeExercise({ tags: ["IPP"], chapter_id: "chap-integration", difficulty: 3 });
    const wrongChapter = makeExercise({ tags: ["IPP"], chapter_id: "chap-polynomes", difficulty: 3 });
    const wrongDifficulty = makeExercise({ tags: ["IPP"], chapter_id: "chap-integration", difficulty: 5 });
    const result = filterExercises([match, wrongChapter, wrongDifficulty], {
      ...defaultExerciseFilters,
      chapter: "chap-integration",
      tag: "IPP",
      difficulty: 3,
    });
    expect(result.map((e) => e.id)).toEqual([match.id]);
  });
});

describe("tagOptionsForFilters", () => {
  it("retourne les tags distincts, triés, du périmètre matière/chapitre déjà choisi", () => {
    const a = makeExercise({ subject: "Mathématiques", chapter_id: "chap-1", tags: ["changement de variable", "IPP"] });
    const b = makeExercise({ subject: "Mathématiques", chapter_id: "chap-1", tags: ["IPP"] });
    const c = makeExercise({ subject: "Mathématiques", chapter_id: "chap-2", tags: ["primitives usuelles"] });
    const options = tagOptionsForFilters([a, b, c], { subject: "Mathématiques", chapter: "chap-1" });
    expect(options).toEqual(["changement de variable", "IPP"]);
  });

  it("ignore les exercices archivés", () => {
    const archived = makeExercise({ tags: ["archivé-uniquement"], archived: true });
    const options = tagOptionsForFilters([archived], { subject: "Toutes", chapter: "Tous" });
    expect(options).not.toContain("archivé-uniquement");
  });

  it("sans chapitre choisi (\"Tous\"), agrège les tags de toute la matière", () => {
    const a = makeExercise({ subject: "Physique", chapter_id: "chap-1", tags: ["résonance"] });
    const b = makeExercise({ subject: "Physique", chapter_id: "chap-2", tags: ["filtre passe-bas"] });
    const options = tagOptionsForFilters([a, b], { subject: "Physique", chapter: "Tous" });
    expect(options).toEqual(["filtre passe-bas", "résonance"]);
  });
});
