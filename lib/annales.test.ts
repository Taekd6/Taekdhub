import { describe, expect, it } from "vitest";
import {
  computeTimeCalibration,
  countResults,
  describeTimeCalibration,
  matchChapter,
  normalizeAnnaleLog,
  normalizeAnnaleLogs,
  summarizeByChapter,
  summarizeByLevel,
  toLevel,
  toSubject,
  topErrorTags,
  weakChapters,
  type AnnaleLog,
} from "@/lib/annales";
import { createChapter } from "@/lib/chapter-memory";

const NOW = new Date(2026, 9, 2, 18, 0);

let seq = 0;
function row(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `a-${seq}`,
    created_at: new Date(2026, 9, 1, 15, 0).toISOString(),
    matiere: "maths",
    chapitre: "Réduction",
    source: null,
    niveau: "Mines",
    resultat: "réussi",
    indices: 0,
    temps_min: null,
    temps_prevu: null,
    erreurs: null,
    commentaire: null,
    ...overrides,
  };
}

function log(overrides: Record<string, unknown> = {}): AnnaleLog {
  return normalizeAnnaleLog(row(overrides))!;
}

describe("normalisation", () => {
  it("reconnaît les matières écrites librement", () => {
    expect(toSubject("maths")).toBe("Mathématiques");
    expect(toSubject("Physique")).toBe("Physique");
    expect(toSubject("chimie ")).toBe("Chimie");
    expect(toSubject("info spé")).toBe("Informatique Spé");
    expect(toSubject("informatique")).toBe("Informatique TC");
    expect(toSubject("SII")).toBeNull();
  });

  it("range les concours par niveau", () => {
    expect(toLevel("Mines-Ponts 2023")).toBe("Mines");
    expect(toLevel("CCINP")).toBe("CCINP");
    expect(toLevel("e3a")).toBe("CCINP");
    expect(toLevel("Centrale-Supélec")).toBe("Centrale");
    expect(toLevel("X-ENS")).toBe("X-ENS");
    expect(toLevel("ENS Ulm")).toBe("X-ENS");
    expect(toLevel("Banque PT")).toBe("Autre");
    expect(toLevel("")).toBeNull();
    expect(toLevel(null)).toBeNull();
  });

  it("rejette une ligne inutilisable sans lever", () => {
    expect(normalizeAnnaleLog(null)).toBeNull();
    expect(normalizeAnnaleLog(row({ resultat: "bof" }))).toBeNull();
    expect(normalizeAnnaleLog(row({ chapitre: "  " }))).toBeNull();
    expect(normalizeAnnaleLog(row({ created_at: "pas une date" }))).toBeNull();
  });

  it("garde le texte d'une matière inconnue et nettoie les champs", () => {
    const entry = log({ matiere: "SII", indices: -2, temps_min: "35", temps_prevu: 0, erreurs: ["calcul", "", 4] });
    expect(entry.subject).toBeNull();
    expect(entry.subjectLabel).toBe("SII");
    expect(entry.hints).toBe(0);
    expect(entry.minutes).toBe(35);
    expect(entry.plannedMinutes).toBeNull();
    expect(entry.errors).toEqual(["calcul"]);
  });

  it("trie du plus récent au plus ancien", () => {
    const logs = normalizeAnnaleLogs([row({ created_at: "2026-09-01T10:00:00Z" }), row({ created_at: "2026-09-20T10:00:00Z" })]);
    expect(logs.map((entry) => entry.createdAt.slice(0, 10))).toEqual(["2026-09-20", "2026-09-01"]);
    expect(normalizeAnnaleLogs("n'importe quoi")).toEqual([]);
  });
});

