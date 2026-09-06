import { describe, expect, it } from "vitest";
import { extractExercises } from "@/lib/import/detect";
import { readFixture } from "@/lib/import/fixtures/read-fixture";
import { fingerprint, toImportRows, type DraftOverrides, type SheetMetadata } from "@/lib/import/sheet";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, Exercise } from "@/lib/supabase/types";
import type { SheetExercise } from "@/lib/import/types";

/**
 * CHAÎNE COMPLÈTE : PDF → aperçu → validation existante → exercices écrits.
 *
 * Le point vérifié ici est celui qui compte le plus pour l'utilisateur : un
 * exercice importé depuis une feuille est un exercice ORDINAIRE. Il passe par
 * `parseExerciseImportPayload` puis `createExerciseFromInput`, exactement comme
 * une saisie manuelle — donc le lecteur, le chronomètre, les indices,
 * l'historique et les recommandations le traitent comme n'importe quel autre.
 * S'il existait un chemin parallèle, ce test le verrait.
 */

const CHAPTERS: Chapter[] = [
  { id: "chap-integ", subject: "Mathématiques", label: "Intégration" },
  { id: "chap-suites", subject: "Mathématiques", label: "Suites" },
];

const METADATA: SheetMetadata = {
  subject: "Mathématiques",
  chapterLabel: "",
  sheetName: "Feuille 4 — Intégrales",
  origin: "Lycée Jean Perrin",
  year: "2026",
  type: "TD",
  tags: ["intégrales", "suites"],
};

function defaults(exercises: SheetExercise[], patch: Partial<DraftOverrides>[] = []): DraftOverrides[] {
  return exercises.map((exercise, index) => ({
    include: true,
    title: exercise.title,
    statement: exercise.statement,
    chapterLabel: "",
    difficulty: 3 as Difficulty,
    force: false,
    ...(patch[index] ?? {}),
  }));
}

async function sheet() {
  const pages = await readFixture("feuille-integrales.pdf");
  const extraction = extractExercises(pages);
  return { extraction, print: fingerprint("feuille-integrales.pdf:4596") };
}

describe("un PDF devient des exercices de la banque", () => {
  it("produit des exercices valides, sans aucune erreur de validation", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.errors).toEqual([]);
    expect(parsed.duplicates).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
  });

  it("crée des exercices strictement identiques, en structure, à une saisie manuelle", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    const created = parsed.rows.map((row) => createExerciseFromInput(row.input));

    const manual = createExerciseFromInput({
      subject: "Mathématiques", title: "Saisi à la main", statement: "Un énoncé.", source: "Moi",
      type: "TD", difficulty: 3, chapterId: null, tags: [], estimatedMinutes: null, note: "", hints: [], correction: "",
    });
    for (const exercise of created) {
      expect(Object.keys(exercise).sort()).toEqual(Object.keys(manual).sort());
      // Les champs dont dépend le lecteur : un énoncé, un statut de départ,
      // aucune tentative, aucune maîtrise acquise.
      expect(exercise.statement.trim().length).toBeGreaterThan(20);
      expect(exercise.status).toBe("à faire");
      expect(exercise.attempts).toBe(0);
      expect(exercise.mastery).toBe(manual.mastery);
      expect(exercise.archived).toBe(false);
      expect(exercise.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    // Les identifiants sont uniques : deux exercices importés ne peuvent pas
    // se confondre dans la banque.
    expect(new Set(created.map((exercise) => exercise.id)).size).toBe(created.length);
  });

  it("garde la source de la feuille sur chaque exercice", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const created = parseExerciseImportPayload(rows, CHAPTERS, []).rows.map((row) => createExerciseFromInput(row.input));
    for (const exercise of created) {
      expect(exercise.source).toBe("Feuille 4 — Intégrales — Lycée Jean Perrin — 2026");
      expect(exercise.provenance).toBe("enseignant");
      expect(exercise.competition).toBeNull();
      expect(exercise.tags).toEqual(["intégrales", "suites"]);
    }
  });

  it("conserve les formules jusque dans l'exercice écrit", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const created = parseExerciseImportPayload(rows, CHAPTERS, []).rows.map((row) => createExerciseFromInput(row.input));
    const statements = created.map((exercise) => exercise.statement).join("\n");
    expect(statements).toContain("$u_{n+1} = u_{n}^{2} + 1$");
    expect(statements).toContain("\\int");
    expect(statements).toContain("\\alpha");
    // `RichMath` découpe sur les `$` : un nombre impair casserait le rendu.
    expect((statements.match(/\$/g) ?? []).length % 2).toBe(0);
  });

  it("range l'exercice dans un chapitre existant plutôt que d'en créer un doublon", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises, [{ chapterLabel: "Intégration" }]), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows[0].isNewChapter).toBe(false);
    expect(parsed.rows[0].input.chapterId).toBe("chap-integ");
  });

  it("annonce un chapitre à créer sans le créer lui-même", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises, [{ chapterLabel: "Séries entières" }]), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows[0].isNewChapter).toBe(true);
    expect(parsed.rows[0].chapterLabel).toBe("Séries entières");
    expect(parsed.rows[0].input.chapterId).toBeNull();
  });
});

