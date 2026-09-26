import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import { mergeList } from "@/lib/sync/collections";
import { SyncEngine, SYNC_META_KEY, type LocalStore, type PushResult, type RemoteRow, type RemoteStore } from "@/lib/sync/engine";
import type { CollectionName } from "@/lib/sync/collections";

/* ── Doubles de test ─────────────────────────────────────────────── */

class MemoryLocal implements LocalStore {
  data = new Map<string, string>();
  read(key: string) {
    return this.data.get(key) ?? null;
  }
  write(key: string, raw: string) {
    this.data.set(key, raw);
    return true;
  }
  set(collection: CollectionName, value: unknown) {
    this.data.set(STORAGE_KEYS[collection], JSON.stringify(value));
  }
  get(collection: CollectionName): unknown {
    const raw = this.data.get(STORAGE_KEYS[collection]);
    return raw === undefined ? undefined : JSON.parse(raw);
  }
}

/** Serveur en mémoire avec la MÊME règle que la table : on ne remplace que la révision attendue. */
class MemoryRemote implements RemoteStore {
  rows = new Map<CollectionName, RemoteRow>();
  offline = false;
  pushes = 0;
  /** Appelé juste avant d'appliquer un envoi — simule un autre appareil qui passe entre-temps. */
  beforePush: ((collection: CollectionName) => void) | null = null;

  seed(collection: CollectionName, items: unknown, revision = 1, updatedAt = "2026-09-20T10:00:00.000Z") {
    this.rows.set(collection, { collection, items, revision, updatedAt });
  }
  async fetchAll() {
    if (this.offline) throw new Error("hors ligne");
    return [...this.rows.values()].map((row) => ({ ...row }));
  }
  async fetchOne(collection: CollectionName) {
    if (this.offline) throw new Error("hors ligne");
    const row = this.rows.get(collection);
    return row ? { ...row } : null;
  }
  async push(collection: CollectionName, items: unknown, baseRevision: number): Promise<PushResult> {
    if (this.offline) return { ok: false, conflict: false, error: "hors ligne" };
    this.beforePush?.(collection);
    this.pushes += 1;
    const current = this.rows.get(collection);
    if ((current?.revision ?? 0) !== baseRevision) return { ok: false, conflict: true };
    const next = { collection, items, revision: baseRevision + 1, updatedAt: "2026-09-24T18:00:00.000Z" };
    this.rows.set(collection, next);
    return { ok: true, revision: next.revision, updatedAt: next.updatedAt };
  }
}

const NOW = new Date("2026-09-24T17:00:00.000Z");
const USER = "user-a";

function setup() {
  const local = new MemoryLocal();
  const remote = new MemoryRemote();
  const engine = new SyncEngine(local, remote, () => NOW);
  return { local, remote, engine };
}

const session = (id: string, created = "2026-09-20T08:00:00.000Z") => ({ id, subject: "Physique", started_at: created, duration_seconds: 600, created_at: created });

/* ── Premier login ───────────────────────────────────────────────── */

