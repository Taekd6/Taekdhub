import { describe, expect, it } from "vitest";
import { localData, normalizePreferences, normalizeSession, validateBackupPayload, type ContestProgress } from "@/lib/storage";
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
    hints_used: null,
    ...overrides,
  };
}

describe("normalizeSession — dates corrompues (robustesse)", () => {
  /**
   * Régression : une date illisible traversait la normalisation, puis faisait
   * lever `RangeError: Invalid time value` au rendu — page BLANCHE sur toute
   * l'application, sans retour possible depuis l'interface, puisque les
   * données vivent dans le localStorage. Trouvé en test de destruction.
   */
  it("remplace une date de début illisible par une date valide plutôt que de la propager", () => {
    const session = normalizeSession(makeRawSession({ started_at: "pas-une-date" }));
    expect(Number.isNaN(new Date(session.started_at).getTime())).toBe(false);
  });

  it("ramène à null une date de fin illisible", () => {
    expect(normalizeSession(makeRawSession({ ended_at: "???" })).ended_at).toBeNull();
  });

  it("retombe sur started_at quand created_at est illisible", () => {
    const session = normalizeSession(makeRawSession({ created_at: "n'importe quoi" }));
    expect(session.created_at).toBe(session.started_at);
  });

  it("une durée non finie (NaN/Infinity) ne contamine jamais les totaux", () => {
    expect(normalizeSession(makeRawSession({ duration_seconds: Number.NaN })).duration_seconds).toBe(0);
    expect(normalizeSession(makeRawSession({ duration_seconds: Number.POSITIVE_INFINITY })).duration_seconds).toBe(0);
  });

  it("toutes les dates restent valides même sur un objet entièrement corrompu", () => {
    const session = normalizeSession({ id: 42, subject: null, started_at: {}, created_at: [], ended_at: 7 });
    expect(Number.isNaN(new Date(session.started_at).getTime())).toBe(false);
    expect(Number.isNaN(new Date(session.created_at).getTime())).toBe(false);
    expect(session.ended_at).toBeNull();
  });
});

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

  /**
   * Bug réel trouvé en testant des valeurs volontairement absurdes (audit
   * "edge cases produits") : un objectif négatif/NaN traversait cette
   * fonction tel quel — le Dashboard affichait ensuite littéralement
   * « 45 / -50 min », et un `contestDate` illisible transformait le compte à
   * rebours du concours en « NaN jours ». Ni l'un ni l'autre ne faisait
   * planter l'app, mais tous deux affichaient un nombre incohérent — même
   * défaut de fond que les champs déjà validés dans ce fichier.
   */
  it("un objectif négatif, nul ou non numérique retombe sur le défaut", () => {
    expect(normalizePreferences({ dailyGoalMinutes: -50 }).dailyGoalMinutes).toBe(60);
    expect(normalizePreferences({ dailyGoalMinutes: 0 }).dailyGoalMinutes).toBe(60);
    expect(normalizePreferences({ dailyGoalMinutes: NaN }).dailyGoalMinutes).toBe(60);
    expect(normalizePreferences({ dailyGoalMinutes: "not-a-number" }).dailyGoalMinutes).toBe(60);
    expect(normalizePreferences({ weeklyGoalMinutes: -300 }).weeklyGoalMinutes).toBe(300);
    expect(normalizePreferences({ dailyGoalMinutes: 90 }).dailyGoalMinutes).toBe(90);
  });

  it("un contestDate illisible retombe sur \"\" plutôt que de produire un NaN en aval", () => {
    expect(normalizePreferences({ contestDate: "" }).contestDate).toBe("");
    expect(normalizePreferences({ contestDate: "pas-une-date" }).contestDate).toBe("");
    expect(normalizePreferences({ contestDate: 42 }).contestDate).toBe("");
    expect(normalizePreferences({ contestDate: "2026-06-15" }).contestDate).toBe("2026-06-15");
  });

  it("un displayName non textuel retombe sur le défaut", () => {
    expect(normalizePreferences({ displayName: 42 }).displayName).toBe("");
    expect(normalizePreferences({ displayName: "Camille" }).displayName).toBe("Camille");
  });
});

/**
 * `normalize*` est la frontière de confiance pour le CONTENU, mais rien ne
 * protégeait l'ANALYSE elle-même : un `localStorage` corrompu (quota atteint
 * en pleine écriture, extension de navigateur, synchronisation interrompue)
 * faisait lever `JSON.parse`, erreur non rattrapée remontée dans le rendu.
 * Trouvé en test de destruction : une seule clé illisible suffisait.
 */
