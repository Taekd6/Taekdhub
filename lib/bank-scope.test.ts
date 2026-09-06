import { describe, expect, it } from "vitest";
import {
  countForScope,
  defaultExerciseFilters,
  filterExercises,
  filtersForScope,
  scopeBaseline,
  type BankScope,
  type ExerciseFilters,
} from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery, Subject } from "@/lib/supabase/types";

/**
 * RÉGRESSION — le volet annonçait 17, la liste en montrait 2.
 *
 * Les compteurs du navigateur de banque étaient calculés sur la banque BRUTE
 * (matière + chapitre, rien d'autre) tandis que la liste applique les onze
 * filtres. Un filtre concours resté en vigueur suffisait donc à ce que l'écran
 * se contredise : « Applications linéaires 17 » à gauche, deux exercices à
 * droite. Reproduit au navigateur avant correction.
 *
 * La règle vérifiée ici est celle qui rend la contradiction impossible : le
 * nombre annoncé par une entrée EST le nombre d'exercices que
 * `filterExercises` rendra une fois cette entrée choisie. Pas « à peu près » —
 * exactement, pour chaque entrée et pour chaque combinaison de filtres.
 */

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title: `Exercice ${counter}`, statement: "Énoncé.",
    chapter_id: null, source: "Test", year: null, competition: null, programme_level: null,
    license_status: null, external_id: null, epreuve: null, filieres: [], exercise_number: null,
    provenance: "originale", source_url: null, prerequisites: [], pedagogical_goal: null, level: null,
    type: "TD", difficulty: 3, mastery: 0 as Mastery, status: "à faire", estimated_minutes: null,
    attempts: 0, note: null, created_at: now, updated_at: now, tags: [], hints: [], correction: null,
    favorite: false, archived: false, last_worked_at: null,
    ...overrides,
  };
}

const CHAPITRES: Chapter[] = [
  { id: "lin", subject: "Mathématiques", label: "Applications linéaires" },
  { id: "red", subject: "Mathématiques", label: "Réduction" },
  { id: "meca", subject: "Physique", label: "Mécanique" },
];

/**
 * La banque du bug : 17 exercices dans « Applications linéaires », dont
 * seulement 2 issus du CCINP.
 */
function banque(): Exercise[] {
  const exercises: Exercise[] = [];
  for (let index = 0; index < 15; index++) exercises.push(makeExercise({ chapter_id: "lin", difficulty: index % 5 === 0 ? 5 : 3 }));
  for (let index = 0; index < 2; index++) {
    exercises.push(makeExercise({ chapter_id: "lin", competition: "CCINP", provenance: "concours-verifie", favorite: index === 0 }));
  }
  for (let index = 0; index < 9; index++) exercises.push(makeExercise({ chapter_id: "red", competition: index < 4 ? "CCINP" : null }));
  for (let index = 0; index < 6; index++) exercises.push(makeExercise({ subject: "Physique", chapter_id: "meca" }));
  exercises.push(makeExercise({ chapter_id: "lin", archived: true }));
  return exercises;
}

/** Toutes les entrées du volet, dans l'ordre où il les affiche. */
function scopes(): BankScope[] {
  return [
    { kind: "all" },
    { kind: "favorites" },
    { kind: "subject", subject: "Mathématiques" },
    { kind: "subject", subject: "Physique" },
    ...CHAPITRES.map((chapter): BankScope => ({ kind: "chapter", subject: chapter.subject as Subject, chapterId: chapter.id })),
  ];
}

describe("le compteur d'une entrée annonce ce que la liste montrera", () => {
  const exercises = banque();

  const états: { nom: string; filtres: ExerciseFilters }[] = [
    { nom: "aucun filtre", filtres: defaultExerciseFilters },
    { nom: "concours CCINP", filtres: { ...defaultExerciseFilters, competition: "CCINP" } },
    { nom: "Mathématiques + Applications linéaires + CCINP", filtres: { ...defaultExerciseFilters, subject: "Mathématiques", chapter: "lin", competition: "CCINP" } },
    { nom: "recherche", filtres: { ...defaultExerciseFilters, query: "Exercice 1" } },
    { nom: "difficulté 5", filtres: { ...defaultExerciseFilters, difficulty: 5 } },
    { nom: "favoris + concours", filtres: { ...defaultExerciseFilters, favoritesOnly: true, competition: "CCINP" } },
    { nom: "origine + statut", filtres: { ...defaultExerciseFilters, origin: "Concours", status: "à faire" } },
  ];

  for (const état of états) {
    it(`tient pour chaque entrée — ${état.nom}`, () => {
      for (const scope of scopes()) {
        const annoncé = countForScope(exercises, état.filtres, scope);
        const affiché = filterExercises(exercises, filtersForScope(état.filtres, scope)).length;
        expect(annoncé, `entrée ${JSON.stringify(scope)}`).toBe(affiché);
      }
    });
  }
});

