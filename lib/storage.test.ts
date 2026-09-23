import { describe, expect, it } from "vitest";
import { buildBackupPayload, lastStorageWriteFailure, localData, normalizeCheckin, normalizeErrorEntry, normalizeGrade, normalizePreferences, normalizeSession, normalizeWorkItem, purgeRetiredBankData, restoreBackup, validateBackupPayload } from "@/lib/storage";
import { DEFAULT_ACCENT, hexToRgb } from "@/lib/theme";
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
  it("une préférence vide retombe entièrement sur les défauts (dont themeMode: \"dark\", défaut « Nuit »)", () => {
    const prefs = normalizePreferences({});
    expect(prefs.themeMode).toBe("dark");
    expect(prefs.weeklyGoalMinutes).toBe(300);
    expect(prefs.accent).toMatch(/^#/);
  });

  it("conserve un themeMode valide", () => {
    expect(normalizePreferences({ themeMode: "light" }).themeMode).toBe("light");
    expect(normalizePreferences({ themeMode: "dark" }).themeMode).toBe("dark");
  });

  it("retombe sur le défaut (sombre) pour un themeMode invalide ou corrompu", () => {
    expect(normalizePreferences({ themeMode: "bleu" }).themeMode).toBe("dark");
    expect(normalizePreferences({ themeMode: 42 }).themeMode).toBe("dark");
    expect(normalizePreferences({ themeMode: null }).themeMode).toBe("dark");
  });

  it("conserve un choix explicite \"system\"", () => {
    expect(normalizePreferences({ themeMode: "system" }).themeMode).toBe("system");
  });

  it("une ancienne sauvegarde sans themeMode ni weeklyGoalMinutes reste valide et n'invente rien d'autre", () => {
    const legacy = { displayName: "Ancien utilisateur", dailyGoalMinutes: 120, contestDate: "", accent: "#6366f1" };
    const prefs = normalizePreferences(legacy);
    expect(prefs.displayName).toBe("Ancien utilisateur");
    expect(prefs.dailyGoalMinutes).toBe(120);
    expect(prefs.accent).toBe("#6366f1");
    expect(prefs.themeMode).toBe("dark");
    expect(prefs.weeklyGoalMinutes).toBe(300);
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
    expect(withStorage({ "prepahub:work-items": "<html>" }, () => localData.workItems())).toEqual([]);
    expect(withStorage({ "prepahub:grades": "" }, () => localData.grades())).toEqual([]);
  });

  it("une valeur qui n'est pas un tableau est traitée comme absente", () => {
    expect(withStorage({ "prepahub:sessions": "42" }, () => localData.sessions())).toEqual([]);
    expect(withStorage({ "prepahub:work-items": '{"pas":"un tableau"}' }, () => localData.workItems())).toEqual([]);
  });

  it("des préférences illisibles retombent sur les valeurs par défaut", () => {
    const preferences = withStorage({ "prepahub:preferences": "nope" }, () => localData.preferences());
    expect(preferences.dailyGoalMinutes).toBeGreaterThan(0);
    expect(preferences.themeMode).toBeTruthy();
  });
});

/**
 * ------------------------------------------------------------------------
 * Écriture : la moitié du problème que la lecture blindée ne couvrait pas.
 * ------------------------------------------------------------------------
 * Les deux régressions ci-dessous font perdre, chacune, la TOTALITÉ de
 * l'historique d'un élève — le contraire exact de la promesse du produit
 * ("je déclare Réussi, je reviens plus tard, mon entraînement a évolué").
 */

const writeStore: Record<string, string> = {};
let refuseWrites = false;

const writableStub = {
  getItem: (key: string) => writeStore[key] ?? null,
  setItem: (key: string, value: string) => {
    if (refuseWrites) {
      // Ce que jette réellement un navigateur quand le quota est atteint.
      const error = new Error("QuotaExceededError");
      error.name = "QuotaExceededError";
      throw error;
    }
    writeStore[key] = value;
  },
};

function withWritableStorage<T>(entries: Record<string, string>, run: () => T, refuse = false): T {
  Object.keys(writeStore).forEach((key) => delete writeStore[key]);
  Object.assign(writeStore, entries);
  refuseWrites = refuse;
  const globals = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const previousWindow = globals.window;
  const previousStorage = globals.localStorage;
  globals.window = globals.window ?? {};
  globals.localStorage = writableStub;
  try {
    return run();
  } finally {
    refuseWrites = false;
    globals.window = previousWindow;
    globals.localStorage = previousStorage;
  }
}

function rawSession(id: string, startedAt: string): Record<string, unknown> {
  return makeRawSession({ id, started_at: startedAt, created_at: startedAt, ended_at: startedAt, duration_seconds: 600 });
}

/**
 * Régression P0 — perte totale de l'historique par copie périmée.
 *
 * Chaque appel à `usePrepahubData()` a sa PROPRE copie React (ce n'est pas un
 * contexte partagé). components/timer.tsx, en particulier, n'attend pas
 * `ready` : tant que le premier `refresh()` n'a pas eu lieu, sa liste
 * `sessions` vaut encore `[]` — alors que `useWorkTimer` a déjà restauré le chrono
 * persisté et que le bouton « Terminer » est cliquable. Un rechargement en
 * pleine séance suivi de « Terminer » écrivait `[la séance en cours]` par
 * REMPLACEMENT : toutes les séances précédentes disparaissaient d'un coup.
 */
