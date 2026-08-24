import { describe, expect, it } from "vitest";
import { chapterOptionsForSubject, defaultExerciseFilters, distinctYears, filterExercises, type ExerciseFilters } from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery, Priority } from "@/lib/supabase/types";

/**
 * lib/exercise-filters.ts n'avait jusqu'ici AUCUN test, alors que c'est le
 * cœur logique de exercise-filters-bar.tsx — exactement le module que cette
 * manche d'audit cible. Priorité aux combinaisons de filtres (ET, pas OU ;
 * indépendantes de l'ordre) et à l'exclusion systématique des archivés.
 */

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

describe("filterExercises", () => {
  it("aucun filtre actif (défauts) : tous les exercices actifs, archivés exclus", () => {
    const exercises = [makeExercise(), makeExercise({ archived: true })];
    const result = filterExercises(exercises, defaultExerciseFilters);
    expect(result).toHaveLength(1);
    expect(result[0].archived).toBe(false);
  });

  it("un exercice archivé n'apparaît JAMAIS, quels que soient les autres filtres", () => {
    const archived = makeExercise({ archived: true, subject: "Mathématiques", status: "à faire" });
    const result = filterExercises([archived], { ...defaultExerciseFilters, subject: "Mathématiques", status: "à faire" });
    expect(result).toEqual([]);
  });

  it("filtre matière + statut combinés : intersection (ET), pas union (OU)", () => {
    const matchBoth = makeExercise({ subject: "Physique", status: "à revoir" });
    const matchSubjectOnly = makeExercise({ subject: "Physique", status: "à faire" });
    const matchStatusOnly = makeExercise({ subject: "Chimie", status: "à revoir" });
    const matchNeither = makeExercise({ subject: "Chimie", status: "à faire" });
    const filters: ExerciseFilters = { ...defaultExerciseFilters, subject: "Physique", status: "à revoir" };
    const result = filterExercises([matchBoth, matchSubjectOnly, matchStatusOnly, matchNeither], filters);
    expect(result.map((e) => e.id)).toEqual([matchBoth.id]);
  });

  it("le résultat ne dépend pas de l'ordre dans lequel les critères sont posés (même filtres, ordre d'écriture différent)", () => {
    const exercises = [
      makeExercise({ subject: "Mathématiques", difficulty: 4, mastery: 25 }),
      makeExercise({ subject: "Mathématiques", difficulty: 4, mastery: 50 }),
      makeExercise({ subject: "Physique", difficulty: 4, mastery: 25 }),
    ];
    const filtersA: ExerciseFilters = { ...defaultExerciseFilters, subject: "Mathématiques", difficulty: 4, mastery: 25 as Mastery };
    const filtersB: ExerciseFilters = { ...defaultExerciseFilters, mastery: 25 as Mastery, subject: "Mathématiques", difficulty: 4 };
    expect(filterExercises(exercises, filtersA).map((e) => e.id)).toEqual(filterExercises(exercises, filtersB).map((e) => e.id));
  });

  it("filtre chapitre : ne retient que le chapitre exact", () => {
    const inChapter = makeExercise({ chapter_id: "chap-1" });
    const otherChapter = makeExercise({ chapter_id: "chap-2" });
    const noChapter = makeExercise({ chapter_id: null });
    const result = filterExercises([inChapter, otherChapter, noChapter], { ...defaultExerciseFilters, chapter: "chap-1" });
    expect(result.map((e) => e.id)).toEqual([inChapter.id]);
  });

  it("filtre priorité, difficulté, maîtrise et année : chacun restreint indépendamment", () => {
    const target = makeExercise({ priority: 5 as Priority, difficulty: 5, mastery: 100 as Mastery, year: 2024 });
    const others = [
      makeExercise({ priority: 1 as Priority }),
      makeExercise({ difficulty: 1 }),
      makeExercise({ mastery: 0 as Mastery }),
      makeExercise({ year: 2020 }),
    ];
    const all = [target, ...others];
    expect(filterExercises(all, { ...defaultExerciseFilters, priority: 5 as Priority }).map((e) => e.id)).toEqual([target.id]);
    expect(filterExercises(all, { ...defaultExerciseFilters, difficulty: 5 }).map((e) => e.id)).toEqual([target.id]);
    expect(filterExercises(all, { ...defaultExerciseFilters, mastery: 100 as Mastery }).map((e) => e.id)).toEqual([target.id]);
    expect(filterExercises(all, { ...defaultExerciseFilters, year: 2024 }).map((e) => e.id)).toEqual([target.id]);
  });

  it("favoritesOnly : ne retient que les favoris, sans exclure les non-favoris quand désactivé", () => {
    const favorite = makeExercise({ favorite: true });
    const notFavorite = makeExercise({ favorite: false });
    expect(filterExercises([favorite, notFavorite], { ...defaultExerciseFilters, favoritesOnly: true }).map((e) => e.id)).toEqual([favorite.id]);
    expect(filterExercises([favorite, notFavorite], { ...defaultExerciseFilters, favoritesOnly: false })).toHaveLength(2);
  });

  it("recherche : insensible à la casse, espaces en début/fin ignorés, correspondance partielle", () => {
    const exercise = makeExercise({ title: "Racines n-ièmes de l'unité" });
    expect(filterExercises([exercise], { ...defaultExerciseFilters, query: "RACINES" })).toHaveLength(1);
    expect(filterExercises([exercise], { ...defaultExerciseFilters, query: "  racines  " })).toHaveLength(1);
    expect(filterExercises([exercise], { ...defaultExerciseFilters, query: "unité" })).toHaveLength(1);
    expect(filterExercises([exercise], { ...defaultExerciseFilters, query: "polynôme" })).toHaveLength(0);
  });

  it("recherche vide (ou uniquement des espaces) : aucun filtrage, tout passe", () => {
    const exercises = [makeExercise(), makeExercise()];
    expect(filterExercises(exercises, { ...defaultExerciseFilters, query: "" })).toHaveLength(2);
    expect(filterExercises(exercises, { ...defaultExerciseFilters, query: "   " })).toHaveLength(2);
  });

  it("recherche combinée avec un autre filtre : intersection, pas juste la recherche seule", () => {
    const matchBoth = makeExercise({ title: "Suites récurrentes", subject: "Mathématiques" });
    const matchQueryOnly = makeExercise({ title: "Suites récurrentes", subject: "Physique" });
    const result = filterExercises([matchBoth, matchQueryOnly], { ...defaultExerciseFilters, query: "suites", subject: "Mathématiques" });
    expect(result.map((e) => e.id)).toEqual([matchBoth.id]);
  });

  it("banque vide : résultat vide, jamais d'erreur", () => {
    expect(filterExercises([], { ...defaultExerciseFilters, subject: "Mathématiques", query: "x" })).toEqual([]);
  });
});

