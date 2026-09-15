import { describe, expect, it } from "vitest";
import { computeSubjectDistribution, computeWeeklyComparison, computeWorkTimeSeries, minutesBetween } from "@/lib/analytics/work-time";
import { computeExerciseOutcomeStats, computeSuccessRateTrend, describeSampleSize, OUTCOME_SOLID_SAMPLE } from "@/lib/analytics/outcomes";
import { computeConsistency, currentStreak } from "@/lib/analytics/consistency";
import { computePlanningAccuracy, computeWeekPlanVsActual, describePlanningAccuracy } from "@/lib/analytics/planning";
import { computeChapterMastery, computeMasteryTrend } from "@/lib/analytics/mastery";
import type { Chapter, DayPlanRecord, WeekSnapshot } from "@/lib/storage";
import type { AttemptResult, Exercise, WorkSession } from "@/lib/supabase/types";

/** Dimanche 20 septembre 2026, 20 h — le moment où l'on ouvre /progress. */
const NOW = new Date("2026-09-20T20:00:00");

function session(startedAt: string, minutes: number, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: null,
    ...overrides,
  };
}

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    subject: "Mathématiques",
    title: `Ex ${id}`,
    statement: "",
    chapter_id: null,
    source: "test",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    epreuve: null,
    filieres: [],
    exercise_number: null,
    provenance: "originale",
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    mastery: 0,
    status: "à faire",
    estimated_minutes: 20,
    attempts: 0,
    note: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

/* ═══════════════════════ TEMPS ═══════════════════════ */

describe("séries temporelles", () => {
  it("agrège par jour, et garde les jours vides à zéro", () => {
    const sessions = [session("2026-09-18T10:00:00", 60), session("2026-09-20T10:00:00", 30)];
    const series = computeWorkTimeSeries(sessions, "jour", 3, NOW);
    expect(series.map((point) => point.minutes)).toEqual([60, 0, 30]);
  });

  it("agrège par semaine", () => {
    const sessions = [session("2026-09-15T10:00:00", 120), session("2026-09-08T10:00:00", 60)];
    const series = computeWorkTimeSeries(sessions, "semaine", 3, NOW);
    expect(series.map((point) => point.minutes)).toEqual([0, 60, 120]);
  });

  it("agrège par mois", () => {
    const sessions = [session("2026-09-15T10:00:00", 120), session("2026-08-15T10:00:00", 60)];
    const series = computeWorkTimeSeries(sessions, "mois", 2, NOW);
    expect(series.map((point) => point.minutes)).toEqual([60, 120]);
  });

  it("ignore une séance postérieure à la date de référence", () => {
    expect(computeWorkTimeSeries([session("2026-12-01T10:00:00", 60)], "jour", 3, NOW).every((p) => p.minutes === 0)).toBe(true);
  });

  it("aucune séance : une série de zéros, pas une série vide", () => {
    expect(computeWorkTimeSeries([], "jour", 7, NOW)).toHaveLength(7);
  });

  it("borne correctement une période", () => {
    const sessions = [session("2026-09-14T10:00:00", 60), session("2026-09-01T10:00:00", 60)];
    expect(minutesBetween(sessions, new Date("2026-09-10T00:00:00"), NOW)).toBe(60);
  });
});

describe("répartition par matière", () => {
  const sessions = [
    session("2026-09-14T10:00:00", 120, { subject: "Mathématiques" }),
    session("2026-09-15T10:00:00", 60, { subject: "Physique" }),
    session("2026-09-16T10:00:00", 20, { subject: "Chimie" }),
  ];

  it("classe par volume décroissant, avec les parts", () => {
    const shares = computeSubjectDistribution(sessions, null, NOW);
    expect(shares.map((entry) => entry.subject)).toEqual(["Mathématiques", "Physique", "Chimie"]);
    expect(shares[0].minutes).toBe(120);
    expect(shares[0].percent).toBe(60);
  });

  it("n'affiche jamais une matière à zéro", () => {
    expect(computeSubjectDistribution(sessions, null, NOW).some((entry) => entry.minutes === 0)).toBe(false);
  });

  it("aucune séance : liste vide, pas sept matières à 0 %", () => {
    expect(computeSubjectDistribution([], null, NOW)).toEqual([]);
  });
});

