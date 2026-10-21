import { describe, expect, it } from "vitest";
import { computeAttemptWeeks, mondayOf } from "@/lib/analytics/attempt-trend";
import type { ExerciseAttempt } from "@/lib/attempts";

let counter = 0;
function attempt(day: string, result: ExerciseAttempt["result"], help: ExerciseAttempt["help"] = "sans"): ExerciseAttempt {
  counter += 1;
  return {
    id: `a${counter}`, exerciseKey: `k${counter}`, label: "x", subject: "Mathématiques", chapterId: null, origin: "exercice", day,
    createdAt: `${day}T10:00:00.000Z`, updatedAt: `${day}T10:00:00.000Z`, result, help, minutes: null, plannedMinutes: null,
    cause: null, lackOfTime: false, gradeId: null, note: null,
  };
}

// Mercredi 21 octobre 2026 : la semaine courante commence le lundi 19.
const NOW = new Date("2026-10-21T12:00:00");

describe("mondayOf", () => {
  it("renvoie le lundi, y compris pour un dimanche", () => {
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });
});

describe("computeAttemptWeeks", () => {
  it("renvoie toujours le nombre de semaines demandé, de la plus ancienne à la courante", () => {
    const weeks = computeAttemptWeeks([], NOW, 6);
    expect(weeks).toHaveLength(6);
    expect(weeks[5].start).toBe("2026-10-19");
    expect(weeks[0].start).toBe("2026-09-14");
    expect(weeks.every((week) => week.total === 0 && week.unaidedPercent === null)).toBe(true);
  });

  it("compte les résultats par semaine et ignore les essais hors fenêtre", () => {
    const weeks = computeAttemptWeeks(
      [attempt("2026-10-19", "réussi"), attempt("2026-10-21", "échec"), attempt("2026-10-14", "partiel"), attempt("2026-01-01", "réussi")],
      NOW
    );
    expect(weeks[5]).toMatchObject({ réussi: 1, échec: 1, partiel: 0, total: 2 });
    expect(weeks[4]).toMatchObject({ partiel: 1, total: 1 });
    expect(weeks.reduce((sum, week) => sum + week.total, 0)).toBe(3);
  });

  it("ne calcule la part sans aide qu'à partir de trois tentatives", () => {
    const two = computeAttemptWeeks([attempt("2026-10-19", "réussi"), attempt("2026-10-20", "réussi")], NOW);
    expect(two[5].unaidedPercent).toBeNull();
    const three = computeAttemptWeeks([attempt("2026-10-19", "réussi"), attempt("2026-10-20", "réussi"), attempt("2026-10-21", "échec")], NOW);
    expect(three[5].unaidedPercent).toBe(67);
  });

  it("un réussi AVEC aide ne compte pas comme réussi sans aide", () => {
    const weeks = computeAttemptWeeks([attempt("2026-10-19", "réussi", "correction"), attempt("2026-10-20", "réussi", "indices"), attempt("2026-10-21", "réussi", "sans")], NOW);
    expect(weeks[5].réussi).toBe(3);
    expect(weeks[5].unaidedPercent).toBe(33);
  });
});
