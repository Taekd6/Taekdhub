import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearFocusDraft, findPersistedFocusDraft, readFocusDraft, writeFocusDraft } from "@/lib/focus-draft";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * Environnement Vitest par défaut = Node, sans DOM (voir vitest.config.ts) :
 * `lib/focus-draft.ts` ne dépend que de `window`/`localStorage`, donc un
 * polyfill en mémoire minimal suffit à le tester sans jsdom — cohérent avec
 * le choix du projet de garder cette config volontairement légère.
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

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s-1",
    subject: "Mathématiques",
    exercise_id: "ex-1",
    started_at: "2026-01-07T10:00:00.000Z",
    ended_at: "2026-01-07T10:20:00.000Z",
    duration_seconds: 1200,
    note: null,
    created_at: "2026-01-07T10:20:00.000Z",
    result: null,
    ...overrides,
  };
}

let originalWindow: typeof globalThis.window;
let originalLocalStorage: typeof globalThis.localStorage;

beforeEach(() => {
  originalWindow = globalThis.window;
  originalLocalStorage = globalThis.localStorage;
  // @ts-expect-error — polyfill minimal pour le test, pas un vrai `window`.
  globalThis.window = {};
  globalThis.localStorage = new MemoryStorage();
});

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.localStorage = originalLocalStorage;
});

describe("focus draft — écriture/lecture/nettoyage", () => {
  it("écrit puis relit exactement le même draft", () => {
    const draft = makeSession();
    writeFocusDraft("ex-1", draft);
    expect(readFocusDraft("ex-1")).toEqual(draft);
  });

  it("aucun draft pour un exercice qui n'en a pas", () => {
    expect(readFocusDraft("ex-999")).toBeNull();
  });

  it("clearFocusDraft supprime le draft — plus jamais retrouvé ensuite", () => {
    writeFocusDraft("ex-1", makeSession());
    clearFocusDraft("ex-1");
    expect(readFocusDraft("ex-1")).toBeNull();
    expect(findPersistedFocusDraft()).toBeNull();
  });

  it("JSON corrompu : traité comme absent, et l'entrée corrompue est nettoyée", () => {
    localStorage.setItem("prepahub:timer:focus-draft:ex-1", "{ pas du json valide");
    expect(readFocusDraft("ex-1")).toBeNull();
    expect(localStorage.getItem("prepahub:timer:focus-draft:ex-1")).toBeNull();
  });
});

describe("findPersistedFocusDraft — détection tous exercices confondus", () => {
  it("retrouve le draft, quel que soit l'exercice concerné", () => {
    const draft = makeSession({ exercise_id: "ex-42" });
    writeFocusDraft("ex-42", draft);
    expect(findPersistedFocusDraft()).toEqual(draft);
  });

  it("aucun draft en attente : null", () => {
    expect(findPersistedFocusDraft()).toBeNull();
  });

  it("ignore les autres clés localStorage (ex. checkpoints, timer libre)", () => {
    localStorage.setItem("prepahub:timer:free", "quelque chose");
    localStorage.setItem("prepahub:timer-checkpoint:prepahub:timer:focus:ex-1", "quelque chose");
    expect(findPersistedFocusDraft()).toBeNull();
  });
});
