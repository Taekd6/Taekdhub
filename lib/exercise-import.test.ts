import { describe, expect, it } from "vitest";
import banqueComplete from "@/datasets/exercices-banque-complete.json";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";

/**
 * Diagnostic « champ Énoncé vide en édition » — vérifie que `statement`
 * traverse `parseExerciseImportPayload` → `createExerciseFromInput` sans
 * jamais être renommé, supprimé, ni silencieusement remplacé par "" alors
 * qu'il existe dans la source. Absent de couverture avant cette
 * investigation (aucun test n'existait pour lib/exercise-import.ts).
 */
describe("parseExerciseImportPayload — statement", () => {
  const baseRow = { title: "Exercice test", source: "Test", subject: "Mathématiques" };

  it("un statement présent dans la source est conservé tel quel, y compris multi-lignes et LaTeX", () => {
    const statement = "Soit $P(X) = X^4 - 4X^3 + 5X^2 - 4X + 4$.\nMontrer que $2$ est racine de $P$.";
    const { rows, errors } = parseExerciseImportPayload([{ ...baseRow, statement }], []);
    expect(errors).toHaveLength(0);
    expect(rows[0].input.statement).toBe(statement);
  });

  it("un statement absent de la source retombe sur \"\" — jamais inventé, jamais une exception", () => {
    const { rows, errors } = parseExerciseImportPayload([{ ...baseRow }], []);
    expect(errors).toHaveLength(0);
    expect(rows[0].input.statement).toBe("");
  });

  it("un statement qui n'est pas une chaîne (donnée corrompue) retombe sur \"\" plutôt que de planter", () => {
    const { rows, errors } = parseExerciseImportPayload([{ ...baseRow, statement: 42 }], []);
    expect(errors).toHaveLength(0);
    expect(rows[0].input.statement).toBe("");
  });

  it("createExerciseFromInput conserve le statement du input jusqu'à l'Exercise final", () => {
    const statement = "Énoncé de bout en bout.";
    const { rows } = parseExerciseImportPayload([{ ...baseRow, statement }], []);
    const exercise = createExerciseFromInput(rows[0].input);
    expect(exercise.statement).toBe(statement);
  });
});

/**
 * Garde de non-régression directe sur le bug rapporté : l'exercice "Division
 * euclidienne et racine multiple d'un polynôme" doit conserver un énoncé
 * non vide dans le dataset RÉELLEMENT chargé au premier lancement
 * (lib/seed.ts#loadSeedBank → datasets/exercices-banque-complete.json) — pas
 * un dataset legacy inutilisé. Si ce test casse un jour, c'est que ce champ
 * a été perdu à la source, exactement le symptôme initial.
 */
describe("dataset actif — exercice rapporté dans le bug", () => {
  it("« Division euclidienne et racine multiple d'un polynôme » a un énoncé non vide", () => {
    const entries = banqueComplete as unknown as Array<{ title: string; statement?: string }>;
    const entry = entries.find((item) => item.title === "Division euclidienne et racine multiple d'un polynôme");
    expect(entry).toBeDefined();
    expect((entry?.statement ?? "").trim().length).toBeGreaterThan(0);
  });
});
