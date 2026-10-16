import { describe, expect, it } from "vitest";
import { isCleanSuccess } from "@/lib/attempts";
import { createRetryAttempt } from "@/lib/exercises";
import {
  createSheet,
  declarableHelps,
  EMPTY_DRAFT,
  helpFromReveal,
  normalizeSheet,
  normalizeSheets,
  NOTHING_REVEALED,
  revealCorrection,
  revealNextHint,
  safeUrl,
  sheetHref,
  sheetIdOfKey,
  sheetIssues,
  sheetKey,
  sheetsForChapter,
  trainingHref,
  upsertSheet,
  type ExerciseSheet,
  type SheetDraft,
} from "@/lib/exercise-sheets";

const NOW = new Date("2026-10-14T18:00:00.000Z");

const ia: SheetDraft = {
  ...EMPTY_DRAFT,
  subject: "Mathématiques",
  chapterId: "m2-reduction",
  notion: "polynôme annulateur",
  competence: "Diagonaliser via un polynôme annulateur",
  level: "classique",
  origin: "ia",
  statement: "Soit A ∈ M3(R)… Montrer que A est diagonalisable.",
  hints: ["Cherche un polynôme annulateur.", "Est-il scindé à racines simples ?"],
  correction: "Corrigé complet…",
  estimatedMinutes: "30",
};

const externe: SheetDraft = { ...ia, origin: "externe", sourceName: "Centrale-Supélec 2022, Maths 1", sourceUrl: "https://example.org/sujet.pdf" };

describe("fiches d'exercice — saisie", () => {
  it("une fiche IA complète est valide, sans source", () => {
    expect(sheetIssues(ia)).toEqual([]);
    const sheet = createSheet(ia, NOW, "s1")!;
    expect(sheet.origin).toBe("ia");
    expect(sheet.source).toBeNull();
    expect(sheet).toMatchObject({ subject: "Mathématiques", chapterId: "m2-reduction", competence: "Diagonaliser via un polynôme annulateur", level: "classique", estimatedMinutes: 30 });
  });

  it("une ressource externe garde sa source ET son lien", () => {
    const sheet = createSheet(externe, NOW, "s2")!;
    expect(sheet.origin).toBe("externe");
    expect(sheet.source).toEqual({ name: "Centrale-Supélec 2022, Maths 1", url: "https://example.org/sujet.pdf" });
  });

  it("une ressource externe SANS source n'est pas enregistrable ; sans lien, si (sujet papier)", () => {
    expect(sheetIssues({ ...externe, sourceName: "  " }).join(" ")).toMatch(/source/);
    expect(createSheet({ ...externe, sourceName: "" }, NOW)).toBeNull();
    expect(sheetIssues({ ...externe, sourceUrl: "" })).toEqual([]);
    expect(createSheet({ ...externe, sourceUrl: "" }, NOW, "s3")!.source).toEqual({ name: "Centrale-Supélec 2022, Maths 1", url: null });
  });

  it("une fiche IA n'emporte pas de source, même si le brouillon en portait une", () => {
    expect(createSheet({ ...ia, sourceName: "x", sourceUrl: "https://example.org" }, NOW, "s4")!.source).toBeNull();
  });

  it("exige origine, matière, chapitre cohérent, compétence, difficulté, énoncé", () => {
    expect(sheetIssues(EMPTY_DRAFT)).toHaveLength(6);
    expect(sheetIssues({ ...ia, subject: "Physique" }).join(" ")).toMatch(/chapitre n'est pas dans cette matière/);
    expect(sheetIssues({ ...ia, chapterId: "inconnu" }).join(" ")).toMatch(/chapitre/);
    expect(sheetIssues({ ...ia, competence: " " }).join(" ")).toMatch(/compétence/);
    expect(sheetIssues({ ...ia, statement: "" }).join(" ")).toMatch(/énoncé/);
    expect(sheetIssues({ ...ia, estimatedMinutes: "-3" }).join(" ")).toMatch(/durée/);
  });

  it("les liens javascript:, data: ou avec identifiants sont refusés ; seuls http(s) passent", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<b>x</b>")).toBeNull();
    expect(safeUrl("https://user:pass@example.org")).toBeNull();
    expect(safeUrl("ftp://example.org/x")).toBeNull();
    expect(safeUrl("pas un lien")).toBeNull();
    expect(safeUrl(" https://example.org/a b ")).toBe("https://example.org/a%20b");
    expect(sheetIssues({ ...externe, sourceUrl: "javascript:alert(1)" }).join(" ")).toMatch(/http/);
  });

  it("nettoie : indices vides retirés, 5 indices au plus, texte rogné", () => {
    const sheet = createSheet({ ...ia, hints: ["  a  ", "", "b", "c", "d", "e", "f"], statement: `  ${"x".repeat(10)}  ` }, NOW, "s5")!;
    expect(sheet.hints).toEqual(["a", "b", "c", "d", "e"]);
    expect(sheet.statement).toBe("xxxxxxxxxx");
  });
});

