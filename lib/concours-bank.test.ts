import { describe, expect, it } from "vitest";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import { competitionOptionsForFilters, defaultExerciseFilters, filterExercises, originOf } from "@/lib/exercise-filters";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Banque concours — garde-fous d'HONNÊTETÉ.
 *
 * La règle produit est nette : rien ne doit être présenté comme un exercice
 * de concours sans que ses métadonnées le justifient. Ces tests vérifient
 * que le pipeline REFUSE les revendications non étayées, et pas seulement
 * qu'il accepte les cas nominaux.
 */

const base = {
  title: "Exercice de test",
  statement: "Soit $A$ une matrice de $M_n(\\mathbb{R})$. Montrer que son rang est inchangé par multiplication à gauche par une matrice inversible.",
  source: "Test",
  subject: "Mathématiques",
  chapter: "Matrices et systèmes",
  type: "Concours",
  difficulty: 3,
};

function importOne(overrides: Record<string, unknown>) {
  return parseExerciseImportPayload([{ ...base, ...overrides }], []);
}

describe("provenance — un exercice ne peut pas revendiquer plus qu'il ne prouve", () => {
  it("refuse « concours-verifie » sans session ni numéro d'exercice", () => {
    const { rows, errors } = importOne({ provenance: "concours-verifie", competition: "CCINP", epreuve: "Maths 1" });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("concours + session + épreuve + numéro");
  });

  it("accepte « concours-verifie » quand les quatre informations sont là", () => {
    const { rows, errors } = importOne({
      provenance: "concours-verifie",
      competition: "CCINP",
      epreuve: "Maths 1",
      year: 2022,
      exerciseNumber: "3",
    });
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].input.provenance).toBe("concours-verifie");
  });

  it("accepte « concours-partiel » sans session — c'est exactement son objet", () => {
    const { rows, errors } = importOne({ provenance: "concours-partiel", competition: "Mines-Ponts", epreuve: "Oral" });
    expect(errors).toEqual([]);
    expect(rows[0].input.provenance).toBe("concours-partiel");
  });

  it("refuse qu'un exercice original porte le nom d'un concours", () => {
    const { rows, errors } = importOne({ provenance: "originale", competition: "Centrale" });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("ne doit jamais en porter le nom");
  });

  it("refuse une provenance de concours sans nommer le concours", () => {
    const { rows, errors } = importOne({ provenance: "concours-partiel" });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("sans nommer le concours");
  });

  it("refuse un exercice de concours sans chapitre : il serait introuvable", () => {
    const { rows, errors } = importOne({ competition: "Centrale", epreuve: "Oral", chapter: undefined });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("sans champ \"chapter\"");
  });

  it("refuse une session incohérente", () => {
    const { rows, errors } = importOne({ competition: "CCINP", epreuve: "Oral", year: 1850 });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/incohérente|invalide/);
  });

  it("refuse une filière inconnue", () => {
    const { rows, errors } = importOne({ competition: "CCINP", epreuve: "Oral", filiere: "MPSI" });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("filière invalide");
  });

  it("déduit prudemment la provenance quand elle n'est pas déclarée", () => {
    expect(importOne({ competition: "Centrale", epreuve: "Oral" }).rows[0].input.provenance).toBe("concours-partiel");
    expect(importOne({}).rows[0].input.provenance).toBe("originale");
  });
});

