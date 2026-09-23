import { describe, expect, it } from "vitest";
import { buildBackupPayload, lastStorageWriteFailure, localData, normalizePreferences, normalizeSession, normalizeWorkItem, restoreBackup, validateBackupPayload } from "@/lib/storage";
import { hexToRgb } from "@/lib/theme";
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
 * `ready` : tant que `maybeSeedBank()` n'a pas résolu (import dynamique de
 * 1,35 Mo de JSON puis reconstruction de 477 exercices), sa liste `sessions`
 * vaut encore `[]` — alors que `useWorkTimer` a déjà restauré le chrono
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

describe("localData.mergeExercises — une progression enregistrée ailleurs n'est pas annulée", () => {
  it("garde les exercices absents de la liste entrante et applique la modification sur celui qu'elle contient", () => {
    const disk = [
      { id: "ex-1", subject: "Mathématiques", title: "A", source: "s", difficulty: 3, status: "à faire", created_at: "2026-01-01T00:00:00.000Z", attempts: 0 },
      { id: "ex-2", subject: "Physique", title: "B", source: "s", difficulty: 3, status: "maîtrisé", created_at: "2026-01-01T00:00:00.000Z", attempts: 7 },
    ];
    const stored = withWritableStorage({ "prepahub:exercises": JSON.stringify(disk) }, () => {
      const current = localData.exercises();
      const patched = current.filter((item) => item.id === "ex-1").map((item) => ({ ...item, attempts: 1 }));
      return localData.mergeExercises(patched);
    });

    expect(stored).toHaveLength(2);
    expect(stored.find((item) => item.id === "ex-1")!.attempts).toBe(1);
    expect(stored.find((item) => item.id === "ex-2")!.attempts).toBe(7);
  });
});

/**
 * Régression P0 — quota atteint = résultat perdu EN SILENCE.
 *
 * `localStorage.setItem` lève un `QuotaExceededError`, et aucun appel n'était
 * protégé. Dans components/exercises/focus-view.tsx#commitResult, l'exception
 * partait depuis un gestionnaire de clic React : `update(...)` et `onClose(...)`
 * ne s'exécutaient jamais, l'écran « Comment s'est passé l'exercice ? » restait
 * figé, et la séance était perdue sans aucun message. Ce n'est pas théorique :
 * la banque amorcée sérialise à elle seule ~1,20 M caractères, soit ~2,3 Mo
 * en UTF-16, sur un quota de 5 Mo par origine.
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
    withWritableStorage({}, () => localData.saveExercises([]), true);
    expect(lastStorageWriteFailure()?.key).toBe("prepahub:exercises");
    // …et un écriture qui repasse efface le signal.
    withWritableStorage({}, () => localData.saveExercises([]));
    expect(lastStorageWriteFailure()).toBeNull();
  });

  it("saveChapters/savePreferences/saveWeekSnapshots ne lèvent pas non plus", () => {
    withWritableStorage({}, () => {
      expect(() => localData.saveChapters([])).not.toThrow();
      expect(() => localData.saveWeekSnapshots([])).not.toThrow();
      expect(() => localData.saveLastBackupAt("2026-01-01T00:00:00.000Z")).not.toThrow();
      expect(() => localData.savePreferences(normalizePreferences({}))).not.toThrow();
    }, true);
  });
});

/**
 * Compteurs négatifs — une seule valeur suffit à fausser durablement tout ce
 * qui s'additionne (temps du jour, bilan hebdo, XP), sans qu'aucune erreur
 * ne soit levée nulle part.
 */
describe("normalize* — un compteur négatif ne franchit jamais la frontière de confiance", () => {
  it("une durée négative ne fait pas DIMINUER le temps de travail", () => {
    expect(normalizeSession(makeRawSession({ duration_seconds: -3600 })).duration_seconds).toBe(0);
  });

  it("une durée fractionnaire est arrondie, jamais rejetée", () => {
    expect(normalizeSession(makeRawSession({ duration_seconds: 599.6 })).duration_seconds).toBe(600);
  });

  it("des tentatives négatives et une durée estimée négative sont écartées", () => {
    const raw = [{ id: "ex-1", subject: "Mathématiques", title: "A", source: "s", difficulty: 3, status: "à faire", created_at: "2026-01-01T00:00:00.000Z", attempts: -5, estimated_minutes: -30 }];
    const [exercise] = withWritableStorage({ "prepahub:exercises": JSON.stringify(raw) }, () => localData.exercises());
    expect(exercise.attempts).toBe(0);
    expect(exercise.estimated_minutes).toBeNull();
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
    exercises: [],
    sessions: [],
    preferences: { displayName: "Léo", dailyGoalMinutes: 90 },
    chapters: [],
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

  it("la banque ne passe pas → RIEN n'est touché, et c'est dit", () => {
    const outcome = withQuotaStorage({}, 1, () =>
      restoreBackup(backup({ exercises: [{ id: "x", subject: "Mathématiques", title: "t", source: "s", difficulty: 3, status: "à faire", created_at: "2026-01-01T00:00:00.000Z" }] }))
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.intact).toBe(true);
    expect(outcome.restored).toEqual([]);
    expect(outcome.failedAt).toBe("les exercices");
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

  it("la banque est tentée EN PREMIER — c'est ce qui rend l'échec inoffensif", () => {
    const outcome = withQuotaStorage({}, 1_000_000, () => restoreBackup(backup()));
    expect(outcome.restored[0]).toBe("les exercices");
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