describe("premier login", () => {
  it("appareil vide, compte vide : rien à décider, le cache appartient au compte", async () => {
    const { engine } = setup();
    const outcome = await engine.signIn(USER);
    expect(outcome.type).toBe("synced");
    expect(engine.readMeta().ownerId).toBe(USER);
  });

  it("appareil vide, compte rempli : le compte est téléchargé", async () => {
    const { engine, local, remote } = setup();
    remote.seed("sessions", [session("s1")], 4);
    const outcome = await engine.signIn(USER);
    expect(outcome.type).toBe("synced");
    expect(local.get("sessions")).toEqual([session("s1")]);
    expect(engine.readMeta().collections.sessions).toMatchObject({ revision: 4, dirty: false });
  });

  it("des données locales et un compte vide : on DEMANDE avant d'envoyer quoi que ce soit", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("s1")]);
    const outcome = await engine.signIn(USER);
    expect(outcome).toMatchObject({ type: "decision", decision: { kind: "import", foreignOwner: false, local: { sessions: 1 } } });
    expect(remote.pushes).toBe(0);
    expect(engine.readMeta().ownerId).toBeNull();
  });

  it("« Importer mes données » envoie tout, et le cache appartient désormais au compte", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("s1"), session("s2")]);
    local.set("preferences", { displayName: "Taekd" });
    await engine.signIn(USER);
    const report = await engine.resolveDecision(USER, "importer");
    expect(report.failed).toEqual([]);
    expect(remote.rows.get("sessions")?.items).toEqual([session("s1"), session("s2")]);
    expect(remote.rows.get("preferences")?.items).toEqual({ displayName: "Taekd" });
    expect(engine.readMeta().ownerId).toBe(USER);
    expect(engine.hasPendingChanges()).toBe(false);
  });

  it("des données des deux côtés : décision « conflit », jamais d'écrasement silencieux", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("local")]);
    remote.seed("sessions", [session("cloud")]);
    const outcome = await engine.signIn(USER);
    expect(outcome).toMatchObject({ type: "decision", decision: { kind: "conflit", local: { sessions: 1 }, remote: { sessions: 1 } } });
    expect(local.get("sessions")).toEqual([session("local")]);
    expect(remote.rows.get("sessions")?.items).toEqual([session("cloud")]);
  });

  it("« Fusionner » réunit les deux côtés, sur l'appareil ET sur le compte", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("local")]);
    remote.seed("sessions", [session("cloud")], 3);
    await engine.signIn(USER);
    await engine.resolveDecision(USER, "fusionner");
    const expected = [session("local"), session("cloud")];
    expect(local.get("sessions")).toEqual(expected);
    expect(remote.rows.get("sessions")).toMatchObject({ items: expected, revision: 4 });
  });

  it("« Garder le compte » remplace l'appareil par le compte", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("local")]);
    local.set("grades", [{ id: "g1" }]);
    remote.seed("sessions", [session("cloud")]);
    await engine.signIn(USER);
    await engine.resolveDecision(USER, "compte");
    expect(local.get("sessions")).toEqual([session("cloud")]);
    expect(local.get("grades")).toEqual([]);
    expect(remote.rows.has("grades")).toBe(false);
  });

  it("les données d'un AUTRE compte sur l'appareil déclenchent aussi une décision", async () => {
    const { engine, local } = setup();
    local.data.set(SYNC_META_KEY, JSON.stringify({ ownerId: "user-b", collections: {}, lastSyncedAt: null }));
    local.set("errors", [{ id: "e1", createdAt: "2026-09-01T00:00:00.000Z" }]);
    const outcome = await engine.signIn(USER);
    expect(outcome).toMatchObject({ type: "decision", decision: { foreignOwner: true } });
  });

  it("hors ligne au moment du login : l'erreur remonte, rien n'est modifié", async () => {
    const { engine, local, remote } = setup();
    local.set("sessions", [session("s1")]);
    remote.offline = true;
    await expect(engine.signIn(USER)).rejects.toThrow();
    expect(local.get("sessions")).toEqual([session("s1")]);
    expect(engine.readMeta().ownerId).toBeNull();
  });
});

/* ── Synchronisation ordinaire ───────────────────────────────────── */

async function signedIn() {
  const context = setup();
  await context.engine.signIn(USER);
  return context;
}