describe("fiches d'exercice — lecture du stockage", () => {
  const stored = createSheet(externe, NOW, "s6")!;

  it("relit une fiche valide à l'identique", () => {
    expect(normalizeSheet(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("écarte ce qui ne dit rien : sans énoncé, chapitre inconnu, origine inconnue, pas un objet", () => {
    for (const broken of [{ ...stored, statement: "" }, { ...stored, chapterId: "zzz" }, { ...stored, origin: "autre" }, { ...stored, level: "facile" }, null, "x", 3]) {
      expect(normalizeSheet(broken)).toBeNull();
    }
  });

  it("une ressource externe sans source n'est pas relue (jamais rendue anonyme)", () => {
    expect(normalizeSheet({ ...stored, source: null })).toBeNull();
    expect(normalizeSheet({ ...stored, source: { name: "", url: "https://example.org" } })).toBeNull();
  });

  it("un lien non http(s) du stockage est retiré, la source reste", () => {
    const read = normalizeSheet({ ...stored, source: { name: "Annale", url: "javascript:alert(1)" } })!;
    expect(read.source).toEqual({ name: "Annale", url: null });
  });

  it("une fiche IA relue n'a pas de source, même si le stockage en portait une", () => {
    const sheet = createSheet(ia, NOW, "s7")!;
    expect(normalizeSheet({ ...sheet, source: { name: "x", url: "https://example.org" } })!.source).toBeNull();
  });

  it("liste : doublons d'identifiant écartés, plus récentes d'abord, entrée non-tableau ⇒ []", () => {
    const older = createSheet(ia, new Date("2026-10-01T10:00:00.000Z"), "a")!;
    const newer = createSheet(ia, new Date("2026-10-10T10:00:00.000Z"), "b")!;
    expect(normalizeSheets([older, newer, newer, { nope: true }]).map((sheet) => sheet.id)).toEqual(["b", "a"]);
    expect(normalizeSheets("x")).toEqual([]);
  });

  it("upsertSheet remplace par identifiant sans modifier la liste d'origine", () => {
    const list = [createSheet(ia, NOW, "a")!];
    const edited: ExerciseSheet = { ...list[0], competence: "Autre" };
    const next = upsertSheet(list, edited);
    expect(next).toHaveLength(1);
    expect(next[0].competence).toBe("Autre");
    expect(list[0].competence).toBe("Diagonaliser via un polynôme annulateur");
  });
});

describe("fiches d'exercice — ce qui a été ouvert fixe l'aide enregistrée", () => {
  const sheet = createSheet(ia, NOW, "s8")!;

  it("rien d'ouvert ⇒ sans aide ; un indice ⇒ indices ; la correction l'emporte", () => {
    expect(helpFromReveal(NOTHING_REVEALED)).toBe("sans");
    const withHint = revealNextHint(NOTHING_REVEALED, sheet);
    expect(withHint.hintsShown).toBe(1);
    expect(helpFromReveal(withHint)).toBe("indices");
    expect(helpFromReveal(revealCorrection(withHint, sheet))).toBe("correction");
  });

  it("les indices se montrent un à un, sans dépasser leur nombre", () => {
    let reveal = NOTHING_REVEALED;
    for (let index = 0; index < 5; index += 1) reveal = revealNextHint(reveal, sheet);
    expect(reveal.hintsShown).toBe(2);
  });

  it("sans correction dans la fiche, rien n'est ouvert (donc aucune aide fictive)", () => {
    const bare = createSheet({ ...ia, correction: "" }, NOW, "s9")!;
    expect(helpFromReveal(revealCorrection(NOTHING_REVEALED, bare))).toBe("sans");
  });

  it("l'élève ne peut pas déclarer une aide plus légère que celle utilisée", () => {
    expect(declarableHelps(NOTHING_REVEALED)).toEqual(["sans", "indices", "correction"]);
    expect(declarableHelps({ hintsShown: 1, correctionShown: false })).toEqual(["indices", "correction"]);
    expect(declarableHelps({ hintsShown: 0, correctionShown: true })).toEqual(["correction"]);
  });

  it("de bout en bout : la correction ouverte ne peut jamais produire une réussite « sans aide »", () => {
    const reveal = revealCorrection(NOTHING_REVEALED, sheet);
    const allowed = declarableHelps(reveal);
    expect(allowed).not.toContain("sans");
    const attempt = createRetryAttempt({ key: sheetKey(sheet.id), label: "x", subject: sheet.subject, chapterId: sheet.chapterId, origin: "exercice" }, { result: "réussi", help: allowed[0], minutes: 20, cause: null }, NOW)!;
    expect(isCleanSuccess(attempt)).toBe(false);
  });

  it("une tentative sur une fiche rejoint le suivi : clé fiche:<id>, chapitre, niveau", () => {
    const attempt = createRetryAttempt(
      { key: sheetKey(sheet.id), label: "Réduction — polynôme annulateur", subject: sheet.subject, chapterId: sheet.chapterId, origin: "exercice" },
      { result: "échec", help: "sans", minutes: 25, cause: "méthode", level: sheet.level },
      NOW
    )!;
    expect(attempt).toMatchObject({ exerciseKey: `fiche:${sheet.id}`, chapterId: "m2-reduction", level: "classique", cause: "méthode", subject: "Mathématiques" });
  });
});

describe("fiches d'exercice — clés, liens et choix", () => {
  it("clé et adresse sont réversibles", () => {
    expect(sheetKey("abc")).toBe("fiche:abc");
    expect(sheetIdOfKey("fiche:abc")).toBe("abc");
    expect(sheetIdOfKey("annale:x|y")).toBeNull();
    expect(sheetIdOfKey("fiche:")).toBeNull();
    expect(sheetHref("a b")).toBe("/entrainement?fiche=a%20b");
    expect(trainingHref({ chapterId: "m2-reduction", level: "difficile" })).toBe("/entrainement?chapitre=m2-reduction&niveau=difficile");
    expect(trainingHref({})).toBe("/entrainement");
  });

  it("propose d'abord les fiches du chapitre jamais tentées, puis les moins tentées, les prouvées en dernier", () => {
    const a = createSheet(ia, new Date("2026-10-01T10:00:00.000Z"), "a")!;
    const b = createSheet(ia, new Date("2026-10-02T10:00:00.000Z"), "b")!;
    const c = createSheet(ia, new Date("2026-10-03T10:00:00.000Z"), "c")!;
    const other = createSheet({ ...ia, subject: "Physique", chapterId: "p1-optique" }, NOW, "z");
    const statuses = new Map([
      ["a", { attempts: 2, proven: true }],
      ["b", { attempts: 1, proven: false }],
    ]);
    expect(sheetsForChapter([a, b, c, ...(other ? [other] : [])], statuses, "m2-reduction").map((sheet) => sheet.id)).toEqual(["c", "b", "a"]);
    expect(sheetsForChapter([a, b, c], statuses, "m2-reduction", "difficile")).toEqual([]);
    expect(sheetsForChapter([a, b, c], statuses, "m2-reduction", "classique")).toHaveLength(3);
  });
});
