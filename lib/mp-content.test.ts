import { describe, expect, it } from "vitest";
import reductionBank from "@/datasets/mp-reduction-endomorphismes.json";
import vectorSpacesBank from "@/datasets/mp-espaces-vectoriels.json";
import algebraCorrected from "@/datasets/exercices-algebre-lineaire-feuille-13-24-corriges.json";
import algebraSheet from "@/datasets/exercices-algebre-lineaire-hors-reduction-septembre-2026.json";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import { recommendExercises } from "@/lib/recommendation";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Contenu de programme MP — garde-fou de LIVRAISON.
 *
 * La règle produit est explicite : « un exercice ajouté mais impossible à
 * sélectionner par le moteur est considéré comme non livré ». Ces tests
 * vérifient donc la chaîne complète, pas seulement la validité du JSON :
 * l'import doit accepter les lignes, elles doivent rester ACTIVES (le
 * pipeline archivait autrefois d'office tout ce qui est de 2e année), et
 * `recommendExercises` doit réellement les proposer.
 */

function importAll(bank: unknown): Exercise[] {
  const { rows, errors } = parseExerciseImportPayload(bank, []);
  expect(errors).toEqual([]);
  return rows.map((row) => createExerciseFromInput(row.input));
}

describe("banque MP — réduction des endomorphismes", () => {
  const exercises = importAll(reductionBank);

  it("est intégralement acceptée par le pipeline d'import", () => {
    expect(exercises.length).toBeGreaterThanOrEqual(20);
  });

  it("reste ACTIVE : rien n'est archivé d'office parce que c'est du programme de Spé", () => {
    expect(exercises.filter((exercise) => exercise.archived)).toEqual([]);
    expect(exercises.every((exercise) => exercise.programme_level === "spe")).toBe(true);
  });

  it("est travaillable : énoncé, indices et correction sur chaque fiche", () => {
    for (const exercise of exercises) {
      expect(exercise.statement.trim().length, exercise.title).toBeGreaterThan(80);
      expect(exercise.hints.length, exercise.title).toBeGreaterThan(0);
      expect((exercise.correction ?? "").trim().length, exercise.title).toBeGreaterThan(80);
    }
  });

  it("couvre les notions attendues du chapitre", () => {
    const tags = new Set(exercises.flatMap((exercise) => exercise.tags));
    for (const notion of [
      "valeurs propres",
      "sous-espaces propres",
      "polynôme caractéristique",
      "polynôme annulateur",
      "polynôme minimal",
      "diagonalisation",
      "trigonalisation",
      "Cayley-Hamilton",
      "nilpotence",
      "puissances de matrice",
      "suites récurrentes",
      "systèmes différentiels",
      "sous-espaces stables",
      "commutant",
      "multiplicité",
    ]) {
      expect(tags.has(notion), `notion absente de la banque : ${notion}`).toBe(true);
    }
  });

  it("propose une vraie progression de difficulté, pas un seul palier", () => {
    const levels = new Set(exercises.map((exercise) => exercise.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
    const difficulties = new Set(exercises.map((exercise) => exercise.difficulty));
    expect(Math.min(...difficulties)).toBeLessThanOrEqual(2);
    expect(Math.max(...difficulties)).toBeGreaterThanOrEqual(4);
  });

  it("est réellement sélectionnable par le moteur de recommandation", () => {
    const picks = recommendExercises(exercises, [], 5);
    expect(picks.length).toBe(5);
    expect(picks.every(({ exercise }) => exercise.chapter_id !== undefined)).toBe(true);
  });
});

describe("banque MP — espaces vectoriels (révision DS)", () => {
  const own = importAll(vectorSpacesBank);
  const sheet = [...importAll(algebraCorrected), ...importAll(algebraSheet)];

  it("les exercices originaux sont acceptés et travaillables", () => {
    expect(own.length).toBeGreaterThanOrEqual(5);
    for (const exercise of own) {
      expect(exercise.hints.length, exercise.title).toBeGreaterThan(0);
      expect((exercise.correction ?? "").trim().length, exercise.title).toBeGreaterThan(80);
    }
  });

  it("ne revendique jamais une provenance de concours qu'ils n'ont pas", () => {
    for (const exercise of own) {
      expect(exercise.competition, exercise.title).toBeNull();
      expect(exercise.source, exercise.title).toContain("TaekdHub");
    }
  });

  /**
   * Le point qui fait la valeur de la révision : les exercices RÉELLEMENT
   * issus des concours (références BEOS de la feuille) n'avaient ni indice ni
   * correction, donc étaient inexploitables seul la veille d'un DS.
   */
  it("les exercices de concours retenus pour le DS ont bien indices et correction", () => {
    const ds = sheet.filter((exercise) => exercise.tags.includes("DS espaces vectoriels"));
    expect(ds.length).toBeGreaterThanOrEqual(8);
    for (const exercise of ds) {
      expect(exercise.hints.length, exercise.title).toBeGreaterThan(0);
      expect((exercise.correction ?? "").trim().length, exercise.title).toBeGreaterThan(200);
    }
  });

  it("la sélection du DS mélange concours réels et exercices d'échauffement", () => {
    const ds = [...own, ...sheet].filter((exercise) => exercise.tags.includes("DS espaces vectoriels"));
    expect(ds.filter((exercise) => exercise.competition !== null).length).toBeGreaterThanOrEqual(5);
    expect(ds.filter((exercise) => exercise.difficulty <= 2).length).toBeGreaterThanOrEqual(2);
    expect(recommendExercises(ds, [], 6).length).toBe(6);
  });
});
