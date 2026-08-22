import { afterEach, describe, expect, it, vi } from "vitest";
import { localData, normalizePreferences, normalizeSession, validateBackupPayload } from "@/lib/storage";
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

/**
 * Sprint planification hebdomadaire adaptative — `subjectDeadlines` doit
 * suivre exactement les mêmes garanties de rétrocompatibilité que
 * `weeklyGoalMinutes`/`themeMode` ci-dessus : absent → `{}`, jamais une
 * exception, jamais une clé/valeur inventée à partir de rien.
 */
describe("normalizePreferences — subjectDeadlines (rétrocompatibilité)", () => {
  it("absence de subjectDeadlines (préférence vide) → {}", () => {
    expect(normalizePreferences({})).toMatchObject({ subjectDeadlines: {} });
  });

  it("objet vide → {}", () => {
    expect(normalizePreferences({ subjectDeadlines: {} })).toMatchObject({ subjectDeadlines: {} });
  });

  it("une échéance valide pour une matière est conservée telle quelle", () => {
    const prefs = normalizePreferences({ subjectDeadlines: { Physique: "2026-09-21" } });
    expect(prefs.subjectDeadlines).toEqual({ Physique: "2026-09-21" });
  });

  it("plusieurs échéances, pour plusieurs matières, sont toutes conservées", () => {
    const prefs = normalizePreferences({
      subjectDeadlines: { Physique: "2026-09-21", Mathématiques: "2026-09-25", Chimie: "2026-09-18" },
    });
    expect(prefs.subjectDeadlines).toEqual({ Physique: "2026-09-21", Mathématiques: "2026-09-25", Chimie: "2026-09-18" });
  });

  it("une valeur invalide (pas une string, ou vide) est écartée silencieusement, sans planter", () => {
    expect(normalizePreferences({ subjectDeadlines: { Physique: 42, Chimie: "", Mathématiques: null } }).subjectDeadlines).toEqual({});
  });

  it("une clé qui n'est pas une matière connue est ignorée (jamais injectée telle quelle)", () => {
    const prefs = normalizePreferences({ subjectDeadlines: { "Matière Fantôme": "2026-09-21", Physique: "2026-09-21" } });
    expect(prefs.subjectDeadlines).toEqual({ Physique: "2026-09-21" });
  });

  it("subjectDeadlines n'étant pas un objet (corrompu) retombe sur {} sans planter", () => {
    expect(normalizePreferences({ subjectDeadlines: "pas un objet" }).subjectDeadlines).toEqual({});
    expect(normalizePreferences({ subjectDeadlines: null }).subjectDeadlines).toEqual({});
    expect(normalizePreferences({ subjectDeadlines: 42 }).subjectDeadlines).toEqual({});
  });

  it("migration d'une ancienne préférence sans subjectDeadlines : reste valide, {} par défaut, rien d'autre inventé", () => {
    const legacy = { displayName: "Ancien utilisateur", dailyGoalMinutes: 120, weeklyGoalMinutes: 300, contestDate: "", accent: "#6366f1" };
    const prefs = normalizePreferences(legacy);
    expect(prefs.subjectDeadlines).toEqual({});
    expect(prefs.displayName).toBe("Ancien utilisateur");
  });

  it("une date syntaxiquement invalide mais bien une string non vide est conservée telle quelle — même convention que contestDate : la validité de la date se vérifie à la lecture (lib/plan.ts#daysUntilContest), jamais ici", () => {
    const prefs = normalizePreferences({ subjectDeadlines: { Physique: "pas une date" } });
    expect(prefs.subjectDeadlines).toEqual({ Physique: "pas une date" });
  });
});

/**
 * Sprint Study OS (Aujourd'hui) — `dailySubjectGoals`/`dailyExerciseGoal`
 * suivent exactement les mêmes garanties de rétrocompatibilité que
 * `subjectDeadlines` ci-dessus : absent → valeur par défaut, jamais une
 * exception, jamais une valeur inventée à partir de rien.
 */
