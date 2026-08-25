import { describe, expect, it } from "vitest";
import { reconcileSeedBank } from "@/lib/seed";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title: `Exercice ${counter}`, statement: "",
    chapter_id: null, source: "Ancienne source", year: null, competition: null, programme_level: null,
    license_status: null, external_id: null, source_url: null, prerequisites: [],
    pedagogical_goal: null, level: null, type: "TD", difficulty: 3,
    mastery: 0 as Mastery, status: "à faire", estimated_minutes: null, attempts: 0, note: null,
    created_at: now, updated_at: now, tags: [], favorite: false, archived: false, hints: [],
    correction: null, last_worked_at: null, ...overrides,
  };
}

/**
 * Reproduit le bug remonté par l'usage réel : une banque amorcée à l'époque où
 * elle comptait 176 fiches SANS AUCUN énoncé restait figée pour toujours —
 * l'écran de séance affichait « aucun énoncé renseigné », indéfiniment.
 * Le rattrapage doit apporter le contenu SANS toucher à la progression.
 */
describe("reconcileSeedBank — rattraper le contenu sans effacer le travail", () => {
  const chapters: Chapter[] = [{ id: "chap-local", subject: "Mathématiques", label: "Nombres complexes" } as Chapter];

  it("apporte l'énoncé manquant et conserve intégralement la progression", () => {
    const local = makeExercise({
      title: "Racines n-ièmes de l'unité",
      statement: "",
      hints: [],
      status: "à revoir",
      mastery: 50 as Mastery,
      attempts: 4,
      favorite: true,
      note: "revoir la formule d'Euler",
      last_worked_at: "2026-03-01T10:00:00.000Z",
    });
    const fresh = makeExercise({
      title: "Racines n-ièmes de l'unité",
      statement: "Soit $n \\geq 2$…",
      hints: ["Pense aux exponentielles complexes."],
      correction: "On écrit $z = e^{2i\\pi k/n}$…",
      source: "Nouvelle source",
      difficulty: 4,
    });

    const result = reconcileSeedBank([local], chapters, { exercises: [fresh], chapters: [] });
    const merged = result.exercises[0];

    // contenu rafraîchi
    expect(merged.statement).toBe("Soit $n \\geq 2$…");
    expect(merged.hints).toEqual(["Pense aux exponentielles complexes."]);
    expect(merged.correction).toContain("e^{2i\\pi k/n}");
    expect(merged.source).toBe("Nouvelle source");
    expect(merged.difficulty).toBe(4);

    // progression intacte
    expect(merged.id).toBe(local.id);
    expect(merged.status).toBe("à revoir");
    expect(merged.mastery).toBe(50);
    expect(merged.attempts).toBe(4);
    expect(merged.favorite).toBe(true);
    expect(merged.note).toBe("revoir la formule d'Euler");
    expect(merged.last_worked_at).toBe("2026-03-01T10:00:00.000Z");
  });

  it("ajoute les exercices apparus depuis, avec une progression vierge", () => {
    const local = makeExercise({ title: "Déjà là" });
    const seed = [makeExercise({ title: "Déjà là" }), makeExercise({ title: "Nouveau chapitre entier" })];

    const result = reconcileSeedBank([local], chapters, { exercises: seed, chapters: [] });

    expect(result.addedCount).toBe(1);
    expect(result.exercises).toHaveLength(2);
    const added = result.exercises.find((exercise) => exercise.title === "Nouveau chapitre entier")!;
    expect(added.attempts).toBe(0);
    expect(added.status).toBe("à faire");
  });

  it("ne touche jamais à un exercice que l'élève a créé lui-même", () => {
    const own = makeExercise({ title: "Mon DS maison", statement: "énoncé perso", status: "en cours", attempts: 2 });

    const result = reconcileSeedBank([own], chapters, { exercises: [makeExercise({ title: "Autre chose" })], chapters: [] });

    const kept = result.exercises.find((exercise) => exercise.title === "Mon DS maison")!;
    expect(kept).toEqual(own);
  });

  it("respecte un archivage décidé par l'élève", () => {
    const local = makeExercise({ title: "Écarté par l'élève", archived: true, attempts: 1 });
    const fresh = makeExercise({ title: "Écarté par l'élève", archived: false, statement: "nouvel énoncé" });

    const result = reconcileSeedBank([local], chapters, { exercises: [fresh], chapters: [] });

    expect(result.exercises[0].archived).toBe(true);
    expect(result.exercises[0].statement).toBe("nouvel énoncé");
  });

  it("réutilise les chapitres existants plutôt que d'en créer des doublons", () => {
    const local = makeExercise({ title: "Racines", chapter_id: "chap-local" });
    const seedChapter = { id: "chap-seed", subject: "Mathématiques", label: "Nombres complexes" } as Chapter;
    const fresh = makeExercise({ title: "Racines", chapter_id: "chap-seed", statement: "x" });

    const result = reconcileSeedBank([local], chapters, { exercises: [fresh], chapters: [seedChapter] });

    expect(result.chapters).toHaveLength(1);
    expect(result.exercises[0].chapter_id).toBe("chap-local");
  });
});

describe("reconcileSeedBank — la note personnelle prime, sans effacer celle de la banque", () => {
  const chapters: Chapter[] = [];

  it("garde la note écrite par l'élève", () => {
    const local = makeExercise({ title: "X", note: "ma remarque" });
    const fresh = makeExercise({ title: "X", note: "piège classique" });
    expect(reconcileSeedBank([local], chapters, { exercises: [fresh], chapters: [] }).exercises[0].note).toBe("ma remarque");
  });

  it("apporte celle de la banque quand l'élève n'en a pas écrit", () => {
    const local = makeExercise({ title: "X", note: null });
    const fresh = makeExercise({ title: "X", note: "piège classique" });
    expect(reconcileSeedBank([local], chapters, { exercises: [fresh], chapters: [] }).exercises[0].note).toBe("piège classique");
  });
});