describe("localData.mergeSessions — le scénario 'Terminer avant chargement'", () => {
  it("une séance ajoutée depuis une liste vide ne détruit pas les six mois d'historique déjà stockés", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z"), rawSession("s-2", "2026-02-01T08:00:00.000Z")];
    const nouvelle = normalizeSession(rawSession("s-3", "2026-03-01T08:00:00.000Z"));

    const stored = withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () =>
      // Exactement ce que fait components/timer.tsx#handleStop avec `sessions === []`.
      localData.mergeSessions([nouvelle])
    );

    expect(stored.map((session) => session.id).sort()).toEqual(["s-1", "s-2", "s-3"]);
    expect(JSON.parse(writeStore["prepahub:sessions"])).toHaveLength(3);
  });

  it("la liste entrante fait foi pour les id qu'elle contient — une modification n'est pas annulée", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    const stored = withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () =>
      localData.mergeSessions([normalizeSession({ ...rawSession("s-1", "2026-01-01T08:00:00.000Z"), result: "réussi" })])
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].result).toBe("réussi");
  });

  it("une liste entrante VIDE n'efface rien", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    const stored = withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () => localData.mergeSessions([]));
    expect(stored).toHaveLength(1);
  });

  it("renvoie la liste RÉELLEMENT enregistrée, pas celle qu'on croyait écrire", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    const stored = withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () =>
      localData.mergeSessions([normalizeSession(rawSession("s-2", "2026-02-01T08:00:00.000Z"))])
    );
    expect(stored).toHaveLength(2);
  });
});

/**
 * Régression P0 — quota atteint = résultat perdu EN SILENCE.
 *
 * `localStorage.setItem` lève un `QuotaExceededError`, et aucun appel n'était
 * protégé : l'exception partait depuis un gestionnaire de clic React, la suite
 * du gestionnaire ne s'exécutait jamais, et la séance était perdue sans aucun
 * message.
 */
describe("écriture refusée par le navigateur (quota) — ne lève jamais, et ne ment jamais", () => {
  it("saveSessions renvoie false au lieu de faire exploser le gestionnaire de clic", () => {
    const result = withWritableStorage({}, () => localData.saveSessions([normalizeSession(rawSession("s-1", "2026-01-01T08:00:00.000Z"))]), true);
    expect(result).toBe(false);
  });

  it("mergeSessions ne lève pas non plus et laisse le disque intact", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () => {
      expect(() => localData.mergeSessions([normalizeSession(rawSession("s-2", "2026-02-01T08:00:00.000Z"))])).not.toThrow();
    }, true);
    expect(JSON.parse(writeStore["prepahub:sessions"])).toHaveLength(1);
  });

  it("l'échec est signalé, pour que l'app puisse le dire plutôt que de laisser croire que c'est enregistré", () => {
    withWritableStorage({}, () => localData.saveSessions([]), true);
    expect(lastStorageWriteFailure()?.key).toBe("prepahub:sessions");
    // …et un écriture qui repasse efface le signal.
    withWritableStorage({}, () => localData.saveSessions([]));
    expect(lastStorageWriteFailure()).toBeNull();
  });

  it("saveGrades/savePreferences/saveWeekSnapshots ne lèvent pas non plus", () => {
    withWritableStorage({}, () => {
      expect(() => localData.saveGrades([])).not.toThrow();
      expect(() => localData.saveWeekSnapshots([])).not.toThrow();
      expect(() => localData.saveLastBackupAt("2026-01-01T00:00:00.000Z")).not.toThrow();
      expect(() => localData.savePreferences(normalizePreferences({}))).not.toThrow();
    }, true);
  });
});

/**
 * Compteurs négatifs — une seule valeur suffit à fausser durablement tout ce
 * qui s'additionne (temps du jour, bilan hebdo), sans qu'aucune erreur
 * ne soit levée nulle part.
 */
describe("normalize* — un compteur négatif ne franchit jamais la frontière de confiance", () => {
  it("une durée négative ne fait pas DIMINUER le temps de travail", () => {
    expect(normalizeSession(makeRawSession({ duration_seconds: -3600 })).duration_seconds).toBe(0);
  });

  it("une durée fractionnaire est arrondie, jamais rejetée", () => {
    expect(normalizeSession(makeRawSession({ duration_seconds: 599.6 })).duration_seconds).toBe(600);
  });

});

/* ══════════════════════════════════════════════════════════════════
   MIGRATION — le chantier planning ne doit invalider AUCUNE donnée
   ══════════════════════════════════════════════════════════════════ */

describe("WorkSession — le nouveau champ ne casse aucune séance existante", () => {
  /**
   * §24 du cahier des charges : aucune donnée existante ne doit devenir
   * invalide. `work_item_id` suit exactement le protocole de `result` et
   * `hints_used` avant lui — absent d'une séance antérieure, il vaut `null`
   * et n'est jamais rattaché après coup à un travail qui n'existait pas.
   */
  it("une séance enregistrée avant ce chantier reste valide, avec un rattachement nul", () => {
    const session = normalizeSession(makeRawSession());
    expect(session.work_item_id).toBeNull();
    expect(session.duration_seconds).toBe(600);
  });

  it("un rattachement présent est conservé tel quel", () => {
    expect(normalizeSession(makeRawSession({ work_item_id: "w-1" })).work_item_id).toBe("w-1");
  });

  it("un rattachement corrompu retombe à null plutôt que de propager n'importe quoi", () => {
    expect(normalizeSession(makeRawSession({ work_item_id: 42 })).work_item_id).toBeNull();
  });
});

