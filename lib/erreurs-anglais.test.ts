import { describe, expect, it } from "vitest";
import {
  ERREURS_ANGLAIS,
  ERREURS_CATEGORIES,
  filterByCategory,
  formatDate,
  groupByCategory,
  shuffledOrder,
  sortByOrder,
  UNKNOWN_CATEGORY,
  type ErreurAnglais,
  type ErreurCategorie,
} from "@/lib/erreurs-anglais";

const CATEGORIES: ErreurCategorie[] = [
  { id: "a", nom: "A", regle: "règle a" },
  { id: "b", nom: "B", regle: "règle b" },
  { id: "vide", nom: "Vide", regle: "aucune erreur" },
];

function erreur(id: number, categorie: string, date = "2026-10-24"): ErreurAnglais {
  return { id, date, source: "s", categorie, francais: "f", faux: "x", correct: "y" };
}

/**
 * Le fichier est enrichi à la main à chaque séance : ces contrôles disent
 * laquelle des lignes est fautive au lieu de laisser la page se dégrader.
 */
describe("data/erreurs-anglais.json", () => {
  it("contient des catégories et des erreurs", () => {
    expect(ERREURS_CATEGORIES.length).toBeGreaterThan(0);
    expect(ERREURS_ANGLAIS.length).toBeGreaterThan(0);
  });

  it("n'a pas deux catégories de même identifiant", () => {
    const ids = ERREURS_CATEGORIES.map((categorie) => categorie.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it("donne à chaque catégorie un nom et une règle", () => {
    for (const categorie of ERREURS_CATEGORIES) {
      expect(categorie.id, "id").not.toBe("");
      expect(categorie.nom.trim(), `nom de ${categorie.id}`).not.toBe("");
      expect(categorie.regle.trim(), `règle de ${categorie.id}`).not.toBe("");
    }
  });

  it("rattache chaque erreur à une catégorie qui existe", () => {
    const ids = new Set(ERREURS_CATEGORIES.map((categorie) => categorie.id));
    const orphans = ERREURS_ANGLAIS.filter((entry) => !ids.has(entry.categorie)).map((entry) => `${entry.source} : ${entry.categorie}`);
    expect(orphans, "catégorie inconnue").toEqual([]);
  });

  it("remplit tous les champs de chaque erreur, avec une date AAAA-MM-JJ valide", () => {
    for (const entry of ERREURS_ANGLAIS) {
      const label = `${entry.source} (${entry.francais})`;
      expect(entry.date, `date de ${label}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${entry.date}T00:00:00Z`).getTime()), `date de ${label}`).toBe(false);
      for (const field of ["source", "francais", "faux", "correct"] as const) {
        expect(entry[field].trim(), `${field} de ${label}`).not.toBe("");
      }
    }
  });
});

describe("groupByCategory", () => {
  it("suit l'ordre des catégories et passe les catégories sans erreur", () => {
    const groups = groupByCategory(CATEGORIES, [erreur(0, "b"), erreur(1, "a"), erreur(2, "b")]);
    expect(groups.map((group) => group.categorie.id)).toEqual(["a", "b"]);
    expect(groups.map((group) => group.erreurs.length)).toEqual([1, 2]);
  });

  it("met la plus récente d'abord, et garde l'ordre du fichier à date égale", () => {
    const [group] = groupByCategory(CATEGORIES, [erreur(0, "a", "2026-10-01"), erreur(1, "a", "2026-10-24"), erreur(2, "a", "2026-10-24")]);
    expect(group.erreurs.map((entry) => entry.id)).toEqual([1, 2, 0]);
  });

  it("garde une erreur à catégorie inconnue dans un groupe final, sans la perdre", () => {
    const groups = groupByCategory(CATEGORIES, [erreur(0, "a"), erreur(1, "faute-de-frappe")]);
    expect(groups.map((group) => group.categorie.id)).toEqual(["a", UNKNOWN_CATEGORY.id]);
    expect(groups[1].erreurs.map((entry) => entry.id)).toEqual([1]);
  });

  it("ne perd aucune erreur du vrai fichier", () => {
    const total = groupByCategory(ERREURS_CATEGORIES, ERREURS_ANGLAIS).reduce((sum, group) => sum + group.erreurs.length, 0);
    expect(total).toBe(ERREURS_ANGLAIS.length);
  });

  it("ne renvoie rien s'il n'y a aucune erreur", () => {
    expect(groupByCategory(CATEGORIES, [])).toEqual([]);
  });
});

describe("filterByCategory", () => {
  const all = [erreur(0, "a"), erreur(1, "b"), erreur(2, "inconnue")];

  it("renvoie tout sans filtre", () => {
    expect(filterByCategory(CATEGORIES, all, null)).toEqual(all);
  });

  it("ne garde que la catégorie choisie", () => {
    expect(filterByCategory(CATEGORIES, all, "b").map((entry) => entry.id)).toEqual([1]);
  });

  it("retrouve les erreurs à catégorie inconnue par leur groupe", () => {
    expect(filterByCategory(CATEGORIES, all, UNKNOWN_CATEGORY.id).map((entry) => entry.id)).toEqual([2]);
  });
});

describe("shuffledOrder et sortByOrder", () => {
  it("renvoie une permutation, sans toucher à la liste d'origine", () => {
    const ids = [0, 1, 2, 3, 4, 5];
    const order = shuffledOrder(ids, () => 0.3);
    expect([...order].sort()).toEqual(ids);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("est déterministe pour un tirage donné (Fisher-Yates)", () => {
    expect(shuffledOrder([0, 1, 2], () => 0)).toEqual([1, 2, 0]);
  });

  it("range les erreurs dans l'ordre demandé et met à la fin celles qu'il ignore", () => {
    const list = [erreur(0, "a"), erreur(1, "a"), erreur(2, "a"), erreur(3, "a")];
    expect(sortByOrder(list, [2, 0, 1]).map((entry) => entry.id)).toEqual([2, 0, 1, 3]);
  });

  it("garde l'ordre relatif d'un sous-ensemble (filtre appliqué après le mélange)", () => {
    const list = [erreur(0, "a"), erreur(2, "a")];
    expect(sortByOrder(list, [2, 1, 0]).map((entry) => entry.id)).toEqual([2, 0]);
  });
});

describe("formatDate", () => {
  it("écrit la date en français", () => {
    expect(formatDate("2026-10-24")).toBe("24 octobre 2026");
  });

  it("rend telle quelle une date illisible", () => {
    expect(formatDate("bientôt")).toBe("bientôt");
    expect(formatDate("2026-13-45")).toBe("2026-13-45");
  });
});
