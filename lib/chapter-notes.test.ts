import { describe, expect, it } from "vitest";
import { addMethodes, chapterErrors, COURSE_CHUNK_MAX, COURSE_TOTAL_MAX, findChapter, normalizeChapterNotes, notesFor, parseCourse, setCourse, type ChapterNotes } from "@/lib/chapter-notes";
import type { ErrorEntry } from "@/lib/storage";

const NOW = new Date("2026-10-24T10:00:00Z");
const LATER = new Date("2026-10-25T10:00:00Z");
const METHODE = { titre: "Diagonaliser un endomorphisme", quand: "On veut calculer uⁿ", etapes: ["Calculer χ_u", "Chercher les sous-espaces propres"] };

describe("findChapter", () => {
  it("retrouve un chapitre par son identifiant, son titre ou un alias (sans casse ni accents)", () => {
    for (const query of ["m2-reduction", "Réduction des endomorphismes", "REDUCTION DES ENDOMORPHISMES", "diagonalisation"]) {
      const found = findChapter(query);
      expect(found.ok && found.chapter.id, query).toBe("m2-reduction");
    }
  });

  it("refuse un chapitre inconnu ou vide, en le disant", () => {
    expect(findChapter("zzzz inconnu")).toMatchObject({ ok: false });
    expect(findChapter("  ")).toMatchObject({ ok: false });
  });

  it("retrouve « Réduction » tout court : c'est le chapitre de spé", () => {
    const found = findChapter("Réduction");
    expect(found.ok && found.chapter.id).toBe("m2-reduction");
  });

  it("ne devine pas quand plusieurs chapitres conviennent (sup et spé), et les nomme", () => {
    const found = findChapter("probabilités");
    expect(found.ok).toBe(false);
    expect(found.ok === false ? found.error : "").toMatch(/ambigu.*m1-probas.*m2-probas/);
  });

  it("restreint à une matière quand on la donne", () => {
    const found = findChapter("ondes", "physique");
    expect(found.ok && found.chapter.subject).toBe("Physique");
  });
});

describe("normalizeChapterNotes", () => {
  it("jette ce qui n'est pas un chapitre du programme et garde le reste", () => {
    const items = normalizeChapterNotes([
      { id: "m2-reduction", cours: "# Cours", methodes: [], updatedAt: NOW.toISOString() },
      { id: "chapitre-inconnu", cours: "x", methodes: [] },
      "n'importe quoi",
    ]);
    expect(items.map((entry) => entry.id)).toEqual(["m2-reduction"]);
  });

  it("jette une méthode incomplète sans toucher aux autres", () => {
    const [entry] = normalizeChapterNotes([{ id: "m2-reduction", methodes: [{ titre: "Sans étape", quand: "q", etapes: [] }, { ...METHODE }], updatedAt: NOW.toISOString() }]);
    expect(entry.methodes.map((methode) => methode.titre)).toEqual([METHODE.titre]);
  });

  it("tolère tout ce que le stockage peut contenir", () => {
    expect(normalizeChapterNotes(null)).toEqual([]);
    expect(normalizeChapterNotes({})).toEqual([]);
  });
});