describe("normalizeWorkItem — frontière de confiance du travail planifié", () => {
  it("un travail vide ne plante pas et reçoit des valeurs sûres", () => {
    const item = normalizeWorkItem({});
    expect(item.title).toBe("Travail sans titre");
    expect(item.kind).toBe("autre");
    expect(item.status).toBe("à faire");
    expect(item.estimatedMinutes).toBeGreaterThan(0);
    expect(item.dueDate).toBeNull();
  });

  it("une durée nulle est ramenée à au moins une minute — un travail à 0 min serait invisible du planificateur tout en restant affiché", () => {
    expect(normalizeWorkItem({ estimatedMinutes: 0 }).estimatedMinutes).toBeGreaterThan(0);
  });

  it("une date d'échéance illisible est écartée, jamais propagée", () => {
    expect(normalizeWorkItem({ dueDate: "jeudi prochain" }).dueDate).toBeNull();
    expect(normalizeWorkItem({ dueDate: "2026-13-45" }).dueDate).toBeNull();
    expect(normalizeWorkItem({ dueDate: "2026-09-17" }).dueDate).toBe("2026-09-17");
  });

  it("une heure hors format est écartée", () => {
    expect(normalizeWorkItem({ dueTime: "25:00" }).dueTime).toBeNull();
    expect(normalizeWorkItem({ dueTime: "08:00" }).dueTime).toBe("08:00");
  });

  it("une matière inconnue devient « sans matière » plutôt qu'une matière inventée", () => {
    expect(normalizeWorkItem({ subject: "Philosophie" }).subject).toBeNull();
    expect(normalizeWorkItem({ subject: "Physique" }).subject).toBe("Physique");
  });

  it("une date d'achèvement sur un travail non terminé est effacée — elle fausserait le bilan hebdomadaire", () => {
    const item = normalizeWorkItem({ status: "en cours", completedAt: "2026-09-10T00:00:00.000Z" });
    expect(item.completedAt).toBeNull();
  });

  it("les reports malformés sont écartés un par un, sans perdre les valides", () => {
    const item = normalizeWorkItem({
      postponements: [
        { at: "2026-09-14T08:00:00.000Z", fromDate: "2026-09-14", toDate: "2026-09-15" },
        { at: "n'importe quoi", fromDate: "2026-09-14", toDate: "2026-09-15" },
        "pas un objet",
      ],
    });
    expect(item.postponements).toHaveLength(1);
  });
});

