import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog, type AnnaleLog } from "@/lib/annales";
import type { ExerciseAttempt } from "@/lib/attempts";
import { annaleKey, buildExercises, CHANGE_APPROACH_AFTER, createRetryAttempt, dueRetries, progressLine, upcomingRetries, verifyError } from "@/lib/exercises";

const TODAY = "2026-10-10";

let seq = 0;
function annale(day: string, resultat: string, extra: Record<string, unknown> = {}): AnnaleLog {
  seq += 1;
  return normalizeAnnaleLog({ id: `a${seq}`, created_at: `${day}T15:00:00Z`, matiere: "maths", chapitre: "Réduction", source: "Mines 2023 MP1", resultat, indices: 0, ...extra })!;
}

function attempt(key: string, day: string, result: ExerciseAttempt["result"], help: ExerciseAttempt["help"], extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return {
    id: `t${seq}`,
    exerciseKey: key,
    label: "DS 2 — Q3",
    subject: "Mathématiques",
    chapterId: "m2-reduction",
    origin: "ds",
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

function build(annales: AnnaleLog[], attempts: ExerciseAttempt[], delays = [2, 5, 12]) {
  return buildExercises({ annales, attempts, retryDelaysDays: delays, today: TODAY });
}

describe("réunion des sources", () => {
  it("une annale et sa nouvelle tentative saisie dans l'app forment un seul exercice", () => {
    const first = annale("2026-10-01", "échec");
    const retry = attempt(annaleKey(first), "2026-10-04", "réussi", "sans");
    const [exercise] = build([first], [retry]);
    expect(exercise.steps.map((step) => step.source)).toEqual(["annale", "app"]);
    expect(exercise.status).toBe("vérifié");
    expect(exercise.verifiedOn).toBe("2026-10-04");
    expect(exercise.chapterId).toBe("m2-reduction");
  });

  it("deux annales sans source ne sont pas confondues", () => {
    const exercises = build([annale("2026-10-01", "échec", { source: null }), annale("2026-10-02", "échec", { source: null })], []);
    expect(exercises).toHaveLength(2);
  });
});

describe("refaire sans aide", () => {
  it("réussir avec la correction ouverte ne prouve rien : une nouvelle tentative est due", () => {
    const key = "ds:g1:Q3";
    const [exercise] = build([], [attempt(key, "2026-10-01", "échec", "sans"), attempt(key, "2026-10-03", "réussi", "correction")]);
    expect(exercise.status).toBe("à-refaire");
    expect(exercise.failedStreak).toBe(2);
    expect(exercise.nextRetryDay).toBe("2026-10-08"); // 3 oct. + 5 j (2e délai)
  });

  it("le délai suit les tentatives ratées d'affilée, puis reste au dernier", () => {
    const key = "k";
    expect(build([], [attempt(key, "2026-10-01", "échec", "sans")])[0].nextRetryDay).toBe("2026-10-03");
    const four = ["2026-09-01", "2026-09-05", "2026-09-12", "2026-09-25"].map((day) => attempt(key, day, "partiel", "sans"));
    expect(build([], four)[0].nextRetryDay).toBe("2026-10-07");
  });

  it("à refaire quand la date est passée, programmé sinon ; délais configurables", () => {
    const exercises = build([], [attempt("old", "2026-10-01", "échec", "sans"), attempt("new", "2026-10-09", "échec", "sans")], [3]);
    expect(dueRetries(exercises).map((exercise) => exercise.key)).toEqual(["old"]);
    expect(upcomingRetries(exercises).map((exercise) => exercise.key)).toEqual(["new"]);
    expect(exercises.find((exercise) => exercise.key === "new")!.nextRetryDay).toBe("2026-10-12");
  });

  it(`après ${CHANGE_APPROACH_AFTER} échecs d'affilée, une autre action est proposée selon la cause`, () => {
    const key = "k";
    const attempts = ["2026-09-01", "2026-09-04", "2026-09-10"].map((day) => attempt(key, day, "échec", "sans", { cause: "cours" }));
    const [exercise] = build([], attempts);
    expect(exercise.changeApproach).toContain("Revois d'abord le cours");
    expect(build([], attempts.slice(0, 2))[0].changeApproach).toBeNull();
  });

  it("une annale avec indices n'est pas une réussite sans aide", () => {
    const [exercise] = build([annale("2026-10-01", "réussi", { indices: 2 })], []);
    expect(exercise.status).toBe("à-refaire");
    expect(exercise.steps[0]).toMatchObject({ help: "indices", helpDeclared: false });
  });

  it("l'aide déclarée par le connecteur prime sur les indices", () => {
    const [exercise] = build([annale("2026-10-01", "réussi", { indices: 0, aide: "correction" })], []);
    expect(exercise.steps[0]).toMatchObject({ help: "correction", helpDeclared: true });
    expect(exercise.status).not.toBe("réussi");
  });
});

describe("nouvelle tentative et vérification des erreurs", () => {
  const key = "ds:g1:Q3";
  const base = build([], [attempt(key, "2026-10-01", "échec", "sans", { minutes: 40 })])[0];

  it("crée une tentative du même exercice ; pas de cause pour une réussite", () => {
    const retry = createRetryAttempt(base, { result: "réussi", help: "sans", minutes: 22, cause: "calcul" }, new Date(2026, 9, 10, 18))!;
    expect(retry).toMatchObject({ exerciseKey: key, chapterId: "m2-reduction", result: "réussi", cause: null, minutes: 22, day: "2026-10-10" });
    expect(createRetryAttempt({ ...base, subject: null }, { result: "échec", help: "sans", minutes: null, cause: null }, new Date())).toBeNull();
  });

  it("une erreur n'est corrigée qu'après une réussite sans aide postérieure", () => {
    const error = { date: "2026-10-01", exerciseKey: key };
    const before = new Map(build([], [attempt(key, "2026-10-01", "échec", "sans")]).map((exercise) => [exercise.key, exercise]));
    expect(verifyError(error, before)).toEqual({ state: "à-vérifier", on: "2026-10-03" });
    const after = new Map(build([], [attempt(key, "2026-10-01", "échec", "sans"), attempt(key, "2026-10-05", "réussi", "sans", { minutes: 18 })]).map((exercise) => [exercise.key, exercise]));
    expect(verifyError(error, after)).toEqual({ state: "vérifiée", on: "2026-10-05" });
    expect(verifyError({ date: "2026-10-01" }, after)).toEqual({ state: "non-reliée" });
    expect(progressLine(after.get(key)!)).toBe("2 tentatives · échec sans aide → réussi sans aide");
  });
});

describe("niveau des exercices", () => {
  it("le niveau d'une annale vient de son concours ; une nouvelle tentative hérite du niveau connu", async () => {
    const { annaleLevel } = await import("@/lib/exercises");
    expect(annaleLevel("CCINP")).toBe("classique");
    expect(annaleLevel("Mines")).toBe("difficile");
    expect(annaleLevel("Autre")).toBeNull();
    const [exercise] = build([annale("2026-10-01", "échec", { niveau: "Centrale" })], []);
    expect(exercise.steps[0].level).toBe("difficile");
    const retry = createRetryAttempt(exercise, { result: "réussi", help: "sans", minutes: 30, cause: null }, new Date(2026, 9, 5, 18))!;
    expect(retry.level).toBe("difficile");
  });
});