describe("setCourse", () => {
  it("range un cours, puis le remplace", () => {
    const first = setCourse([], "m2-reduction", "# Titre\n\nTexte", "remplacer", NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = setCourse(first.items, "m2-reduction", "Autre", "remplacer", LATER);
    expect(second.ok && notesFor(second.items, "m2-reduction")?.cours).toBe("Autre");
  });

  it("ajoute à la suite pour un cours envoyé en plusieurs morceaux", () => {
    const first = setCourse([], "m2-reduction", "Partie 1", "remplacer", NOW);
    if (!first.ok) throw new Error("setup");
    const second = setCourse(first.items, "m2-reduction", "Partie 2", "ajouter", LATER);
    expect(second.ok && notesFor(second.items, "m2-reduction")?.cours).toBe("Partie 1\n\nPartie 2");
  });

  it("refuse un texte vide, un morceau trop long, un cours trop long et un chapitre inconnu", () => {
    expect(setCourse([], "m2-reduction", "   ", "remplacer", NOW).ok).toBe(false);
    expect(setCourse([], "m2-reduction", "x".repeat(COURSE_CHUNK_MAX + 1), "remplacer", NOW).ok).toBe(false);
    expect(setCourse([], "nope", "texte", "remplacer", NOW).ok).toBe(false);
    let items: ChapterNotes[] = [];
    let refused = false;
    for (let i = 0; i <= COURSE_TOTAL_MAX / COURSE_CHUNK_MAX + 1; i += 1) {
      const step = setCourse(items, "m2-reduction", "x".repeat(COURSE_CHUNK_MAX), "ajouter", NOW);
      if (!step.ok) {
        refused = true;
        break;
      }
      items = step.items;
    }
    expect(refused).toBe(true);
  });

  it("ne touche pas aux autres chapitres ni aux méthodes déjà rangées", () => {
    const withMethods = addMethodes([], "m2-reduction", [METHODE], NOW);
    if (!withMethods.ok) throw new Error("setup");
    const other = setCourse(withMethods.items, "m2-euclidiens", "Autre chapitre", "remplacer", LATER);
    const course = other.ok ? setCourse(other.items, "m2-reduction", "Cours", "remplacer", LATER) : other;
    expect(course.ok && notesFor(course.items, "m2-reduction")?.methodes).toHaveLength(1);
    expect(course.ok && notesFor(course.items, "m2-euclidiens")?.cours).toBe("Autre chapitre");
  });
});

describe("addMethodes", () => {
  it("ajoute puis remplace une méthode de même titre, sans doublon", () => {
    const first = addMethodes([], "m2-reduction", [METHODE], NOW);
    if (!first.ok) throw new Error("setup");
    expect(first.value).toEqual({ added: 1, replaced: 0, total: 1 });
    const second = addMethodes(first.items, "m2-reduction", [{ ...METHODE, titre: "diagonaliser un ENDOMORPHISME", etapes: ["Une seule étape"] }], LATER);
    expect(second.ok && second.value).toEqual({ added: 0, replaced: 1, total: 1 });
    expect(second.ok && notesFor(second.items, "m2-reduction")?.methodes[0].etapes).toEqual(["Une seule étape"]);
  });

  it("refuse une méthode sans étape et ne range rien", () => {
    expect(addMethodes([], "m2-reduction", [{ titre: "t", quand: "q", etapes: [] }], NOW).ok).toBe(false);
  });
});

describe("parseCourse", () => {
  it("sépare titres, listes et paragraphes", () => {
    expect(parseCourse("# Titre\n\nUn paragraphe\nsur deux lignes\n\n- a\n- b\n\n### Sous-titre")).toEqual([
      { kind: "titre", niveau: 1, texte: "Titre" },
      { kind: "paragraphe", texte: "Un paragraphe\nsur deux lignes" },
      { kind: "liste", items: ["a", "b"] },
      { kind: "titre", niveau: 3, texte: "Sous-titre" },
    ]);
  });

  it("ne renvoie rien pour un texte vide", () => {
    expect(parseCourse("  \n ")).toEqual([]);
  });
});

describe("chapterErrors", () => {
  const entry = (id: string, date: string, chapter?: string, createdAt = `${date}T08:00:00Z`) => ({ id, date, createdAt, ...(chapter ? { programmeChapterId: chapter } : {}) }) as unknown as ErrorEntry;

  it("ne garde que le chapitre demandé, la plus récente d'abord", () => {
    const list = chapterErrors([entry("a", "2026-10-01", "m2-reduction"), entry("b", "2026-10-24", "m2-reduction"), entry("c", "2026-10-30", "m2-euclidiens"), entry("d", "2026-10-30")], "m2-reduction");
    expect(list.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
