import { describe, expect, it } from "vitest";
import {
  LocalStorageRepository,
  STORAGE_KEY,
  parseBackup,
  serializeBackup,
} from "@/lib/store/repository";
import { emptyState, normalizeState, readBackup, STATE_VERSION } from "@/lib/store/schema";
import { makeEntry, makeState, makeTask, NOW, slot } from "@/lib/domain/__tests__/fixtures";
import { scheduleTask } from "@/lib/domain/tasks";
import type { AppState } from "@/lib/domain/types";

/** `localStorage` minimal — suffisant pour tester la persistance sans environnement navigateur. */
function installLocalStorage(failing = false) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failing) throw new DOMException("QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  return { data, storage };
}

describe("normalisation — la frontière de confiance", () => {
  it("rejette une tâche sans titre plutôt que d'afficher une ligne vide", () => {
    expect(normalizeState({ tasks: [{ id: "1", title: "   " }, { id: "2", title: "TD" }] }).tasks).toHaveLength(1);
  });

  it("neutralise une date illisible au lieu de faire planter le rendu", () => {
    const [task] = normalizeState({ tasks: [{ id: "1", title: "TD", dueAt: "pas-une-date", createdAt: "n'importe quoi" }] }).tasks;
    expect(task.dueAt).toBeUndefined();
    expect(() => new Date(task.createdAt).toISOString()).not.toThrow();
  });

  it("refuse une durée négative, qui fausserait durablement toutes les sommes", () => {
    const [task] = normalizeState({ tasks: [{ id: "1", title: "TD", estimatedMinutes: -120 }] }).tasks;
    expect(task.estimatedMinutes).toBeUndefined();
    const state = normalizeState({ timeEntries: [{ id: "e", minutes: -60, startedAt: NOW.toISOString() }] });
    expect(state.timeEntries).toEqual([]);
  });

  it("ramène un statut ou une catégorie inconnus sur une valeur sûre", () => {
    const [task] = normalizeState({ tasks: [{ id: "1", title: "TD", status: "zombie", category: "inventée", priority: 99 }] }).tasks;
    expect(task.status).toBe("todo");
    expect(task.category).toBe("autre");
    expect(task.priority).toBe(2);
  });

  it("répare des créneaux incohérents au lieu de les propager", () => {
    const [task] = normalizeState({
      tasks: [{ id: "1", title: "TD", slots: [{ start: "x", end: "y" }, { start: "2026-09-14T20:00:00.000Z", end: "2026-09-14T19:00:00.000Z" }] }],
    }).tasks;
    expect(task.slots).toEqual([]);
  });

  it("coupe les références orphelines (matière, objectif, tâche supprimées)", () => {
    const state = normalizeState({
      subjects: [{ id: "maths", label: "Mathématiques", short: "M", tone: "violet", order: 0 }],
      tasks: [{ id: "t1", title: "TD", subjectId: "disparue", goalId: "fantome" }],
      timeEntries: [{ id: "e1", taskId: "inexistante", minutes: 30, startedAt: NOW.toISOString() }],
    });
    expect(state.tasks[0].subjectId).toBeUndefined();
    expect(state.tasks[0].goalId).toBeUndefined();
    expect(state.timeEntries[0].taskId).toBeUndefined();
  });

  it("restaure les matières par défaut quand une sauvegarde n'en contient aucune", () => {
    expect(normalizeState({ subjects: [] }).subjects.length).toBeGreaterThan(0);
  });

  it("survit à un état qui n'est pas un objet", () => {
    for (const raw of [null, undefined, 42, "texte", []]) {
      expect(() => normalizeState(raw)).not.toThrow();
    }
    expect(normalizeState(null).tasks).toEqual([]);
  });

  it("fusionne des plages de disponibilité qui se chevauchent", () => {
    const state = normalizeState({
      availability: { weekly: { "0": [{ start: "18:00", end: "21:00" }, { start: "20:00", end: "22:00" }] }, exceptions: [] },
    });
    expect(state.availability.weekly[0]).toEqual([{ start: "18:00", end: "22:00" }]);
  });

  it("écarte une heure impossible", () => {
    const state = normalizeState({ availability: { weekly: { "0": [{ start: "25:00", end: "99:99" }] }, exceptions: [] } });
    expect(state.availability.weekly[0]).toEqual([]);
  });
});

describe("sauvegarde et restauration", () => {
  const source: AppState = makeState({
    tasks: [scheduleTask(makeTask({ title: "DM de physique", estimatedMinutes: 120 }), [slot(1, "18:00", 90)])],
    timeEntries: [makeEntry(45)],
  });

  it("fait un aller-retour sans rien perdre", () => {
    const restored = parseBackup(serializeBackup(source, NOW));
    expect(restored).not.toBeNull();
    expect(restored!.tasks[0].title).toBe("DM de physique");
    expect(restored!.tasks[0].slots).toHaveLength(1);
    expect(restored!.timeEntries[0].minutes).toBe(45);
  });

  it("accepte aussi un état nu, sans enveloppe — un fichier édité à la main reste importable", () => {
    expect(readBackup(source)).not.toBeNull();
  });

  it("refuse un fichier qui n'est pas une sauvegarde", () => {
    expect(parseBackup("{}")).toBeNull();
    expect(parseBackup("pas du json")).toBeNull();
  });

  it("une sauvegarde d'une version plus récente est lue plutôt que refusée", () => {
    const future = JSON.stringify({ app: "taekdhub", version: 99, state: { ...source, version: 99 } });
    const restored = parseBackup(future);
    expect(restored?.version).toBe(STATE_VERSION);
    expect(restored?.tasks).toHaveLength(1);
  });
});

describe("dépôt local", () => {
  it("écrit puis relit l'état à l'identique", () => {
    installLocalStorage();
    const repo = new LocalStorageRepository();
    const state = makeState({ tasks: [makeTask({ title: "TD 4" })] });
    expect(repo.save(state)).toBe(true);
    expect(repo.load().tasks[0].title).toBe("TD 4");
  });

  it("repart d'un état vide plutôt que de planter sur un stockage corrompu", () => {
    const { data } = installLocalStorage();
    data.set(STORAGE_KEY, "{ ceci n'est pas du json");
    expect(new LocalStorageRepository().load()).toEqual(emptyState());
  });

  it("SIGNALE un refus d'écriture au lieu de le taire", () => {
    installLocalStorage(true);
    const repo = new LocalStorageRepository();
    expect(repo.save(makeState())).toBe(false);
    expect(repo.lastFailure()).not.toBeNull();
  });
});