describe("bilans", () => {
  it("un partiel compte pour moitié", () => {
    const counts = countResults([log({ resultat: "réussi", indices: 1 }), log({ resultat: "partiel", indices: 2 }), log({ resultat: "échec" }), log({ resultat: "échec", indices: 3 })]);
    expect(counts).toMatchObject({ count: 4, réussi: 1, partiel: 1, échec: 2 });
    expect(counts.successRate).toBeCloseTo(1.5 / 4);
    expect(counts.meanHints).toBe(1.5);
  });

  it("regroupe un chapitre malgré la casse et les accents, le plus fragile d'abord", () => {
    const chapters = summarizeByChapter([
      log({ chapitre: "réduction", resultat: "échec", created_at: "2026-09-01T10:00:00Z" }),
      log({ chapitre: "Réduction", resultat: "partiel", created_at: "2026-09-05T10:00:00Z" }),
      log({ chapitre: "Séries entières", resultat: "réussi" }),
    ]);
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({ chapter: "Réduction", count: 2, history: ["échec", "partiel"], lastResult: "partiel" });
    expect(chapters[1].chapter).toBe("Séries entières");
  });

  it("ne garde que les niveaux tentés, dans l'ordre des concours", () => {
    const levels = summarizeByLevel([log({ niveau: "X" }), log({ niveau: "CCINP" }), log({ niveau: null })]);
    expect(levels.map((entry) => entry.level)).toEqual(["CCINP", "X-ENS"]);
  });

  it("compte les erreurs relevées sans casse ni accents", () => {
    const tags = topErrorTags([log({ erreurs: ["Calcul", "signe"] }), log({ erreurs: ["calcul"] })]);
    expect(tags[0]).toEqual({ label: "Calcul", count: 2 });
  });
});

describe("calibration du temps", () => {
  it("se tait sous trois exercices chronométrés", () => {
    const time = computeTimeCalibration([log({ temps_min: 40, temps_prevu: 30 }), log({ temps_min: 40, temps_prevu: 30 })]);
    expect(time.overall.sufficient).toBe(false);
    expect(describeTimeCalibration(time.overall)).toBeNull();
  });

  it("prend la médiane : un exercice abandonné ne décide pas seul", () => {
    const time = computeTimeCalibration([
      log({ temps_min: 42, temps_prevu: 30 }),
      log({ temps_min: 45, temps_prevu: 30 }),
      log({ temps_min: 180, temps_prevu: 30 }),
    ]);
    expect(time.overall.medianRatio).toBe(1.5);
    expect(describeTimeCalibration(time.overall)).toBe("Tu mets en général 1,5 fois le temps prévu (médiane sur 3 exercices).");
    expect(describeTimeCalibration(time.bySubject[0])).toContain("en mathématiques");
  });

  it("dit quand l'estimation est bonne", () => {
    const time = computeTimeCalibration([log({ temps_min: 30, temps_prevu: 30 }), log({ temps_min: 32, temps_prevu: 30 }), log({ temps_min: 29, temps_prevu: 30 })]);
    expect(describeTimeCalibration(time.overall)).toContain("Tu estimes bien ton temps");
  });
});

describe("chapitres qui bloquent", () => {
  it("un échec au dernier essai suffit", () => {
    const weak = weakChapters([log({ resultat: "échec" })], NOW);
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ subject: "Mathématiques", échecs: 1, attempts: 1 });
  });

  it("un seul partiel ne suffit pas, deux oui", () => {
    expect(weakChapters([log({ resultat: "partiel" })], NOW)).toHaveLength(0);
    expect(weakChapters([log({ resultat: "partiel" }), log({ resultat: "partiel" })], NOW)).toHaveLength(1);
  });

  it("ignore ce qui est réglé, ancien, ou dans une matière inconnue", () => {
    expect(weakChapters([log({ resultat: "échec", created_at: "2026-09-25T10:00:00Z" }), log({ resultat: "réussi" })], NOW)).toHaveLength(0);
    expect(weakChapters([log({ resultat: "échec", created_at: "2026-08-01T10:00:00Z" })], NOW)).toHaveLength(0);
    expect(weakChapters([log({ resultat: "échec", matiere: "SII" })], NOW)).toHaveLength(0);
  });
});

describe("lien avec Mémoire", () => {
  const chapters = [
    createChapter({ subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-09-01" }, NOW, "red"),
    createChapter({ subject: "Physique", title: "Réduction", learnedAt: "2026-09-01" }, NOW, "phys"),
  ];

  it("retrouve le chapitre de la même matière dont le titre contient l'autre", () => {
    expect(matchChapter("Mathématiques", "reduction", chapters)?.id).toBe("red");
    expect(matchChapter("Physique", "reduction", chapters)?.id).toBe("phys");
  });

  it("ne colle pas un mot trop court ni une autre matière", () => {
    expect(matchChapter("Mathématiques", "red", chapters)).toBeNull();
    expect(matchChapter("Chimie", "reduction", chapters)).toBeNull();
    expect(matchChapter(null, "reduction", chapters)).toBeNull();
  });
});