describe("sauvegarde — les échéances voyagent, et une ancienne sauvegarde reste importable", () => {
  it("une sauvegarde d'avant ce chantier reste valide : `workItems` est simplement absent", () => {
    const legacy = {
      version: 1,
      exportedAt: "2026-09-01T00:00:00.000Z",
      exercises: [],
      sessions: [],
      preferences: { displayName: "Taekd" },
    };
    expect(validateBackupPayload(legacy)).toBe(true);
    expect((legacy as { workItems?: unknown[] }).workItems).toBeUndefined();
  });

  it("un travail traverse un cycle export → JSON → import sans rien perdre", () => {
    const original = normalizeWorkItem({
      id: "w-1",
      title: "DM de maths",
      kind: "dm",
      subject: "Mathématiques",
      estimatedMinutes: 120,
      dueDate: "2026-09-17",
      dueTime: "08:00",
      status: "en cours",
      important: true,
      notBeforeDate: "2026-09-15",
      chapterIds: ["c-1"],
      createdAt: "2026-09-14T08:00:00.000Z",
      postponements: [{ at: "2026-09-14T08:00:00.000Z", fromDate: "2026-09-14", toDate: "2026-09-15" }],
    });
    expect(normalizeWorkItem(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   LOT ① — INTÉGRITÉ : ne jamais annoncer réussi ce qui ne l'est pas
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Stockage à BUDGET, plus fidèle que le `refuse` global : il laisse passer les
 * premières écritures et refuse les suivantes, ce qui est exactement le
 * comportement d'un quota atteint en cours de restauration — le seul moyen de
 * reproduire l'état mi-fichier mi-appareil que `restoreBackup` doit empêcher.
 */
function withQuotaStorage<T>(entries: Record<string, string>, budget: number, run: () => T): T {
  const store: Record<string, string> = { ...entries };
  let used = 0;
  const stub = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      if (used + value.length > budget) {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      }
      used += value.length;
      store[key] = value;
    },
  };
  const globals = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const previousWindow = globals.window;
  const previousStorage = globals.localStorage;
  globals.window = globals.window ?? {};
  globals.localStorage = stub;
  try {
    return run();
  } finally {
    globals.window = previousWindow;
    globals.localStorage = previousStorage;
  }
}

function backup(overrides: Record<string, unknown> = {}) {
  return {
    sessions: [],
    preferences: { displayName: "Léo", dailyGoalMinutes: 90 },
    weekSnapshots: [],
    workItems: [],
    grades: [],
    dayPlans: [],
    ...overrides,
  } as never;
}

describe("restoreBackup — une restauration partielle ne s'annonce jamais réussie", () => {
  it("tout passe → ok, rien en échec", () => {
    const outcome = withQuotaStorage({}, 1_000_000, () => restoreBackup(backup()));
    expect(outcome.ok).toBe(true);
    expect(outcome.failedAt).toBeNull();
    expect(outcome.restored).toHaveLength(9);
  });

  it("les séances ne passent pas → RIEN n'est touché, et c'est dit", () => {
    const outcome = withQuotaStorage({}, 1, () =>
      restoreBackup(backup({ sessions: [normalizeSession(rawSession("s-1", "2026-01-01T08:00:00.000Z"))] }))
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.intact).toBe(true);
    expect(outcome.restored).toEqual([]);
    expect(outcome.failedAt).toBe("les séances");
  });

  it("un refus EN COURS de restauration s'arrête net et nomme ce qui est passé", () => {
    // Budget calibré pour laisser entrer les premières écritures puis refuser.
    const outcome = withQuotaStorage({}, 12, () => restoreBackup(backup()));
    expect(outcome.ok).toBe(false);
    expect(outcome.intact).toBe(false);
    expect(outcome.restored.length).toBeGreaterThan(0);
    expect(outcome.failedAt).not.toBeNull();
    // Et surtout : ce qui a échoué n'est JAMAIS compté comme restauré.
    expect(outcome.restored).not.toContain(outcome.failedAt);
  });

  it("les séances — la plus grosse écriture — sont tentées EN PREMIER : c'est ce qui rend l'échec inoffensif", () => {
    const outcome = withQuotaStorage({}, 1_000_000, () => restoreBackup(backup()));
    expect(outcome.restored[0]).toBe("les séances");
  });

  it("les préférences restaurées passent par la normalisation, jamais telles quelles", () => {
    // Un fichier de sauvegarde édité à la main ne doit pas pouvoir déposer
    // dans le localStorage une valeur qui fera planter lib/theme.ts au
    // prochain démarrage — cf. la page blanche sur TOUTES les routes.
    const prefs = withQuotaStorage({}, 1_000_000, () => {
      const outcome = restoreBackup(backup({ preferences: { accent: 42, contestDate: "demain", dailyGoalMinutes: "beaucoup" } }));
      expect(outcome.ok).toBe(true);
      return localData.preferences();
    });
    expect(hexToRgb(prefs.accent)).not.toBeNull();
    expect(prefs.contestDate).toBe("");
    expect(prefs.dailyGoalMinutes).toBeGreaterThan(0);
  });

  it("les budgets par matière font l'aller-retour export → fichier → restauration", () => {
    // Le cycle réel d'`exportBackup` : les préférences telles que lues, puis
    // sérialisées en JSON, puis restaurées sur un autre appareil. Un 0
    // explicite (« je ne suis pas l'anglais ») doit survivre, pas redevenir
    // le défaut.
    const exported = normalizePreferences({ weeklySubjectTargets: { Anglais: 0, Mathématiques: 540, Chimie: 90 } });
    const file = JSON.parse(JSON.stringify(backup({ preferences: exported })));
    const prefs = withQuotaStorage({}, 1_000_000, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.preferences();
    });
    expect(prefs.weeklySubjectTargets).toEqual(exported.weeklySubjectTargets);
    expect(prefs.weeklySubjectTargets.Anglais).toBe(0);
  });

  it("une ancienne sauvegarde qui porte encore palette et couleurs de matière se restaure sans erreur, et les abandonne", () => {
    const file = JSON.parse(
      JSON.stringify(backup({ preferences: { ...normalizePreferences({ displayName: "Ancien" }), subjectPalette: "ocean", subjectColors: { Chimie: "#ff8800" } } }))
    );
    const prefs = withQuotaStorage({}, 1_000_000, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.preferences();
    }) as Record<string, unknown>;
    expect(prefs.displayName).toBe("Ancien");
    expect(prefs).not.toHaveProperty("subjectPalette");
    expect(prefs).not.toHaveProperty("subjectColors");
  });
});

describe("normalizePreferences — couleurs de matière retirées (refonte « Apple »)", () => {
  it("une préférence « Nuit » (palette + surcharges) est lue sans erreur, et les deux clés disparaissent", () => {
    for (const legacy of [
      { subjectPalette: "neon", subjectColors: {} },
      { subjectPalette: "ocean", subjectColors: { Chimie: "#FF8800", Physique: "bleu", Latin: "#000000" } },
      { subjectPalette: 3, subjectColors: "violet" },
      { subjectPalette: null, subjectColors: null },
    ]) {
      const prefs = normalizePreferences({ displayName: "Ancien", accent: "#6366f1", ...legacy }) as Record<string, unknown>;
      expect(prefs.displayName).toBe("Ancien");
      expect(prefs.accent).toBe("#6366f1");
      expect(prefs).not.toHaveProperty("subjectPalette");
      expect(prefs).not.toHaveProperty("subjectColors");
    }
  });

  it("les anciens accents par défaut (« Miel », « Menthe ») migrent vers le bleu, un vrai choix est conservé", () => {
    expect(normalizePreferences({ accent: "#e0a758" }).accent).toBe(DEFAULT_ACCENT);
    expect(normalizePreferences({ accent: "#E0A758" }).accent).toBe(DEFAULT_ACCENT);
    expect(normalizePreferences({ accent: "#5eead4" }).accent).toBe(DEFAULT_ACCENT);
    expect(DEFAULT_ACCENT).toBe("#0a84ff");
    expect(normalizePreferences({ accent: "#d4f36b" }).accent).toBe("#d4f36b");
  });
});

describe("normalizePreferences — frontière de trust réelle, pas trois champs sur huit", () => {
  it("un accent non textuel retombe sur le défaut au lieu de faire planter applyAccent", () => {
    const prefs = normalizePreferences({ accent: 42 });
    expect(typeof prefs.accent).toBe("string");
    // Le vrai critère : la valeur produite doit être ACCEPTÉE par l'analyseur qui l'utilisera.
    expect(hexToRgb(prefs.accent)).not.toBeNull();
  });

  it("un accent textuel mais invalide est refusé lui aussi", () => {
    expect(hexToRgb(normalizePreferences({ accent: "rouge vif" }).accent)).not.toBeNull();
  });

  it("une date de concours illisible ne peut plus atteindre Intl.DateTimeFormat", () => {
    const prefs = normalizePreferences({ contestDate: "pas-une-date" });
    expect(prefs.contestDate).toBe("");
    // Reproduit littéralement l'appel de components/dashboard-overview.tsx.
    expect(() => prefs.contestDate && new Intl.DateTimeFormat("fr-FR").format(new Date(prefs.contestDate))).not.toThrow();
  });

  it("une date de concours réelle est conservée", () => {
    expect(normalizePreferences({ contestDate: "2027-05-04" }).contestDate).toBe("2027-05-04");
  });

  it("un objectif nul, négatif ou non numérique ne devient jamais un dénominateur", () => {
    for (const value of [0, -30, "beaucoup", null, Number.NaN]) {
      const prefs = normalizePreferences({ dailyGoalMinutes: value, weeklyGoalMinutes: value });
      expect(prefs.dailyGoalMinutes).toBeGreaterThan(0);
      expect(prefs.weeklyGoalMinutes).toBeGreaterThan(0);
      expect(Number.isFinite(100 / prefs.dailyGoalMinutes)).toBe(true);
    }
  });

  it("un nom d'affichage non textuel ne traverse pas", () => {
    expect(typeof normalizePreferences({ displayName: { evil: true } }).displayName).toBe("string");
  });

  it("aucune clé étrangère ne ressort des préférences", () => {
    const prefs = normalizePreferences({ __proto__: null, intrus: "oui", autre: 1 }) as Record<string, unknown>;
    expect(Object.keys(prefs).sort()).toEqual(
      [
        "accent",
        "capacityByWeekday",
        "contestDate",
        "dailyGoalMinutes",
        "displayName",
        "planningMarginPercent",
        "themeMode",
        "weeklyGoalMinutes",
        "weeklySubjectTargets",
      ]
    );
  });
});

/* ══════════════════════════════════════════════════════════════════
   BANQUE D'EXERCICES RETIRÉE — ménage du stockage, anciennes sauvegardes
   ══════════════════════════════════════════════════════════════════ */

describe("banque d'exercices retirée — les anciennes données ne gênent plus, et ne se perdent pas", () => {
  const oldExercise = { id: "x", subject: "Mathématiques", title: "t", source: "s", difficulty: 3, status: "à faire", created_at: "2026-01-01T00:00:00.000Z" };

  it("le ménage efface l'ancienne banque, ses chapitres et ses drapeaux d'amorçage", () => {
    const { removed, remaining } = withWritableStorage(
      {
        "prepahub:exercises": JSON.stringify([oldExercise]),
        "prepahub:chapters": "[]",
        "prepahub:seeded": "2026-01-01T00:00:00.000Z",
        "prepahub:seeded:version": "12",
        "prepahub:sessions": JSON.stringify([rawSession("s-1", "2026-01-01T08:00:00.000Z")]),
      },
      () => {
        const globals = globalThis as unknown as { localStorage: { removeItem?: (key: string) => void } };
        globals.localStorage.removeItem = (key: string) => {
          delete writeStore[key];
        };
        try {
          return { removed: purgeRetiredBankData(), remaining: { ...writeStore } };
        } finally {
          delete globals.localStorage.removeItem;
        }
      }
    );
    expect(removed.sort()).toEqual(["prepahub:chapters", "prepahub:exercises", "prepahub:seeded", "prepahub:seeded:version"]);
    // Les données de l'élève, elles, ne sont pas touchées.
    expect(Object.keys(remaining)).toEqual(["prepahub:sessions"]);
  });

  it("le ménage ne fait rien la deuxième fois, et ne lève jamais", () => {
    const removed = withWritableStorage({}, () => {
      const globals = globalThis as unknown as { localStorage: { removeItem?: (key: string) => void } };
      globals.localStorage.removeItem = () => {
        throw new Error("SecurityError");
      };
      try {
        return purgeRetiredBankData();
      } finally {
        delete globals.localStorage.removeItem;
      }
    });
    expect(removed).toEqual([]);
  });

  it("l'export ne contient plus ni exercices ni chapitres", () => {
    const payload = withWritableStorage({}, () => buildBackupPayload(new Date("2026-09-20T12:00:00.000Z")));
    expect(payload).not.toHaveProperty("exercises");
    expect(payload).not.toHaveProperty("chapters");
    expect(validateBackupPayload(JSON.parse(JSON.stringify(payload)))).toBe(true);
  });

  it("une ANCIENNE sauvegarde avec des exercices et des chapitres reste valide…", () => {
    const legacy = {
      version: 1,
      exportedAt: "2026-05-01T00:00:00.000Z",
      exercises: [oldExercise],
      chapters: [{ id: "c-1", subject: "Mathématiques", label: "Suites" }],
      sessions: [rawSession("s-1", "2026-01-01T08:00:00.000Z")],
      preferences: {},
    };
    expect(validateBackupPayload(JSON.parse(JSON.stringify(legacy)))).toBe(true);
  });

  it("… et sa restauration écrit les séances sans jamais réécrire la banque", () => {
    const legacy = backup({
      exercises: [oldExercise],
      chapters: [{ id: "c-1", subject: "Mathématiques", label: "Suites" }],
      sessions: [normalizeSession(rawSession("s-1", "2026-01-01T08:00:00.000Z"))],
    });
    const { outcome, keys } = withWritableStorage({}, () => ({ outcome: restoreBackup(legacy), keys: Object.keys(writeStore) }));
    expect(outcome.ok).toBe(true);
    expect(keys).toContain("prepahub:sessions");
    expect(keys).not.toContain("prepahub:exercises");
    expect(keys).not.toContain("prepahub:chapters");
  });
});

describe("validateBackupPayload — les trois collections récentes ne passent plus en aveugle", () => {
  const base = { exercises: [], sessions: [], preferences: {} };

  it("refuse un fichier dont les échéances ne sont pas une liste", () => {
    expect(validateBackupPayload({ ...base, workItems: "oups" })).toBe(false);
  });

  it("refuse un fichier dont les notes ne sont pas une liste", () => {
    expect(validateBackupPayload({ ...base, grades: 42 })).toBe(false);
  });

  it("refuse un fichier dont le planning n'est pas une liste", () => {
    expect(validateBackupPayload({ ...base, dayPlans: { a: 1 } })).toBe(false);
  });

  it("accepte toujours une sauvegarde ANCIENNE, où ces trois clés sont absentes", () => {
    expect(validateBackupPayload(base)).toBe(true);
  });
});

describe("lastBackupAt — un stockage bloqué ne fige plus l'application", () => {
  it("renvoie null au lieu de lever quand getItem est refusé", () => {
    const globals = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    const previousWindow = globals.window;
    const previousStorage = globals.localStorage;
    globals.window = globals.window ?? {};
    globals.localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    try {
      // C'est l'appel exact que fait readAll() dans hooks/use-prepahub-data.ts :
      // s'il lève, `ready` ne passe jamais à true et toutes les pages restent
      // bloquées sur leurs squelettes.
      expect(() => localData.lastBackupAt()).not.toThrow();
      expect(localData.lastBackupAt()).toBeNull();
    } finally {
      globals.window = previousWindow;
      globals.localStorage = previousStorage;
    }
  });
});

describe("merge* — l'état React reçoit ce qui est sur le DISQUE, pas l'intention", () => {
  it("une fusion refusée renvoie le disque intact, jamais la liste voulue", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    const stored = withWritableStorage(
      { "prepahub:sessions": JSON.stringify(disk) },
      () => localData.mergeSessions([normalizeSession(rawSession("s-2", "2026-02-01T08:00:00.000Z"))]),
      true
    );
    expect(stored.map((session) => session.id)).toEqual(["s-1"]);
    expect(lastStorageWriteFailure()?.key).toBe("prepahub:sessions");
  });

  it("une fusion acceptée renvoie bien la liste fusionnée", () => {
    const disk = [rawSession("s-1", "2026-01-01T08:00:00.000Z")];
    const stored = withWritableStorage({ "prepahub:sessions": JSON.stringify(disk) }, () =>
      localData.mergeSessions([normalizeSession(rawSession("s-2", "2026-02-01T08:00:00.000Z"))])
    );
    expect(stored.map((session) => session.id).sort()).toEqual(["s-1", "s-2"]);
  });
});

/**
 * CARNET « À REVOIR » — la seule collection née APRÈS la leçon des trois
 * collections oubliées par `validateBackupPayload`. On vérifie donc d'emblée
 * les trois promesses : le carnet voyage dans la sauvegarde, une sauvegarde
 * ancienne (sans le champ) reste importable et REMPLACE par un carnet vide,
 * et une suppression n'est jamais ressuscitée par l'écriture suivante.
 */
describe("carnet « À revoir » — sauvegarde, restauration, suppression", () => {
  const entries = [
    { id: "r-1", subject: "Mathématiques", text: "Cartouche : suite convergente → monotone bornée", kind: "méthode", createdAt: "2026-09-20T10:00:00.000Z", doneAt: null },
    { id: "r-2", subject: "Physique", text: "Refaire exo 12 TD4", kind: "à revoir", createdAt: "2026-09-21T10:00:00.000Z", doneAt: "2026-09-22T10:00:00.000Z" },
  ];

  it("export → JSON → validation → restauration sur un autre appareil : rien ne se perd", () => {
    const file = withWritableStorage({ "prepahub:reviewItems": JSON.stringify(entries) }, () =>
      JSON.parse(JSON.stringify(buildBackupPayload(new Date("2026-09-23T12:00:00.000Z"))))
    );
    expect(file.reviewItems).toEqual(entries);
    expect(validateBackupPayload(file)).toBe(true);

    const restored = withWritableStorage({}, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.reviewItems();
    });
    expect(restored).toEqual(entries);
  });

  it("une sauvegarde d'avant le carnet reste importable, et le carnet de l'appareil est remplacé par un carnet vide", () => {
    const legacy = { version: 1, exportedAt: "2026-09-01T00:00:00.000Z", exercises: [], sessions: [], preferences: {} };
    expect(validateBackupPayload(legacy)).toBe(true);
    const after = withWritableStorage({ "prepahub:reviewItems": JSON.stringify(entries) }, () => {
      restoreBackup(legacy as never);
      return localData.reviewItems();
    });
    expect(after).toEqual([]);
  });

  it("refuse un fichier dont le carnet n'est pas une liste", () => {
    expect(validateBackupPayload({ exercises: [], sessions: [], preferences: {}, reviewItems: "oups" })).toBe(false);
  });

  it("une entrée supprimée ne revient pas : l'écriture REMPLACE", () => {
    const after = withWritableStorage({ "prepahub:reviewItems": JSON.stringify(entries) }, () => {
      localData.saveReviewItems(localData.reviewItems().filter((entry) => entry.id !== "r-1"));
      return localData.reviewItems();
    });
    expect(after.map((entry) => entry.id)).toEqual(["r-2"]);
  });
});

