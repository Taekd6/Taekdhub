import { describe, expect, it } from "vitest";
import { applyDebrief, buildDebrief, debriefKey, debriefPlan, questionsFromAttempts, validateQuestions, type DebriefQuestion } from "@/lib/debrief";
import { buildExercises, createRetryAttempt, verifyError } from "@/lib/exercises";
import type { ErrorEntry, Grade } from "@/lib/storage";

const NOW = new Date(2026, 9, 3, 18, 0);
const grade: Grade = { id: "g1", subject: "Mathématiques", title: "DS 2", kind: "ds", date: "2026-10-01", score: 9, maxScore: 20, createdAt: "2026-10-03T10:00:00.000Z" };

function q(label: string, outcome: DebriefQuestion["outcome"], extra: Partial<DebriefQuestion> = {}): DebriefQuestion {
  return { label, chapterId: "m2-reduction", outcome, cause: null, lackOfTime: false, points: null, minutes: null, linkedExerciseKey: null, note: "", ...extra };
}

const questions = [q("Q1", "réussie"), q("Q2", "fausse", { cause: "méthode", points: 4 }), q("Q3", "non abordée", { lackOfTime: true }), q("Q4", "partielle", { cause: "cours", points: 2 })];

describe("débrief → tentatives et carnet", () => {
  const built = buildDebrief(grade, questions, NOW);

  it("chaque question devient une tentative sans aide, datée du DS", () => {
    expect(built.attempts).toHaveLength(4);
    expect(built.attempts.map((attempt) => [attempt.exerciseKey, attempt.result, attempt.help, attempt.day])).toEqual([
      ["ds:g1:q1", "réussi", "sans", "2026-10-01"],
      ["ds:g1:q2", "échec", "sans", "2026-10-01"],
      ["ds:g1:q3", "échec", "sans", "2026-10-01"],
      ["ds:g1:q4", "partiel", "sans", "2026-10-01"],
    ]);
    // Non abordée par manque de temps : la cause « temps » est posée.
    expect(built.attempts[2].cause).toBe("temps");
  });

  it("les questions ratées avec une cause vont au carnet existant, reliées au chapitre et à l'exercice", () => {
    expect(built.errors.map((error) => [error.type, error.source, error.programmeChapterId, error.exerciseKey])).toEqual([
      ["méthode", "DS", "m2-reduction", "ds:g1:q2"],
      ["temps", "DS", "m2-reduction", "ds:g1:q3"],
      ["cours", "DS", "m2-reduction", "ds:g1:q4"],
    ]);
  });

  it("une question reliée à une annale existante relie l'erreur à cette annale", () => {
    const linked = buildDebrief(grade, [q("Q2", "fausse", { cause: "calcul", linkedExerciseKey: "annale:mines 2023|reduction" })], NOW);
    expect(linked.errors[0].exerciseKey).toBe("annale:mines 2023|reduction");
    expect(linked.attempts[0].exerciseKey).toBe("ds:g1:q2");
  });

  it("idempotent : réenregistrer remplace ; une question retirée disparaît ; la bonne idée notée est gardée", () => {
    const other = { id: "autre", subject: "Physique" } as unknown as ErrorEntry;
    let state = applyDebrief("g1", { attempts: [], errors: [other] }, built);
    state = { ...state, errors: state.errors.map((error) => (error.id === "debrief-err:g1:q2" ? { ...error, fix: "Penser au lemme des noyaux" } : error)) };
    state = applyDebrief("g1", state, built);
    expect(state.attempts).toHaveLength(4);
    expect(state.errors).toHaveLength(4);
    expect(state.errors.find((error) => error.id === "debrief-err:g1:q2")!.fix).toBe("Penser au lemme des noyaux");
    const fewer = applyDebrief("g1", state, buildDebrief(grade, questions.slice(0, 2), NOW));
    expect(fewer.attempts.map((attempt) => attempt.exerciseKey)).toEqual(["ds:g1:q1", "ds:g1:q2"]);
    expect(fewer.errors.map((error) => error.id)).toEqual(["autre", "debrief-err:g1:q2"]);
  });

  it("relit un débrief enregistré pour le corriger", () => {
    const back = questionsFromAttempts("g1", built.attempts, built.errors);
    expect(back.map((question) => [question.label, question.outcome, question.cause])).toEqual([
      ["Q1", "réussie", null],
      ["Q2", "fausse", "méthode"],
      ["Q3", "non abordée", "temps"],
      ["Q4", "partielle", "cours"],
    ]);
  });

  it("refuse les libellés vides ou en double", () => {
    expect(validateQuestions([q("", "fausse")])).not.toBeNull();
    expect(validateQuestions([q("Q1", "fausse"), q("q1", "réussie")])).not.toBeNull();
    expect(validateQuestions(questions)).toBeNull();
  });
});