describe("localData — lecture blindée d'un stockage corrompu", () => {
  const store: Record<string, string> = {};
  const stub = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };

  function withStorage<T>(entries: Record<string, string>, read: () => T): T {
    Object.keys(store).forEach((key) => delete store[key]);
    Object.assign(store, entries);
    const globals = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    const previousWindow = globals.window;
    const previousStorage = globals.localStorage;
    globals.window = globals.window ?? {};
    globals.localStorage = stub;
    try {
      return read();
    } finally {
      globals.window = previousWindow;
      globals.localStorage = previousStorage;
    }
  }

  it("du JSON illisible ne lève pas — la liste est simplement vide", () => {
    expect(withStorage({ "prepahub:sessions": "{{{cassé" }, () => localData.sessions())).toEqual([]);
    expect(withStorage({ "prepahub:exercises": "<html>" }, () => localData.exercises())).toEqual([]);
    expect(withStorage({ "prepahub:chapters": "" }, () => localData.chapters())).toEqual([]);
  });

  it("une valeur qui n'est pas un tableau est traitée comme absente", () => {
    expect(withStorage({ "prepahub:sessions": "42" }, () => localData.sessions())).toEqual([]);
    expect(withStorage({ "prepahub:exercises": '{"pas":"un tableau"}' }, () => localData.exercises())).toEqual([]);
  });

  it("des préférences illisibles retombent sur les valeurs par défaut", () => {
    const preferences = withStorage({ "prepahub:preferences": "nope" }, () => localData.preferences());
    expect(preferences.dailyGoalMinutes).toBeGreaterThan(0);
    expect(preferences.themeMode).toBeTruthy();
  });
});

/**
 * Progression des sujets de concours (chantier banque de sujets) — même
 * frontière de confiance que le reste de `localData` : un `localStorage`
 * corrompu ne doit jamais faire planter /contests, et une progression
 * valide doit survivre à un cycle export → JSON → import (Phase 6/8 du
 * chantier : "persistance après reload").
 */
describe("localData.contestProgress — robustesse et persistance", () => {
  const store: Record<string, string> = {};
  const stub = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };

  function withStorage<T>(entries: Record<string, string>, read: () => T): T {
    Object.keys(store).forEach((key) => delete store[key]);
    Object.assign(store, entries);
    const globals = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    const previousWindow = globals.window;
    const previousStorage = globals.localStorage;
    globals.window = globals.window ?? {};
    globals.localStorage = stub;
    try {
      return read();
    } finally {
      globals.window = previousWindow;
      globals.localStorage = previousStorage;
    }
  }

  it("du JSON illisible ne lève pas — la liste est simplement vide", () => {
    expect(withStorage({ "prepahub:contest-progress": "{{{cassé" }, () => localData.contestProgress())).toEqual([]);
  });

  it("une entrée sans paperId exploitable est écartée plutôt que conservée orpheline", () => {
    const raw = JSON.stringify([{ status: "fait" }, { paperId: "", status: "fait" }]);
    expect(withStorage({ "prepahub:contest-progress": raw }, () => localData.contestProgress())).toEqual([]);
  });

  it("un statut invalide/corrompu retombe sur « à faire » plutôt que de propager une valeur inconnue", () => {
    const raw = JSON.stringify([{ paperId: "p-1", status: "inventé" }]);
    const [entry] = withStorage({ "prepahub:contest-progress": raw }, () => localData.contestProgress());
    expect(entry.status).toBe("à faire");
  });

  it("une progression valide survit intacte à un cycle stringify/parse (export puis import)", () => {
    const original: ContestProgress = {
      paperId: "ccinp-2024-maths1",
      status: "en cours",
      favorite: true,
      startedAt: "2026-02-01T10:00:00.000Z",
      completedAt: null,
      updatedAt: "2026-02-01T10:00:00.000Z",
    };
    const roundTripped = withStorage({ "prepahub:contest-progress": JSON.stringify([original]) }, () => localData.contestProgress());
    expect(roundTripped).toEqual([original]);
  });
});

describe("validateBackupPayload — contestProgress optionnel (rétrocompatibilité)", () => {
  function makeValidPayload(extra: Record<string, unknown> = {}) {
    return {
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      exercises: [],
      sessions: [],
      preferences: {},
      ...extra,
    };
  }

  it("accepte une sauvegarde sans contestProgress (exportée avant ce chantier)", () => {
    expect(validateBackupPayload(makeValidPayload())).toBe(true);
  });

  it("accepte une sauvegarde avec contestProgress", () => {
    expect(validateBackupPayload(makeValidPayload({ contestProgress: [{ paperId: "p-1", status: "fait" }] }))).toBe(true);
  });

  it("rejette une sauvegarde où contestProgress n'est pas un tableau", () => {
    expect(validateBackupPayload(makeValidPayload({ contestProgress: "pas-un-tableau" }))).toBe(false);
  });
});
