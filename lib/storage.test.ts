import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePreferences, normalizeSession, patchPreferences, validateBackupPayload } from "@/lib/storage";
import type { AttemptResult, Exercise, WorkSession } from "@/lib/supabase/types";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

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
 * Audit /settings & data-backup : `normalizePreferences` faisait un simple
 * `{ ...defaults, ...item }` sans jamais vérifier le TYPE de chacun de ces
 * cinq champs (seul `themeMode` était contrôlé) — contrairement à toutes les
 * autres fonctions `normalize*` de ce fichier, qui vérifient systématiquement
 * `typeof` avant d'accepter une valeur externe. Un import de sauvegarde avec
 * un `displayName`/`accent` de mauvais type (ex. un nombre) faisait planter
 * TOUTE l'app ailleurs : `preferences.displayName?.trim()`
 * (app/(app)/dashboard/page.tsx — `?.` protège seulement contre `null`/
 * `undefined`, jamais contre un type inattendu mais non-nul) et
 * `hexToRgb(preferences.accent)` (ThemeSync, monté dans le layout racine,
 * donc sur TOUTE page) — reproduit réellement via un import de sauvegarde
 * corrompue (Playwright), corrigé ici.
 */
describe("normalizePreferences — robustesse face à des types incorrects (import corrompu)", () => {
  it("displayName d'un autre type que string retombe sur le défaut, jamais propagé tel quel", () => {
    expect(normalizePreferences({ displayName: 42 }).displayName).toBe("");
    expect(normalizePreferences({ displayName: ["Alice"] }).displayName).toBe("");
    expect(normalizePreferences({ displayName: null }).displayName).toBe("");
    expect(normalizePreferences({ displayName: true }).displayName).toBe("");
  });

  it("accent d'un autre type, ou une chaîne qui n'est pas un hex valide, retombe sur l'accent par défaut", () => {
    expect(normalizePreferences({ accent: ["not", "a", "hex"] }).accent).toMatch(/^#/);
    expect(normalizePreferences({ accent: 12345 }).accent).toMatch(/^#/);
    expect(normalizePreferences({ accent: "pas-un-hex" }).accent).toMatch(/^#/);
    // Un hex réellement valide, lui, reste intact.
    expect(normalizePreferences({ accent: "#6366f1" }).accent).toBe("#6366f1");
  });

  it("dailyGoalMinutes/weeklyGoalMinutes d'un autre type, ou négatifs/nuls, retombent sur le défaut", () => {
    expect(normalizePreferences({ dailyGoalMinutes: "beaucoup" }).dailyGoalMinutes).toBe(240);
    expect(normalizePreferences({ dailyGoalMinutes: -30 }).dailyGoalMinutes).toBe(240);
    expect(normalizePreferences({ dailyGoalMinutes: 0 }).dailyGoalMinutes).toBe(240);
    expect(normalizePreferences({ weeklyGoalMinutes: "énormément" }).weeklyGoalMinutes).toBe(300);
    expect(normalizePreferences({ weeklyGoalMinutes: -1 }).weeklyGoalMinutes).toBe(300);
    // Une valeur numérique positive valide reste intacte.
    expect(normalizePreferences({ dailyGoalMinutes: 90 }).dailyGoalMinutes).toBe(90);
  });

  it("contestDate d'un autre type que string retombe sur le défaut", () => {
    expect(normalizePreferences({ contestDate: 20260601 }).contestDate).toBe("");
    expect(normalizePreferences({ contestDate: null }).contestDate).toBe("");
  });

  /**
   * Audit hardening final : `contestDate` était vérifié en TYPE (string) mais
   * jamais en FORMAT — une chaîne non convertible en date réelle (édition
   * manuelle du localStorage, import corrompu) traversait `normalizePreferences`
   * intacte, puis se propageait jusqu'au Dashboard qui affichait littéralement
   * "NaN j avant le concours" (dashboard-overview.tsx#contestDays,
   * `new Date(contestDate).getTime()` → NaN → `Math.max(0, NaN)` → NaN,
   * jamais `null`, donc le badge restait affiché) — reproduit réellement en
   * navigateur, corrigé ici.
   */
  it("contestDate une chaîne non convertible en date réelle retombe sur le défaut (jamais un Date invalide propagé)", () => {
    expect(normalizePreferences({ contestDate: "ceci-nest-pas-une-date" }).contestDate).toBe("");
    expect(normalizePreferences({ contestDate: "n'importe quoi" }).contestDate).toBe("");
  });

  it("contestDate vide reste explicitement valide (aucune date choisie, pas une erreur)", () => {
    expect(normalizePreferences({ contestDate: "" }).contestDate).toBe("");
  });

  it("contestDate une vraie date au format du champ <input type=\"date\"> reste intacte", () => {
    expect(normalizePreferences({ contestDate: "2027-06-01" }).contestDate).toBe("2027-06-01");
  });

  it("un objet de préférences entièrement mal typé ne plante jamais et ne renvoie que des types valides", () => {
    const prefs = normalizePreferences({
      displayName: 1,
      dailyGoalMinutes: "x",
      weeklyGoalMinutes: "y",
      contestDate: 2,
      accent: [1, 2, 3],
      themeMode: false,
    });
    expect(typeof prefs.displayName).toBe("string");
    expect(typeof prefs.dailyGoalMinutes).toBe("number");
    expect(typeof prefs.weeklyGoalMinutes).toBe("number");
    expect(typeof prefs.contestDate).toBe("string");
    expect(typeof prefs.accent).toBe("string");
    expect(prefs.themeMode).toBe("system");
  });
});

/**
 * `patchPreferences` corrige un bug réel : PreferencesForm et ThemePicker
 * (Réglages) montent chacun leur propre instance de `usePrepahubData`, sans
 * store partagé — enregistrer l'un avec un instantané complet de
 * `preferences` écrasait silencieusement tout champ que l'AUTRE venait de
 * changer (ex. choisir une couleur d'accent puis enregistrer son prénom
 * faisait revenir l'ancienne couleur). `patchPreferences` relit toujours
 * `localData.preferences()` au moment de l'appel plutôt que de partir d'un
 * instantané React figé — cette garantie de fusion est ce que ces tests
 * vérifient (la persistance réelle inter-appels n'est pas simulable ici, en
 * l'absence de `window`/`localStorage` — voir vitest.config.ts).
 */
describe("patchPreferences — fusion avec la dernière valeur stockée, jamais un instantané périmé", () => {
  it("n'applique que les champs du patch ; les champs non mentionnés restent inchangés", () => {
    const patched = patchPreferences({ accent: "#123456" });
    expect(patched.accent).toBe("#123456");
    expect(patched.displayName).toBe("");
    expect(patched.dailyGoalMinutes).toBe(240);
    expect(patched.themeMode).toBe("system");
  });

  it("plusieurs champs du patch sont tous appliqués en un seul appel", () => {
    const patched = patchPreferences({ displayName: "Alice", dailyGoalMinutes: 90 });
    expect(patched.displayName).toBe("Alice");
    expect(patched.dailyGoalMinutes).toBe(90);
    // Champs non mentionnés dans CE patch : toujours ceux actuellement stockés.
    expect(patched.accent).toMatch(/^#/);
  });

  it("un patch vide renvoie exactement les préférences actuellement stockées", () => {
    expect(patchPreferences({})).toEqual(normalizePreferences({}));
  });
});

/**
 * Audit du hook central de données : aucun `JSON.parse` de `localData`
 * n'était protégé — une seule clé localStorage corrompue (écriture
 * interrompue par un crash navigateur, extension défaillante) faisait
 * planter `readAll()` (hooks/use-prepahub-data.ts) tout entier, donc
 * l'application entière, sans aucun chemin de récupération. `safeParse`
 * retombe désormais sur une valeur sûre par clé, jamais une invention de
 * données — seule la panne totale est évitée.
 */
describe("localData — résilience face à une valeur localStorage corrompue", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("exercises() : JSON invalide retombe sur [] plutôt que de lever une exception", async () => {
    localStorage.setItem("prepahub:exercises", "{ceci n'est pas du JSON valide");
    const { localData } = await import("@/lib/storage");
    expect(() => localData.exercises()).not.toThrow();
    expect(localData.exercises()).toEqual([]);
  });

  it("preferences() : JSON invalide retombe sur les défauts plutôt que de lever une exception", async () => {
    localStorage.setItem("prepahub:preferences", "not json at all");
    const { localData } = await import("@/lib/storage");
    expect(() => localData.preferences()).not.toThrow();
    expect(localData.preferences().themeMode).toBe("system");
  });

  it("sessions()/chapters()/weekSnapshots() : même garantie, jamais d'exception propagée", async () => {
    localStorage.setItem("prepahub:sessions", "]][[corrompu");
    localStorage.setItem("prepahub:chapters", "undefined");
    localStorage.setItem("prepahub:week-snapshots", "{");
    const { localData } = await import("@/lib/storage");
    expect(() => localData.sessions()).not.toThrow();
    expect(() => localData.chapters()).not.toThrow();
    expect(() => localData.weekSnapshots()).not.toThrow();
    expect(localData.sessions()).toEqual([]);
    expect(localData.chapters()).toEqual([]);
    expect(localData.weekSnapshots()).toEqual([]);
  });

  it("une clé absente (jamais écrite) se comporte comme avant : tableau/objet vide, pas une erreur", async () => {
    const { localData } = await import("@/lib/storage");
    expect(localData.exercises()).toEqual([]);
    expect(localData.preferences().displayName).toBe("");
  });
});

/** Simule un quota localStorage réel : `setItem` lève `QuotaExceededError` dès que la taille totale dépasserait `limit`. */
class QuotaLimitedStorage {
  private store = new Map<string, string>();
  constructor(private limit: number) {}
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    let size = key.length + value.length;
    for (const [k, v] of this.store.entries()) {
      if (k !== key) size += k.length + v.length;
    }
    if (size > this.limit) {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    }
    this.store.set(key, value);
  }
}

/**
 * Audit /settings & data-backup (PHASE 6, "atomicité de l'import") : chaque
 * `localData.save*` est un `setItem` indépendant — une restauration qui
 * écrit cinq clés à la suite pouvait échouer AU MILIEU (ex. quota dépassé
 * sur un gros fichier) et laisser un mélange entre l'ancien et le nouveau,
 * reproduit réellement (Playwright) : exercices remplacés par l'import,
 * séances restées à l'ancienne version. `restoreBackup` relit d'abord la
 * valeur actuelle de chaque clé et restaure tout si une seule écriture
 * échoue — ces tests le vérifient sans navigateur, via un mock de quota.
 */
describe("restoreBackup — atomicité face à un échec en cours de restauration", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("toutes les écritures réussissent : renvoie ok:true, les cinq clés reflètent le nouveau payload", async () => {
    vi.stubGlobal("localStorage", new QuotaLimitedStorage(1_000_000));
    const { restoreBackup, localData } = await import("@/lib/storage");
    const exercise = { ...makeExerciseForTest(), id: "new-1", title: "Nouveau" };
    const result = restoreBackup({
      exercises: [exercise],
      sessions: [],
      preferences: { ...defaultPreferencesForTest(), displayName: "Nouveau nom" },
      chapters: [],
      weekSnapshots: [],
    });
    expect(result).toEqual({ ok: true });
    expect(localData.exercises()[0].title).toBe("Nouveau");
    expect(localData.preferences().displayName).toBe("Nouveau nom");
  });

  it("une écriture échoue au milieu de la séquence : TOUTES les clés reviennent à leur valeur d'avant, aucun mélange", async () => {
    const storage = new QuotaLimitedStorage(2000);
    vi.stubGlobal("localStorage", storage);
    const { restoreBackup, localData } = await import("@/lib/storage");

    // État précédent, distinct et repérable sur chaque clé concernée.
    localData.saveExercises([{ ...makeExerciseForTest(), id: "old-1", title: "ANCIEN" }]);
    localData.saveSessions([]);
    localData.savePreferences({ ...defaultPreferencesForTest(), displayName: "Ancien nom" });

    // `sessions` du nouveau payload est volontairement énorme : `exercises` (écrit avant) passe,
    // `sessions` dépasse le quota restant — exactement le cas "échec au milieu" de l'audit.
    const hugeNote = "z".repeat(5000);
    const result = restoreBackup({
      exercises: [{ ...makeExerciseForTest(), id: "new-1", title: "NOUVEAU" }],
      sessions: [{ id: "s1", subject: "Mathématiques", exercise_id: null, started_at: "2026-01-01T00:00:00.000Z", ended_at: null, duration_seconds: 1, note: hugeNote, created_at: "2026-01-01T00:00:00.000Z", result: null }],
      preferences: { ...defaultPreferencesForTest(), displayName: "Nouveau nom" },
      chapters: [],
      weekSnapshots: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rolledBack).toBe(true);
    // Aucun mélange : exercises ET preferences reviennent à l'ANCIEN état, pas seulement sessions.
    expect(localData.exercises()[0].title).toBe("ANCIEN");
    expect(localData.preferences().displayName).toBe("Ancien nom");
    expect(localData.sessions()).toEqual([]);
  });

  it("l'échec peut survenir sur N'IMPORTE LAQUELLE des cinq clés (pas seulement exercises/sessions) : rollback complet à chaque fois", async () => {
    // Ordre réel d'écriture dans restoreBackup : exercises, sessions, preferences, chapters, weekSnapshots.
    // On fait successivement échouer chacune des CINQ clés (via une clé "poison" trop grosse pour le
    // budget restant) et on vérifie, à chaque fois, que les CINQ reviennent à l'état précédent.
    const cases: Array<"exercises" | "sessions" | "preferences" | "chapters" | "weekSnapshots"> = [
      "exercises",
      "sessions",
      "preferences",
      "chapters",
      "weekSnapshots",
    ];
    for (const poisoned of cases) {
      const storage = new QuotaLimitedStorage(100_000);
      vi.stubGlobal("localStorage", storage);
      const { restoreBackup, localData } = await import("@/lib/storage");

      localData.saveExercises([{ ...makeExerciseForTest(), id: "old-ex", title: "ANCIEN-EX" }]);
      localData.saveSessions([{ id: "old-s", subject: "Mathématiques", exercise_id: null, started_at: "2026-01-01T00:00:00.000Z", ended_at: null, duration_seconds: 1, note: null, created_at: "2026-01-01T00:00:00.000Z", result: null }]);
      localData.savePreferences({ ...defaultPreferencesForTest(), displayName: "ANCIEN-NOM" });
      localData.saveChapters([{ id: "old-c", subject: "Mathématiques", label: "ANCIEN-CHAPITRE" }]);
      localData.saveWeekSnapshots([{ weekStart: "2026-01-05T00:00:00.000Z", capturedAt: "2026-01-12T00:00:00.000Z", totalSeconds: 111, bySubject: [], activeCount: 1, masteredCount: 0, completionRate: 0, bySubjectProgress: [] }]);

      const hugeText = "p".repeat(150_000);
      const payload = {
        exercises: [{ ...makeExerciseForTest(), id: "new-ex", title: poisoned === "exercises" ? hugeText : "NOUVEAU-EX" }],
        sessions: [{ id: "new-s", subject: "Mathématiques" as const, exercise_id: null, started_at: "2026-01-01T00:00:00.000Z", ended_at: null, duration_seconds: 1, note: poisoned === "sessions" ? hugeText : "nouveau", created_at: "2026-01-01T00:00:00.000Z", result: null }],
        preferences: { ...defaultPreferencesForTest(), displayName: poisoned === "preferences" ? hugeText : "NOUVEAU-NOM" },
        chapters: [{ id: "new-c", subject: "Mathématiques" as const, label: poisoned === "chapters" ? hugeText : "NOUVEAU-CHAPITRE" }],
        weekSnapshots: [{ weekStart: poisoned === "weekSnapshots" ? hugeText : "2026-01-12T00:00:00.000Z", capturedAt: "2026-01-19T00:00:00.000Z", totalSeconds: 222, bySubject: [], activeCount: 2, masteredCount: 0, completionRate: 0, bySubjectProgress: [] }],
      };

      const result = restoreBackup(payload);
      expect(result.ok, `poisoned=${poisoned}`).toBe(false);
      if (!result.ok) expect(result.rolledBack, `poisoned=${poisoned}`).toBe(true);

      // Les CINQ clés doivent être revenues à l'ancien état — pas seulement celle qui a échoué.
      expect(localData.exercises()[0].title, `poisoned=${poisoned}`).toBe("ANCIEN-EX");
      expect(localData.sessions()[0].note, `poisoned=${poisoned}`).toBe(null);
      expect(localData.preferences().displayName, `poisoned=${poisoned}`).toBe("ANCIEN-NOM");
      expect(localData.chapters()[0].label, `poisoned=${poisoned}`).toBe("ANCIEN-CHAPITRE");
      expect(localData.weekSnapshots()[0].totalSeconds, `poisoned=${poisoned}`).toBe(111);
    }
  });

  it("cas pathologique : le rollback lui-même échoue (ex. localStorage totalement indisponible) — renvoie rolledBack:false, jamais une exception non gérée", async () => {
    const alwaysFails = { getItem: () => null, setItem: () => { throw new DOMException("disabled", "QuotaExceededError"); } };
    vi.stubGlobal("localStorage", alwaysFails);
    const { restoreBackup } = await import("@/lib/storage");
    let result: ReturnType<typeof restoreBackup> | undefined;
    expect(() => {
      result = restoreBackup({
        exercises: [makeExerciseForTest()],
        sessions: [],
        preferences: defaultPreferencesForTest(),
        chapters: [],
        weekSnapshots: [],
      });
    }).not.toThrow();
    expect(result).toEqual({ ok: false, rolledBack: false });
  });
});

function makeExerciseForTest(): Exercise {
  return {
    id: "base",
    subject: "Mathématiques",
    title: "Exercice",
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
    priority: 3,
    mastery: 0,
    status: "à faire",
    estimated_minutes: null,
    attempts: 0,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: null,
  };
}

function defaultPreferencesForTest() {
  return normalizePreferences({});
}
