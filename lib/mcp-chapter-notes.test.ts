import { describe, expect, it } from "vitest";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { addChapterErrors, describeChapter } from "@/lib/mcp-chapter-notes";
import type { ChapterNotes } from "@/lib/chapter-notes";

const NOW = new Date("2026-10-24T10:00:00Z");
const CHAPTER = PROGRAMME_BY_ID.get("m2-reduction")!;
const ERREUR = { description: "A diagonalisé sans vérifier que χ_u est scindé", fix: "Vérifier χ_u scindé avant de conclure", type: "méthode" as const, source: "exercice" as const, date: "2026-10-24" };

describe("addChapterErrors", () => {
  it("note l'erreur dans le carnet, rattachée au chapitre et à sa matière", () => {
    const result = addChapterErrors([], CHAPTER, [ERREUR], NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toEqual({ added: 1, skipped: 0, total: 1 });
    expect(result.items[0]).toMatchObject({ programmeChapterId: "m2-reduction", subject: "Mathématiques", type: "méthode", fix: ERREUR.fix, date: "2026-10-24" });
  });

  it("ne duplique pas une erreur déjà notée le même jour, et en relançant l'outil", () => {
    const first = addChapterErrors([], CHAPTER, [ERREUR], NOW);
    if (!first.ok) throw new Error("setup");
    const again = addChapterErrors(first.items, CHAPTER, [{ ...ERREUR, description: "a diagonalisé SANS vérifier que χ_u est scindé" }], NOW);
    expect(again.ok && again.value).toEqual({ added: 0, skipped: 1, total: 1 });
  });

  it("garde les erreurs déjà dans le carnet, y compris d'autres chapitres", () => {
    const first = addChapterErrors([], PROGRAMME_BY_ID.get("m2-euclidiens")!, [{ ...ERREUR, description: "Autre chapitre" }], NOW);
    if (!first.ok) throw new Error("setup");
    const second = addChapterErrors(first.items, CHAPTER, [ERREUR], NOW);
    expect(second.ok && second.items).toHaveLength(2);
    expect(second.ok && second.value.total).toBe(1);
  });

  it("refuse une description vide ou trop longue sans rien écrire", () => {
    expect(addChapterErrors([], CHAPTER, [{ ...ERREUR, description: " " }], NOW).ok).toBe(false);
    expect(addChapterErrors([], CHAPTER, [ERREUR, { ...ERREUR, description: "x".repeat(201) }], NOW).ok).toBe(false);
  });
});

describe("describeChapter", () => {
  const notes: ChapterNotes = {
    id: "m2-reduction",
    cours: "# Réduction\n\nTexte du prof",
    methodes: [{ id: "1", titre: "Diagonaliser", quand: "uⁿ", etapes: ["a", "b"], piege: "χ scindé", createdAt: NOW.toISOString() }],
    updatedAt: NOW.toISOString(),
  };

  it("donne cours, méthodes et erreurs", () => {
    const errors = addChapterErrors([], CHAPTER, [ERREUR], NOW);
    if (!errors.ok) throw new Error("setup");
    const out = describeChapter(CHAPTER, notes, errors.items, true);
    expect(out).toContain("Texte du prof");
    expect(out).toContain("Diagonaliser — Quand : uⁿ — Étapes : 1. a 2. b — Piège : χ scindé");
    expect(out).toContain("ERREURS NOTÉES (1)");
    expect(out).toContain("À retenir : Vérifier χ_u scindé avant de conclure");
  });

  it("dit qu'aucun cours n'est rangé au lieu de laisser supposer ce qui a été vu", () => {
    expect(describeChapter(CHAPTER, null, [], true)).toMatch(/aucun cours rangé.*NE PRÉTENDS PAS/);
  });

  it("n'inclut pas le cours quand on ne le demande pas", () => {
    const out = describeChapter(CHAPTER, notes, [], false);
    expect(out).not.toContain("Texte du prof");
    expect(out).toContain("non inclus");
  });
});

describe("le parcours complet, avec un stockage en mémoire (comme le connecteur)", () => {
  it("range un cours, une méthode et une erreur, puis les relit ensemble", async () => {
    const { mutateCollection } = await import("@/lib/mcp-collections");
    const { addMethodes, normalizeChapterNotes, notesFor, setCourse } = await import("@/lib/chapter-notes");
    const memory = new Map<string, { items: unknown; revision: number }>();
    const store = (name: string) => ({
      async read() {
        return memory.get(name) ?? null;
      },
      async write(items: unknown, base: number) {
        if ((memory.get(name)?.revision ?? 0) !== base) return "conflict" as const;
        memory.set(name, { items, revision: base + 1 });
        return "ok" as const;
      },
    });

    await mutateCollection(store("chapterNotes"), (current) => setCourse(normalizeChapterNotes(current), CHAPTER.id, "# Réduction\n\nu diagonalisable ⟺ π_u scindé à racines simples.", "remplacer", NOW));
    await mutateCollection(store("chapterNotes"), (current) => addMethodes(normalizeChapterNotes(current), CHAPTER.id, [{ titre: "Diagonaliser", quand: "uⁿ", etapes: ["χ_u", "E_λ"] }], NOW));
    await mutateCollection(store("errors"), (current) => {
      const result = addChapterErrors(current, CHAPTER, [ERREUR], NOW);
      return result.ok ? { ok: true, items: result.items, value: result.value } : result;
    });

    const notes = normalizeChapterNotes(memory.get("chapterNotes")?.items);
    const errors = (memory.get("errors")?.items ?? []) as never[];
    expect(memory.get("chapterNotes")?.revision).toBe(2);
    const out = describeChapter(CHAPTER, notesFor(notes, CHAPTER.id), errors, true);
    expect(out).toContain("π_u scindé à racines simples");
    expect(out).toContain("MÉTHODES (1)");
    expect(out).toContain("ERREURS NOTÉES (1)");
  });
});
