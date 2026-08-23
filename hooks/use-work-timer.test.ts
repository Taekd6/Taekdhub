import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCheckpoint,
  checkpointAgeMs,
  CHECKPOINT_RECOVERY_MAX_AGE_MS,
  clearCheckpoint,
  computeElapsedSeconds,
  findPersistedSessionSuffix,
  findRecoverableCheckpoint,
  isCheckpointRecoverable,
  type TimerCheckpoint,
  type WorkTimerSnapshot,
} from "@/hooks/use-work-timer";

/**
 * Environnement Vitest par défaut = Node, sans DOM (voir vitest.config.ts).
 * `hooks/use-work-timer.ts` extrait volontairement toute sa logique de
 * calcul/décision en fonctions pures ou quasi-pures (horloge injectable via
 * `now`, lecture/écriture localStorage/sessionStorage isolées) précisément
 * pour rester testable sans jsdom ni @testing-library/react (absents du
 * projet) — le câblage React (useEffect, visibilitychange, pagehide) reste,
 * lui, vérifié manuellement (voir le rapport de sprint, section validation
 * desktop/mobile).
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

let originalWindow: typeof globalThis.window;
let originalLocalStorage: typeof globalThis.localStorage;
let originalSessionStorage: typeof globalThis.sessionStorage;

beforeEach(() => {
  originalWindow = globalThis.window;
  originalLocalStorage = globalThis.localStorage;
  originalSessionStorage = globalThis.sessionStorage;
  // @ts-expect-error — polyfill minimal pour le test, pas un vrai `window`.
  globalThis.window = {};
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
});

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.localStorage = originalLocalStorage;
  globalThis.sessionStorage = originalSessionStorage;
});

function snapshot(overrides: Partial<WorkTimerSnapshot<unknown>> = {}): WorkTimerSnapshot<unknown> {
  return {
    startedAt: "2026-01-07T10:00:00.000Z",
    accumulatedSeconds: 0,
    runningSince: null,
    context: {},
    ...overrides,
  };
}

describe("computeElapsedSeconds — calcul du temps écoulé", () => {
  it("aucune séance : 0", () => {
    expect(computeElapsedSeconds(null)).toBe(0);
  });

  it("en pause (runningSince: null) : uniquement l'accumulé, aucun extra — déjà en pause = no-op", () => {
    const s = snapshot({ accumulatedSeconds: 120, runningSince: null });
    expect(computeElapsedSeconds(s, Date.parse("2026-01-07T12:00:00.000Z"))).toBe(120);
  });

  it("en cours : accumulé + secondes écoulées depuis `runningSince`", () => {
    const s = snapshot({ accumulatedSeconds: 60, runningSince: "2026-01-07T10:00:00.000Z" });
    const now = Date.parse("2026-01-07T10:00:30.000Z");
    expect(computeElapsedSeconds(s, now)).toBe(90);
  });

  it("reprise simulée (reload) : mêmes horodatages, `now` avancé — le temps écoulé pendant le rechargement compte", () => {
    const s = snapshot({ accumulatedSeconds: 0, runningSince: "2026-01-07T10:00:00.000Z" });
    const beforeReload = computeElapsedSeconds(s, Date.parse("2026-01-07T10:00:05.000Z"));
    const afterReload = computeElapsedSeconds(s, Date.parse("2026-01-07T10:01:00.000Z"));
    expect(beforeReload).toBe(5);
    expect(afterReload).toBe(60);
  });

  it("jamais de durée négative même avec une horloge incohérente (`now` avant `runningSince`)", () => {
    const s = snapshot({ accumulatedSeconds: 10, runningSince: "2026-01-07T10:00:00.000Z" });
    const now = Date.parse("2026-01-07T09:59:00.000Z");
    expect(computeElapsedSeconds(s, now)).toBe(10);
  });
});

describe("buildCheckpoint / checkpointAgeMs / isCheckpointRecoverable — pure", () => {
  it("le checkpoint stocke des secondes déjà résolues, jamais un horodatage à prolonger", () => {
    const s = snapshot({ accumulatedSeconds: 30, runningSince: "2026-01-07T10:00:00.000Z" });
    const now = Date.parse("2026-01-07T10:02:00.000Z");
    const checkpoint = buildCheckpoint(s, now);
    expect(checkpoint.seconds).toBe(150);
    expect(checkpoint.savedAt).toBe(new Date(now).toISOString());
    expect(checkpoint.startedAt).toBe(s.startedAt);
  });

  it("checkpoint récent (bien en dessous du seuil) : récupérable", () => {
    const checkpoint: TimerCheckpoint = { startedAt: "2026-01-07T10:00:00.000Z", seconds: 300, savedAt: "2026-01-07T10:05:00.000Z" };
    const now = Date.parse("2026-01-07T10:06:00.000Z");
    expect(isCheckpointRecoverable(checkpoint, now)).toBe(true);
  });

  it("checkpoint trop vieux (au-delà de CHECKPOINT_RECOVERY_MAX_AGE_MS) : jamais récupérable", () => {
    const savedAt = "2026-01-07T00:00:00.000Z";
    const checkpoint: TimerCheckpoint = { startedAt: savedAt, seconds: 300, savedAt };
    const justOver = Date.parse(savedAt) + CHECKPOINT_RECOVERY_MAX_AGE_MS + 1;
    expect(checkpointAgeMs(checkpoint, justOver)).toBeGreaterThan(CHECKPOINT_RECOVERY_MAX_AGE_MS);
    expect(isCheckpointRecoverable(checkpoint, justOver)).toBe(false);
  });

  it("checkpoint vide (0 seconde) : jamais récupérable, même récent", () => {
    const checkpoint: TimerCheckpoint = { startedAt: "2026-01-07T10:00:00.000Z", seconds: 0, savedAt: "2026-01-07T10:00:00.000Z" };
    expect(isCheckpointRecoverable(checkpoint, Date.parse("2026-01-07T10:00:01.000Z"))).toBe(false);
  });

  it("une récupération ne prolonge jamais la durée jusqu'à `now` : un checkpoint vieux de 14h garde ses secondes d'origine, jamais 14h de plus", () => {
    const s = snapshot({ accumulatedSeconds: 600, runningSince: "2026-01-07T10:00:00.000Z" });
    const savedAt = Date.parse("2026-01-07T10:05:00.000Z");
    const checkpoint = buildCheckpoint(s, savedAt);
    const muchLater = savedAt + 14 * 60 * 60 * 1000;
    // Les secondes du checkpoint restent celles figées à l'écriture, jamais recalculées à `muchLater`.
    expect(checkpoint.seconds).toBe(900);
    expect(isCheckpointRecoverable(checkpoint, muchLater)).toBe(false);
  });
});

describe("findRecoverableCheckpoint — récupération depuis localStorage", () => {
  const FOCUS_PREFIX = "prepahub:timer:focus:";

  function putCheckpoint(storageKey: string, checkpoint: TimerCheckpoint) {
    localStorage.setItem(`prepahub:timer-checkpoint:${storageKey}`, JSON.stringify(checkpoint));
  }

  it("checkpoint récent détecté, avec le bon suffixe (identifiant d'exercice)", () => {
    putCheckpoint(`${FOCUS_PREFIX}ex-1`, { startedAt: "2026-01-07T10:00:00.000Z", seconds: 400, savedAt: "2026-01-07T10:10:00.000Z" });
    const now = Date.parse("2026-01-07T10:11:00.000Z");
    const found = findRecoverableCheckpoint(FOCUS_PREFIX, now);
    expect(found?.suffix).toBe("ex-1");
    expect(found?.checkpoint.seconds).toBe(400);
  });

  it("checkpoint trop vieux : ni renvoyé, ni laissé en place (nettoyé)", () => {
    const savedAt = "2026-01-01T00:00:00.000Z";
    putCheckpoint(`${FOCUS_PREFIX}ex-old`, { startedAt: savedAt, seconds: 400, savedAt });
    const now = Date.parse(savedAt) + CHECKPOINT_RECOVERY_MAX_AGE_MS + 1000;
    expect(findRecoverableCheckpoint(FOCUS_PREFIX, now)).toBeNull();
    expect(localStorage.getItem(`prepahub:timer-checkpoint:${FOCUS_PREFIX}ex-old`)).toBeNull();
  });

  it("aucun checkpoint : null", () => {
    expect(findRecoverableCheckpoint(FOCUS_PREFIX)).toBeNull();
  });

  it("JSON corrompu : traité comme absent et nettoyé", () => {
    localStorage.setItem(`prepahub:timer-checkpoint:${FOCUS_PREFIX}ex-2`, "{ invalide");
    expect(findRecoverableCheckpoint(FOCUS_PREFIX)).toBeNull();
    expect(localStorage.getItem(`prepahub:timer-checkpoint:${FOCUS_PREFIX}ex-2`)).toBeNull();
  });

  it("un checkpoint du chrono libre n'est jamais confondu avec un checkpoint Focus (Task 11)", () => {
    putCheckpoint("prepahub:timer:free", { startedAt: "2026-01-07T10:00:00.000Z", seconds: 500, savedAt: "2026-01-07T10:10:00.000Z" });
    expect(findRecoverableCheckpoint(FOCUS_PREFIX)).toBeNull();
  });

  it("clearCheckpoint supprime un checkpoint — plus jamais retrouvé ensuite", () => {
    putCheckpoint(`${FOCUS_PREFIX}ex-3`, { startedAt: "2026-01-07T10:00:00.000Z", seconds: 300, savedAt: "2026-01-07T10:10:00.000Z" });
    clearCheckpoint(`${FOCUS_PREFIX}ex-3`);
    expect(findRecoverableCheckpoint(FOCUS_PREFIX)).toBeNull();
  });
});

describe("findPersistedSessionSuffix — reprise sessionStorage normale (inchangée)", () => {
  it("retrouve le suffixe d'une clé sessionStorage existante", () => {
    sessionStorage.setItem("prepahub:timer:focus:ex-7", JSON.stringify(snapshot()));
    expect(findPersistedSessionSuffix("prepahub:timer:focus:")).toBe("ex-7");
  });

  it("aucune séance persistée : null", () => {
    expect(findPersistedSessionSuffix("prepahub:timer:focus:")).toBeNull();
  });

  it("ne confond jamais le chrono libre avec une clé focus (Task 11)", () => {
    sessionStorage.setItem("prepahub:timer:free", JSON.stringify(snapshot()));
    expect(findPersistedSessionSuffix("prepahub:timer:focus:")).toBeNull();
  });
});
