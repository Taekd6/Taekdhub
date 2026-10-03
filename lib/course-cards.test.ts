import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapDecks } from "@/lib/anki-mapping";
import { COURSE_CHAPTERS, COURSE_DECK_URL, courseAnkiCards, courseDeckName } from "@/lib/course-cards";
import data from "@/data/course-cards.json";

describe("cartes de cours", () => {
  it("chaque chapitre du fichier existe dans le programme, et chaque carte a un recto et un verso", () => {
    expect(COURSE_CHAPTERS).toHaveLength(data.chapters.length);
    for (const chapter of COURSE_CHAPTERS) {
      expect(chapter.cards.length).toBeGreaterThan(0);
      for (const card of chapter.cards) {
        expect(card.front.trim().length).toBeGreaterThan(0);
        expect(card.back.trim().length).toBeGreaterThan(0);
        expect(["définition", "théorème", "méthode"]).toContain(card.kind);
      }
    }
  });

  it("pas deux rectos identiques dans un paquet : Anki les prendrait pour des doublons", () => {
    for (const chapter of COURSE_CHAPTERS) expect(new Set(chapter.cards.map((card) => card.front)).size).toBe(chapter.cards.length);
  });

  it("les paquets sont associés tout seuls, et avec certitude, au bon chapitre", () => {
    const mappings = mapDecks(COURSE_CHAPTERS.map(courseDeckName), {});
    for (const chapter of COURSE_CHAPTERS) {
      const mapping = mappings.find((entry) => entry.deck === courseDeckName(chapter))!;
      expect(mapping, chapter.chapterId).toMatchObject({ chapterId: chapter.chapterId, kind: "certaine" });
    }
  });

  it("cartes pour Anki : seulement les chapitres choisis, étiquetées cours", () => {
    const cards = courseAnkiCards(["m2-reduction"]);
    expect(cards.length).toBe(COURSE_CHAPTERS.find((chapter) => chapter.chapterId === "m2-reduction")!.cards.length);
    expect(cards[0]).toMatchObject({ deck: "TaekdHub::Mathématiques::Réduction des endomorphismes", tags: ["taekdhub", "cours", "définition"] });
  });

  it("le paquet .apkg à télécharger est bien publié", () => {
    expect(existsSync(`public${COURSE_DECK_URL}`)).toBe(true);
  });
});
