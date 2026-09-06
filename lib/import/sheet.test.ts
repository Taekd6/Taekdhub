import { describe, expect, it } from "vitest";
import {
  buildSource,
  externalIdFor,
  fingerprint,
  suggestChapter,
  suggestDifficulty,
  suggestMinutes,
  toImportRows,
  type DraftOverrides,
  type SheetMetadata,
} from "@/lib/import/sheet";
import type { Chapter } from "@/lib/storage";
import type { Difficulty } from "@/lib/supabase/types";
import type { SheetExercise } from "@/lib/import/types";

function draft(overrides: Partial<SheetExercise> = {}): SheetExercise {
  return {
    number: "1",
    title: "Suites récurrentes",
    statement: "Soit $u_{n}$ la suite définie par récurrence. Montrer qu'elle converge.",
    pages: [1],
    parts: 0,
    warnings: [],
    ...overrides,
  };
}

function override(overrides: Partial<DraftOverrides> = {}): DraftOverrides {
  return { include: true, title: "Suites récurrentes", statement: draft().statement, chapterLabel: "", difficulty: 3 as Difficulty, force: false, ...overrides };
}

const metadata: SheetMetadata = {
  subject: "Mathématiques",
  chapterLabel: "",
  sheetName: "Feuille 4 — Intégrales",
  origin: "Lycée Jean Perrin",
  year: "2026",
  type: "TD",
  tags: ["intégrales"],
};

describe("source d'une feuille", () => {
  it("assemble nom, origine et année", () => {
    expect(buildSource(metadata)).toBe("Feuille 4 — Intégrales — Lycée Jean Perrin — 2026");
  });

  it("n'invente pas de tirets pour des champs vides", () => {
    expect(buildSource({ ...metadata, origin: "", year: "" })).toBe("Feuille 4 — Intégrales");
    expect(buildSource({ ...metadata, sheetName: "", origin: "", year: "" })).toBe("");
  });
});

describe("identifiants d'import", () => {
  it("sont stables : deux analyses de la même feuille donnent les mêmes", () => {
    const print = fingerprint("feuille.pdf:12345:Feuille 4");
    expect(externalIdFor(print, 0)).toBe(externalIdFor(fingerprint("feuille.pdf:12345:Feuille 4"), 0));
    // C'est cette stabilité qui fait détecter le réimport comme un doublon,
    // sans dépendre du titre — que l'élève a pu corriger entre-temps.
    expect(externalIdFor(print, 0)).not.toBe(externalIdFor(print, 1));
  });

  it("changent quand l'élève force l'import d'un doublon", () => {
    const print = fingerprint("feuille.pdf");
    expect(externalIdFor(print, 0, 1)).not.toBe(externalIdFor(print, 0, 0));
  });

  it("distinguent deux feuilles différentes", () => {
    expect(fingerprint("feuille-a.pdf")).not.toBe(fingerprint("feuille-b.pdf"));
  });
});

describe("propositions faites à l'élève", () => {
  it("propose une difficulté plus haute quand l'exercice a beaucoup de sous-questions", () => {
    expect(suggestDifficulty(draft({ parts: 5 }))).toBeGreaterThan(suggestDifficulty(draft({ parts: 2 })));
  });

  it("propose une difficulté plus basse pour une question de cours courte", () => {
    expect(suggestDifficulty(draft({ statement: "Calculer $2 + 2$.", parts: 0 }))).toBeLessThan(3);
  });

  it("reste toujours dans l'échelle 1–5", () => {
    for (const parts of [0, 1, 3, 8, 20]) {
      const value = suggestDifficulty(draft({ parts }));
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("propose une durée qui grandit avec le nombre de sous-questions, sans dépasser 90 minutes", () => {
    expect(suggestMinutes(draft({ parts: 0 }))).toBe(15);
    expect(suggestMinutes(draft({ parts: 3 }))).toBe(30);
    expect(suggestMinutes(draft({ parts: 40 }))).toBe(90);
  });

  it("propose le chapitre dont le libellé apparaît dans l'énoncé", () => {
    const chapters: Chapter[] = [
      { id: "c1", subject: "Mathématiques", label: "Suites et séries" },
      { id: "c2", subject: "Mathématiques", label: "Intégration" },
      { id: "c3", subject: "Physique", label: "Suites et séries" },
    ];
    expect(suggestChapter(draft({ statement: "Étudier les suites et séries de fonctions." }), chapters, "Mathématiques")).toBe("Suites et séries");
    // Rien ne correspond : on ne propose rien plutôt que de ranger au hasard.
    expect(suggestChapter(draft({ title: "Zéro", statement: "Rien de reconnaissable ici." }), chapters, "Mathématiques")).toBe("");
  });
});

describe("construction des lignes d'import", () => {
  it("reporte les métadonnées communes sur chaque exercice", () => {
    const rows = toImportRows([draft(), draft({ number: "2" })], [override(), override()], metadata, "abc123");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.source).toBe("Feuille 4 — Intégrales — Lycée Jean Perrin — 2026");
      expect(row.subject).toBe("Mathématiques");
      expect(row.type).toBe("TD");
      expect(row.tags).toEqual(["intégrales"]);
      expect(row.year).toBe(2026);
      // La provenance « enseignant » est celle qui fait afficher la source
      // dans la liste d'exercices — et elle ne revendique aucun concours.
      expect(row.provenance).toBe("enseignant");
    }
    expect(rows[0].exerciseNumber).toBe("1");
    expect(rows[1].exerciseNumber).toBe("2");
  });

  it("ne produit QUE les exercices retenus — c'est ce qui rend l'import partiel possible", () => {
    const drafts = [draft({ number: "1" }), draft({ number: "2" }), draft({ number: "3" })];
    const rows = toImportRows(drafts, [override(), override({ include: false }), override()], metadata, "abc123");
    expect(rows.map((row) => row.exerciseNumber)).toEqual(["1", "3"]);
  });

  it("respecte les corrections faites dans l'aperçu", () => {
    const rows = toImportRows(
      [draft()],
      [override({ title: "Titre corrigé", statement: "Énoncé corrigé à la main.", chapterLabel: "Suites", difficulty: 5 as Difficulty })],
      metadata,
      "abc123"
    );
    expect(rows[0].title).toBe("Titre corrigé");
    expect(rows[0].statement).toBe("Énoncé corrigé à la main.");
    expect(rows[0].chapter).toBe("Suites");
    expect(rows[0].difficulty).toBe(5);
  });

  it("ne rend aucune ligne quand rien n'est sélectionné", () => {
    expect(toImportRows([draft()], [override({ include: false })], metadata, "abc")).toEqual([]);
  });
});
