import { describe, expect, it } from "vitest";
import {
  computeGradesByKind,
  computeGradesBySubject,
  computePeriodTotals,
  computeRegularity,
  computeSubjectTracking,
  computeTrackingOverview,
  granularityFor,
  PERIOD_DAYS,
} from "@/lib/tracking";
import type { Grade } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Dimanche 20 septembre 2026, 20 h — la fin d'une semaine, pour que « semaine en cours » soit complète. */
const NOW = new Date("2026-09-20T20:00:00");

function session(startedAt: string, minutes: number, subject: Subject = "Mathématiques"): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject,
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

function grade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    title: "DS",
    kind: "ds",
    score: 14,
    maxScore: 20,
    date: "2026-09-10",
    createdAt: "2026-09-10T18:00:00.000Z",
    ...overrides,
  };
}

/** Une séance de `minutes` le jour J − `offset`. */
function daysBefore(offset: number, minutes: number, subject: Subject = "Mathématiques"): WorkSession {
  const date = new Date(NOW);
  date.setDate(date.getDate() - offset);
  date.setHours(10, 0, 0, 0);
  return session(date.toISOString(), minutes, subject);
}

/* ══════════════════════════════════════════════════════════════════
   TOTAUX PAR PÉRIODE
   ══════════════════════════════════════════════════════════════════ */

