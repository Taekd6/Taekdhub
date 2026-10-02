import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog } from "@/lib/annales";
import { computeBilan, describeTrend, formatDuration, periodRange } from "@/lib/bilan";
import { createErrorEntry } from "@/lib/error-log";
import { createGrade } from "@/lib/grades";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const TODAY = "2026-10-02";
const NOW = new Date(2026, 9, 2, 18, 0);

let seq = 0;
function session(subject: Subject, day: string, minutes: number): WorkSession {
  seq += 1;
  const start = new Date(`${day}T10:00:00`);
  return {
    id: `s${seq}`,
    subject,
    exercise_id: null,
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_seconds: minutes * 60,
    note: null,
    created_at: start.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

describe("périodes", () => {
  it("se terminent aujourd'hui, bornes incluses", () => {
    expect(periodRange("semaine", TODAY)).toEqual({ from: "2026-09-26", to: TODAY });
    expect(periodRange("mois", TODAY)).toEqual({ from: "2026-09-03", to: TODAY });
  });

  it("l'année scolaire commence au 1er septembre, y compris au printemps", () => {
    expect(periodRange("annee", TODAY).from).toBe("2026-09-01");
    expect(periodRange("annee", "2027-03-10").from).toBe("2026-09-01");
  });
});

describe("bilan", () => {
  const sessions = [
    session("Mathématiques", "2026-10-01", 120),
    session("Physique", "2026-09-30", 60),
    session("Mathématiques", "2026-09-28", 30),
    session("Mathématiques", "2026-09-20", 60), // période précédente
  ];
  const grades = [
    createGrade({ subject: "Mathématiques", title: "DS 1", kind: "ds", date: "2026-09-29", score: 12, maxScore: 20, predictedScore: 15 }, NOW)!,
    createGrade({ subject: "Mathématiques", title: "Colle", kind: "colle", date: "2026-09-30", score: 8, maxScore: 10 }, NOW)!,
    createGrade({ subject: "Physique", title: "DS", kind: "ds", date: "2026-08-01", score: 4, maxScore: 20 }, NOW)!,
  ];
  const errors = [
    createErrorEntry({ subject: "Mathématiques", type: "calcul", date: "2026-09-29", source: "DS", description: "signe" }, NOW)!,
    createErrorEntry({ subject: "Physique", type: "calcul", date: "2026-09-30", source: "DS", description: "unités" }, NOW)!,
    createErrorEntry({ subject: "Physique", type: "méthode", date: "2026-09-30", source: "DS", description: "Gauss" }, NOW)!,
  ];
  const annales = [normalizeAnnaleLog({ id: "a", created_at: new Date(2026, 8, 30, 15).toISOString(), matiere: "maths", chapitre: "Réduction", resultat: "partiel" })!];

  const bilan = computeBilan({ sessions, grades, errors, chapterMemory: [], annales, programmeSeen: ["m2-reduction"], ...periodRange("semaine", TODAY), today: TODAY });

  it("compte le temps de la période, par matière, et la période précédente", () => {
    expect(bilan.totalMinutes).toBe(210);
    expect(bilan.activeDays).toBe(3);
    expect(bilan.previousMinutes).toBe(60);
    expect(bilan.bySubject.map((entry) => [entry.subject, entry.minutes])).toEqual([
      ["Mathématiques", 150],
      ["Physique", 60],
    ]);
  });

  it("ne garde que les notes de la période, ramenées sur 20", () => {
    expect(bilan.gradeCount).toBe(2);
    expect(bilan.overallAverage).toBe(14);
    expect(bilan.bySubject[0].average).toBe(14);
    expect(bilan.bySubject[1].average).toBeNull();
  });

  it("erreurs, annales et programme", () => {
    expect(bilan.errorCount).toBe(3);
    expect(bilan.topErrors[0]).toEqual({ label: "Calcul", count: 2 });
    expect(bilan.annales.count).toBe(1);
    expect(bilan.programme.find((entry) => entry.subject === "Mathématiques")!.summary.seen).toBe(1);
  });

  it("décrit l'évolution du temps", () => {
    expect(describeTrend(bilan)).toBe("+2 h 30 (+250 %) par rapport à la période précédente.");
    expect(describeTrend({ ...bilan, previousMinutes: 0 })).toBeNull();
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
  });
});