/* ── Carnet d'erreurs ─────────────────────────────────────────────────
 * Les mêmes trois promesses que le carnet « À revoir » — voyager dans la
 * sauvegarde, rester importable depuis une sauvegarde ancienne, ne jamais
 * ressusciter une suppression — plus la frontière de confiance propre au
 * carnet : un type inconnu écarte l'entrée plutôt que d'inventer un type.
 */
describe("carnet d'erreurs — normalisation, sauvegarde, restauration, suppression", () => {
  const errors = [
    {
      id: "e-1",
      subject: "Physique",
      date: "2026-09-20",
      source: "colle",
      type: "calcul",
      description: "Signe oublié dans la projection",
      fix: "Faire un schéma avec les axes",
      chapterId: null,
      exerciseId: null,
      reviewItemId: null,
      createdAt: "2026-09-20T18:00:00.000Z",
    },
    {
      id: "e-2",
      subject: "Mathématiques",
      date: "2026-09-21",
      source: "DS",
      type: "cours",
      description: "Définition de la continuité uniforme",
      fix: null,
      chapterId: "ch-1",
      exerciseId: "ex-1",
      reviewItemId: "r-9",
      createdAt: "2026-09-21T18:00:00.000Z",
    },
  ];

  it("répare ce qui se répare, écarte ce qui ne veut plus rien dire", () => {
    expect(normalizeErrorEntry({ ...errors[0], source: "khôlle", fix: "  ", chapterId: 3 })).toMatchObject({ source: "autre", fix: null, chapterId: null });
    expect(normalizeErrorEntry({ ...errors[0], description: "   " })).toBeNull();
    expect(normalizeErrorEntry({ ...errors[0], subject: "Latin" })).toBeNull();
    // Type inconnu : écartée, jamais rangée d'office dans un type inventé.
    expect(normalizeErrorEntry({ ...errors[0], type: "fatigue" })).toBeNull();
    // Date illisible : retombe sur le jour de saisie.
    expect(normalizeErrorEntry({ ...errors[0], date: "hier" })?.date).toBe("2026-09-20");
    // Matière renommée : migrée, pas perdue.
    expect(normalizeErrorEntry({ ...errors[0], subject: "Informatique" })?.subject).toBe("Informatique TC");
  });

  it("export → JSON → validation → restauration sur un autre appareil : rien ne se perd", () => {
    const file = withWritableStorage({ "prepahub:errors": JSON.stringify(errors) }, () =>
      JSON.parse(JSON.stringify(buildBackupPayload(new Date("2026-09-23T12:00:00.000Z"))))
    );
    expect(file.errors).toEqual(errors);
    expect(validateBackupPayload(file)).toBe(true);
    const restored = withWritableStorage({}, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.errors();
    });
    expect(restored).toEqual(errors);
  });

  it("une sauvegarde d'avant le carnet reste importable, et le carnet de l'appareil est remplacé par un carnet vide", () => {
    const legacy = { version: 1, exportedAt: "2026-09-01T00:00:00.000Z", exercises: [], sessions: [], preferences: {} };
    expect(validateBackupPayload(legacy)).toBe(true);
    const after = withWritableStorage({ "prepahub:errors": JSON.stringify(errors) }, () => {
      restoreBackup(legacy as never);
      return localData.errors();
    });
    expect(after).toEqual([]);
  });

  it("refuse un fichier dont le carnet d'erreurs n'est pas une liste", () => {
    expect(validateBackupPayload({ exercises: [], sessions: [], preferences: {}, errors: { a: 1 } })).toBe(false);
  });

  it("une erreur supprimée ne revient pas : l'écriture REMPLACE", () => {
    const after = withWritableStorage({ "prepahub:errors": JSON.stringify(errors) }, () => {
      localData.saveErrors(localData.errors().filter((entry) => entry.id !== "e-1"));
      return localData.errors();
    });
    expect(after.map((entry) => entry.id)).toEqual(["e-2"]);
  });
});


