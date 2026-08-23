import { describe, expect, it } from "vitest";
import { computeWeeklySummary, neglectedSubjects, sessionsInWeek, startOfWeek, weeklyTimeBySubject } from "@/lib/week";
import type { Exercise, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`,
    subject: "Mathématiques",
    title: `Exercice ${counter}`,
    statement: "",
    chapter_id: null,
    source: "Test",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    priority: 3 as Priority,
    mastery: 0 as Mastery,
    status: "à faire",
    estimated_minutes: null,
    attempts: 0,
    note: null,
    created_at: now,
    updated_at: now,
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

function makeSession(startedAt: string, subject: Subject = "Mathématiques", overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${startedAt}-${Math.random()}`,
    subject,
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: 600,
    note: null,
    created_at: startedAt,
    result: null,
    ...overrides,
  };
}

describe("startOfWeek", () => {
  it("un mercredi renvoie le lundi précédent à minuit", () => {
    const wednesday = new Date("2026-08-19T15:30:00.000Z"); // mercredi
    const start = startOfWeek(wednesday);
    expect(start.toISOString()).toBe("2026-08-17T00:00:00.000Z"); // lundi
  });

  it("un lundi renvoie le même jour à minuit (pas la semaine suivante ni précédente)", () => {
    const monday = new Date("2026-08-17T09:00:00.000Z");
    expect(startOfWeek(monday).toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("un dimanche renvoie le lundi PRÉCÉDENT (pas le suivant) — cas limite classique de getDay() === 0", () => {
    const sunday = new Date("2026-08-23T20:00:00.000Z"); // dimanche
    expect(startOfWeek(sunday).toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });
});

describe("sessionsInWeek / weeklyTimeBySubject", () => {
  const MONDAY_9AM = new Date("2026-08-17T09:00:00.000Z");

  it("une séance exactement à la borne de début (lundi 00:00) est incluse", () => {
    const sessions = [makeSession("2026-08-17T00:00:00.000Z")];
    expect(sessionsInWeek(sessions, startOfWeek(MONDAY_9AM))).toHaveLength(1);
  });

  it("une séance à la borne de fin (lundi suivant 00:00, exclusive) n'est PAS incluse", () => {
    const sessions = [makeSession("2026-08-24T00:00:00.000Z")];
    expect(sessionsInWeek(sessions, startOfWeek(MONDAY_9AM))).toHaveLength(0);
  });

  it("additionne correctement le temps par matière, 0 pour une matière sans séance cette semaine", () => {
    const sessions = [
      makeSession("2026-08-18T09:00:00.000Z", "Mathématiques", { duration_seconds: 600 }),
      makeSession("2026-08-19T09:00:00.000Z", "Mathématiques", { duration_seconds: 300 }),
      makeSession("2026-08-10T09:00:00.000Z", "Physique", { duration_seconds: 900 }), // semaine précédente, exclue
    ];
    const bySubject = weeklyTimeBySubject(sessions, MONDAY_9AM);
    expect(bySubject.find((e) => e.subject === "Mathématiques")?.seconds).toBe(900);
    expect(bySubject.find((e) => e.subject === "Physique")?.seconds).toBe(0);
  });
});

describe("neglectedSubjects", () => {
  it("aucun signal avant mercredi (moins de 2 jours pleins écoulés depuis lundi), même avec des exercices en attente", () => {
    const tuesday = new Date("2026-08-18T23:00:00.000Z"); // mardi
    const exercises = [makeExercise({ subject: "Physique", status: "à faire" })];
    expect(neglectedSubjects(exercises, [], tuesday)).toEqual([]);
  });

  it("à partir de mercredi, une matière avec du travail en attente et 0 seconde cette semaine est signalée", () => {
    const wednesday = new Date("2026-08-19T09:00:00.000Z");
    const exercises = [makeExercise({ subject: "Physique", status: "à faire" })];
    const neglected = neglectedSubjects(exercises, [], wednesday);
    expect(neglected.map((e) => e.subject)).toContain("Physique");
  });

  it("une matière déjà travaillée cette semaine n'est jamais signalée, même avec du travail en attente", () => {
    const wednesday = new Date("2026-08-19T09:00:00.000Z");
    const exercises = [makeExercise({ subject: "Physique", status: "à faire" })];
    const sessions = [makeSession("2026-08-18T09:00:00.000Z", "Physique")];
    expect(neglectedSubjects(exercises, sessions, wednesday)).toEqual([]);
  });

  it("une matière entièrement maîtrisée n'est jamais signalée (rien n'attend)", () => {
    const wednesday = new Date("2026-08-19T09:00:00.000Z");
    const exercises = [makeExercise({ subject: "Chimie", status: "maîtrisé", mastery: 100 })];
    expect(neglectedSubjects(exercises, [], wednesday)).toEqual([]);
  });
});

describe("computeWeeklySummary", () => {
  it("objectif à 0 minute : pourcentage à 0, jamais une division par zéro", () => {
    const summary = computeWeeklySummary([], [], 0, new Date("2026-08-19T09:00:00.000Z"));
    expect(summary.progressPercent).toBe(0);
  });

  it("le pourcentage est plafonné à 100 même si l'objectif est dépassé", () => {
    const now = new Date("2026-08-19T09:00:00.000Z");
    const sessions = [makeSession("2026-08-18T09:00:00.000Z", "Mathématiques", { duration_seconds: 36000 })]; // 10h
    const summary = computeWeeklySummary([], sessions, 60, now); // objectif 1h
    expect(summary.progressPercent).toBe(100);
  });
});
