import { describe, expect, it } from "vitest";
import { createChapter } from "@/lib/chapter-memory";
import { drawQuestion, memoryFor, parseKholleHistory, questionsFor, questionWeight, recordGrade, reviewCardFor, tally } from "@/lib/kholle";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { createPracticeSession } from "@/lib/practice-session";

const NOW = new Date(2026, 9, 2, 18, 0);

describe("questions", () => {
  it("rassemble les questions des chapitres choisis, identifiants inconnus ignorés", () => {
    const questions = questionsFor(["m2-reduction", "inconnu"]);
    expect(questions.length).toBe(PROGRAMME_BY_ID.get("m2-reduction")!.questions.length);
    expect(questions[0].id).toBe("m2-reduction#0");
  });
});

describe("tirage pondéré", () => {
  const [a, b] = questionsFor(["m2-reduction"]);

  it("une question ratée pèse plus qu'une question sue, une question récente presque rien", () => {
    const old = new Date(2026, 8, 1).toISOString();
    expect(questionWeight(a, recordGrade({}, a.id, "pas su", new Date(old)), NOW)).toBe(4);
    expect(questionWeight(a, recordGrade({}, a.id, "su", new Date(old)), NOW)).toBe(1);
    expect(questionWeight(a, {}, NOW)).toBe(3);
    expect(questionWeight(a, recordGrade({}, a.id, "pas su", new Date(2026, 9, 2, 10)), NOW)).toBeCloseTo(0.4);
  });

  it("le hasard injecté choisit selon les poids, et les questions exclues ne sortent pas", () => {
    expect(drawQuestion([a, b], {}, NOW, new Set(), () => 0)).toBe(a);
    expect(drawQuestion([a, b], {}, NOW, new Set(), () => 0.99)).toBe(b);
    expect(drawQuestion([a, b], {}, NOW, new Set([a.id]), () => 0)).toBe(b);
    expect(drawQuestion([a], {}, NOW, new Set([a.id]))).toBeNull();
  });

  it("relit un historique abîmé sans lever", () => {
    expect(parseKholleHistory(null)).toEqual({});
    expect(parseKholleHistory("{pas du json")).toEqual({});
    expect(parseKholleHistory(JSON.stringify({ x: { grade: "su", at: "2026-10-01T10:00:00Z" }, y: { grade: "bof", at: "2026-10-01T10:00:00Z" } }))).toEqual({
      x: { grade: "su", at: "2026-10-01T10:00:00Z" },
    });
  });
});

describe("liens avec le reste de l'application", () => {
  const [question] = questionsFor(["m2-reduction"]);

  it("une question pas sue devient une carte « à apprendre », jamais en double", () => {
    const card = reviewCardFor(question, [], NOW)!;
    expect(card).toMatchObject({ subject: "Mathématiques", kind: "à apprendre", text: question.text });
    expect(reviewCardFor(question, [card], NOW)).toBeNull();
  });

  it("retrouve le chapitre de Mémoire correspondant", () => {
    const memory = createChapter({ subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-09-01" }, NOW, "red");
    const other = createChapter({ subject: "Mathématiques", title: "Séries entières", learnedAt: "2026-09-01" }, NOW, "se");
    expect(memoryFor(question.chapter, [memory, other]).map((entry) => entry.id)).toEqual(["red"]);
  });

  it("compte les résultats d'une séance", () => {
    expect(tally([{ grade: "su" }, { grade: "pas su" }, { grade: "su" }])).toEqual({ asked: 3, su: 2, hésitant: 0, "pas su": 1 });
  });

  it("le temps d'entraînement devient une séance, pas en dessous d'une minute", () => {
    const start = new Date(2026, 9, 2, 17, 0);
    const session = createPracticeSession({ subject: "Physique", startedAt: start, endedAt: new Date(2026, 9, 2, 17, 25), note: "Khôlle" }, NOW)!;
    expect(session).toMatchObject({ subject: "Physique", duration_seconds: 1500, note: "Khôlle" });
    expect(createPracticeSession({ subject: "Physique", startedAt: start, endedAt: new Date(start.getTime() + 30_000), note: "Khôlle" }, NOW)).toBeNull();
  });
});