describe("comparaison hebdomadaire", () => {
  it("compare la semaine en cours à la précédente", () => {
    const sessions = [session("2026-09-16T10:00:00", 180), session("2026-09-09T10:00:00", 120)];
    const comparison = computeWeeklyComparison(sessions, NOW);
    expect(comparison.currentMinutes).toBe(180);
    expect(comparison.previousMinutes).toBe(120);
    expect(comparison.deltaMinutes).toBe(60);
  });

  it("la semaine EN COURS est retirée de la tendance de rythme — sinon tout lundi serait une chute", () => {
    const monday = new Date("2026-09-21T09:00:00");
    const sessions = [
      session("2026-09-02T10:00:00", 300),
      session("2026-09-09T10:00:00", 320),
      session("2026-09-16T10:00:00", 310),
      session("2026-09-21T08:00:00", 10),
    ];
    expect(computeWeeklyComparison(sessions, monday).trend.direction).not.toBe("baisse");
  });

  it("aucune séance : aucune tendance de rythme", () => {
    expect(computeWeeklyComparison([], NOW).trend.direction).toBe("insuffisant");
  });
});

/* ═══════════════════════ RÉSULTATS ═══════════════════════ */

describe("taux de réussite — définition explicite du dénominateur", () => {
  const attempt = (result: AttemptResult | null, hints: number | null = null) =>
    session("2026-09-16T10:00:00", 20, { exercise_id: crypto.randomUUID(), result, hints_used: hints });

  it("ne compte QUE les tentatives portant un résultat déclaré", () => {
    const stats = computeExerciseOutcomeStats([attempt("réussi"), attempt("échoué"), attempt(null)], null, NOW);
    expect(stats.evaluated).toBe(2);
    expect(stats.successRate).toBe(50);
    expect(stats.unevaluated).toBe(1);
  });

  it("une séance sans résultat n'est JAMAIS comptée comme un échec", () => {
    const stats = computeExerciseOutcomeStats([attempt("réussi"), attempt(null), attempt(null)], null, NOW);
    expect(stats.failed).toBe(0);
    expect(stats.successRate).toBe(100);
  });

  it("une séance libre (sans exercice) ne compte pas comme un exercice travaillé", () => {
    const stats = computeExerciseOutcomeStats([session("2026-09-16T10:00:00", 60)], null, NOW);
    expect(stats.exercisesWorked).toBe(0);
    expect(stats.evaluated).toBe(0);
  });

  it("un même exercice repris trois fois compte pour UN exercice travaillé", () => {
    const sessions = Array.from({ length: 3 }, () => session("2026-09-16T10:00:00", 20, { exercise_id: "ex-1", result: "réussi" as const }));
    expect(computeExerciseOutcomeStats(sessions, null, NOW).exercisesWorked).toBe(1);
  });

  it("aucune tentative évaluable : pas de taux, et surtout pas « 0 % »", () => {
    expect(computeExerciseOutcomeStats([attempt(null)], null, NOW).successRate).toBeNull();
  });

  it("l'autonomie vaut null quand aucune réussite ne porte l'information", () => {
    expect(computeExerciseOutcomeStats([attempt("réussi", null)], null, NOW).autonomousSuccesses).toBeNull();
    expect(computeExerciseOutcomeStats([attempt("réussi", 0)], null, NOW).autonomousSuccesses).toBe(1);
  });

  it("un échantillon trop mince est signalé, un échantillon suffisant ne l'est pas", () => {
    const few = computeExerciseOutcomeStats([attempt("réussi"), attempt("réussi")], null, NOW);
    expect(describeSampleSize(few)).toContain("échantillon encore limité");
    const many = computeExerciseOutcomeStats(
      Array.from({ length: OUTCOME_SOLID_SAMPLE }, () => attempt("réussi")),
      null,
      NOW
    );
    expect(describeSampleSize(many)).toBeNull();
  });
});

describe("évolution de la réussite", () => {
  it("une semaine sans tentative notée vaut null, pas 0 %", () => {
    const sessions = [session("2026-09-16T10:00:00", 20, { exercise_id: "a", result: "réussi" })];
    const { points } = computeSuccessRateTrend(sessions, 3, NOW);
    expect(points[points.length - 1].rate).toBe(100);
    expect(points[0].rate).toBeNull();
  });

  it("les semaines vides ne font pas plonger la tendance", () => {
    const sessions = [session("2026-09-16T10:00:00", 20, { exercise_id: "a", result: "réussi" })];
    expect(computeSuccessRateTrend(sessions, 6, NOW).trend.direction).toBe("insuffisant");
  });
});

/* ═══════════════════════ RÉGULARITÉ ═══════════════════════ */

