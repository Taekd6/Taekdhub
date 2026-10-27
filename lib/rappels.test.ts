import { describe, expect, it } from "vitest";
import { completeFromReminders, doneReminderUrls, idFromReminder, openReminders, reminderUrl } from "@/lib/rappels";
import { handleRappels, type RappelsEnv } from "@/lib/rappels-handler";
import type { CollectionStore } from "@/lib/mcp-collections";

const SITE = "https://taekdhub.vercel.app";
const NOW = new Date("2026-10-27T17:00:00+01:00");
const TODAY = "2026-10-27";

function item(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    title: `Tâche ${id}`,
    kind: "exercices",
    subject: "Mathématiques",
    estimatedMinutes: 60,
    dueDate: "2026-11-03",
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-10-26T10:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...patch,
  };
}

describe("lien rappel ⇄ tâche", () => {
  it("l'URL du rappel porte l'identifiant, et on le relit", () => {
    const url = reminderUrl(SITE, "abc-123");
    expect(url).toBe("https://taekdhub.vercel.app/echeances?t=abc-123");
    expect(idFromReminder(url)).toBe("abc-123");
    expect(idFromReminder("abc-123")).toBe("abc-123");
  });

  it("ignore ce qui n'est pas un identifiant", () => {
    for (const bad of ["", "   ", 42, null, "https://exemple.fr/sans-id", "javascript:alert(1)", "x".repeat(200)]) expect(idFromReminder(bad)).toBeNull();
  });
});

describe("openReminders", () => {
  it("renvoie les tâches ouvertes datées, la plus proche d'abord, avec 19 h par défaut", () => {
    const list = openReminders([item("b", { dueDate: "2026-11-03" }), item("a", { dueDate: "2026-10-28", dueTime: "08:00" }), item("fini", { status: "terminé" }), item("retire", { status: "abandonné" })], TODAY, SITE);
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ jour: "2026-10-28", heure: "08:00", date: "2026-10-28T08:00" });
    expect(list[1]).toMatchObject({ heure: "19:00", url: `${SITE}/echeances?t=b` });
  });

  it("préfère le jour planifié à l'échéance, et le dit dans la note", () => {
    const [r] = openReminders([item("p", { plan: { day: "2026-11-02", time: "20:30", place: null } })], TODAY, SITE);
    expect(r).toMatchObject({ jour: "2026-11-02", heure: "20:30" });
    expect(r.notes).toContain("pour le 2026-11-03");
  });

  it("écarte le trop ancien et le trop lointain, garde le sans-date", () => {
    const list = openReminders([item("vieux", { dueDate: "2026-10-01" }), item("loin", { dueDate: "2027-03-01" }), item("libre", { dueDate: null })], TODAY, SITE);
    expect(list.map((r) => r.id)).toEqual(["libre"]);
    expect(list[0]).toMatchObject({ jour: null, heure: null, date: null });
  });

  it("supporte une collection corrompue", () => {
    expect(openReminders("n'importe quoi", TODAY)).toEqual([]);
    expect(openReminders([null, 3, { pas: "d'id" }, item("ok")], TODAY).map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("terminées et cochées", () => {
  it("annonce les tâches terminées depuis moins de 14 jours", () => {
    const urls = doneReminderUrls([item("recent", { status: "terminé", completedAt: "2026-10-25T10:00:00.000Z" }), item("ancien", { status: "terminé", completedAt: "2026-09-01T10:00:00.000Z" }), item("ouvert")], NOW, SITE);
    expect(urls).toEqual([`${SITE}/echeances?t=recent`]);
  });

  it("coche seulement les tâches visées encore ouvertes, sans toucher au reste", () => {
    const corrupt = { garbage: true };
    const before = [item("a"), item("b"), item("deja", { status: "terminé", completedAt: "2026-10-20T10:00:00.000Z" }), corrupt];
    const { items, completed } = completeFromReminders(before, ["a", "deja", "inconnu"], NOW);
    expect(completed).toEqual(["a"]);
    expect(items[0]).toMatchObject({ id: "a", status: "terminé", completedAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
    expect(items[1]).toBe(before[1]);
    expect(items[2]).toBe(before[2]);
    expect(items[3]).toBe(corrupt);
  });
});

function memoryStore(initial: unknown[]): CollectionStore & { items: unknown; revision: number } {
  const store = {
    items: initial as unknown,
    revision: 1,
    async read() {
      return { items: store.items, revision: store.revision };
    },
    async write(items: unknown, base: number) {
      if (base !== store.revision) return "conflict" as const;
      store.items = items;
      store.revision += 1;
      return "ok" as const;
    },
  };
  return store;
}

const TOKEN = "t".repeat(40);

function env(store: CollectionStore, patch: Partial<RappelsEnv> = {}): RappelsEnv {
  return { token: TOKEN, userId: "user-1", siteUrl: SITE, store: () => store, now: () => NOW, ...patch };
}

const req = (method: string, body?: unknown, token: string | null = TOKEN) =>
  new Request(`${SITE}/api/rappels`, { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

describe("/api/rappels", () => {
  it("fermé sans configuration, 401 sans le bon jeton", async () => {
    const store = memoryStore([]);
    expect((await handleRappels(req("GET"), env(store, { token: undefined }))).status).toBe(503);
    expect((await handleRappels(req("GET"), env(store, { token: "court" }))).status).toBe(503);
    expect((await handleRappels(req("GET"), env(store, { userId: undefined }))).status).toBe(503);
    expect((await handleRappels(req("GET", undefined, null), env(store))).status).toBe(401);
    expect((await handleRappels(req("GET", undefined, "x".repeat(40)), env(store))).status).toBe(401);
  });

  it("GET renvoie à faire et terminées, sans rien écrire", async () => {
    const store = memoryStore([item("a"), item("b", { status: "terminé", completedAt: "2026-10-27T08:00:00.000Z" })]);
    const res = await handleRappels(req("GET"), env(store));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.a_faire.map((r: { id: string }) => r.id)).toEqual(["a"]);
    expect(body.termines).toEqual([`${SITE}/echeances?t=b`]);
    expect(store.revision).toBe(1);
  });

  it("POST coche depuis les URL des rappels et renvoie la liste à jour en une seule requête", async () => {
    const store = memoryStore([item("a"), item("b")]);
    const res = await handleRappels(req("POST", { termines: [`${SITE}/echeances?t=a`] }), env(store));
    const body = await res.json();
    expect(body.coches).toEqual(["a"]);
    expect(body.a_faire.map((r: { id: string }) => r.id)).toEqual(["b"]);
    expect(body.termines).toEqual([`${SITE}/echeances?t=a`]);
    expect(store.revision).toBe(2);
  });

  it("POST accepte la liste en texte (une URL par ligne) et un corps vide", async () => {
    const store = memoryStore([item("a"), item("b")]);
    const res = await handleRappels(req("POST", { termines: `${SITE}/echeances?t=a\n${SITE}/echeances?t=b` }), env(store));
    expect((await res.json()).coches).toEqual(["a", "b"]);
    const empty = await handleRappels(req("POST", ""), env(memoryStore([item("c")])));
    expect(empty.status).toBe(200);
  });

  it("refuse un JSON illisible et un corps trop grand", async () => {
    const store = memoryStore([]);
    expect((await handleRappels(req("POST", "{pas du json"), env(store))).status).toBe(400);
    expect((await handleRappels(req("POST", "x".repeat(20_000)), env(store))).status).toBe(413);
  });
});