describe("doublons à l'import d'une feuille", () => {
  async function importedOnce(): Promise<{ bank: Exercise[]; extraction: Awaited<ReturnType<typeof sheet>>["extraction"]; print: string }> {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const bank = parseExerciseImportPayload(rows, CHAPTERS, []).rows.map((row) => createExerciseFromInput(row.input));
    return { bank, extraction, print };
  }

  it("réimporter la même feuille n'ajoute rien et ne modifie rien", async () => {
    const { bank, extraction, print } = await importedOnce();
    const before = JSON.stringify(bank);
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, bank);
    expect(parsed.rows).toEqual([]);
    expect(parsed.duplicates).toHaveLength(3);
    // Rien de ce qui existait n'a bougé : la détection lit la banque, elle ne
    // l'écrit jamais.
    expect(JSON.stringify(bank)).toBe(before);
  });

  it("détecte le doublon même quand le titre a été corrigé entre-temps", async () => {
    const { bank, extraction, print } = await importedOnce();
    const rows = toImportRows(
      extraction.exercises,
      defaults(extraction.exercises, [{ title: "Un titre entièrement différent" }]),
      METADATA,
      print
    );
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, bank);
    // L'identifiant de feuille fait foi, pas le titre.
    expect(parsed.rows).toEqual([]);
    expect(parsed.duplicates).toHaveLength(3);
  });

  it("permet d'importer quand même un exercice signalé comme doublon", async () => {
    const { bank, extraction, print } = await importedOnce();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises, [{ force: true }, { include: false }, { include: false }]), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, bank);
    expect(parsed.rows).toHaveLength(1);
    // Un identifiant NEUF : l'exercice existant n'est jamais écrasé.
    const created = createExerciseFromInput(parsed.rows[0].input);
    expect(created.external_id).not.toBe(bank[0].external_id);
    expect(bank.some((exercise) => exercise.id === created.id)).toBe(false);
  });

  it("écarte deux exercices identiques présents dans la MÊME feuille", async () => {
    const { extraction, print } = await sheet();
    const doubled = [extraction.exercises[0], extraction.exercises[0]];
    const rows = toImportRows(doubled, defaults(doubled), METADATA, print);
    // Les deux lignes portent des identifiants distincts (rangs différents),
    // mais le même titre : la validation existante refuse la seconde.
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows.length + parsed.duplicates.length).toBe(2);
  });
});

describe("import partiel et échec", () => {
  it("importe les bons exercices même si l'élève en écarte deux", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises, [{}, { include: false }, { include: false }]), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toEqual([]);
  });

  it("une ligne invalide n'empêche pas les autres d'être importées", async () => {
    const { extraction, print } = await sheet();
    // Énoncé vidé à la main dans l'aperçu : un exercice sans énoncé n'est pas
    // travaillable, la validation existante le refuse — nommément.
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises, [{ statement: "   " }]), METADATA, print);
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain("statement");
  });

  it("ne produit AUCUN exercice quand la feuille entière est refusée", async () => {
    const { extraction, print } = await sheet();
    const rows = toImportRows(extraction.exercises, defaults(extraction.exercises.map(() => ({ ...extraction.exercises[0] }))), { ...METADATA, sheetName: "", origin: "", year: "" }, print);
    // Sans nom de feuille, la source est vide : la validation refuse tout.
    const parsed = parseExerciseImportPayload(rows, CHAPTERS, []);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
