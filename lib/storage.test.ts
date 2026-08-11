import { describe, expect, it } from "vitest";
import { normalizePreferences, normalizeSession, validateBackupPayload } from "@/lib/storage";
import type { AttemptResult, WorkSession } from "@/lib/supabase/types";

/**
 * Sprint 5 (Phase 7, explicitement marquée "TRÈS IMPORTANT" par l'énoncé) :
 * vérifie que `WorkSession.result` traverse un cycle export → JSON → import
 * sans perte, ET que les séances antérieures à ce champ (absent du JSON)
 * restent parfaitement valides, sans donnée inventée.
 */

function makeRawSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "s-1",
    subject: "Mathématiques",
    exercise_id: "ex-1",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T00:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-01-01T00:10:00.000Z",
    ...overrides,
  };
}

describe("normalizeSession — rétrocompatibilité de result", () => {
  it("normalise result à null pour une séance qui n'a jamais eu ce champ (pré-Sprint 5)", () => {
    const raw = makeRawSession();
    expect("result" in raw).toBe(false);
    const session = normalizeSession(raw);
    expect(session.result).toBeNull();
    // Rien d'autre n'est perdu ou altéré au passage.
    expect(session.id).toBe("s-1");
    expect(session.duration_seconds).toBe(600);
  });

  it("conserve chacune des trois valeurs valides de result", () => {
    (["réussi", "partiel", "échoué"] as AttemptResult[]).forEach((result) => {
      const session = normalizeSession(makeRawSession({ result }));
      expect(session.result).toBe(result);
    });
  });

  it("retombe sur null pour une valeur de result invalide ou corrompue", () => {
    expect(normalizeSession(makeRawSession({ result: "en cours" })).result).toBeNull();
    expect(normalizeSession(makeRawSession({ result: 42 })).result).toBeNull();
    expect(normalizeSession(makeRawSession({ result: null })).result).toBeNull();
  });
});

describe("export → JSON → import — round-trip complet (Phase 7)", () => {
  it("un backup avec des résultats renseignés survit intact à un cycle stringify/parse/normalize", () => {
    const sessions: WorkSession[] = [
      { ...normalizeSession(makeRawSession({ id: "s-1", result: "réussi" })) },
      { ...normalizeSession(makeRawSession({ id: "s-2", result: "échoué" })) },
      // Séance libre, antérieure au champ : aucun result, jamais deviné.
      { ...normalizeSession(makeRawSession({ id: "s-3", exercise_id: null })) },
    ];

    const payload = {
      version: 1,
      exportedAt: "2026-08-10T00:00:00.000Z",
      exercises: [],
      sessions,
      preferences: { displayName: "", dailyGoalMinutes: 240, contestDate: "", accent: "#6366f1" },
      chapters: [],
      weekSnapshots: [],
    };

    // Le cycle réel : export sérialise en JSON, import reparse ce JSON.
    const roundTripped = JSON.parse(JSON.stringify(payload));

    expect(validateBackupPayload(roundTripped)).toBe(true);

    const restored = (roundTripped.sessions as unknown[]).map(normalizeSession);
    expect(restored).toHaveLength(3);
    expect(restored.find((s) => s.id === "s-1")?.result).toBe("réussi");
    expect(restored.find((s) => s.id === "s-2")?.result).toBe("échoué");
    expect(restored.find((s) => s.id === "s-3")?.result).toBeNull();
    // Aucune autre donnée perdue en chemin.
    expect(restored.find((s) => s.id === "s-1")?.duration_seconds).toBe(600);
    expect(restored.find((s) => s.id === "s-1")?.exercise_id).toBe("ex-1");
  });

  it("un backup exporté avant l'introduction de result (aucune séance n'a le champ) reste valide et n'invente rien", () => {
    const legacySessions = [makeRawSession({ id: "s-old-1" }), makeRawSession({ id: "s-old-2" })];
    const payload = {
      version: 1,
      exportedAt: "2025-01-01T00:00:00.000Z",
      exercises: [],
      sessions: legacySessions,
      preferences: { displayName: "", dailyGoalMinutes: 240, contestDate: "", accent: "#6366f1" },
    };

    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(validateBackupPayload(roundTripped)).toBe(true);

    const restored = (roundTripped.sessions as unknown[]).map(normalizeSession);
    expect(restored.every((s) => s.result === null)).toBe(true);
  });
});

/**
 * Sprint personnalisation (Phase 11, "rétrocompatibilité" explicitement
 * demandée) : une sauvegarde exportée avant `themeMode`/`weeklyGoalMinutes`
 * doit rester utilisable telle quelle, sans jamais planter ni imposer une
 * valeur incohérente à `applyThemeMode` (lib/theme.ts).
 */
describe("normalizePreferences — thème et rétrocompatibilité", () => {
  it("une préférence vide retombe entièrement sur les défauts (dont themeMode: \"system\")", () => {
    const prefs = normalizePreferences({});
    expect(prefs.themeMode).toBe("system");
    expect(prefs.weeklyGoalMinutes).toBe(300);
    expect(prefs.accent).toMatch(/^#/);
  });

  it("conserve un themeMode valide", () => {
    expect(normalizePreferences({ themeMode: "light" }).themeMode).toBe("light");
    expect(normalizePreferences({ themeMode: "dark" }).themeMode).toBe("dark");
  });

  it("retombe sur \"system\" pour un themeMode invalide ou corrompu", () => {
    expect(normalizePreferences({ themeMode: "bleu" }).themeMode).toBe("system");
    expect(normalizePreferences({ themeMode: 42 }).themeMode).toBe("system");
    expect(normalizePreferences({ themeMode: null }).themeMode).toBe("system");
  });

  it("une ancienne sauvegarde sans themeMode ni weeklyGoalMinutes reste valide et n'invente rien d'autre", () => {
    const legacy = { displayName: "Ancien utilisateur", dailyGoalMinutes: 120, contestDate: "", accent: "#6366f1" };
    const prefs = normalizePreferences(legacy);
    expect(prefs.displayName).toBe("Ancien utilisateur");
    expect(prefs.dailyGoalMinutes).toBe(120);
    expect(prefs.accent).toBe("#6366f1");
    expect(prefs.themeMode).toBe("system");
    expect(prefs.weeklyGoalMinutes).toBe(300);
  });
});