/* ── Check-in du soir et calibration des notes ────────────────────── */

describe("check-in du soir — normalisation, sauvegarde, restauration", () => {
  const entries = [
    { date: "2026-09-21", sleepHours: 6.5, energy: 2, stress: 4, note: null, updatedAt: "2026-09-21T20:00:00.000Z" },
    { date: "2026-09-22", sleepHours: 8, energy: 4, stress: 2, note: "Colle de maths OK", updatedAt: "2026-09-22T20:30:00.000Z" },
  ];

  it("écarte un check-in sans jour ou sans mesure lisible — rien n'est inventé", () => {
    expect(normalizeCheckin({ sleepHours: 7, energy: 3, stress: 3 })).toBeNull();
    expect(normalizeCheckin({ date: "2026-09-22", energy: 3, stress: 3 })).toBeNull();
    expect(normalizeCheckin({ date: "2026-09-22", sleepHours: 7, energy: "fort", stress: 3 })).toBeNull();
  });

  it("ramène dans les bornes une saisie maladroite mais lisible", () => {
    expect(normalizeCheckin({ date: "2026-09-22", sleepHours: 13, energy: 8, stress: 0, note: "   " })).toMatchObject({
      sleepHours: 10,
      energy: 5,
      stress: 1,
      note: null,
    });
    expect(normalizeCheckin({ date: "2026-09-22", sleepHours: 6.8, energy: 3, stress: 3 })?.sleepHours).toBe(7);
  });

  it("un seul check-in par jour à la lecture : le plus récent gagne", () => {
    const duplicated = [...entries, { ...entries[1], sleepHours: 5, updatedAt: "2026-09-22T19:00:00.000Z" }];
    const read = withWritableStorage({ "prepahub:checkins": JSON.stringify(duplicated) }, () => localData.checkins());
    expect(read).toEqual(entries);
  });

  it("export → JSON → validation → restauration : rien ne se perd", () => {
    const file = withWritableStorage({ "prepahub:checkins": JSON.stringify(entries) }, () =>
      JSON.parse(JSON.stringify(buildBackupPayload(new Date("2026-09-23T12:00:00.000Z"))))
    );
    expect(file.checkins).toEqual(entries);
    expect(validateBackupPayload(file)).toBe(true);
    const restored = withWritableStorage({}, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.checkins();
    });
    expect(restored).toEqual(entries);
  });

  it("une sauvegarde d'avant le check-in reste importable, et remplace par une liste vide", () => {
    const legacy = { version: 1, exportedAt: "2026-09-01T00:00:00.000Z", exercises: [], sessions: [], preferences: {} };
    expect(validateBackupPayload(legacy)).toBe(true);
    const after = withWritableStorage({ "prepahub:checkins": JSON.stringify(entries) }, () => {
      restoreBackup(legacy as never);
      return localData.checkins();
    });
    expect(after).toEqual([]);
  });

  it("refuse un fichier dont les check-ins ne sont pas une liste", () => {
    expect(validateBackupPayload({ exercises: [], sessions: [], preferences: {}, checkins: "oups" })).toBe(false);
  });
});

