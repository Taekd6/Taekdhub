import { describe, expect, it } from "vitest";
import { EXERCISE_IMPORT_TEMPLATE, parseExerciseImportPayload } from "@/lib/exercise-import";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Racines n-ièmes de l'unité",
    statement: "Soit $n \\geq 2$. Déterminer les racines n-ièmes de l'unité.",
    source: "Feuille 3",
    subject: "Mathématiques",
    type: "TD",
    difficulty: 3,
    ...overrides,
  };
}

/**
 * Régression P1 — une fiche SANS énoncé traversait l'import sans un mot.
 *
 * Elle s'installait durablement dans la banque et, en mode focus, n'affichait
 * rien à chercher : « Aucun énoncé renseigné pour cet exercice — ouvre sa
 * fiche (hors mode focus) pour l'ajouter » (components/exercises/focus-view.tsx).
 * Pour du contenu de banque dont l'élève n'a pas la source papier, c'est un
 * cul-de-sac : il ne PEUT pas le compléter. Quinze fiches de ce type étaient
 * entrées ainsi. La porte se ferme à la frontière d'import — la seule qui
 * alimente à la fois la banque livrée (lib/seed.ts) et l'import manuel.
 */
describe("parseExerciseImportPayload — un exercice sans énoncé n'entre plus", () => {
  it("refuse une ligne sans champ statement, en la nommant", () => {
    const { rows, errors } = parseExerciseImportPayload([row({ statement: undefined })], []);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("statement");
    expect(errors[0].message).toContain("Racines n-ièmes de l'unité");
  });

  it("refuse un énoncé vide ou réduit à des espaces", () => {
    expect(parseExerciseImportPayload([row({ statement: "" })], []).rows).toEqual([]);
    expect(parseExerciseImportPayload([row({ statement: "   \n  " })], []).rows).toEqual([]);
  });

  it("refuse un statement qui n'est pas une chaîne", () => {
    expect(parseExerciseImportPayload([row({ statement: 42 })], []).rows).toEqual([]);
  });

  it("n'empêche jamais les autres lignes d'être importées", () => {
    const { rows, errors } = parseExerciseImportPayload([row({ statement: "" }), row({ title: "Valide" })], []);
    expect(rows.map((parsed) => parsed.input.title)).toEqual(["Valide"]);
    expect(errors).toHaveLength(1);
  });

  it("accepte un énoncé réel et le conserve tel quel (espaces de bord retirés)", () => {
    const { rows } = parseExerciseImportPayload([row({ statement: "  Soit $f$ continue sur $[0,1]$.  " })], []);
    expect(rows[0].input.statement).toBe("Soit $f$ continue sur $[0,1]$.");
  });
});

/**
 * Le modèle téléchargé par l'élève doit rester importable tel quel : c'est le
 * seul exemple concret du format qu'il possède. Un champ devenu obligatoire
 * sans mise à jour du modèle transforme la documentation en piège.
 */
describe("EXERCISE_IMPORT_TEMPLATE — le modèle livré reste importable", () => {
  it("chaque ligne du modèle passe la validation, sans une seule erreur", () => {
    const { rows, errors } = parseExerciseImportPayload(EXERCISE_IMPORT_TEMPLATE, []);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(EXERCISE_IMPORT_TEMPLATE.length);
  });
});
