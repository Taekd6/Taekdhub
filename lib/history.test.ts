import { describe, expect, it } from "vitest";
import { filterSessions, periodStart, recentDaySummaries, resultCounts, summarizeSessions } from "@/lib/history";
import type { Subject, WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: null,
    started_at: "2026-08-10T09:00:00.000Z",
    ended_at: "2026-08-10T09:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T09:10:00.000Z",
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T18:00:00.000Z");

describe("recentDaySummaries", () => {
  it("aucune séance : liste vide", () => {
    expect(recentDaySummaries([], NOW)).toEqual([]);
  });

  it("regroupe le temps et le nombre de séances par jour, le plus récent d'abord", () => {
    const sessions = [
      makeSession({ started_at: "2026-08-10T08:00:00.000Z", duration_seconds: 1500 }),
      makeSession({ started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 1200 }),
      makeSession({ started_at: "2026-08-09T08:00:00.000Z", duration_seconds: 1920 }),
    ];
    const days = recentDaySummaries(sessions, NOW);
    expect(days).toHaveLength(2);
    expect(days[0].label).toBe("Aujourd'hui");
    expect(days[0].seconds).toBe(2700);
    expect(days[0].sessionCount).toBe(2);
    expect(days[1].label).toBe("Hier");
    expect(days[1].seconds).toBe(1920);
    expect(days[1].sessionCount).toBe(1);
  });

  it("respecte la limite fournie", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ started_at: `2026-08-${String(10 - i).padStart(2, "0")}T08:00:00.000Z` })
    );
    const days = recentDaySummaries(sessions, NOW, 3);
    expect(days).toHaveLength(3);
  });
});

/**
 * Aucun test ne couvrait jusqu'ici periodStart/filterSessions/summarizeSessions/
 * resultCounts, alors qu'ils portent exactement la même catégorie de risque
 * (bornes de date/semaine) que le bug de streak corrigé dans
 * lib/gamification.ts — voir aussi lib/week.test.ts, ajouté pour la même raison.
 */
describe("periodStart", () => {
  it("\"all\" : aucune borne", () => {
    expect(periodStart("all", NOW)).toBeNull();
  });

  it("\"week\" : même définition que lib/week.ts#startOfWeek (lundi 00:00)", () => {
    const wednesday = new Date("2026-08-19T15:30:00.000Z");
    expect(periodStart("week", wednesday)?.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("\"month\" : le 1er du mois en cours, à minuit", () => {
    const midMonth = new Date("2026-08-19T15:30:00.000Z");
    const start = periodStart("month", midMonth);
    expect(start?.getDate()).toBe(1);
    expect(start?.getHours()).toBe(0);
    expect(start?.getMinutes()).toBe(0);
  });
});

describe("filterSessions", () => {
  const sessions: WorkSession[] = [
    makeSession({ id: "s-this-week", subject: "Mathématiques", started_at: "2026-08-10T09:00:00.000Z" }),
    makeSession({ id: "s-last-week", subject: "Mathématiques", started_at: "2026-08-02T09:00:00.000Z" }),
    makeSession({ id: "s-physique", subject: "Physique", started_at: "2026-08-10T09:00:00.000Z" }),
  ];

  it("\"all\" sans filtre de matière : tout est renvoyé", () => {
    expect(filterSessions(sessions, { subject: "Toutes", period: "all" }, NOW)).toHaveLength(3);
  });

  it("filtre matière seule (ET implicite avec la période \"all\", qui ne retire rien)", () => {
    const result = filterSessions(sessions, { subject: "Mathématiques", period: "all" }, NOW);
    expect(result.map((s) => s.id).sort()).toEqual(["s-last-week", "s-this-week"]);
  });

  it("filtre période seule : exclut une séance antérieure au début de semaine", () => {
    const result = filterSessions(sessions, { subject: "Toutes", period: "week" }, NOW);
    expect(result.map((s) => s.id)).not.toContain("s-last-week");
    expect(result.map((s) => s.id)).toContain("s-this-week");
  });

  it("matière + période combinés : intersection (ET), pas union (OU)", () => {
    const result = filterSessions(sessions, { subject: "Mathématiques", period: "week" }, NOW);
    expect(result.map((s) => s.id)).toEqual(["s-this-week"]);
  });

  it("une séance exactement à la borne de début de semaine (lundi 00:00) est incluse — borne inclusive", () => {
    const boundarySession = makeSession({ id: "s-boundary", started_at: "2026-08-10T00:00:00.000Z" });
    const result = filterSessions([boundarySession], { subject: "Toutes", period: "week" }, NOW);
    expect(result.map((s) => s.id)).toEqual(["s-boundary"]);
  });
});

describe("summarizeSessions", () => {
  it("agrège temps total, nombre de séances, et répartition par matière (matières sans temps omises)", () => {
    const sessions: WorkSession[] = [
      makeSession({ subject: "Mathématiques", duration_seconds: 600 }),
      makeSession({ subject: "Mathématiques", duration_seconds: 300 }),
      makeSession({ subject: "Physique", duration_seconds: 900 }),
    ];
    const summary = summarizeSessions(sessions);
    expect(summary.totalSeconds).toBe(1800);
    expect(summary.sessionCount).toBe(3);
    expect(summary.bySubject).toEqual([
      { subject: "Mathématiques", seconds: 900 },
      { subject: "Physique", seconds: 900 },
    ]);
  });

  it("aucune séance : agrégat à zéro, aucune matière listée", () => {
    const summary = summarizeSessions([]);
    expect(summary.totalSeconds).toBe(0);
    expect(summary.sessionCount).toBe(0);
    expect(summary.bySubject).toEqual([]);
  });
});

describe("resultCounts", () => {
  it("distingue les résultats et exclut les séances sans résultat renseigné du taux de réussite", () => {
    const sessions: WorkSession[] = [
      makeSession({ result: "réussi" }),
      makeSession({ result: "réussi" }),
      makeSession({ result: "échoué" }),
      makeSession({ result: null }),
    ];
    const counts = resultCounts(sessions);
    expect(counts.success).toBe(2);
    expect(counts.failure).toBe(1);
    expect(counts.unrecorded).toBe(1);
    expect(counts.attempted).toBe(3);
    expect(counts.successRate).toBe(67);
  });

  it("aucune séance avec résultat renseigné : successRate est null, jamais 0%", () => {
    const counts = resultCounts([makeSession({ result: null })]);
    expect(counts.attempted).toBe(0);
    expect(counts.successRate).toBeNull();
  });
});
