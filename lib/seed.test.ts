import { describe, expect, it } from "vitest";
import { loadSeedBank, reconcileSeedBank, SEED_CONTENT_VERSION } from "@/lib/seed";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`, subject: "Mathématiques", title: `Exercice ${counter}`, statement: "",
    chapter_id: null, source: "Ancienne source", year: null, competition: null, programme_level: null,
    license_status: null, external_id: null,
  epreuve: null,
  filiere: null,
  exercise_number: null,
  provenance: "originale", source_url: null, prerequisites: [],
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

/**
 * Régression P1 — une montée de version de la banque effaçait du contenu que
 * l'élève avait TAPÉ LUI-MÊME.
 *
 * `merged = { ...fresh }` ne restituait que `LEARNER_OWNED` (statut, maîtrise,
 * tentatives, dernier travail, favori, id, création) plus la note. Or l'énoncé
 * et la durée estimée se saisissent directement dans l'app
 * (components/exercises/exercise-detail.tsx, lignes 52 et 85) : ils
 * repartaient à la valeur de la banque à chaque `SEED_CONTENT_VERSION`.
 */
describe("reconcileSeedBank — ce que l'élève a écrit lui-même ne s'écrase pas", () => {
  it("garde l'énoncé recopié à la main sur une fiche livrée sans énoncé", () => {
    // Scénario réel : la banque a livré cette fiche avec `statement: ""`,
    // l'élève a recopié l'énoncé de sa feuille de TD, puis la version 6 sort.
    const local = makeExercise({ title: "Feuille 13 — exercice 4", statement: "Soit $A \\in M_n(\\mathbb{R})$ telle que…", attempts: 2 });
    const fresh = makeExercise({ title: "Feuille 13 — exercice 4", statement: "" });

    const merged = reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] }).exercises[0];

    expect(merged.statement).toBe("Soit $A \\in M_n(\\mathbb{R})$ telle que…");
  });

  it("laisse quand même la banque combler un énoncé resté vide", () => {
    const local = makeExercise({ title: "X", statement: "   " });
    const fresh = makeExercise({ title: "X", statement: "énoncé de la banque" });
    expect(reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] }).exercises[0].statement).toBe("énoncé de la banque");
  });

  it("garde la durée estimée saisie par l'élève", () => {
    const local = makeExercise({ title: "X", estimated_minutes: 45 });
    const fresh = makeExercise({ title: "X", estimated_minutes: null });
    expect(reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] }).exercises[0].estimated_minutes).toBe(45);
  });
});

/**
 * Régression P1 — un exercice DÉSARCHIVÉ à la main était ré-archivé à chaque
 * montée de version.
 *
 * `local.archived || fresh.archived` ne protégeait qu'un sens. Les exercices
 * "spe" et de palier 4/6 arrivent archivés par construction
 * (lib/exercise-import.ts) : l'élève qui commence la Spé les restaure
 * explicitement (exercise-manager.tsx#restoreExercise), travaille dessus…
 * et les voyait disparaître de la liste ET de toutes les recommandations à
 * la version suivante, en emportant les tentatives enregistrées.
 */
describe("reconcileSeedBank — la décision d'archivage de l'élève tient dans les deux sens", () => {
  it("ne ré-archive pas un pilier de Spé restauré puis travaillé", () => {
    const local = makeExercise({ title: "Réduction — exercice 3", archived: false, attempts: 3, status: "en cours", last_worked_at: "2026-09-01T10:00:00.000Z" });
    const fresh = makeExercise({ title: "Réduction — exercice 3", archived: true });

    const merged = reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] }).exercises[0];

    expect(merged.archived).toBe(false);
    expect(merged.attempts).toBe(3);
  });

  it("archive bien un exercice jamais travaillé que la banque met en quarantaine", () => {
    const local = makeExercise({ title: "Jamais ouvert", archived: false, attempts: 0, last_worked_at: null });
    const fresh = makeExercise({ title: "Jamais ouvert", archived: true });
    expect(reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] }).exercises[0].archived).toBe(true);
  });
});

/**
 * Régression P0 — une correction de la banque n'atteignait JAMAIS
 * l'installation existante.
 *
 * hooks/use-prepahub-data.ts ne relance `reconcileSeedBank` que si
 * `SEED_CONTENT_VERSION` dépasse la version déjà appliquée. Corriger le
 * dataset sans incrémenter cette constante ne profite qu'aux nouvelles
 * installations : l'élève qui utilise déjà l'app garde son ancienne banque,
 * fiches sans énoncé comprises.
 */
describe("SEED_CONTENT_VERSION", () => {
  it("dépasse la version 5, sinon le nettoyage de la banque n'atteint pas les installations existantes", () => {
    expect(SEED_CONTENT_VERSION).toBeGreaterThan(5);
  });
});

/**
 * Régression P0 — `reconcileSeedBank` n'avait aucun chemin de RETRAIT.
 *
 * Il ne savait qu'ajouter et fusionner : une fiche corrigée en la supprimant
 * du dataset (une fiche sans énoncé, ou renvoyant à une feuille papier que
 * l'app ne contient pas) restait définitivement dans la banque locale et
 * continuait d'afficher « Aucun énoncé renseigné » en mode focus, à chaque
 * séance, pour toujours.
 */
describe("reconcileSeedBank — retirer ce que la banque a corrigé en le supprimant", () => {
  it("retire une fiche absente de la nouvelle banque à laquelle l'élève n'a jamais touché", () => {
    const obsolete = makeExercise({ title: "Feuille 7 — exercice 2 (renvoie au papier)" });
    const kept = makeExercise({ title: "Toujours dans la banque" });

    const result = reconcileSeedBank([obsolete, kept], [], { exercises: [makeExercise({ title: "Toujours dans la banque" })], chapters: [] });

    expect(result.removedCount).toBe(1);
    expect(result.exercises.map((exercise) => exercise.title)).toEqual(["Toujours dans la banque"]);
  });

  // Un seul signal de travail suffit à protéger la fiche : c'est le point
  // entier de la règle, aucune de ces sept traces ne doit pouvoir être
  // effacée par une mise à jour de contenu.
  const traces: [string, Partial<Exercise>][] = [
    ["une tentative enregistrée", { attempts: 1 }],
    ["une date de dernier travail", { last_worked_at: "2026-09-01T10:00:00.000Z" }],
    ["une mise en favori", { favorite: true }],
    ["une note personnelle", { note: "à refaire avant le DS" }],
    ["un énoncé recopié à la main", { statement: "Soit $f$ continue…" }],
    ["un statut déplacé", { status: "à revoir" }],
    ["une maîtrise déclarée", { mastery: 75 as Mastery }],
  ];

  it.each(traces)("garde une fiche absente de la banque dès qu'elle porte %s", (_label, trace) => {
    const worked = makeExercise({ title: "Retirée de la banque mais travaillée", ...trace });

    const result = reconcileSeedBank([worked], [], { exercises: [makeExercise({ title: "Autre chose" })], chapters: [] });

    expect(result.removedCount).toBe(0);
    expect(result.exercises.find((exercise) => exercise.title === "Retirée de la banque mais travaillée")).toEqual(worked);
  });

  it("ne retire rien quand la banque contient toujours tout", () => {
    const local = makeExercise({ title: "A" });
    const result = reconcileSeedBank([local], [], { exercises: [makeExercise({ title: "A" })], chapters: [] });
    expect(result.removedCount).toBe(0);
    expect(result.exercises).toHaveLength(1);
  });
});

/**
 * Régression P1 — l'apostrophe typographique (U+2019) contre l'ASCII (U+0027).
 *
 * La clé de rapprochement se contentait de `trim().toLowerCase()`. Un simple
 * changement d'apostrophe entre deux versions du dataset suffisait pour que la
 * fiche locale ne soit plus reconnue : la progression de l'élève restait
 * accrochée à sa version, et la version banque était réinsérée À CÔTÉ, à zéro
 * tentative. Cas réel dans la banque : « Déterminant d'une matrice
 * tridiagonale », présent deux fois.
 */
describe("clé de banque — deux écritures d'un même titre ne font qu'une fiche", () => {
  it("rapproche une apostrophe typographique d'une apostrophe ASCII (aucun doublon, progression conservée)", () => {
    const local = makeExercise({ title: "Déterminant d’une matrice tridiagonale", attempts: 5, status: "à revoir" });
    const fresh = makeExercise({ title: "Déterminant d'une matrice tridiagonale", statement: "énoncé corrigé" });

    const result = reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] });

    expect(result.exercises).toHaveLength(1);
    expect(result.addedCount).toBe(0);
    expect(result.exercises[0].attempts).toBe(5);
    expect(result.exercises[0].statement).toBe("énoncé corrigé");
  });

  it("absorbe aussi une espace insécable et une double espace", () => {
    const local = makeExercise({ title: "Suites et  séries", attempts: 1 });
    const fresh = makeExercise({ title: "Suites et séries", statement: "x" });
    const result = reconcileSeedBank([local], [], { exercises: [fresh], chapters: [] });
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].attempts).toBe(1);
  });
});

/**
 * La banque réellement livrée — le seul test qui parle des vrais datasets.
 * Il fixe les deux invariants que le nettoyage vient d'établir, pour qu'un
 * futur ajout de dataset ne puisse pas les défaire en silence.
 */
describe("loadSeedBank — invariants de la banque livrée", () => {
  it("aucune fiche sans énoncé, aucun doublon de titre", async () => {
    const { exercises } = await loadSeedBank();

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.filter((exercise) => !exercise.statement.trim())).toEqual([]);

    const keys = exercises.map((exercise) => `${exercise.subject}::${exercise.title.normalize("NFKC").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase()}`);
    expect(keys.length - new Set(keys).size).toBe(0);
  });
});
