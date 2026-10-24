import { describe, expect, it } from "vitest";
import { hasContent, recentChapters, summarizeChapters } from "@/lib/chapters-overview";
import type { ChapterNotes } from "@/lib/chapter-notes";
import { PROGRAMME } from "@/lib/programme-data";
import type { ErrorEntry } from "@/lib/storage";

const NOW = "2026-10-24T10:00:00.000Z";
const notes: ChapterNotes[] = [
  { id: "m2-reduction", cours: "# Cours", methodes: [{ id: "1", titre: "t", quand: "q", etapes: ["e"], createdAt: NOW }], updatedAt: NOW },
  { id: "p2-maxwell", cours: null, methodes: [], updatedAt: NOW },
];
const error = (id: string, chapter?: string) => ({ id, date: "2026-10-24", createdAt: NOW, ...(chapter ? { programmeChapterId: chapter } : {}) }) as unknown as ErrorEntry;

describe("summarizeChapters", () => {
  it("donne les chapitres d'une matière et d'une année, dans l'ordre du programme", () => {
    const maths = summarizeChapters([], [], "Mathématiques", 2);
    expect(maths.every((entry) => entry.chapter.subject === "Mathématiques" && entry.chapter.year === 2)).toBe(true);
    expect(maths.map((entry) => entry.chapter.id)).toEqual(PROGRAMME.filter((chapter) => chapter.subject === "Mathématiques" && chapter.year === 2).map((chapter) => chapter.id));
  });

  it("compte cours, méthodes, erreurs et cartes d'un chapitre", () => {
    const reduction = summarizeChapters(notes, [error("a", "m2-reduction"), error("b", "m2-reduction"), error("c", "m2-euclidiens"), error("d")], "Mathématiques", 2).find((entry) => entry.chapter.id === "m2-reduction")!;
    expect(reduction).toMatchObject({ hasCourse: true, methodes: 1, erreurs: 2 });
    expect(reduction.courseLength).toBe("# Cours".length);
    expect(reduction.cartes).toBeGreaterThan(0);
  });

  it("ne compte aucun cours quand l'entrée n'en a pas, et un chapitre sans rien reste listé", () => {
    const maxwell = summarizeChapters(notes, [], "Physique", 2).find((entry) => entry.chapter.id === "p2-maxwell")!;
    expect(maxwell).toMatchObject({ hasCourse: false, methodes: 0, erreurs: 0, cartes: 0 });
    expect(hasContent(maxwell)).toBe(false);
  });

  it("couvre aussi la physique et la chimie", () => {
    expect(summarizeChapters([], [], "Physique").length).toBeGreaterThan(0);
    expect(summarizeChapters([], [], "Chimie").length).toBeGreaterThan(0);
  });
});

describe("recentChapters", () => {
  const later = "2026-10-26T10:00:00.000Z";

  it("ne garde que les chapitres qui ont du contenu, le plus récent d'abord, toutes matières", () => {
    const list = recentChapters(
      [{ id: "m2-reduction", cours: "# Cours", methodes: [], updatedAt: NOW }, { id: "p2-maxwell", cours: null, methodes: [], updatedAt: NOW }],
      [{ ...error("e1", "p1-optique"), createdAt: later } as ErrorEntry],
      10
    );
    expect(list.map((entry) => entry.chapter.id)).toEqual(["p1-optique", "m2-reduction"]);
    expect(list[0]).toMatchObject({ hasCourse: false, erreurs: 1 });
  });

  it("respecte la limite et ne renvoie rien quand il n'y a rien", () => {
    expect(recentChapters([], [], 5)).toEqual([]);
    const many = ["m2-reduction", "m2-euclidiens", "m2-evn"].map((id) => ({ id, cours: "x", methodes: [], updatedAt: NOW }));
    expect(recentChapters(many, [], 2)).toHaveLength(2);
  });
});