describe("synchronisation ordinaire", () => {
  it("une écriture locale marque la collection, puis part au serveur", async () => {
    const { engine, local, remote } = await signedIn();
    local.set("grades", [{ id: "g1" }]);
    expect(engine.markDirty(STORAGE_KEYS.grades)).toBe("grades");
    expect(engine.hasPendingChanges()).toBe(true);
    await engine.sync(USER);
    expect(remote.rows.get("grades")).toMatchObject({ items: [{ id: "g1" }], revision: 1 });
    expect(engine.hasPendingChanges()).toBe(false);
  });

  it("une clé qui n'est pas une collection synchronisée est ignorée", async () => {
    const { engine } = await signedIn();
    expect(engine.markDirty("prepahub:last-backup")).toBeNull();
    expect(engine.hasPendingChanges()).toBe(false);
  });

  it("le serveur a avancé, rien de local : la version serveur est prise", async () => {
    const { engine, local, remote } = await signedIn();
    remote.seed("sessions", [session("autre-appareil")], 2);
    const report = await engine.sync(USER);
    expect(report.pulled).toContain("sessions");
    expect(local.get("sessions")).toEqual([session("autre-appareil")]);
  });

  it("les deux ont changé : fusion, puis envoi fondé sur la révision serveur", async () => {
    const { engine, local, remote } = await signedIn();
    remote.seed("sessions", [session("a")], 1);
    await engine.sync(USER);
    // Un autre appareil ajoute « b » ; celui-ci ajoute « c » hors ligne.
    remote.seed("sessions", [session("a"), session("b")], 2);
    local.set("sessions", [session("a"), session("c")]);
    engine.markDirty(STORAGE_KEYS.sessions);
    const report = await engine.sync(USER);
    expect(report.merged).toContain("sessions");
    const ids = (remote.rows.get("sessions")!.items as { id: string }[]).map((item) => item.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
    expect(remote.rows.get("sessions")!.revision).toBe(3);
  });

  it("un autre appareil passe PENDANT l'envoi : refus, relecture, fusion, nouvel envoi", async () => {
    const { engine, local, remote } = await signedIn();
    local.set("errors", [{ id: "e-local", createdAt: "2026-09-24T10:00:00.000Z" }]);
    engine.markDirty(STORAGE_KEYS.errors);
    let raced = false;
    remote.beforePush = (collection) => {
      if (collection !== "errors" || raced) return;
      raced = true;
      remote.seed("errors", [{ id: "e-autre", createdAt: "2026-09-24T09:00:00.000Z" }], 1);
    };
    const report = await engine.pushDirty();
    expect(report.merged).toContain("errors");
    const ids = (remote.rows.get("errors")!.items as { id: string }[]).map((item) => item.id).sort();
    expect(ids).toEqual(["e-autre", "e-local"]);
  });

  it("hors ligne : rien n'est perdu, la collection reste « à envoyer » et part au retour du réseau", async () => {
    const { engine, local, remote } = await signedIn();
    local.set("checkins", [{ date: "2026-09-24", updatedAt: "2026-09-24T20:00:00.000Z" }]);
    engine.markDirty(STORAGE_KEYS.checkins);
    remote.offline = true;
    const report = await engine.pushDirty();
    expect(report.failed).toEqual(["checkins"]);
    expect(engine.hasPendingChanges()).toBe(true);
    remote.offline = false;
    await engine.sync(USER);
    expect(engine.hasPendingChanges()).toBe(false);
    expect(remote.rows.get("checkins")?.items).toEqual([{ date: "2026-09-24", updatedAt: "2026-09-24T20:00:00.000Z" }]);
  });

  it("refuse de synchroniser un cache qui appartient à un autre compte", async () => {
    const { engine } = await signedIn();
    await expect(engine.sync("user-b")).rejects.toThrow();
  });
});

/* ── Déconnexion ─────────────────────────────────────────────────── */

describe("déconnexion", () => {
  it("par défaut, les données restent sur l'appareil", async () => {
    const { engine, local } = await signedIn();
    local.set("sessions", [session("s1")]);
    expect(engine.signOut({ wipe: false })).toBe(true);
    expect(local.get("sessions")).toEqual([session("s1")]);
  });

  it("effacer l'appareil est refusé tant que des modifications n'ont pas été envoyées", async () => {
    const { engine, local } = await signedIn();
    local.set("sessions", [session("s1")]);
    engine.markDirty(STORAGE_KEYS.sessions);
    expect(engine.signOut({ wipe: true })).toBe(false);
    expect(local.get("sessions")).toEqual([session("s1")]);
  });

  it("effacer l'appareil une fois tout envoyé : les collections sont vidées, les réglages restent", async () => {
    const { engine, local } = await signedIn();
    local.set("sessions", [session("s1")]);
    local.set("preferences", { palette: "ocean" });
    engine.markDirty(STORAGE_KEYS.sessions);
    await engine.sync(USER);
    expect(engine.signOut({ wipe: true })).toBe(true);
    expect(local.get("sessions")).toEqual([]);
    expect(local.get("preferences")).toEqual({ palette: "ocean" });
    expect(engine.readMeta().ownerId).toBeNull();
  });
});

/* ── Fusion ──────────────────────────────────────────────────────── */

describe("fusion des collections", () => {
  it("une carte révisée sur l'autre appareil l'emporte sur la version locale plus ancienne", () => {
    const base = { id: "r1", createdAt: "2026-09-01T00:00:00.000Z", doneAt: null };
    const localVersion = { ...base, srs: { lastReviewedAt: "2026-09-10T00:00:00.000Z" } };
    const remoteVersion = { ...base, srs: { lastReviewedAt: "2026-09-20T00:00:00.000Z" } };
    expect(mergeList("reviewItems", [localVersion], [remoteVersion])).toEqual([remoteVersion]);
  });

  it("une note résolue l'emporte sur la même note encore en attente", () => {
    const pending = { id: "g1", score: null, createdAt: "2026-09-01T00:00:00.000Z" };
    const scored = { ...pending, score: 14 };
    expect(mergeList("grades", [pending], [scored])).toEqual([scored]);
    expect(mergeList("grades", [scored], [pending])).toEqual([scored]);
  });

  it("check-ins : un par jour, le plus récemment saisi gagne", () => {
    const morning = { date: "2026-09-24", energy: 2, updatedAt: "2026-09-24T08:00:00.000Z" };
    const evening = { date: "2026-09-24", energy: 4, updatedAt: "2026-09-24T21:00:00.000Z" };
    expect(mergeList("checkins", [morning], [evening])).toEqual([evening]);
  });

  it("les entrées illisibles sont ignorées sans casser la fusion", () => {
    expect(mergeList("sessions", [null, 3, { id: "a" }], "pas une liste")).toEqual([{ id: "a" }]);
  });
});
