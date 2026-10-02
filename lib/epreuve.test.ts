import { describe, expect, it } from "vitest";
import {
  addQuestion,
  createExamSim,
  elapsedSeconds,
  endExam,
  focusQuestion,
  parseExamSim,
  questionSeconds,
  remainingSeconds,
  removeQuestion,
  scoreExam,
  timeSinks,
  updateQuestion,
} from "@/lib/epreuve";

const T0 = new Date(2026, 9, 2, 8, 0);
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function sim(questionCount = 3) {
  return createExamSim({ subject: "Mathématiques", title: " Mines 2023 MP1 ", durationMinutes: 240, questionCount }, T0);
}

describe("création", () => {
  it("borne la durée et le nombre de questions, et nettoie le titre", () => {
    const exam = sim(3);
    expect(exam.title).toBe("Mines 2023 MP1");
    expect(exam.questions.map((question) => question.label)).toEqual(["Q1", "Q2", "Q3"]);
    expect(createExamSim({ subject: "Physique", title: "", durationMinutes: 9999, questionCount: 500 }, T0)).toMatchObject({ title: "Épreuve blanche", durationMinutes: 360 });
  });
});

describe("temps par question", () => {
  it("la question active accumule le temps, et le verse en changeant de question", () => {
    let exam = sim();
    const [q1, q2] = exam.questions;
    exam = focusQuestion(exam, q1.id, at(0));
    expect(questionSeconds(exam, exam.questions[0], at(20))).toBe(1200);
    exam = focusQuestion(exam, q2.id, at(30));
    expect(exam.questions[0].seconds).toBe(1800);
    expect(exam.active?.id).toBe(q2.id);
  });

  it("re-toucher la question active la met en pause", () => {
    let exam = sim();
    const [q1] = exam.questions;
    exam = focusQuestion(exam, q1.id, at(0));
    exam = focusQuestion(exam, q1.id, at(10));
    expect(exam.active).toBeNull();
    expect(exam.questions[0].seconds).toBe(600);
  });

  it("terminer l'épreuve arrête le chrono et verse le temps en cours", () => {
    let exam = sim();
    exam = focusQuestion(exam, exam.questions[0].id, at(0));
    exam = endExam(exam, at(100));
    expect(elapsedSeconds(exam, at(500))).toBe(6000);
    expect(remainingSeconds(exam, at(500))).toBe(240 * 60 - 6000);
    expect(exam.active).toBeNull();
    expect(exam.questions[0].seconds).toBe(6000);
  });

  it("supprimer la question active ne perd pas l'épreuve", () => {
    let exam = sim();
    exam = focusQuestion(exam, exam.questions[0].id, at(0));
    exam = removeQuestion(exam, exam.questions[0].id, at(5));
    expect(exam.questions).toHaveLength(2);
    expect(exam.active).toBeNull();
  });
});

describe("note", () => {
  it("faite = tous les points, partielle = la moitié, ramenée sur 20", () => {
    let exam = addQuestion(sim(3));
    const [q1, q2, q3, q4] = exam.questions;
    exam = updateQuestion(exam, q1.id, { points: 4, status: "faite" });
    exam = updateQuestion(exam, q2.id, { points: 4, status: "partielle" });
    exam = updateQuestion(exam, q3.id, { points: 6, status: "fausse" });
    exam = updateQuestion(exam, q4.id, { points: 6 });
    const score = scoreExam(exam);
    expect(score).toMatchObject({ earned: 6, total: 20, outOf20: 6 });
    expect(score.counts).toEqual({ faite: 1, partielle: 1, fausse: 1, "pas abordée": 1 });
  });

  it("pas de note sans barème", () => {
    expect(scoreExam(sim(0)).outOf20).toBeNull();
  });

  it("repère la question où l'on s'est enlisé", () => {
    let exam = sim(4);
    const [q1, q2] = exam.questions;
    exam = focusQuestion(exam, q1.id, at(0));
    exam = focusQuestion(exam, q2.id, at(150));
    exam = focusQuestion(exam, null, at(160));
    const sinks = timeSinks(exam, at(160));
    expect(sinks.map((entry) => entry.question.id)).toEqual([q1.id]);
    expect(sinks[0].fairSeconds).toBe(3600);
  });
});

describe("sauvegarde sur l'appareil", () => {
  it("relit ce qu'elle a écrit, et rejette un contenu abîmé", () => {
    const base = sim();
    const fixed = focusQuestion(base, base.questions[0].id, at(0));
    expect(parseExamSim(JSON.stringify(fixed))).toEqual(fixed);
    expect(parseExamSim("{abîmé")).toBeNull();
    expect(parseExamSim(JSON.stringify({ ...fixed, subject: "Latin" }))).toBeNull();
    expect(parseExamSim(JSON.stringify({ ...fixed, active: { id: "inconnue", since: fixed.startedAt } }))?.active).toBeNull();
  });
});