describe("normalizePreferences — dailySubjectGoals / dailyExerciseGoal", () => {
  it("absence des deux champs (préférence vide) → {} / null", () => {
    const prefs = normalizePreferences({});
    expect(prefs.dailySubjectGoals).toEqual({});
    expect(prefs.dailyExerciseGoal).toBeNull();
  });

  it("un objectif par matière valide (nombre positif) est conservé", () => {
    const prefs = normalizePreferences({ dailySubjectGoals: { Mathématiques: 90, Physique: 60 } });
    expect(prefs.dailySubjectGoals).toEqual({ Mathématiques: 90, Physique: 60 });
  });

  it("une valeur non numérique, nulle, ou ≤ 0 est écartée silencieusement, sans planter", () => {
    expect(normalizePreferences({ dailySubjectGoals: { Physique: "90", Chimie: 0, Mathématiques: -5, Anglais: null } }).dailySubjectGoals).toEqual({});
  });

  it("une clé qui n'est pas une matière connue est ignorée", () => {
    const prefs = normalizePreferences({ dailySubjectGoals: { "Matière Fantôme": 60, Physique: 60 } });
    expect(prefs.dailySubjectGoals).toEqual({ Physique: 60 });
  });

  it("dailySubjectGoals corrompu (pas un objet) retombe sur {} sans planter", () => {
    expect(normalizePreferences({ dailySubjectGoals: "pas un objet" }).dailySubjectGoals).toEqual({});
    expect(normalizePreferences({ dailySubjectGoals: null }).dailySubjectGoals).toEqual({});
  });

  it("dailyExerciseGoal valide (nombre positif) est conservé, arrondi", () => {
    expect(normalizePreferences({ dailyExerciseGoal: 5 }).dailyExerciseGoal).toBe(5);
    expect(normalizePreferences({ dailyExerciseGoal: 5.6 }).dailyExerciseGoal).toBe(6);
  });

  it("dailyExerciseGoal invalide (0, négatif, non numérique) retombe sur null — jamais 0 (ambigu avec \"objectif atteint d'office\")", () => {
    expect(normalizePreferences({ dailyExerciseGoal: 0 }).dailyExerciseGoal).toBeNull();
    expect(normalizePreferences({ dailyExerciseGoal: -3 }).dailyExerciseGoal).toBeNull();
    expect(normalizePreferences({ dailyExerciseGoal: "5" }).dailyExerciseGoal).toBeNull();
  });

  it("migration d'une ancienne préférence sans ces champs : reste valide, défauts appliqués, rien d'autre inventé", () => {
    const legacy = { displayName: "Ancien utilisateur", dailyGoalMinutes: 120, weeklyGoalMinutes: 300, contestDate: "", accent: "#6366f1" };
    const prefs = normalizePreferences(legacy);
    expect(prefs.dailySubjectGoals).toEqual({});
    expect(prefs.dailyExerciseGoal).toBeNull();
    expect(prefs.displayName).toBe("Ancien utilisateur");
  });
});

/**
 * Robustesse stockage (audit produit) : une écriture `localStorage` qui
 * échoue (quota dépassé, navigation privée…) ne doit jamais faire planter
 * l'appelant — voir `lib/storage.ts#safeSetItem`, seul point d'écriture.
 * `localStorage` est stubbé ici (absent de l'environnement de test Node,
 * voir vitest.config.ts) pour simuler les deux issues possibles.
 */
describe("localData.save* — robustesse d'écriture", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renvoie true et persiste quand l'écriture réussit", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    });
    expect(localData.saveSessions([])).toBe(true);
    expect(store.get("prepahub:sessions")).toBe("[]");
  });

  it("renvoie false sans jeter quand setItem échoue (quota dépassé)", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      getItem: () => null,
    });
    expect(() => localData.saveExercises([])).not.toThrow();
    expect(localData.saveExercises([])).toBe(false);
  });

  it("le même échec s'applique à chaque type de donnée (chapitres, préférences)", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("stockage indisponible");
      },
      getItem: () => null,
    });
    expect(localData.saveChapters([])).toBe(false);
    expect(localData.savePreferences(normalizePreferences({}))).toBe(false);
  });
});
