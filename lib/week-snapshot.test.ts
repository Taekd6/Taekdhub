import { describe, expect, it } from "vitest";
import { captureWeekSnapshot, compareToPreviousWeek, findMissingSnapshotWeekStart, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import type { WeekSnapshot } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Mercredi 23 septembre 2026, 18 h : semaine en cours = lundi 21 → dimanche 27. */
const NOW = new Date("2026-09-23T18:00:00");
const THIS_MONDAY = new Date("2026-09-21T00:00:00");
const LAST_MONDAY = new Date("2026-09-14T00:00:00");

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

function snapshot(weekStart: Date, totalMinutes: number): WeekSnapshot {
  return { weekStart: weekStart.toISOString(), capturedAt: NOW.toISOString(), totalSeconds: totalMinutes * 60, bySubject: [] };
}

describe("findMissingSnapshotWeekStart — quelle semaine figer", () => {
  it("fige la semaine précédente quand du travail existait avant cette semaine", () => {
    const sessions = [session("2026-09-16T10:00:00", 60)];
    expect(findMissingSnapshotWeekStart(sessions, [], NOW)?.toISOString()).toBe(LAST_MONDAY.toISOString());
  });

  it("ne fige rien pour un tout nouvel élève (aucune séance avant cette semaine)", () => {
    const sessions = [session("2026-09-22T10:00:00", 60)];
    expect(findMissingSnapshotWeekStart(sessions, [], NOW)).toBeNull();
    expect(findMissingSnapshotWeekStart([], [], NOW)).toBeNull();
  });

  it("ne crée jamais de doublon : semaine déjà figée ⇒ rien", () => {
    const sessions = [session("2026-09-16T10:00:00", 60)];
    expect(findMissingSnapshotWeekStart(sessions, [snapshot(LAST_MONDAY, 60)], NOW)).toBeNull();
  });

  it("une séance très ancienne suffit, même si la semaine dernière était vide", () => {
    const sessions = [session("2026-08-01T10:00:00", 30)];
    expect(findMissingSnapshotWeekStart(sessions, [], NOW)?.toISOString()).toBe(LAST_MONDAY.toISOString());
  });
});

describe("captureWeekSnapshot — figer le temps d'une semaine", () => {
  const sessions = [
    session("2026-09-14T08:00:00", 90, "Mathématiques"), // lundi, première minute de la semaine
    session("2026-09-20T23:30:00", 30, "Physique"), // dimanche soir, encore dans la semaine
    session("2026-09-21T00:00:00", 45, "Physique"), // lundi suivant : exclu
    session("2026-09-13T23:59:00", 20, "Chimie"), // dimanche précédent : exclu
  ];

  it("ne compte que les séances de [lundi 00:00, lundi suivant 00:00)", () => {
    const result = captureWeekSnapshot(sessions, LAST_MONDAY, NOW);
    expect(result.weekStart).toBe(LAST_MONDAY.toISOString());
    expect(result.capturedAt).toBe(NOW.toISOString());
    expect(result.totalSeconds).toBe(120 * 60);
  });

  it("ventile par matière, toutes les matières présentes (0 si rien)", () => {
    const result = captureWeekSnapshot(sessions, LAST_MONDAY, NOW);
    const bySubject = Object.fromEntries(result.bySubject.map((entry) => [entry.subject, entry.seconds]));
    expect(bySubject["Mathématiques"]).toBe(90 * 60);
    expect(bySubject["Physique"]).toBe(30 * 60);
    expect(bySubject["Chimie"]).toBe(0);
    expect(result.bySubject.reduce((sum, entry) => sum + entry.seconds, 0)).toBe(result.totalSeconds);
  });

  it("ne modifie pas la liste des séances", () => {
    const before = JSON.stringify(sessions);
    captureWeekSnapshot(sessions, LAST_MONDAY, NOW);
    expect(JSON.stringify(sessions)).toBe(before);
  });
});

describe("findPreviousWeekSnapshot et compareToPreviousWeek", () => {
  it("retrouve l'instantané de la semaine précédente, et seulement celui-là", () => {
    const older = snapshot(new Date("2026-09-07T00:00:00"), 300);
    const previous = snapshot(LAST_MONDAY, 600);
    expect(findPreviousWeekSnapshot([older, previous], NOW)).toBe(previous);
    expect(findPreviousWeekSnapshot([older], NOW)).toBeNull();
  });

  it("compare la semaine en cours (en direct) à l'instantané figé", () => {
    const sessions = [session("2026-09-21T09:00:00", 120), session("2026-09-23T09:00:00", 60), session("2026-09-16T09:00:00", 999)];
    const comparison = compareToPreviousWeek(sessions, snapshot(LAST_MONDAY, 240), NOW);
    expect(comparison.currentTotalSeconds).toBe(180 * 60);
    expect(comparison.deltaTotalSeconds).toBe(-60 * 60);
  });

  it("le lundi de cette semaine est bien celui attendu (garde-fou des dates)", () => {
    expect(new Date(LAST_MONDAY.getTime() + 7 * 86_400_000).toISOString()).toBe(THIS_MONDAY.toISOString());
  });
});
