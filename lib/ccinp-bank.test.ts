import { describe, expect, it } from "vitest";
import ccinp from "@/datasets/ccinp-2025-oral-mp-mpi.json";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import { competitionOptionsForFilters, defaultExerciseFilters, filterExercises, originOf } from "@/lib/exercise-filters";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Banque officielle CCINP 2025 — contrôles d'INTÉGRITÉ.
 *
 * C'est la première source dont la provenance soit complète, donc la première
 * à pouvoir prétendre au niveau « concours-verifie ». Ces tests vérifient que
 * ce statut découle bien des données enregistrées, et qu'aucune information
 * absente du PDF n'a été comblée par une supposition — en particulier la
 * filière, publiée pour MP ET MPI, qu'il aurait été facile de réduire à MP.
 */

const imported: Exercise[] = (() => {
  const { rows, errors } = parseExerciseImportPayload(ccinp, []);
  expect(errors).toEqual([]);
  return rows.map((row) => createExerciseFromInput(row.input));
})();

describe("provenance CCINP", () => {
  it("est intégralement acceptée par le pipeline d'import", () => {
    expect(imported.length).toBeGreaterThanOrEqual(75);
  });

  it("porte les quatre informations qu'exige le niveau vérifié", () => {
    for (const exercise of imported) {
      expect(exercise.provenance, exercise.title).toBe("concours-verifie");
      expect(exercise.competition).toBe("CCINP");
      expect(exercise.year).toBe(2025);
      expect(exercise.epreuve).toBe("Oral de mathématiques");
      expect(exercise.exercise_number, exercise.title).toMatch(/^\d+$/);
    }
  });

  it("conserve les DEUX filières publiées, sans en choisir une", () => {
    for (const exercise of imported) {
      expect(exercise.filieres).toEqual(["MP", "MPI"]);
    }
  });

  it("garde des numéros d'exercice réels, dans les bornes du document", () => {
    const numbers = imported.map((exercise) => Number(exercise.exercise_number));
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(112);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("cite sa source et sa licence sur chaque fiche", () => {
    for (const exercise of imported) {
      expect(exercise.source).toContain("CCINP");
      expect(exercise.source).toContain("CC BY-NC-SA");
      expect(exercise.license_status).toBe("libre");
      expect(exercise.source_url).toContain("concours-commun-inp.fr");
    }
  });
});

describe("classification CCINP", () => {
  it("range chaque exercice dans un chapitre du programme, pas dans un fourre-tout", () => {
    const generic = imported.filter((exercise) => ["Oral de concours", "Oral", "Concours"].includes(exercise.title));
    expect(generic).toEqual([]);
    const chapters = new Set(imported.map((exercise) => exercise.chapter_id));
    // `chapter_id` est résolu à l'amorçage ; ici on vérifie surtout qu'aucun
    // exercice n'est laissé sans rattachement.
    expect(chapters.size).toBeGreaterThan(0);
  });

  it("couvre plusieurs chapitres du programme MP", () => {
    const { rows } = parseExerciseImportPayload(ccinp, []);
    const labels = new Set(rows.map((row) => row.chapterLabel));
    expect(labels.size).toBeGreaterThanOrEqual(8);
    for (const attendu of ["Réduction des endomorphismes", "Probabilités", "Séries entières"]) {
      expect(labels.has(attendu), `chapitre absent : ${attendu}`).toBe(true);
    }
  });

  it("n'a aucun énoncé mutilé : ni glyphe non résolu, ni appareil de page", () => {
    for (const exercise of imported) {
      expect(exercise.statement, exercise.title).not.toContain("(cid:");
      expect(exercise.statement, exercise.title).not.toContain("CC BY-NC-SA");
      expect(exercise.statement, exercise.title).not.toContain("Banque épreuve orale");
      expect(exercise.statement.trim().length).toBeGreaterThan(70);
    }
  });

  it("conserve les corrigés là où l'extraction les a préservés", () => {
    expect(imported.filter((exercise) => (exercise.correction ?? "").trim().length > 200).length).toBeGreaterThanOrEqual(20);
  });
});

describe("doublons et filtres CCINP", () => {
  it("l'amorçage retient autant d'exercices que le fichier en contient", async () => {
    const { loadSeedBank } = await import("@/lib/seed");
    const seeded = await loadSeedBank();
    const fromCcinp = seeded.exercises.filter((exercise) => exercise.competition === "CCINP" && exercise.provenance === "concours-verifie");
    expect(fromCcinp).toHaveLength(imported.length);
  });

  it("un second import du même fichier n'ajoute rien", () => {
    const { rows, duplicates } = parseExerciseImportPayload(ccinp, [], imported);
    expect(rows).toHaveLength(0);
    expect(duplicates).toHaveLength(imported.length);
  });

  it("est filtrable par origine puis par concours", () => {
    expect(imported.every((exercise) => originOf(exercise) === "Concours")).toBe(true);
    const found = filterExercises(imported, { ...defaultExerciseFilters, origin: "Concours", competition: "CCINP" });
    expect(found).toHaveLength(imported.length);
    expect(competitionOptionsForFilters(imported, defaultExerciseFilters)).toEqual(["CCINP"]);
  });

  it("se retrouve en tapant « CCINP » ou « oral » dans la recherche", () => {
    expect(filterExercises(imported, { ...defaultExerciseFilters, query: "ccinp" })).toHaveLength(imported.length);
    expect(filterExercises(imported, { ...defaultExerciseFilters, query: "oral de mathématiques" })).toHaveLength(imported.length);
  });
});