describe("régularité — des jours actifs, jamais un classement de volume", () => {
  it("compte les jours où au moins une séance existe, quelle que soit sa durée", () => {
    const sessions = [session("2026-09-14T10:00:00", 5), session("2026-09-15T10:00:00", 240)];
    const consistency = computeConsistency(sessions, 1, NOW);
    expect(consistency.currentActiveDays).toBe(2);
  });

  it("une journée de quatre heures ne vaut pas plus qu'une journée d'une heure", () => {
    const big = computeConsistency([session("2026-09-14T10:00:00", 240)], 1, NOW);
    const small = computeConsistency([session("2026-09-14T10:00:00", 60)], 1, NOW);
    expect(big.currentActiveDays).toBe(small.currentActiveDays);
  });

  it("la semaine EN COURS est exclue de la moyenne — un mardi ne peut pas avoir sept jours actifs", () => {
    const tuesday = new Date("2026-09-15T20:00:00");
    const sessions = [
      session("2026-09-07T10:00:00", 60),
      session("2026-09-08T10:00:00", 60),
      session("2026-09-09T10:00:00", 60),
      session("2026-09-14T10:00:00", 60),
    ];
    const consistency = computeConsistency(sessions, 2, tuesday);
    expect(consistency.averageActiveDays).toBe(3);
    expect(consistency.weeks[consistency.weeks.length - 1].partial).toBe(true);
  });

  it("aucune séance : aucune tendance de régularité", () => {
    expect(computeConsistency([], 4, NOW).trend.direction).toBe("insuffisant");
    expect(computeConsistency([], 4, NOW).averageActiveDays).toBe(0);
  });

  it("la série en cours compte les jours consécutifs, aujourd'hui inclus s'il est actif", () => {
    const sessions = [session("2026-09-20T10:00:00", 60), session("2026-09-19T10:00:00", 60)];
    expect(currentStreak(sessions, NOW)).toBe(2);
  });

  it("un jour manqué interrompt la série, sans jugement", () => {
    const sessions = [session("2026-09-18T10:00:00", 60)];
    expect(currentStreak(sessions, NOW)).toBe(0);
  });
});

/* ═══════════════════════ PRÉVU vs RÉALISÉ ═══════════════════════ */

