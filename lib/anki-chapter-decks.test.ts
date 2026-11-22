import { describe, expect, it } from "vitest";
import { CHAPTER_ANKI_DECKS, chapterAnkiDecks, deckShortName } from "@/lib/anki-chapter-decks";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { ankiStudyUrl } from "@/lib/anki";

describe("chapterAnkiDecks", () => {
  it("ne référence que des chapitres du programme", () => {
    for (const id of Object.keys(CHAPTER_ANKI_DECKS)) expect(PROGRAMME_BY_ID.has(id), id).toBe(true);
  });

  it("des chemins propres : pas de vide, de « :: » de bout ni d'espaces de bord, sans doublon dans un chapitre", () => {
    for (const [id, decks] of Object.entries(CHAPTER_ANKI_DECKS)) {
      expect(decks.length, id).toBeGreaterThan(0);
      expect(new Set(decks).size, id).toBe(decks.length);
      for (const deck of decks) {
        expect(deck, id).toBe(deck.trim());
        expect(deck.startsWith("::") || deck.endsWith("::"), id).toBe(false);
        expect(deck.split("::").every(Boolean), id).toBe(true);
      }
    }
  });

  it("un chapitre sans paquet rend une liste vide", () => {
    expect(chapterAnkiDecks("p1-statique-fluides")).toEqual([]);
    expect(chapterAnkiDecks("inconnu")).toEqual([]);
  });

  it("machines thermiques : le paquet « Diagrammes et cycles » d'abord", () => {
    expect(chapterAnkiDecks("p1-machines")[0]).toBe("Physique MP::12 Thermodynamique - Principes et systèmes ouverts::04 - Diagrammes et cycles");
  });
});

describe("deckShortName", () => {
  it("retire le numéro de tête du dernier segment", () => {
    expect(deckShortName("Physique MP::11 Diffusion thermique")).toBe("Diffusion thermique");
    expect(deckShortName("Maths MP::02 - Séries numériques")).toBe("Séries numériques");
    expect(deckShortName("Informatique MP::Python (tronc commun)::01 · Bases et complexité")).toBe("Bases et complexité");
    expect(deckShortName("Anglais")).toBe("Anglais");
  });
});

describe("ankiStudyUrl", () => {
  it("encode le nom du paquet, « :: » compris, sur iOS seulement", () => {
    const url = ankiStudyUrl("Physique MP::11 Diffusion thermique", "ios")!;
    expect(url.startsWith("anki://x-callback-url/study?deck=")).toBe(true);
    expect(decodeURIComponent(url.split("deck=")[1])).toBe("Physique MP::11 Diffusion thermique");
    expect(url).not.toContain(" ");
  });
  it("rien sur ordinateur, Android ou sans nom", () => {
    expect(ankiStudyUrl("Maths", "desktop")).toBeNull();
    expect(ankiStudyUrl("Maths", "android")).toBeNull();
    expect(ankiStudyUrl("  ", "ios")).toBeNull();
    expect(ankiStudyUrl(undefined, "ios")).toBeNull();
  });
});
