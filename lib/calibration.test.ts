import { describe, expect, it } from "vitest";
import { calibrationPoints, CALIBRATION_MIN_SAMPLES, computeCalibration, describeCalibration } from "@/lib/calibration";
import type { Grade } from "@/lib/storage";

function grade(score: number | null, predictedScore: number | undefined, overrides: Partial<Grade> = {}): Grade {
  return {
    id: crypto.randomUUID(),
    subject: "Physique",
    title: "",
    kind: "ds",
    date: "2026-09-14",
    score,
    maxScore: 20,
    ...(predictedScore !== undefined ? { predictedScore } : {}),
    createdAt: "2026-09-14T18:00:00.000Z",
    ...overrides,
  };
}

describe("points de calibration", () => {
  it("ne retient que les notes avec prédiction ET résultat — ni les notes en attente, ni les anciennes notes", () => {
    const points = calibrationPoints([grade(12, 14), grade(null, 15), grade(10, undefined)]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ predicted: 14, actual: 12, error: 2 });
  });

  it("ramène tout sur 20 : 7/10 prédit contre 5/10 obtenu = 4 points d'écart", () => {
    expect(calibrationPoints([grade(5, 7, { maxScore: 10 })])[0].error).toBe(4);
  });
});

describe("erreur moyenne signée", () => {
  it(`ne dit rien sous ${CALIBRATION_MIN_SAMPLES} prédictions notées`, () => {
    const calibration = computeCalibration([grade(12, 14), grade(11, 13)]);
    expect(calibration.overall.sufficient).toBe(false);
    expect(calibration.overall.meanError).toBeNull();
    expect(describeCalibration(calibration.overall)).toBeNull();
  });

  it("surestimation : moyenne positive, phrase par matière", () => {
    const calibration = computeCalibration([grade(12, 14), grade(10, 13), grade(11, 12.3)]);
    expect(calibration.overall.meanError).toBe(2.1);
    const physics = calibration.bySubject.find((row) => row.subject === "Physique")!;
    expect(describeCalibration(physics)).toBe("Tu te surestimes de 2,1 pts en moyenne en physique.");
  });

  it("sous-estimation : moyenne négative", () => {
    const summary = computeCalibration([grade(14, 12), grade(15, 14), grade(13, 12)]).overall;
    expect(summary.meanError).toBe(-1.3);
    expect(describeCalibration(summary)).toBe("Tu te sous-estimes de 1,3 pt en moyenne.");
  });

  it("des erreurs qui se compensent donnent « bien calibré », mais l'erreur absolue le trahit", () => {
    const summary = computeCalibration([grade(10, 14), grade(14, 10), grade(12, 12)]).overall;
    expect(summary.meanError).toBe(0);
    expect(summary.meanAbsoluteError).toBe(2.7);
    expect(describeCalibration(summary)).toMatch(/bien calibrées/);
  });

  it("le seuil s'applique aussi PAR MATIÈRE", () => {
    const calibration = computeCalibration([grade(12, 14), grade(10, 13), grade(11, 12), grade(15, 15, { subject: "Chimie" })]);
    expect(calibration.overall.sufficient).toBe(true);
    const chemistry = calibration.bySubject.find((row) => row.subject === "Chimie")!;
    expect(chemistry.sufficient).toBe(false);
    expect(describeCalibration(chemistry)).toBeNull();
  });
});