describe("totaux d'une période", () => {
  const sessions = [
    daysBefore(0, 60),
    daysBefore(1, 30),
    daysBefore(3, 90),
    daysBefore(10, 120), // hors 7 jours, dans 30
    daysBefore(40, 60), // hors 30 jours, dans 3 mois
  ];

  it("additionne le temps des 7 derniers jours, et lui seul", () => {
    expect(computePeriodTotals(sessions, "7j", NOW).minutes).toBe(180);
  });

  it("des 30 derniers jours", () => {
    expect(computePeriodTotals(sessions, "30j", NOW).minutes).toBe(300);
  });

  it("des 3 derniers mois", () => {
    expect(computePeriodTotals(sessions, "3mois", NOW).minutes).toBe(360);
  });

  it("la moyenne quotidienne porte sur les jours CALENDAIRES de la période", () => {
    // 180 min sur 7 jours, pas sur les 3 jours travaillés.
    expect(computePeriodTotals(sessions, "7j", NOW).dailyAverage).toBe(26);
  });

  it("compte les jours réellement travaillés", () => {
    expect(computePeriodTotals(sessions, "7j", NOW).activeDays).toBe(3);
  });

  it("une journée de moins d'une minute ne compte pas comme travaillée", () => {
    expect(computePeriodTotals([daysBefore(1, 0.4)], "7j", NOW).activeDays).toBe(0);
  });

  it("compare à la période PRÉCÉDENTE de même longueur", () => {
    // Fenêtre précédente = [J−14, J−7] : elle contient le J−10 du jeu de base
    // (120 min) plus les deux ajoutés ici.
    const withPast = [...sessions, daysBefore(9, 60), daysBefore(12, 60)];
    const totals = computePeriodTotals(withPast, "7j", NOW);
    expect(totals.previousMinutes).toBe(240);
    expect(totals.minutes).toBe(180);
    expect(totals.deltaMinutes).toBe(-60);
    expect(totals.deltaPercent).toBe(-25);
  });

  it("aucun pourcentage quand la période précédente est VIDE — un démarrage n'est pas « +100 % »", () => {
    const totals = computePeriodTotals([daysBefore(1, 60)], "7j", NOW);
    expect(totals.previousMinutes).toBe(0);
    expect(totals.deltaPercent).toBeNull();
  });

  it("une barre par jour jusqu'à un mois, par semaine au-delà", () => {
    expect(granularityFor("7j")).toBe("jour");
    expect(granularityFor("30j")).toBe("jour");
    expect(granularityFor("3mois")).toBe("semaine");
    expect(computePeriodTotals(sessions, "7j", NOW).points).toHaveLength(PERIOD_DAYS["7j"]);
  });

  it("sans aucune séance, tout vaut zéro et rien n'est comparé", () => {
    const totals = computePeriodTotals([], "30j", NOW);
    expect(totals.minutes).toBe(0);
    expect(totals.activeDays).toBe(0);
    expect(totals.deltaPercent).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════
   VUE D'ENSEMBLE
   ══════════════════════════════════════════════════════════════════ */

describe("vue d'ensemble", () => {
  const sessions = [daysBefore(0, 45), daysBefore(2, 60), daysBefore(25, 90)];

  it("sépare aujourd'hui, la semaine et le mois", () => {
    const overview = computeTrackingOverview(sessions, NOW);
    expect(overview.todayMinutes).toBe(45);
    expect(overview.weekMinutes).toBe(105);
    expect(overview.monthMinutes).toBe(105);
  });

  it("le dénominateur des jours travaillés est le nombre de jours ÉCOULÉS de la semaine", () => {
    // NOW est un dimanche : 7 jours écoulés.
    expect(computeTrackingOverview(sessions, NOW).elapsedDaysThisWeek).toBe(7);
    const mardi = new Date("2026-09-15T12:00:00");
    expect(computeTrackingOverview(sessions, mardi).elapsedDaysThisWeek).toBe(2);
  });

  it("aucune tendance affirmée sans historique", () => {
    expect(computeTrackingOverview([daysBefore(0, 45)], NOW).trend.direction).toBe("insuffisant");
  });

  it("un compte vierge ne produit que des zéros mesurés, sans tendance", () => {
    const overview = computeTrackingOverview([], NOW);
    expect(overview.todayMinutes).toBe(0);
    expect(overview.streak).toBe(0);
    expect(overview.trend.direction).toBe("insuffisant");
  });
});

/* ══════════════════════════════════════════════════════════════════
   RÉPARTITION PAR MATIÈRE
   ══════════════════════════════════════════════════════════════════ */

describe("répartition du temps par matière", () => {
  const sessions = [daysBefore(1, 120, "Mathématiques"), daysBefore(2, 60, "Physique"), daysBefore(9, 60, "Mathématiques")];

  it("ventile le temps de la période par matière", () => {
    const rows = computeSubjectTracking(sessions, "7j", NOW);
    expect(rows.find((r) => r.subject === "Mathématiques")?.minutes).toBe(120);
    expect(rows.find((r) => r.subject === "Physique")?.minutes).toBe(60);
  });

  it("les pourcentages portent sur le temps de la période", () => {
    const rows = computeSubjectTracking(sessions, "7j", NOW);
    expect(rows.find((r) => r.subject === "Mathématiques")?.percent).toBe(67);
  });

  it("compare à la période précédente, matière par matière", () => {
    const rows = computeSubjectTracking(sessions, "7j", NOW);
    const maths = rows.find((r) => r.subject === "Mathématiques");
    expect(maths?.previousMinutes).toBe(60);
    expect(maths?.deltaMinutes).toBe(60);
  });

  it("n'affiche pas une matière sans temps", () => {
    const rows = computeSubjectTracking(sessions, "7j", NOW);
    expect(rows.map((r) => r.subject)).toEqual(["Mathématiques", "Physique"]);
  });

});

/* ══════════════════════════════════════════════════════════════════
   RÉGULARITÉ
   ══════════════════════════════════════════════════════════════════ */

describe("régularité", () => {
  it("la moyenne par jour TRAVAILLÉ diffère de la moyenne par jour calendaire", () => {
    const sessions = [daysBefore(0, 60), daysBefore(1, 60)];
    const stats = computeRegularity(sessions, "7j", NOW);
    expect(stats.activeDays).toBe(2);
    expect(stats.averagePerActiveDay).toBe(60);
    expect(computePeriodTotals(sessions, "7j", NOW).dailyAverage).toBe(17);
  });

  it("aucune « meilleure » ni « pire » semaine avec une seule semaine comparable", () => {
    const stats = computeRegularity([daysBefore(1, 60)], "30j", NOW);
    expect(stats.best).toBeNull();
    expect(stats.worst).toBeNull();
  });

  it("avec plusieurs semaines complètes, la meilleure et la pire sont réellement distinguées", () => {
    const sessions = [daysBefore(8, 300), daysBefore(15, 60), daysBefore(22, 120)];
    const stats = computeRegularity(sessions, "3mois", NOW);
    expect(stats.best?.minutes).toBe(300);
    expect(stats.worst?.minutes).toBe(60);
  });

  it("sans aucune séance, rien n'est affirmé", () => {
    const stats = computeRegularity([], "7j", NOW);
    expect(stats.activeDays).toBe(0);
    expect(stats.averagePerActiveDay).toBe(0);
    expect(stats.best).toBeNull();
    expect(stats.trend.direction).toBe("insuffisant");
  });
});

/* ══════════════════════════════════════════════════════════════════
   NOTES
   ══════════════════════════════════════════════════════════════════ */

describe("notes par nature et par matière", () => {
  const grades = [
    grade({ kind: "ds", score: 14, date: "2026-09-10" }),
    grade({ kind: "ds", score: 10, date: "2026-09-03" }),
    grade({ kind: "colle", score: 18, date: "2026-09-08" }),
    grade({ kind: "dm", score: 17, date: "2026-09-05", subject: "Physique" }),
  ];

  it("chaque nature garde sa moyenne — un DM à 17 ne remonte pas la moyenne des DS", () => {
    const byKind = computeGradesByKind(grades);
    expect(byKind.find((k) => k.kind === "ds")?.stats.average).toBe(12);
    expect(byKind.find((k) => k.kind === "colle")?.stats.average).toBe(18);
    expect(byKind.find((k) => k.kind === "dm")?.stats.average).toBe(17);
  });

  it("les natures sortent dans l'ordre du modèle", () => {
    expect(computeGradesByKind(grades).map((k) => k.kind)).toEqual(["ds", "dm", "colle"]);
  });

  it("aucune nature sans note", () => {
    expect(computeGradesByKind([]).length).toBe(0);
  });

  it("la vue par matière peut être bornée à une nature", () => {
    const toutes = computeGradesBySubject(grades);
    expect(toutes.map((r) => r.subject)).toEqual(["Mathématiques", "Physique"]);
    const seulementDS = computeGradesBySubject(grades, "ds");
    expect(seulementDS.map((r) => r.subject)).toEqual(["Mathématiques"]);
  });

  it("aucune tendance sur une note unique", () => {
    const une = computeGradesBySubject([grade()]);
    expect(une[0].trend.direction).toBe("insuffisant");
  });

  it("aucune ligne pour une matière sans note", () => {
    expect(computeGradesBySubject([]).length).toBe(0);
  });
});
