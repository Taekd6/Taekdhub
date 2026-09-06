import { describe, expect, it } from "vitest";
import { findDuplicate, normalizeStatement, similarity } from "@/lib/import/duplicates";
import type { Exercise } from "@/lib/supabase/types";

let counter = 0;
function bankExercise(statement: string, title = "Exercice existant"): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title, statement, chapter_id: null, source: "Banque",
    year: null, competition: null, programme_level: null, license_status: null, external_id: null,
    epreuve: null, filieres: [], exercise_number: null, provenance: "originale", source_url: null,
    prerequisites: [], pedagogical_goal: null, level: null, type: "TD", difficulty: 3, mastery: 0,
    status: "à faire", estimated_minutes: null, attempts: 0, note: null, created_at: now, updated_at: now,
    tags: [], hints: [], correction: null, favorite: false, archived: false, last_worked_at: null,
  } as Exercise;
}

const ENONCE = "Soit $u_{n}$ la suite définie par $u_{0} = 1$. Montrer que la suite est croissante puis qu'elle diverge.";

describe("normalisation des énoncés", () => {
  it("ignore la casse, les accents, la ponctuation et les commandes LaTeX", () => {
    // Deux extractions du même exercice ne diffèrent souvent que par ces
    // détails-là : ils ne doivent pas empêcher de reconnaître un doublon.
    expect(normalizeStatement("Montrer que $\\alpha \\leq 1$ !")).toBe("montrer que 1");
    expect(normalizeStatement("MONTRER QUE, l'intégrale converge.")).toBe(
      normalizeStatement("montrer que l integrale converge")
    );
  });
});

describe("similarité", () => {
  it("vaut 1 pour deux textes identiques et 0 pour deux textes étrangers", () => {
    expect(similarity(normalizeStatement(ENONCE), normalizeStatement(ENONCE))).toBe(1);
    expect(similarity(normalizeStatement(ENONCE), normalizeStatement("Calculer la dérivée de la fonction exponentielle."))).toBeLessThan(0.2);
  });

  it("reste élevée quand un mot change", () => {
    const score = similarity(normalizeStatement(ENONCE), normalizeStatement(ENONCE.replace("croissante", "monotone")));
    expect(score).toBeGreaterThan(0.85);
  });
});

describe("détection d'un exercice déjà présent", () => {
  it("reconnaît un énoncé identique même si le titre a changé", () => {
    const bank = [bankExercise(ENONCE, "Un tout autre titre")];
    const match = findDuplicate(ENONCE, bank);
    expect(match?.kind).toBe("identique");
    expect(match?.title).toBe("Un tout autre titre");
  });

  it("reconnaît un énoncé reformulé comme « proche »", () => {
    const bank = [bankExercise(ENONCE)];
    const match = findDuplicate(ENONCE.replace("croissante", "monotone"), bank);
    expect(match?.kind).toBe("proche");
    expect(match!.similarity).toBeGreaterThan(0.85);
  });

  it("ne signale rien pour un exercice réellement nouveau", () => {
    expect(findDuplicate("Déterminer le rayon de convergence de la série entière donnée.", [bankExercise(ENONCE)])).toBeNull();
  });

  it("ne se déclenche pas sur un énoncé trop court pour être comparé", () => {
    // « Calculer. » ressemble à tout : mieux vaut ne rien dire que crier au
    // doublon à chaque exercice court.
    expect(findDuplicate("Calculer.", [bankExercise("Calculer.")])).toBeNull();
  });

  it("retient le plus ressemblant quand plusieurs candidats existent", () => {
    const bank = [bankExercise(ENONCE.replace("croissante", "monotone"), "Proche"), bankExercise(ENONCE, "Exact")];
    expect(findDuplicate(ENONCE, bank)?.title).toBe("Exact");
  });
});
