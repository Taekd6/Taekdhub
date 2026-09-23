import { describe, expect, it } from "vitest";
import { ringSegments, todayBySubject, weekDayStacks } from "@/lib/day-stack";
import { todaySeconds } from "@/lib/study";
import { weeklyTimeBySubject } from "@/lib/week";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Mercredi 23 septembre 2026, 18 h — lundi et mardi écoulés, jeudi → dimanche à venir. */
const NOW = new Date("2026-09-23T18:00:00");

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

const SESSIONS = [
  session("2026-09-21T09:00:00", 60, "Mathématiques"),
  session("2026-09-21T14:00:00", 30, "Anglais"),
  session("2026-09-22T10:00:00", 45, "Physique"),
  session("2026-09-23T08:00:00", 20, "Anglais"),
  session("2026-09-23T16:00:00", 40, "Mathématiques"),
  // Plus tard aujourd'hui : pas encore commencée, donc hors du compte.
  session("2026-09-23T21:00:00", 90, "Chimie"),
  // Semaine précédente : hors du compte.
  session("2026-09-20T10:00:00", 120, "Français"),
];

describe("todayBySubject", () => {
  it("répartit le temps d'aujourd'hui par matière, dans l'ordre des matières", () => {
    expect(todayBySubject(SESSIONS, NOW)).toEqual([
      { subject: "Mathématiques", seconds: 2400 },
      { subject: "Anglais", seconds: 1200 },
    ]);
  });

  it("additionne exactement le même total que l'objectif du jour", () => {
    const sum = todayBySubject(SESSIONS, NOW).reduce((total, entry) => total + entry.seconds, 0);
    expect(sum).toBe(todaySeconds(SESSIONS, NOW));
  });

  it("rien aujourd'hui → aucune entrée", () => {
    expect(todayBySubject([session("2026-09-21T09:00:00", 60)], NOW)).toEqual([]);
  });
});

describe("weekDayStacks", () => {
  const days = weekDayStacks(SESSIONS, NOW);

  it("donne toujours sept jours, du lundi au dimanche", () => {
    expect(days.map((day) => day.key)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(days.map((day) => day.label).join("")).toBe("LMMJVSD");
  });

  it("empile chaque jour par matière", () => {
    expect(days[0].segments).toEqual([
      { subject: "Mathématiques", seconds: 3600 },
      { subject: "Anglais", seconds: 1800 },
    ]);
    expect(days[0].totalSeconds).toBe(5400);
    expect(days[1].segments).toEqual([{ subject: "Physique", seconds: 2700 }]);
  });

  it("marque aujourd'hui et les jours à venir", () => {
    expect(days[2].isToday).toBe(true);
    expect(days.filter((day) => day.isFuture).map((day) => day.label)).toEqual(["J", "V", "S", "D"]);
  });

  it("exclut une séance d'aujourd'hui pas encore commencée et la semaine précédente — comme lib/week.ts", () => {
    expect(days[2].totalSeconds).toBe(3600);
    const weekTotal = days.reduce((sum, day) => sum + day.totalSeconds, 0);
    const reference = weeklyTimeBySubject(SESSIONS, NOW).reduce((sum, entry) => sum + entry.seconds, 0);
    expect(weekTotal).toBe(reference);
  });

  it("porte un libellé long lisible", () => {
    expect(days[0].longLabel).toMatch(/lundi 21 septembre/);
  });
});

describe("ringSegments", () => {
  it("sous l'objectif, chaque matière occupe sa part de l'objectif", () => {
    const segments = ringSegments(
      [
        { subject: "Mathématiques", seconds: 1800 },
        { subject: "Anglais", seconds: 900 },
      ],
      3600
    );
    expect(segments).toEqual([
      { subject: "Mathématiques", start: 0, length: 0.5 },
      { subject: "Anglais", start: 0.5, length: 0.25 },
    ]);
  });

  it("au-delà de l'objectif, l'anneau se ferme et reste proportionné", () => {
    const segments = ringSegments(
      [
        { subject: "Mathématiques", seconds: 3600 },
        { subject: "Anglais", seconds: 3600 },
      ],
      3600
    );
    expect(segments[0].length).toBeCloseTo(0.5);
    expect(segments[1].start).toBeCloseTo(0.5);
    expect(segments[1].length).toBeCloseTo(0.5);
  });

  it("l'écart n'est retiré qu'aux segments assez longs pour le porter", () => {
    const segments = ringSegments(
      [
        { subject: "Mathématiques", seconds: 1800 },
        { subject: "Anglais", seconds: 30 },
      ],
      3600,
      0.02
    );
    expect(segments[0].length).toBeCloseTo(0.48);
    expect(segments[1].length).toBeGreaterThan(0);
  });

  it("rien de travaillé → aucun segment, et un objectif nul ne divise pas par zéro", () => {
    expect(ringSegments([], 3600)).toEqual([]);
    expect(ringSegments([{ subject: "Chimie", seconds: 600 }], 0)).toEqual([{ subject: "Chimie", start: 0, length: 1 }]);
  });
});