describe("prévu vs réalisé", () => {
  const record = (date: string, planned: number): DayPlanRecord => ({
    date,
    plannedMinutes: planned,
    capturedAt: `${date}T00:00:00.000Z`,
  });

  it("compare sur les seuls jours réellement enregistrés", () => {
    const plans = [record("2026-09-18", 120), record("2026-09-19", 60)];
    const sessions = [session("2026-09-18T10:00:00", 100), session("2026-09-19T10:00:00", 60)];
    const accuracy = computePlanningAccuracy(plans, sessions, 5, NOW);
    expect(accuracy.daysCompared).toBe(2);
    expect(accuracy.plannedMinutes).toBe(180);
    expect(accuracy.actualMinutes).toBe(160);
    expect(accuracy.completionPercent).toBe(89);
  });

  it("un jour SANS intention enregistrée est dit, jamais compté comme zéro prévu", () => {
    const accuracy = computePlanningAccuracy([record("2026-09-19", 60)], [session("2026-09-18T10:00:00", 120)], 3, NOW);
    expect(accuracy.daysWithoutRecord).toBe(2);
    // Les 120 min du 18 ne gonflent pas le taux : ce jour n'est pas comparable.
    expect(accuracy.actualMinutes).toBe(0);
  });

  it("aucun enregistrement : aucun pourcentage, et aucune phrase", () => {
    const accuracy = computePlanningAccuracy([], [session("2026-09-18T10:00:00", 120)], 5, NOW);
    expect(accuracy.completionPercent).toBeNull();
    expect(describePlanningAccuracy(accuracy)).toBeNull();
  });

  it("trop peu de jours comparables : aucune phrase plutôt qu'un taux trompeur", () => {
    const accuracy = computePlanningAccuracy([record("2026-09-19", 60)], [session("2026-09-19T10:00:00", 30)], 3, NOW);
    expect(accuracy.completionPercent).toBe(50);
    expect(describePlanningAccuracy(accuracy)).toBeNull();
  });

  it("la phrase est FACTUELLE, jamais un jugement", () => {
    const plans = [record("2026-09-17", 60), record("2026-09-18", 60), record("2026-09-19", 60)];
    const sessions = [
      session("2026-09-17T10:00:00", 50),
      session("2026-09-18T10:00:00", 55),
      session("2026-09-19T10:00:00", 55),
    ];
    const phrase = describePlanningAccuracy(computePlanningAccuracy(plans, sessions, 5, NOW))!;
    expect(phrase).toContain("du temps prévu a été réalisé");
    expect(phrase).not.toMatch(/tu n'as|seulement|que /i);
  });

  it("un dépassement est traité comme un écart de prévision, pas comme un exploit", () => {
    const plans = [record("2026-09-17", 30), record("2026-09-18", 30), record("2026-09-19", 30)];
    const sessions = [
      session("2026-09-17T10:00:00", 60),
      session("2026-09-18T10:00:00", 60),
      session("2026-09-19T10:00:00", 60),
    ];
    const phrase = describePlanningAccuracy(computePlanningAccuracy(plans, sessions, 5, NOW))!;
    expect(phrase).toContain("plus que ce que tu planifies");
  });

  it("le bilan de semaine s'arrête à hier — une journée en cours n'est pas un écart", () => {
    const plans = [record("2026-09-20", 120)];
    const accuracy = computeWeekPlanVsActual(plans, [session("2026-09-20T10:00:00", 30)], NOW);
    expect(accuracy.days.some((day) => day.key === "2026-09-20")).toBe(false);
  });
});

/* ═══════════════════════ MAÎTRISE ═══════════════════════ */

describe("maîtrise", () => {
  const snapshot = (weekStart: string, rate: number): WeekSnapshot => ({
    weekStart,
    capturedAt: weekStart,
    totalSeconds: 0,
    bySubject: [],
    activeCount: 10,
    masteredCount: rate / 10,
    completionRate: rate,
    bySubjectProgress: [{ subject: "Mathématiques", total: 10, mastered: rate / 10, completionRate: rate }],
  });

  it("la série se termine par la mesure du JOUR, pas par le dernier instantané", () => {
    const exercises = [exercise("a", { status: "maîtrisé" }), exercise("b")];
    const trend = computeMasteryTrend(
      "Mathématiques",
      [snapshot("2026-09-07T00:00:00.000Z", 20), snapshot("2026-09-14T00:00:00.000Z", 30)],
      exercises,
      NOW
    );
    expect(trend.currentRate).toBe(50);
    expect(trend.points[trend.points.length - 1].rate).toBe(50);
    expect(trend.trend.direction).toBe("hausse");
  });

  it("aucun instantané : un seul point, donc aucune tendance", () => {
    const trend = computeMasteryTrend("Mathématiques", [], [exercise("a")], NOW);
    expect(trend.points).toHaveLength(1);
    expect(trend.trend.direction).toBe("insuffisant");
  });

  it("une matière absente d'un instantané n'y crée pas un point à zéro", () => {
    const trend = computeMasteryTrend("Physique", [snapshot("2026-09-07T00:00:00.000Z", 20)], [exercise("a", { subject: "Physique" })], NOW);
    expect(trend.points).toHaveLength(1);
  });
});

describe("chapitres — un chapitre jamais commencé n'est PAS un chapitre faible", () => {
  const chapters: Chapter[] = [
    { id: "c1", subject: "Mathématiques", label: "Intégration" },
    { id: "c2", subject: "Mathématiques", label: "Probabilités" },
  ];

  it("sépare le non mesuré du fragile", () => {
    const exercises = [
      exercise("a", { chapter_id: "c1", mastery: 25, attempts: 2, last_worked_at: "2026-09-14T00:00:00.000Z" }),
      exercise("b", { chapter_id: "c2" }),
    ];
    const board = computeChapterMastery(exercises, chapters);
    expect(board.fragile.map((row) => row.chapter.label)).toEqual(["Intégration"]);
    expect(board.untouched.map((row) => row.chapter.label)).toEqual(["Probabilités"]);
  });

  it("un chapitre acquis rejoint les solides, pas les fragiles", () => {
    const exercises = [exercise("a", { chapter_id: "c1", mastery: 100, status: "maîtrisé", attempts: 3, last_worked_at: "2026-09-14T00:00:00.000Z" })];
    const board = computeChapterMastery(exercises, chapters);
    expect(board.solid.map((row) => row.chapter.label)).toEqual(["Intégration"]);
    expect(board.fragile).toEqual([]);
  });

  it("aucun exercice : les trois listes sont vides, aucune conclusion", () => {
    const board = computeChapterMastery([], chapters);
    expect(board.fragile).toEqual([]);
    expect(board.solid).toEqual([]);
    expect(board.untouched).toEqual([]);
  });
});