describe("calibration — prédictions et notes en attente dans la sauvegarde", () => {
  const grades = [
    { id: "g-1", subject: "Physique", title: "DS 1", kind: "ds", date: "2026-09-10", score: 12, maxScore: 20, predictedScore: 14, createdAt: "2026-09-10T18:00:00.000Z" },
    { id: "g-2", subject: "Physique", title: "DS 2", kind: "ds", date: "2026-09-20", score: null, maxScore: 20, predictedScore: 13, createdAt: "2026-09-20T18:00:00.000Z" },
    { id: "g-3", subject: "Chimie", title: "", kind: "colle", date: "2026-09-12", score: 15, maxScore: 20, createdAt: "2026-09-12T18:00:00.000Z" },
  ];

  it("une note en attente a besoin d'une prédiction ; sans l'une ni l'autre, elle est écartée", () => {
    expect(normalizeGrade(grades[1])).toEqual(grades[1]);
    expect(normalizeGrade({ ...grades[1], predictedScore: undefined })).toBeNull();
    expect(normalizeGrade({ ...grades[0], predictedScore: 30 })?.predictedScore).toBe(20);
  });

  it("export → JSON → restauration : prédictions, notes en attente et anciennes notes intactes", () => {
    const file = withWritableStorage({ "prepahub:grades": JSON.stringify(grades) }, () =>
      JSON.parse(JSON.stringify(buildBackupPayload(new Date("2026-09-23T12:00:00.000Z"))))
    );
    expect(file.grades).toEqual(grades);
    const restored = withWritableStorage({}, () => {
      expect(restoreBackup(file).ok).toBe(true);
      return localData.grades();
    });
    expect(restored).toEqual(grades);
    expect("predictedScore" in restored[2]).toBe(false);
  });
});
