import { describe, expect, it } from "vitest";
import { fold, searchExos } from "@/lib/exos-search";
import type { CatalogueChapter, ExoEntry } from "@/lib/exos";

const chapter = (id: string, title: string): CatalogueChapter["chapter"] => ({ id, subject: "Physique", year: 2, title, aliases: [], questions: [] });
const entry = (over: Partial<ExoEntry> & { id: string; titre: string }): ExoEntry => ({ source: "annale", questions: [], createdAt: "2026-11-22T00:00:00.000Z", ...over });

const catalogue: CatalogueChapter[] = [
  {
    chapter: chapter("p1-machines", "Machines thermiques"),
    entries: [
      entry({ id: "a", titre: "CCINP Physique · MP 2023", annee: 2023, concours: "CCINP", questions: ["45", "46", "47"] }),
      entry({ id: "b", titre: "Centrale Physique-Chimie 1 · MP 2023", annee: 2023, concours: "Centrale", questions: ["36"] }),
    ],
  },
  { chapter: chapter("p2-diffusion", "Diffusion thermique"), entries: [entry({ id: "c", titre: "CCINP Physique-Chimie · MP 2020", annee: 2020, detail: "résistance thermique" })] },
];

describe("fold", () => {
  it("retire accents et ponctuation", () => expect(fold("Physique-Chimie · MP 2023 é")).toBe("physique chimie mp 2023 e"));
});

describe("searchExos", () => {
  it("renvoie vide pour une requête vide", () => expect(searchExos(catalogue, "  ")).toEqual([]));
  it("trouve par concours", () => expect(searchExos(catalogue, "ccinp").map((h) => h.entry.id).sort()).toEqual(["a", "c"]));
  it("combine tous les mots", () => expect(searchExos(catalogue, "ccinp 2023").map((h) => h.entry.id)).toEqual(["a"]));
  it("trouve par chapitre", () => expect(searchExos(catalogue, "machines").map((h) => h.entry.id).sort()).toEqual(["a", "b"]));
  it("trouve une question et la renvoie", () => {
    const hits = searchExos(catalogue, "q46");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ question: "46" });
    expect(hits[0].entry.id).toBe("a");
  });
  it("cherche dans le détail sans tenir compte des accents", () => expect(searchExos(catalogue, "resistance").map((h) => h.entry.id)).toEqual(["c"]));
  it("limite le nombre de résultats", () => expect(searchExos(catalogue, "mp", 1)).toHaveLength(1));
});