describe("chapterOptionsForSubject", () => {
  const chapters: Chapter[] = [
    { id: "c1", subject: "Mathématiques", label: "Algèbre" },
    { id: "c2", subject: "Physique", label: "Optique" },
    { id: "c3", subject: "Mathématiques", label: "Analyse" },
  ];

  it("filtre par matière", () => {
    expect(chapterOptionsForSubject(chapters, "Mathématiques").map((c) => c.id).sort()).toEqual(["c1", "c3"]);
  });

  it("\"Toutes\" : chapitres de toutes les matières", () => {
    expect(chapterOptionsForSubject(chapters, "Toutes")).toHaveLength(3);
  });

  it("matière sans aucun chapitre : liste vide, pas d'erreur", () => {
    expect(chapterOptionsForSubject(chapters, "Chimie")).toEqual([]);
  });
});

describe("distinctYears", () => {
  it("exclut les archivés et les années non renseignées, dédoublonne, trie décroissant", () => {
    const exercises = [
      makeExercise({ year: 2022 }),
      makeExercise({ year: 2024 }),
      makeExercise({ year: 2022 }),
      makeExercise({ year: null }),
      makeExercise({ year: 2020, archived: true }),
    ];
    expect(distinctYears(exercises)).toEqual([2024, 2022]);
  });

  it("aucune année renseignée : liste vide", () => {
    expect(distinctYears([makeExercise({ year: null })])).toEqual([]);
  });
});
