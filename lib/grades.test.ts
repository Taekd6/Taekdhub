import { describe, expect, it } from "vitest";
import { computeGradeStats, computeGradeTrend, createGrade, formatAverage, formatGrade, formatPrediction, gradedSubjects, isPending, normalizedScore, removeGrade, resolveGrade, sortedByDate, type ScoredGrade } from "@/lib/grades";
import { computeGradesByKind, computeGradesBySubject } from "@/lib/tracking";
import { normalizeGrade, type Grade } from "@/lib/storage";

function grade(overrides: Partial<ScoredGrade> = {}): ScoredGrade {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    title: "DS n°1",
    kind: "ds",
    date: "2026-09-14",
    score: 14,
    maxScore: 20,
    createdAt: "2026-09-14T18:00:00.000Z",
    ...overrides,
  };
}

describe("barèmes — tout est ramené sur 20 pour être comparable", () => {
  it("une note sur 10 vaut le double sur 20", () => {
    expect(normalizedScore(grade({ score: 7, maxScore: 10 }))).toBe(14);
  });

  it("la moyenne mélange correctement des barèmes différents", () => {
    const stats = computeGradeStats([grade({ score: 14, maxScore: 20 }), grade({ score: 7, maxScore: 10 })]);
    expect(stats.average).toBe(14);
  });

  it("mais la note AFFICHÉE reste celle qui a été vécue", () => {
    expect(formatGrade(grade({ score: 17, maxScore: 40 }))).toBe("17/40");
    expect(formatGrade(grade({ score: 11.5 }))).toBe("11,5/20");
  });
});

describe("statistiques", () => {
  it("aucune note : aucune moyenne, et surtout pas zéro", () => {
    const stats = computeGradeStats([]);
    expect(stats.count).toBe(0);
    expect(stats.average).toBeNull();
    expect(stats.latest).toBeNull();
  });

  it("identifie la meilleure, la pire et la dernière en date", () => {
    const stats = computeGradeStats([
      grade({ score: 8, date: "2026-09-01" }),
      grade({ score: 16, date: "2026-09-07" }),
      grade({ score: 12, date: "2026-09-14" }),
    ]);
    expect(stats.best?.score).toBe(16);
    expect(stats.worst?.score).toBe(8);
    expect(stats.latest?.score).toBe(12);
  });

  it("classe chronologiquement, pas par ordre de saisie", () => {
    const list = sortedByDate([grade({ date: "2026-09-20" }), grade({ date: "2026-09-01" })]);
    expect(list.map((entry) => entry.date)).toEqual(["2026-09-01", "2026-09-20"]);
  });
});

describe("tendance des notes — pas de conclusion prématurée", () => {
  it("une seule note : aucune tendance", () => {
    expect(computeGradeTrend([grade()]).trend.direction).toBe("insuffisant");
  });

  it("deux notes : une variation, avec une confiance faible", () => {
    const result = computeGradeTrend([grade({ score: 10, date: "2026-09-01" }), grade({ score: 14, date: "2026-09-14" })]);
    expect(result.trend.direction).toBe("hausse");
    expect(result.trend.confidence).toBe("faible");
  });

  it("un demi-point d'écart n'est pas une progression", () => {
    const grades = [
      grade({ score: 12, date: "2026-09-01" }),
      grade({ score: 12.3, date: "2026-09-08" }),
      grade({ score: 12, date: "2026-09-15" }),
      grade({ score: 12.2, date: "2026-09-22" }),
    ];
    expect(computeGradeTrend(grades).trend.direction).toBe("stable");
  });

  it("filtre par matière sans mélanger les autres", () => {
    const grades = [
      grade({ subject: "Mathématiques", score: 16, date: "2026-09-01" }),
      grade({ subject: "Physique", score: 8, date: "2026-09-02" }),
    ];
    const physics = computeGradeTrend(grades, "Physique");
    expect(physics.grades).toHaveLength(1);
    expect(physics.stats.average).toBe(8);
  });

  it("ne propose au filtre que les matières réellement notées", () => {
    expect(gradedSubjects([grade({ subject: "Physique" })])).toEqual(["Physique"]);
    expect(gradedSubjects([])).toEqual([]);
  });
});

describe("saisie et correction", () => {
  it("une note au-dessus du barème est ramenée au barème, jamais propagée", () => {
    const created = createGrade({ subject: "Physique", title: "DS", kind: "ds", date: "2026-09-14", score: 25, maxScore: 20 });
    expect(created?.score).toBe(20);
  });

  it("une note se supprime réellement — on saisit 14 au lieu de 4, on corrige", () => {
    const list = [grade({ id: "g1" }), grade({ id: "g2" })];
    expect(removeGrade(list, "g1").map((entry) => entry.id)).toEqual(["g2"]);
  });
});