describe("périmètre des concours", () => {
  it("laisse X et les ENS hors périmètre — l'élève ne les prépare pas", () => {
    for (const nom of ["X", "Polytechnique", "ENS Lyon"]) {
      const { rows, errors } = importOne({ competition: nom, epreuve: "Oral" });
      expect(rows, nom).toHaveLength(0);
      expect(errors[0].message, nom).toContain("hors périmètre");
    }
  });

  it("accepte les autres banques réellement passées en MP", () => {
    for (const [saisi, attendu] of [["tpe", "TPE-EIVP"], ["ensiie", "ENSIIE"], ["mines-télécom", "IMT"]]) {
      const { rows, errors } = importOne({ competition: saisi, epreuve: "Oral" });
      expect(errors, saisi).toEqual([]);
      expect(rows[0].input.competition).toBe(attendu);
    }
  });

  it("normalise les alias vers un libellé canonique", () => {
    expect(importOne({ competition: "ccp", epreuve: "Oral" }).rows[0].input.competition).toBe("CCINP");
    expect(importOne({ competition: "mines ponts", epreuve: "Oral" }).rows[0].input.competition).toBe("Mines-Ponts");
  });

  it("refuse toujours un concours inconnu plutôt que de l'inventer", () => {
    const { rows, errors } = importOne({ competition: "Concours Imaginaire", epreuve: "Oral" });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toContain("non reconnu");
  });
});

describe("doublons — réimporter le même recueil ne double pas la banque", () => {
  const already = createExerciseFromInput(
    parseExerciseImportPayload([{ ...base, competition: "CCINP", epreuve: "Oral", externalId: "delaunay-02598" }], []).rows[0].input
  );

  it("écarte une ligne dont l'identifiant externe est déjà en banque", () => {
    const { rows, duplicates, errors } = parseExerciseImportPayload(
      [{ ...base, competition: "CCINP", epreuve: "Oral", externalId: "delaunay-02598" }],
      [],
      [already]
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(0);
    expect(duplicates[0].message).toContain("déjà présent");
    expect(duplicates[0].message).toContain("delaunay-02598");
  });

  it("écarte aussi un doublon de titre quand il n'y a pas d'identifiant", () => {
    const sansId = createExerciseFromInput(parseExerciseImportPayload([base], []).rows[0].input);
    const { rows, duplicates } = parseExerciseImportPayload([base], [], [sansId]);
    expect(rows).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  it("repère un doublon interne au fichier lui-même", () => {
    const ligne = { ...base, competition: "Centrale", epreuve: "Oral", externalId: "x-1" };
    const { rows, duplicates } = parseExerciseImportPayload([ligne, ligne], []);
    expect(rows).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });

  it("laisse passer un exercice réellement différent", () => {
    const { rows, duplicates } = parseExerciseImportPayload(
      [{ ...base, title: "Un tout autre exercice", competition: "CCINP", epreuve: "Oral", externalId: "delaunay-99999" }],
      [],
      [already]
    );
    expect(duplicates).toEqual([]);
    expect(rows).toHaveLength(1);
  });
});

describe("filtres — retrouver un exercice de concours rapidement", () => {
  const make = (overrides: Record<string, unknown>): Exercise =>
    createExerciseFromInput(parseExerciseImportPayload([{ ...base, ...overrides }], []).rows[0].input);

  const centrale = make({ title: "Centrale réduction", competition: "Centrale", epreuve: "Oral" });
  const mines = make({ title: "Mines réduction", competition: "Mines-Ponts", epreuve: "Oral" });
  const maison = make({ title: "Exercice maison" });
  const bank = [centrale, mines, maison];

  it("classe chaque exercice dans la bonne origine", () => {
    expect(originOf(centrale)).toBe("Concours");
    expect(originOf(maison)).toBe("TaekdHub");
  });

  it("filtre sur l'origine « Concours »", () => {
    const found = filterExercises(bank, { ...defaultExerciseFilters, origin: "Concours" });
    expect(found.map((item) => item.title).sort()).toEqual(["Centrale réduction", "Mines réduction"]);
  });

  it("filtre sur un concours précis", () => {
    const found = filterExercises(bank, { ...defaultExerciseFilters, competition: "Centrale" });
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Centrale réduction");
  });

  it("ne propose que les concours réellement présents", () => {
    expect(competitionOptionsForFilters(bank, defaultExerciseFilters)).toEqual(["Centrale", "Mines-Ponts"]);
  });

  it("trouve un exercice en tapant le nom du concours dans la recherche", () => {
    const found = filterExercises(bank, { ...defaultExerciseFilters, query: "mines" });
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Mines réduction");
  });
});
