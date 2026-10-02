import { describe, expect, it } from "vitest";
import type { ChapterAnki } from "@/lib/anki-mapping";
import type { ExerciseAttempt } from "@/lib/attempts";
import { createChapter, rateChapter } from "@/lib/chapter-memory";
import { diagnoseChapters, mainFinding, rankDiagnoses, type DiagnosticInput } from "@/lib/diagnostic";
import { buildExercises } from "@/lib/exercises";
import type { ErrorEntry, WorkItem } from "@/lib/storage";

const TODAY = "2026-10-10";

let seq = 0;
function attempt(chapterId: string, day: string, result: ExerciseAttempt["result"], help: ExerciseAttempt["help"], extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return {
    id: `t${seq}`,
    exerciseKey: `ex:${seq}`,
    label: `Exercice ${seq}`,
    subject: chapterId.startsWith("p") ? "Physique" : "Mathématiques",
    chapterId,
    origin: "exercice",
    day,
    createdAt: `${day}T18:00:00.000Z`,
    updatedAt: `${day}T18:00:00.000Z`,
    result,
    help,
    minutes: null,
    plannedMinutes: null,
    cause: null,
    lackOfTime: false,
    gradeId: null,
    note: null,
    ...extra,
  };
}

function error(chapterId: string, type: ErrorEntry["type"], date: string): ErrorEntry {
  seq += 1;
  return { id: `e${seq}`, subject: "Mathématiques", date, source: "DS", type, description: "x", fix: null, chapterId: null, exerciseId: null, reviewItemId: null, programmeChapterId: chapterId, createdAt: `${date}T10:00:00.000Z` } as ErrorEntry;
}

function anki(chapterId: string, reviewed30: number, failed30: number): Map<string, ChapterAnki> {
  return new Map([[chapterId, { chapterId, decks: ["MP::Maths::Réduction"], total: 200, due: 5, reviewed30, failed30, mature: 100, lapsing: 1, failRate: reviewed30 >= 20 ? failed30 / reviewed30 : null }]]);
}

function input(overrides: Partial<DiagnosticInput> & { attempts?: ExerciseAttempt[] } = {}): DiagnosticInput {
  const { attempts = [], ...rest } = overrides;
  return {
    chapterMemory: [],
    exercises: buildExercises({ annales: [], attempts, retryDelaysDays: [2, 5, 12], today: TODAY }),
    errors: [],
    anki: null,
    kholle: {},
    workItems: [],
    today: TODAY,
    ...rest,
  };
}

function of(diagnoses: ReturnType<typeof diagnoseChapters>, id: string) {
  return diagnoses.find((diagnosis) => diagnosis.chapter.id === id)!;
}

describe("pas de données, pas de diagnostic", () => {
  it("sans aucune trace : aucun constat, et rien n'est marqué insuffisant", () => {
    const reduction = of(diagnoseChapters(input()), "m2-reduction");
    expect(reduction.findings).toEqual([]);
    expect(reduction.insufficient).toBe(false);
    expect(reduction.course.state).toBe("inconnu");
  });

  it("une seule tentative ratée : données insuffisantes, pas de constat", () => {
    const reduction = of(diagnoseChapters(input({ attempts: [attempt("m2-reduction", "2026-10-05", "échec", "sans", { cause: "méthode" })] })), "m2-reduction");
    expect(reduction.findings).toEqual([]);
    expect(reduction.insufficient).toBe(true);
    expect(reduction.application.detail).toContain("1 tentative seulement");
  });

  it("Anki avec moins de 20 cartes révisées ne dit rien", () => {
    const reduction = of(diagnoseChapters(input({ anki: anki("m2-reduction", 10, 8) })), "m2-reduction");
    expect(reduction.findings).toEqual([]);
  });

  it("les traces de plus de 60 jours sont ignorées", () => {
    const old = ["2026-07-01", "2026-07-02", "2026-07-03"].map((day) => attempt("m2-reduction", day, "échec", "sans"));
    expect(of(diagnoseChapters(input({ attempts: old })), "m2-reduction").findings).toEqual([]);
  });
});

