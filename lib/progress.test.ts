import { describe, expect, it } from "vitest";
import { isExerciseEngaged, progressByChapter } from "@/lib/progress";
import type { Chapter } from "@/lib/storage";
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

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return { id: "chap-1", subject: "Mathématiques", label: "Suites numériques", ...overrides };
}

describe("isExerciseEngaged", () => {
  it("faux pour un exercice neuf (à faire, jamais tenté, jamais travaillé)", () => {
    expect(isExerciseEngaged(makeExercise())).toBe(false);
  });

  it("vrai dès qu'au moins une tentative a été enregistrée", () => {
    expect(isExerciseEngaged(makeExercise({ attempts: 1 }))).toBe(true);
  });

  it("vrai dès que le statut a bougé de \"à faire\", même sans tentative comptée", () => {
    expect(isExerciseEngaged(makeExercise({ status: "en cours" }))).toBe(true);
  });

  it("vrai dès qu'un focus a déjà été travaillé, même sans tentative ni changement de statut", () => {
    expect(isExerciseEngaged(makeExercise({ last_worked_at: "2026-01-01T00:00:00.000Z" }))).toBe(true);
  });
});

describe("progressByChapter — champs de base (non-régression)", () => {
  it("ignore les chapitres sans exercice actif assigné", () => {
    const chapters = [makeChapter({ id: "empty" })];
    expect(progressByChapter([], chapters)).toEqual([]);
  });

  it("ignore les exercices archivés dans le calcul", () => {
    const chapter = makeChapter();
    const exercises = [makeExercise({ chapter_id: chapter.id, archived: true }), makeExercise({ chapter_id: chapter.id, status: "maîtrisé" })];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.total).toBe(1);
    expect(entry.mastered).toBe(1);
  });

  it("un chapitre ENTIÈREMENT archivé n'apparaît pas du tout (comme s'il était vide)", () => {
    const chapter = makeChapter();
    const exercises = [makeExercise({ chapter_id: chapter.id, archived: true }), makeExercise({ chapter_id: chapter.id, archived: true })];
    expect(progressByChapter(exercises, [chapter])).toEqual([]);
  });

  it("calcule complétion et maîtrise moyenne correctement", () => {
    const chapter = makeChapter();
    const exercises = [
      makeExercise({ chapter_id: chapter.id, status: "maîtrisé", mastery: 100 as Mastery }),
      makeExercise({ chapter_id: chapter.id, status: "à faire", mastery: 0 as Mastery }),
    ];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.completionRate).toBe(50);
    expect(entry.averageMastery).toBe(50);
  });
});

describe("progressByChapter — enrichissement (vue Chapitres)", () => {
  it("workedCount compte les exercices engagés, distinct de mastered", () => {
    const chapter = makeChapter();
    const exercises = [
      makeExercise({ chapter_id: chapter.id, status: "maîtrisé" }), // engagé ET maîtrisé
      makeExercise({ chapter_id: chapter.id, attempts: 2, status: "à revoir" }), // engagé, pas maîtrisé
      makeExercise({ chapter_id: chapter.id }), // jamais engagé
    ];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.mastered).toBe(1);
    expect(entry.workedCount).toBe(2);
  });

  it("lastWorkedAt est null tant qu'aucun exercice du chapitre n'a de last_worked_at", () => {
    const chapter = makeChapter();
    const exercises = [makeExercise({ chapter_id: chapter.id })];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.lastWorkedAt).toBeNull();
  });

  it("lastWorkedAt retient le plus RÉCENT des last_worked_at du chapitre, pas le premier trouvé", () => {
    const chapter = makeChapter();
    const exercises = [
      makeExercise({ chapter_id: chapter.id, last_worked_at: "2026-01-01T00:00:00.000Z" }),
      makeExercise({ chapter_id: chapter.id, last_worked_at: "2026-06-15T00:00:00.000Z" }),
      makeExercise({ chapter_id: chapter.id, last_worked_at: "2026-03-01T00:00:00.000Z" }),
    ];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.lastWorkedAt).toBe("2026-06-15T00:00:00.000Z");
  });

  it("maxDifficultyMastered est null tant qu'aucun exercice du chapitre n'est maîtrisé", () => {
    const chapter = makeChapter();
    const exercises = [makeExercise({ chapter_id: chapter.id, status: "en cours", difficulty: 5 })];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.maxDifficultyMastered).toBeNull();
  });

  it("maxDifficultyMastered ne retient que la difficulté des exercices RÉELLEMENT maîtrisés", () => {
    const chapter = makeChapter();
    const exercises = [
      makeExercise({ chapter_id: chapter.id, status: "maîtrisé", difficulty: 2 }),
      makeExercise({ chapter_id: chapter.id, status: "maîtrisé", difficulty: 4 }),
      makeExercise({ chapter_id: chapter.id, status: "à faire", difficulty: 5 }), // le plus difficile, mais pas maîtrisé : ne doit pas compter
    ];
    const [entry] = progressByChapter(exercises, [chapter]);
    expect(entry.maxDifficultyMastered).toBe(4);
  });

  it("nextExerciseId pointe vers le premier exercice NON maîtrisé du chapitre", () => {
    const chapter = makeChapter();
    const mastered = makeExercise({ chapter_id: chapter.id, status: "maîtrisé" });
    const todo = makeExercise({ chapter_id: chapter.id, status: "à faire" });
    const [entry] = progressByChapter([mastered, todo], [chapter]);
    expect(entry.nextExerciseId).toBe(todo.id);
  });

  it("nextExerciseId retombe sur le premier exercice du chapitre si tout est déjà maîtrisé", () => {
    const chapter = makeChapter();
    const first = makeExercise({ chapter_id: chapter.id, status: "maîtrisé" });
    const second = makeExercise({ chapter_id: chapter.id, status: "maîtrisé" });
    const [entry] = progressByChapter([first, second], [chapter]);
    expect(entry.nextExerciseId).toBe(first.id);
  });
});
