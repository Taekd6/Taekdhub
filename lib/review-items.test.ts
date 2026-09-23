import { describe, expect, it } from "vitest";
import {
  countBySubject,
  createReviewItem,
  isOpen,
  methodsFor,
  parseReviewMemory,
  removeReviewItem,
  REVIEW_TEXT_MAX,
  sanitizeReviewText,
  selectReviewItems,
  sortReviewItems,
  toggleReviewItem,
} from "@/lib/review-items";
import { normalizeReviewItem, type ReviewItem } from "@/lib/storage";

const noon = new Date(2026, 8, 23, 12, 0);

function item(overrides: Partial<ReviewItem>): ReviewItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    subject: "Mathématiques",
    text: "Revoir intégration par parties",
    kind: "à revoir",
    createdAt: "2026-09-20T10:00:00.000Z",
    doneAt: null,
    ...overrides,
  };
}

describe("création — une ligne, jamais vide", () => {
  it("retire les espaces de bord et part ouverte", () => {
    const created = createReviewItem({ subject: "Mathématiques", text: "  Revoir IPP  ", kind: "à revoir" }, noon)!;
    expect(created.text).toBe("Revoir IPP");
    expect(created.doneAt).toBeNull();
    expect(created.createdAt).toBe(noon.toISOString());
  });

  it("un collage sur plusieurs lignes devient une ligne", () => {
    expect(sanitizeReviewText("Cartouche :\n  monotone\tbornée")).toBe("Cartouche : monotone bornée");
  });

  it("refuse le vide et le trop long plutôt que de tronquer en silence", () => {
    expect(createReviewItem({ subject: "Physique", text: "   ", kind: "à revoir" })).toBeNull();
    expect(sanitizeReviewText("x".repeat(REVIEW_TEXT_MAX))).not.toBeNull();
    expect(sanitizeReviewText("x".repeat(REVIEW_TEXT_MAX + 1))).toBeNull();
  });
});

describe("cocher, décocher, supprimer", () => {
  it("cocher pose `doneAt`, recocher le retire", () => {
    const a = item({ id: "a" });
    const done = toggleReviewItem([a], "a", noon);
    expect(done[0].doneAt).toBe(noon.toISOString());
    expect(isOpen(done[0])).toBe(false);
    expect(toggleReviewItem(done, "a", noon)[0].doneAt).toBeNull();
  });

  it("ne touche qu'à l'entrée visée", () => {
    const list = [item({ id: "a" }), item({ id: "b" })];
    expect(toggleReviewItem(list, "b", noon)[0]).toBe(list[0]);
  });

  it("supprimer retire vraiment la ligne", () => {
    expect(removeReviewItem([item({ id: "a" }), item({ id: "b" })], "a").map((entry) => entry.id)).toEqual(["b"]);
  });
});

describe("tri — ouvertes d'abord, plus récentes d'abord", () => {
  it("la dernière notée en tête, les cochées en bas par date de cochage", () => {
    const list = [
      item({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      item({ id: "done-early", doneAt: "2026-09-10T00:00:00.000Z" }),
      item({ id: "new", createdAt: "2026-09-22T00:00:00.000Z" }),
      item({ id: "done-late", doneAt: "2026-09-21T00:00:00.000Z" }),
    ];
    expect(sortReviewItems(list).map((entry) => entry.id)).toEqual(["new", "old", "done-late", "done-early"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const list = [item({ id: "a", createdAt: "2026-09-01T00:00:00.000Z" }), item({ id: "b", createdAt: "2026-09-02T00:00:00.000Z" })];
    sortReviewItems(list);
    expect(list.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("filtres et méthodes", () => {
  const list = [
    item({ id: "ipp" }),
    item({ id: "trigo", kind: "à apprendre", subject: "Mathématiques" }),
    item({ id: "cartouche", kind: "méthode", createdAt: "2026-09-21T00:00:00.000Z" }),
    item({ id: "cartouche-sue", kind: "méthode", doneAt: "2026-09-22T00:00:00.000Z" }),
    item({ id: "optique", subject: "Physique", doneAt: "2026-09-22T00:00:00.000Z" }),
  ];

  it("filtre par matière, par nature, et sur les ouvertes", () => {
    expect(selectReviewItems(list, { subject: "Physique" }).map((entry) => entry.id)).toEqual(["optique"]);
    expect(selectReviewItems(list, { kind: "à apprendre" }).map((entry) => entry.id)).toEqual(["trigo"]);
    expect(selectReviewItems(list, { openOnly: true }).every(isOpen)).toBe(true);
  });

  it("une méthode maîtrisée RESTE dans le recueil de sa matière", () => {
    expect(methodsFor(list, "Mathématiques").map((entry) => entry.id)).toEqual(["cartouche", "cartouche-sue"]);
  });

  it("…mais quitte les listes de travail", () => {
    expect(selectReviewItems(list, { openOnly: true }).map((entry) => entry.id)).not.toContain("cartouche-sue");
  });

  it("compte par matière, dans l'ordre canonique, sans les matières vides", () => {
    expect(countBySubject(list)).toEqual([
      { subject: "Mathématiques", open: 3, total: 4 },
      { subject: "Physique", open: 0, total: 1 },
    ]);
  });
});

describe("mémoire de la dernière matière", () => {
  it("relit une matière connue, rejette le reste", () => {
    expect(parseReviewMemory("Physique")).toBe("Physique");
    expect(parseReviewMemory("Latin")).toBeNull();
    expect(parseReviewMemory(null)).toBeNull();
  });
});

describe("normalizeReviewItem — frontière de confiance", () => {
  it("un aller-retour JSON ne perd rien", () => {
    const original = createReviewItem({ subject: "Chimie", text: "Apprendre les pKa usuels", kind: "à apprendre" }, noon)!;
    expect(normalizeReviewItem(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });

  it("écarte ce qui ne veut plus rien dire", () => {
    expect(normalizeReviewItem(null)).toBeNull();
    expect(normalizeReviewItem({ subject: "Mathématiques", text: "   " })).toBeNull();
    expect(normalizeReviewItem({ subject: "Latin", text: "Revoir" })).toBeNull();
  });

  it("répare le reste : nature inconnue, dates illisibles, matière renommée", () => {
    const repaired = normalizeReviewItem({ id: "x", subject: "Informatique", text: "Revoir les piles", kind: "urgent", createdAt: "hier", doneAt: "pas-une-date" })!;
    expect(repaired.subject).toBe("Informatique TC");
    expect(repaired.kind).toBe("à revoir");
    expect(Number.isNaN(new Date(repaired.createdAt).getTime())).toBe(false);
    expect(repaired.doneAt).toBeNull();
  });
});
