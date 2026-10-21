import { describe, expect, it } from "vitest";
import { ageLabel, computeDataHealth } from "@/lib/data-health";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ExerciseAttempt } from "@/lib/attempts";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date("2026-10-21T14:00:00");

const session = (day: string): WorkSession =>
  ({ id: day, subject: "Mathématiques", exercise_id: null, started_at: `${day}T10:00:00`, ended_at: null, duration_seconds: 600, note: null, created_at: `${day}T10:00:00`, result: null, hints_used: null, work_item_id: null }) as WorkSession;
const attempt = (day: string) => ({ id: day, day }) as ExerciseAttempt;
const anki = (takenAt: string, due = 12): AnkiSnapshot =>
  ({ id: "anki:x", day: takenAt.slice(0, 10), takenAt, source: "ankiconnect", decks: [{ due } as never], reviewsByDay: [], manual: null }) as AnkiSnapshot;

const byId = (lines: ReturnType<typeof computeDataHealth>) => Object.fromEntries(lines.map((line) => [line.id, line]));

describe("computeDataHealth", () => {
  it("tout est « vide » sans aucune donnée, avec un geste à faire pour chaque ligne", () => {
    const lines = computeDataHealth({ sessions: [], attempts: [], ankiSnapshots: [], now: NOW });
    expect(lines.map((line) => line.status)).toEqual(["vide", "vide", "vide"]);
    expect(lines.every((line) => line.hint)).toBe(true);
  });

  it("des données fraîches : tout est « ok », sans geste demandé", () => {
    const lines = byId(computeDataHealth({ sessions: [session("2026-10-21")], attempts: [attempt("2026-10-20")], ankiSnapshots: [anki("2026-10-21T08:00:00")], now: NOW }));
    expect(lines.seances).toMatchObject({ status: "ok", detail: "Dernière séance : aujourd'hui.", hint: null });
    expect(lines.exercices).toMatchObject({ status: "ok", detail: "Dernier résultat : hier.", hint: null });
    expect(lines.anki).toMatchObject({ status: "ok", hint: null });
  });

  it("séances : « ok » à 2 jours, « ancien » à 3, d'après la dernière séance (pas la première)", () => {
    expect(byId(computeDataHealth({ sessions: [session("2026-10-01"), session("2026-10-19")], attempts: [], ankiSnapshots: [], now: NOW })).seances.status).toBe("ok");
    const stale = byId(computeDataHealth({ sessions: [session("2026-10-01"), session("2026-10-18")], attempts: [], ankiSnapshots: [], now: NOW })).seances;
    expect(stale).toMatchObject({ status: "ancien", detail: "Dernière séance : il y a 3 jours." });
    expect(stale.hint).toBeTruthy();
  });

  it("exercices : « ok » à 7 jours, « ancien » à 8", () => {
    expect(byId(computeDataHealth({ sessions: [], attempts: [attempt("2026-10-14")], ankiSnapshots: [], now: NOW })).exercices.status).toBe("ok");
    expect(byId(computeDataHealth({ sessions: [], attempts: [attempt("2026-10-13")], ankiSnapshots: [], now: NOW })).exercices.status).toBe("ancien");
  });

  it("Anki : « ancien » au-delà de 24 h, avec l'âge dit en heures puis en jours", () => {
    expect(byId(computeDataHealth({ sessions: [], attempts: [], ankiSnapshots: [anki("2026-10-21T02:00:00")], now: NOW })).anki).toMatchObject({ status: "ok", detail: "Dernier relevé : il y a 12 h." });
    const old = byId(computeDataHealth({ sessions: [], attempts: [], ankiSnapshots: [anki("2026-10-04T21:30:00")], now: NOW })).anki;
    expect(old).toMatchObject({ status: "ancien", detail: "Dernier relevé : il y a 16 jours." });
  });

  it("ageLabel", () => {
    expect([ageLabel(0), ageLabel(1), ageLabel(5)]).toEqual(["aujourd'hui", "hier", "il y a 5 jours"]);
  });
});