describe("cours contre application", () => {
  const failures = ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07"].map((day, index) => attempt("m2-reduction", day, index === 0 ? "réussi" : "échec", "sans"));

  it("le cours tient dans Anki mais les exercices ratent : constat d'application, priorité à l'exercice", () => {
    const reduction = of(diagnoseChapters(input({ attempts: failures, anki: anki("m2-reduction", 60, 3) })), "m2-reduction");
    expect(reduction.findings.map((finding) => finding.kind)).toEqual(["application"]);
    expect(reduction.course.state).toBe("tient");
    expect(reduction.application.state).toBe("fragile");
    expect(reduction.findings[0].evidence.join(" ")).toContain("la priorité est l'exercice");
    expect(mainFinding(reduction)!.action).toContain("exercice ciblé");
  });

  it("sans donnée sur le cours, le constat le dit au lieu de conclure", () => {
    const reduction = of(diagnoseChapters(input({ attempts: failures })), "m2-reduction");
    expect(reduction.findings[0].evidence.join(" ")).toContain("Aucune donnée sur le cours");
  });

  it("Anki : 20 % d'échecs ou plus sur au moins 20 cartes ⇒ cours à mémoriser, avec le paquet à réviser", () => {
    const reduction = of(diagnoseChapters(input({ anki: anki("m2-reduction", 40, 12) })), "m2-reduction");
    expect(reduction.findings.map((finding) => finding.kind)).toEqual(["cours"]);
    expect(reduction.findings[0].action).toContain("MP::Maths::Réduction");
    expect(reduction.course.state).toBe("fragile");
  });

  it("mémoire TaekdHub sous 85 % ⇒ cours, même sans Anki", () => {
    const memory = createChapter({ subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-06-01" }, new Date(2026, 5, 1, 12), "red");
    const reduction = of(diagnoseChapters(input({ chapterMemory: [memory] })), "m2-reduction");
    expect(reduction.findings[0]).toMatchObject({ kind: "cours", sources: ["mémoire"] });
  });

  it("cours et application en cause : le cours passe d'abord", () => {
    const memory = createChapter({ subject: "Mathématiques", title: "Réduction", learnedAt: "2026-06-01" }, new Date(2026, 5, 1, 12), "red");
    const reduction = of(diagnoseChapters(input({ chapterMemory: [memory], attempts: failures })), "m2-reduction");
    expect(mainFinding(reduction)!.kind).toBe("cours");
  });
});

describe("causes : seuils et niveau de preuve", () => {
  it("deux erreurs de calcul au carnet : signal ; plus deux échecs « calcul » : établi (deux sources)", () => {
    const errors = [error("m2-reduction", "calcul", "2026-10-01"), error("m2-reduction", "calcul", "2026-10-02")];
    const signal = of(diagnoseChapters(input({ errors })), "m2-reduction").findings[0];
    expect(signal).toMatchObject({ kind: "calcul", level: "signal" });
    const attempts = [attempt("m2-reduction", "2026-10-03", "échec", "sans", { cause: "calcul" }), attempt("m2-reduction", "2026-10-04", "échec", "sans", { cause: "calcul" })];
    const established = of(diagnoseChapters(input({ errors, attempts })), "m2-reduction").findings.find((finding) => finding.kind === "calcul")!;
    expect(established.level).toBe("établi");
    expect(established.sources.sort()).toEqual(["carnet", "exercices"]);
  });

  it("une seule erreur d'un type ne suffit pas", () => {
    expect(of(diagnoseChapters(input({ errors: [error("m2-reduction", "méthode", "2026-10-01")] })), "m2-reduction").findings).toEqual([]);
  });

  it("temps : tentatives hors délai ; démarrage : cause déclarée", () => {
    const attempts = [
      attempt("m2-reduction", "2026-10-01", "partiel", "sans", { minutes: 50, plannedMinutes: 30 }),
      attempt("m2-reduction", "2026-10-02", "échec", "sans", { lackOfTime: true, cause: "démarrage" }),
      attempt("m2-reduction", "2026-10-03", "échec", "indices", { cause: "démarrage" }),
    ];
    const kinds = of(diagnoseChapters(input({ attempts })), "m2-reduction").findings.map((finding) => finding.kind);
    expect(kinds).toEqual(expect.arrayContaining(["temps", "démarrage", "application"]));
  });

  it("khôlle : deux questions de cours ratées ⇒ démonstrations", () => {
    const kholle = { "m2-reduction#0": { grade: "pas su" as const, at: "2026-10-01T10:00:00Z" }, "m2-reduction#2": { grade: "hésitant" as const, at: "2026-10-02T10:00:00Z" } };
    expect(of(diagnoseChapters(input({ kholle })), "m2-reduction").findings[0].kind).toBe("démonstration");
  });
});

describe("priorité", () => {
  it("établi d'abord, puis le chapitre d'une épreuve proche", () => {
    const errors = [error("m2-reduction", "calcul", "2026-10-01"), error("m2-reduction", "calcul", "2026-10-02"), error("m2-series-entieres", "calcul", "2026-10-01"), error("m2-series-entieres", "calcul", "2026-10-02")];
    const ds: WorkItem = {
      id: "ds",
      title: "DS 3",
      kind: "ds",
      subject: "Mathématiques",
      estimatedMinutes: 240,
      dueDate: "2026-10-14",
      dueTime: null,
      status: "à faire",
      important: false,
      notBeforeDate: null,
      chapterIds: [],
      createdAt: "2026-10-01T10:00:00.000Z",
      completedAt: null,
    } as unknown as WorkItem;
    const ranked = rankDiagnoses(diagnoseChapters(input({ errors, workItems: [ds] })));
    // Même matière, même épreuve, mêmes constats : l'ordre du programme départage, mais les deux sont en tête.
    expect(ranked.slice(0, 2).map((diagnosis) => diagnosis.chapter.id).sort()).toEqual(["m2-reduction", "m2-series-entieres"]);
    expect(ranked[0].examInDays).toBe(4);
    const withEstablished = rankDiagnoses(diagnoseChapters(input({ errors, anki: anki("m2-series-entieres", 40, 12), attempts: [attempt("m2-series-entieres", "2026-10-03", "échec", "sans", { cause: "calcul" }), attempt("m2-series-entieres", "2026-10-04", "échec", "sans", { cause: "calcul" })] })));
    expect(withEstablished[0].chapter.id).toBe("m2-series-entieres");
  });

  it("un chapitre révisé et réussi n'est pas classé", () => {
    const memory = rateChapter(createChapter({ subject: "Mathématiques", title: "Réduction", learnedAt: "2026-09-01" }, new Date(2026, 8, 1, 12), "red"), "good", TODAY);
    const attempts = ["2026-10-01", "2026-10-03", "2026-10-05"].map((day) => attempt("m2-reduction", day, "réussi", "sans"));
    const reduction = of(diagnoseChapters(input({ chapterMemory: [memory], attempts })), "m2-reduction");
    expect(reduction.findings).toEqual([]);
    expect(reduction.course.state).toBe("tient");
    expect(reduction.application.state).toBe("tient");
    expect(rankDiagnoses([reduction])).toEqual([]);
  });
});

describe("boucle d'apprentissage : difficulté, fraîcheur, faits et hypothèses", () => {
  it("classiques réussis, difficiles ratés : « bloque sur les problèmes difficiles », pas « application »", () => {
    const attempts = [
      attempt("p2-electrostatique", "2026-10-01", "réussi", "sans", { level: "classique" }),
      attempt("p2-electrostatique", "2026-10-02", "réussi", "sans", { level: "direct" }),
      attempt("p2-electrostatique", "2026-10-04", "échec", "sans", { level: "difficile" }),
      attempt("p2-electrostatique", "2026-10-06", "partiel", "indices", { level: "difficile" }),
    ];
    const electro = of(diagnoseChapters(input({ attempts })), "p2-electrostatique");
    expect(electro.findings.map((finding) => finding.kind)).toEqual(["difficile"]);
    expect(electro.findings[0].evidence).toEqual(["Directs et classiques : 100 % réussis sans aide sur 2", "Difficiles : 0 % réussis sans aide sur 2"]);
  });

  it("un seul problème difficile raté ne suffit pas à conclure", () => {
    const attempts = [
      attempt("p2-electrostatique", "2026-10-01", "réussi", "sans", { level: "classique" }),
      attempt("p2-electrostatique", "2026-10-02", "réussi", "sans", { level: "classique" }),
      attempt("p2-electrostatique", "2026-10-04", "échec", "sans", { level: "difficile" }),
    ];
    expect(of(diagnoseChapters(input({ attempts })), "p2-electrostatique").findings).toEqual([]);
  });

  it("chaque constat sépare les faits de l'hypothèse", () => {
    const errors = [error("m2-reduction", "calcul", "2026-10-01"), error("m2-reduction", "calcul", "2026-10-02")];
    const [finding] = of(diagnoseChapters(input({ errors })), "m2-reduction").findings;
    expect(finding.evidence).toEqual(["2 erreurs « calcul » au carnet"]);
    expect(finding.hypothesis).toBe("Le raisonnement est juste, l'exécution n'est pas fiable.");
    expect(finding.lastSeen).toBe("2026-10-02");
  });

  it("un constat dont la dernière observation a plus de 3 semaines redevient un signal, à confirmer", () => {
    const errors = ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-25"].map((day) => error("m2-reduction", "méthode", day));
    const [finding] = of(diagnoseChapters(input({ errors })), "m2-reduction").findings;
    expect(finding).toMatchObject({ kind: "méthode", level: "signal", stale: true });
    expect(finding.evidence.at(-1)).toBe("Dernière observation il y a 46 jours : à confirmer par un nouvel exercice.");
    const fresh = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"].map((day) => error("m2-reduction", "méthode", day));
    expect(of(diagnoseChapters(input({ errors: fresh })), "m2-reduction").findings[0].level).toBe("établi");
  });
});
