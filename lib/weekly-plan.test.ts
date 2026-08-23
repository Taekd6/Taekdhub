import { describe, expect, it } from "vitest";
import {
  computeWeeklyPlanRows,
  emptyWeeklyPlan,
  hasAnyPlannedMinutes,
  plannedMinutesForDay,
  plannedMinutesSoFarBySubject,
  planGapMinutesBySubject,
  setDayCellMinutes,
  subjectMinutesForDay,
} from "@/lib/weekly-plan";
import type { WorkSession } from "@/lib/supabase/types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${Math.random()}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-08-24T09:00:00.000Z",
    ended_at: null,
    duration_seconds: 0,
    note: null,
    created_at: "2026-08-24T09:00:00.000Z",
    result: null,
    ...overrides,
  };
}

// 2026-08-24 est un lundi.
const MONDAY = new Date("2026-08-24T18:00:00.000Z");
const WEDNESDAY = new Date("2026-08-26T18:00:00.000Z");

describe("emptyWeeklyPlan", () => {
  it("retourne 7 jours (0-6), tous vides", () => {
    const plan = emptyWeeklyPlan();
    expect(plan).toHaveLength(7);
    expect(plan.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(hasAnyPlannedMinutes(plan)).toBe(false);
  });
});

describe("setDayCellMinutes", () => {
  it("ajoute une matière à un jour, sans toucher aux autres jours", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 90);
    expect(plannedMinutesForDay(plan, 0)).toBe(90);
    expect(plannedMinutesForDay(plan, 1)).toBe(0);
    expect(hasAnyPlannedMinutes(plan)).toBe(true);
  });

  it("cumule plusieurs matières le même jour", () => {
    let plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 90);
    plan = setDayCellMinutes(plan, 0, "Physique", 60);
    expect(plannedMinutesForDay(plan, 0)).toBe(150);
  });

  it("minutes <= 0 retire la matière plutôt que de la garder à 0", () => {
    let plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 90);
    plan = setDayCellMinutes(plan, 0, "Mathématiques", 0);
    expect(plan.find((d) => d.day === 0)?.subjectMinutes).toEqual({});
  });
});

describe("subjectMinutesForDay", () => {
  it("détail par matière pour un jour donné, jamais les matières sans minute", () => {
    let plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 90);
    plan = setDayCellMinutes(plan, 0, "Physique", 45);
    expect(subjectMinutesForDay(plan, 0)).toEqual({ Mathématiques: 90, Physique: 45 });
  });

  it("jour sans plan : objet vide", () => {
    expect(subjectMinutesForDay(emptyWeeklyPlan(), 3)).toEqual({});
  });
});

describe("computeWeeklyPlanRows", () => {
  it("un jour sans rien de prévu est \"sans plan\", jamais un échec", () => {
    const rows = computeWeeklyPlanRows(emptyWeeklyPlan(), [], MONDAY);
    expect(rows.every((row) => row.state === "sans plan" || row.state === "à venir")).toBe(true);
  });

  it("prévu atteint ou dépassé → \"atteint\"", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 60);
    const sessions = [makeSession({ started_at: "2026-08-24T09:00:00.000Z", duration_seconds: 70 * 60 })];
    const rows = computeWeeklyPlanRows(plan, sessions, MONDAY);
    expect(rows[0].state).toBe("atteint");
    expect(rows[0].plannedMinutes).toBe(60);
    expect(rows[0].workedMinutes).toBe(70);
  });

  it("prévu non encore atteint, jour passé/aujourd'hui → \"en cours\"", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 90);
    const sessions = [makeSession({ started_at: "2026-08-24T09:00:00.000Z", duration_seconds: 20 * 60 })];
    const rows = computeWeeklyPlanRows(plan, sessions, MONDAY);
    expect(rows[0].state).toBe("en cours");
  });

  it("un jour futur n'est JAMAIS jugé en échec, même avec du prévu et 0 travaillé", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 4, "Mathématiques", 120); // vendredi
    const rows = computeWeeklyPlanRows(plan, [], MONDAY);
    const friday = rows[4];
    expect(friday.isFuture).toBe(true);
    expect(friday.state).toBe("à venir");
  });

  it("le jour courant est correctement marqué isToday", () => {
    const rows = computeWeeklyPlanRows(emptyWeeklyPlan(), [], WEDNESDAY);
    expect(rows.filter((r) => r.isToday).map((r) => r.day)).toEqual([2]);
  });
});

describe("plannedMinutesSoFarBySubject", () => {
  it("cumule lundi → aujourd'hui inclus, jamais les jours futurs", () => {
    let plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Mathématiques", 60); // lundi
    plan = setDayCellMinutes(plan, 2, "Mathématiques", 45); // mercredi
    plan = setDayCellMinutes(plan, 4, "Mathématiques", 30); // vendredi — futur depuis mercredi
    const result = plannedMinutesSoFarBySubject(plan, WEDNESDAY);
    expect(result.Mathématiques).toBe(105); // lundi + mercredi, pas vendredi
  });

  it("aucune minute planifiée pour une matière → absente du résultat", () => {
    const result = plannedMinutesSoFarBySubject(emptyWeeklyPlan(), WEDNESDAY);
    expect(result.Physique).toBeUndefined();
  });
});

describe("planGapMinutesBySubject", () => {
  it("aucun plan configuré pour une matière → pas de retard signalé", () => {
    const result = planGapMinutesBySubject(emptyWeeklyPlan(), [], WEDNESDAY);
    expect(result.Mathématiques).toBeUndefined();
  });

  it("retard réel : prévu > réalisé cette semaine pour cette matière", () => {
    const plan = setDayCellMinutes(setDayCellMinutes(emptyWeeklyPlan(), 0, "Physique", 60), 2, "Physique", 45); // 105 prévues lundi+mercredi
    const sessions = [makeSession({ subject: "Physique", started_at: "2026-08-24T09:00:00.000Z", duration_seconds: 20 * 60 })];
    const result = planGapMinutesBySubject(plan, sessions, WEDNESDAY);
    expect(result.Physique).toBe(85); // 105 - 20
  });

  it("réalisé ≥ prévu → aucun retard (jamais un nombre négatif)", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Physique", 60);
    const sessions = [makeSession({ subject: "Physique", started_at: "2026-08-24T09:00:00.000Z", duration_seconds: 90 * 60 })];
    const result = planGapMinutesBySubject(plan, sessions, WEDNESDAY);
    expect(result.Physique).toBeUndefined();
  });

  it("le temps travaillé sur UNE AUTRE matière ne comble jamais le retard d'une matière planifiée", () => {
    const plan = setDayCellMinutes(emptyWeeklyPlan(), 0, "Physique", 60);
    const sessions = [makeSession({ subject: "Mathématiques", started_at: "2026-08-24T09:00:00.000Z", duration_seconds: 120 * 60 })];
    const result = planGapMinutesBySubject(plan, sessions, WEDNESDAY);
    expect(result.Physique).toBe(60);
  });
});