describe("le cas exact du bug", () => {
  const exercises = banque();

  it("17 exercices dans le chapitre, et les 17 sont rendus accessibles", () => {
    const filtres = filtersForScope(defaultExerciseFilters, { kind: "chapter", subject: "Mathématiques", chapterId: "lin" });
    const résultats = filterExercises(exercises, filtres);
    expect(résultats).toHaveLength(17);
    expect(countForScope(exercises, defaultExerciseFilters, { kind: "chapter", subject: "Mathématiques", chapterId: "lin" })).toBe(17);
    // Aucun exercice archivé, aucun d'un autre chapitre : rien ne fuit.
    expect(résultats.every((exercise) => exercise.chapter_id === "lin" && !exercise.archived)).toBe(true);
  });

  it("avec le filtre CCINP encore actif, le compteur descend AVEC la liste", () => {
    const courant: ExerciseFilters = { ...defaultExerciseFilters, competition: "CCINP" };
    const scope: BankScope = { kind: "chapter", subject: "Mathématiques", chapterId: "lin" };
    // C'est ici que l'écran se contredisait : 17 annoncés, 2 affichés.
    expect(countForScope(exercises, courant, scope)).toBe(2);
    expect(filterExercises(exercises, filtersForScope(courant, scope))).toHaveLength(2);
  });

  it("« Toute la banque » efface les filtres, et l'annonce", () => {
    const courant: ExerciseFilters = { ...defaultExerciseFilters, competition: "CCINP", query: "Exercice" };
    // Le raccourci remet tout à zéro : son compteur doit donc annoncer la
    // banque entière, pas la sélection courante.
    expect(countForScope(exercises, courant, { kind: "all" })).toBe(exercises.filter((exercise) => !exercise.archived).length);
    expect(filtersForScope(courant, { kind: "all" })).toEqual(defaultExerciseFilters);
  });
});

describe("aucune fuite entre portées", () => {
  const exercises = banque();

  it("un chapitre ne ramène jamais un exercice d'un autre chapitre ni d'une autre matière", () => {
    for (const chapter of CHAPITRES) {
      const scope: BankScope = { kind: "chapter", subject: chapter.subject as Subject, chapterId: chapter.id };
      for (const résultat of filterExercises(exercises, filtersForScope(defaultExerciseFilters, scope))) {
        expect(résultat.chapter_id).toBe(chapter.id);
        expect(résultat.subject).toBe(chapter.subject);
      }
    }
  });

  it("un exercice archivé n'entre dans aucun compteur", () => {
    const total = scopes()
      .filter((scope) => scope.kind === "chapter")
      .reduce((sum, scope) => sum + countForScope(exercises, defaultExerciseFilters, scope), 0);
    expect(total).toBe(exercises.filter((exercise) => !exercise.archived && exercise.chapter_id).length);
  });
});

describe("le raccourci de calcul du volet vaut le calcul complet", () => {
  const exercises = banque();

  /*
   * Le volet ne peut pas appeler `filterExercises` soixante fois à chaque
   * frappe : il filtre UNE fois sur tout ce qui n'est pas matière/chapitre/
   * favoris, puis compte dans ce résultat. Ce test vérifie que ce raccourci
   * donne exactement le même nombre que le calcul complet — sans quoi le bug
   * reviendrait par la porte de la performance.
   */
  it("compter dans la base restreinte équivaut à tout recalculer", () => {
    for (const filtres of [
      defaultExerciseFilters,
      { ...defaultExerciseFilters, competition: "CCINP" },
      { ...defaultExerciseFilters, query: "Exercice 2" },
      { ...defaultExerciseFilters, difficulty: 5 as const, origin: "TaekdHub" as const },
    ]) {
      const base = scopeBaseline(exercises, filtres);
      for (const subject of ["Mathématiques", "Physique"] as Subject[]) {
        expect(base.filter((exercise) => exercise.subject === subject).length).toBe(
          countForScope(exercises, filtres, { kind: "subject", subject })
        );
      }
      for (const chapter of CHAPITRES) {
        expect(
          base.filter((exercise) => exercise.chapter_id === chapter.id && exercise.subject === chapter.subject).length
        ).toBe(countForScope(exercises, filtres, { kind: "chapter", subject: chapter.subject as Subject, chapterId: chapter.id }));
      }
    }
  });
});
