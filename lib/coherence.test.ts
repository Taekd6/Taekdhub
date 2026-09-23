import { describe, expect, it } from "vitest";
import { computeWeeklySummary } from "@/lib/week";
import { computeWeeklyReview } from "@/lib/weekly-review";
import { computeWeeklyComparison } from "@/lib/analytics/work-time";
import { computeDailyObjective } from "@/lib/daily-objective";
import { normalizePreferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * COHÉRENCE ENTRE ÉCRANS.
 *
 * Ces tests ne vérifient pas qu'un calcul est juste — chaque module a déjà les
 * siens. Ils vérifient que DEUX écrans qui montrent le même fait montrent le
 * même nombre. C'est une classe de défaut que les tests par module ne peuvent
 * pas attraper par construction, et c'est celle que l'élève voit en premier :
 * l'accueil et Progression ouverts côte à côte, deux chiffres différents.
 */

/** Mardi 15 septembre 2026, midi. */
const NOW = new Date("2026-09-15T12:00:00");
const prefs = normalizePreferences({});

function session(startedAt: string, minutes: number): WorkSession {
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
  };
}

describe("« cette semaine » vaut la même chose sur l'accueil et sur Progression", () => {
  /**
   * Une séance datée DANS LE FUTUR n'a rien d'exotique : horloge de l'appareil
   * décalée, sauvegarde importée depuis une machine en avance, retour de
   * voyage. `computeWeeklyReview` et `computeWeeklyComparison` la filtraient,
   * `computeWeeklySummary` non — et l'accueil annonçait 5 h 30 quand
   * Progression annonçait 1 h 30.
   */
  const sessions = [
    session("2026-09-14T09:00:00", 60), // lundi, passé
    session("2026-09-15T09:00:00", 30), // aujourd'hui, passé
    session("2026-09-15T23:00:00", 90), // aujourd'hui, PLUS TARD
    session("2026-09-17T09:00:00", 150), // jeudi, à venir
  ];

  it("l'accueil ne compte plus le travail qui n'a pas encore eu lieu", () => {
    expect(Math.round(computeWeeklySummary(sessions, 300, NOW).totalSeconds / 60)).toBe(90);
  });

  it("les trois modules donnent le même total", () => {
    const accueil = Math.round(computeWeeklySummary(sessions, 300, NOW).totalSeconds / 60);
    const bilan = computeWeeklyReview([], sessions, prefs, NOW).totalMinutes;
    const rythme = computeWeeklyComparison(sessions, NOW).currentMinutes;
    expect(new Set([accueil, bilan, rythme]).size).toBe(1);
  });

  it("le pourcentage d'objectif suit le même total", () => {
    expect(computeWeeklySummary(sessions, 300, NOW).progressPercent).toBe(30);
  });
});

describe("« l'objectif du jour » ne se remplit pas tout seul", () => {
  it("une séance datée ce soir ne compte pas à midi", () => {
    const objective = computeDailyObjective([session("2026-09-15T23:00:00", 90)], 60, NOW);
    expect(objective.workedMinutes).toBe(0);
    expect(objective.percent).toBe(0);
    expect(objective.met).toBe(false);
  });

  it("une séance déjà passée dans la journée compte normalement", () => {
    const objective = computeDailyObjective([session("2026-09-15T09:00:00", 30)], 60, NOW);
    expect(objective.workedMinutes).toBe(30);
    expect(objective.percent).toBe(50);
  });
});