describe("plan d'action et vérification", () => {
  const built = buildDebrief(grade, questions, NOW);
  const plan = debriefPlan({
    grade,
    questions,
    attempts: built.attempts,
    annales: [],
    retryDelaysDays: [2, 5, 12],
    ankiDecksByChapter: new Map([["m2-reduction", ["MP::Maths::Réduction"]]]),
    today: "2026-10-03",
  });

  it("six étapes, dans l'ordre demandé", () => {
    expect(plan.map((step) => step.title)).toEqual([
      "1. À corriger en priorité",
      "2. Cours et démonstrations à revoir",
      "3. Exercices à refaire",
      "4. Cartes Anki",
      "5. Nouvelle tentative",
      "6. Vérification",
    ]);
  });

  it("priorité aux questions qui coûtent le plus de points ; cours et paquet Anki du chapitre ; date de nouvelle tentative", () => {
    expect(plan[0].items[0]).toMatch(/^Q2/);
    expect(plan[1].items[0]).toContain("Réduction des endomorphismes");
    expect(plan[3].items[0]).toContain("MP::Maths::Réduction");
    expect(plan[2].items[0]).toBe("Q2 : à refaire sans aide le samedi 3 octobre.");
    expect(plan[4].items[0]).toContain("samedi 3 octobre");
  });

  it("l'erreur du DS n'est corrigée qu'après une nouvelle tentative réussie sans aide", () => {
    const [exerciseBefore] = buildExercises({ annales: [], attempts: [built.attempts[1]], retryDelaysDays: [2], today: "2026-10-03" });
    const error = built.errors[0];
    expect(verifyError(error, new Map([[exerciseBefore.key, exerciseBefore]])).state).toBe("à-vérifier");
    const readOnly = createRetryAttempt(exerciseBefore, { result: "réussi", help: "correction", minutes: 10, cause: null }, new Date(2026, 9, 4, 18))!;
    const [stillOpen] = buildExercises({ annales: [], attempts: [built.attempts[1], readOnly], retryDelaysDays: [2], today: "2026-10-04" });
    expect(verifyError(error, new Map([[stillOpen.key, stillOpen]])).state).toBe("à-vérifier");
    const clean = createRetryAttempt(exerciseBefore, { result: "réussi", help: "sans", minutes: 12, cause: null }, new Date(2026, 9, 6, 18))!;
    const [done] = buildExercises({ annales: [], attempts: [built.attempts[1], readOnly, clean], retryDelaysDays: [2], today: "2026-10-06" });
    expect(verifyError(error, new Map([[done.key, done]]))).toEqual({ state: "vérifiée", on: "2026-10-06" });
    expect(debriefKey("g1", "Q2")).toBe(done.key);
  });

  it("tout réussi : rien à refaire", () => {
    expect(debriefPlan({ grade, questions: [q("Q1", "réussie")], attempts: [], annales: [], retryDelaysDays: [2], ankiDecksByChapter: new Map(), today: "2026-10-03" })[0].title).toBe("Rien à corriger");
  });
});
