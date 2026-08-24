import { describe, expect, it } from "vitest";
import { addChapter, getChaptersForSubject, reconcileExerciseChapters, removeChapter, renameChapter } from "@/lib/chapters";
import type { Chapter } from "@/lib/storage";
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
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

describe("addChapter", () => {
  it("crée un chapitre avec le libellé nettoyé (espaces en trop retirés)", () => {
    const { chapter } = addChapter([], "Mathématiques", "  Suites numériques  ");
    expect(chapter.label).toBe("Suites numériques");
    expect(chapter.subject).toBe("Mathématiques");
  });

  it("ajoute au tableau existant sans y toucher", () => {
    const existing: Chapter[] = [{ id: "c1", subject: "Physique", label: "Optique" }];
    const { chapters } = addChapter(existing, "Mathématiques", "Algèbre");
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toBe(existing[0]);
  });
});

describe("renameChapter", () => {
  const chapters: Chapter[] = [{ id: "c1", subject: "Mathématiques", label: "Ancien nom" }];

  it("renomme et nettoie les espaces en trop", () => {
    const next = renameChapter(chapters, "c1", "  Nouveau nom  ");
    expect(next[0].label).toBe("Nouveau nom");
  });

  it("un libellé vide ou blanc est un no-op : le libellé existant reste inchangé (pas de chapitre sans nom)", () => {
    expect(renameChapter(chapters, "c1", "")).toEqual(chapters);
    expect(renameChapter(chapters, "c1", "   ")).toEqual(chapters);
  });

  it("un id inconnu ne modifie rien", () => {
    expect(renameChapter(chapters, "inconnu", "Nouveau nom")).toEqual(chapters);
  });
});

describe("removeChapter", () => {
  it("retire uniquement le chapitre visé", () => {
    const chapters: Chapter[] = [
      { id: "c1", subject: "Mathématiques", label: "A" },
      { id: "c2", subject: "Mathématiques", label: "B" },
    ];
    expect(removeChapter(chapters, "c1")).toEqual([chapters[1]]);
  });
});

describe("getChaptersForSubject", () => {
  it("filtre par matière et trie par ordre alphabétique français", () => {
    const chapters: Chapter[] = [
      { id: "c1", subject: "Mathématiques", label: "Élasticité" },
      { id: "c2", subject: "Physique", label: "Optique" },
      { id: "c3", subject: "Mathématiques", label: "Algèbre" },
    ];
    const result = getChaptersForSubject(chapters, "Mathématiques");
    expect(result.map((c) => c.id)).toEqual(["c3", "c1"]);
  });
});

describe("reconcileExerciseChapters", () => {
  it("laisse intact un exercice dont le chapitre existe réellement pour sa matière", () => {
    const chapters: Chapter[] = [{ id: "c1", subject: "Mathématiques", label: "Algèbre" }];
    const exercise = makeExercise({ subject: "Mathématiques", chapter_id: "c1" });
    const result = reconcileExerciseChapters([exercise], chapters);
    expect(result[0].chapter_id).toBe("c1");
  });

  it("détache un exercice dont le chapitre n'existe plus du tout (sauvegarde tronquée/corrompue)", () => {
    const exercise = makeExercise({ subject: "Mathématiques", chapter_id: "chapitre-fantome" });
    const result = reconcileExerciseChapters([exercise], []);
    expect(result[0].chapter_id).toBeNull();
  });

  it("détache un exercice dont le chapitre existe mais appartient à une AUTRE matière (incohérence croisée)", () => {
    const chapters: Chapter[] = [{ id: "c1", subject: "Physique", label: "Optique" }];
    const exercise = makeExercise({ subject: "Mathématiques", chapter_id: "c1" });
    const result = reconcileExerciseChapters([exercise], chapters);
    expect(result[0].chapter_id).toBeNull();
  });

  it("un exercice déjà sans chapitre (null) n'est jamais touché", () => {
    const exercise = makeExercise({ subject: "Mathématiques", chapter_id: null });
    const result = reconcileExerciseChapters([exercise], []);
    expect(result[0].chapter_id).toBeNull();
    expect(result[0]).toBe(exercise);
  });
});