describe("normalisation — frontière de confiance", () => {
  it("une note sans date exploitable est écartée plutôt que datée d'office", () => {
    expect(normalizeGrade({ subject: "Physique", score: 12, date: "hier" })).toBeNull();
  });

  it("une matière inconnue écarte la note — elle n'aurait sa place dans aucun filtre", () => {
    expect(normalizeGrade({ subject: "Philosophie", score: 12, date: "2026-09-14" })).toBeNull();
  });

  it("une note absente écarte l'entrée — une note à zéro inventée fausserait la moyenne", () => {
    expect(normalizeGrade({ subject: "Physique", date: "2026-09-14" })).toBeNull();
  });

  it("un barème absent retombe sur 20, le cas immensément majoritaire", () => {
    expect(normalizeGrade({ subject: "Physique", score: 12, date: "2026-09-14" })?.maxScore).toBe(20);
  });

  it("une note hors barème est bornée", () => {
    expect(normalizeGrade({ subject: "Physique", score: 25, maxScore: 20, date: "2026-09-14" })?.score).toBe(20);
  });

  it("traverse un cycle export → JSON → import sans rien perdre", () => {
    const original = normalizeGrade(grade({ score: 11.5, title: "DS n°3" }))!;
    expect(normalizeGrade(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
});

describe("formatage à la française", () => {
  /** Défaut constaté à l'écran : la page affichait « Moyenne 12.1/20 ». */
  it("emploie la virgule décimale, jamais le point", () => {
    expect(formatAverage(12.1)).toBe("12,1");
  });

  it("n'ajoute pas de décimale postiche à un entier", () => {
    expect(formatAverage(14)).toBe("14");
  });
});

/**
 * NOTES EN ATTENTE (calibration) — une prédiction saisie avant la copie
 * rendue ne doit JAMAIS peser dans une moyenne, une courbe ou une tendance.
 */
describe("notes en attente — exclues de tous les agrégats", () => {
  const pending: Grade = { ...grade({ id: "p1", subject: "Chimie", kind: "colle" }), score: null, predictedScore: 15 };

  it("se crée avec une prédiction seule, et se reconnaît comme en attente", () => {
    const created = createGrade({ subject: "Physique", title: "", kind: "ds", date: "2026-09-20", score: null, maxScore: 20, predictedScore: 13 });
    expect(created?.score).toBeNull();
    expect(created?.predictedScore).toBe(13);
    expect(created && isPending(created)).toBe(true);
  });

  it("sans note NI prédiction, rien n'est créé", () => {
    expect(createGrade({ subject: "Physique", title: "", kind: "ds", date: "2026-09-20", score: null, maxScore: 20 })).toBeNull();
  });

  it("la prédiction est bornée au barème, comme la note", () => {
    expect(createGrade({ subject: "Physique", title: "", kind: "ds", date: "2026-09-20", score: null, maxScore: 10, predictedScore: 14 })?.predictedScore).toBe(10);
  });

  it("n'entre ni dans la moyenne, ni dans le compte, ni dans la dernière note", () => {
    const stats = computeGradeStats([grade({ score: 10 }), pending]);
    expect(stats.count).toBe(1);
    expect(stats.average).toBe(10);
    expect(stats.latest?.score).toBe(10);
    expect(computeGradeStats([pending]).average).toBeNull();
  });

  it("n'entre ni dans la courbe, ni dans les matières notées, ni dans les tableaux par nature/matière", () => {
    expect(computeGradeTrend([grade(), pending]).grades).toHaveLength(1);
    expect(gradedSubjects([pending])).toEqual([]);
    expect(computeGradesByKind([pending])).toEqual([]);
    expect(computeGradesBySubject([pending])).toEqual([]);
  });

  it("s'affiche « ?/20 », jamais « 0/20 »", () => {
    expect(formatGrade(pending)).toBe("?/20");
    expect(formatPrediction(pending)).toBe("15/20");
    expect(formatPrediction(grade())).toBeNull();
  });

  it("se complète plus tard sans toucher à la prédiction", () => {
    const [resolved] = resolveGrade([pending], "p1", 12);
    expect(resolved.score).toBe(12);
    expect(resolved.predictedScore).toBe(15);
    expect(isPending(resolved)).toBe(false);
  });

  it("survit à la normalisation, et une note ancienne n'acquiert pas de prédiction", () => {
    expect(normalizeGrade(JSON.parse(JSON.stringify(pending)))).toEqual(pending);
    expect("predictedScore" in normalizeGrade(grade())!).toBe(false);
  });
});
