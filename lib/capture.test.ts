import { describe, expect, it } from "vitest";
import { MIN_CAPTURE_TOKEN_LENGTH, handleCapture, type CaptureEnv } from "@/lib/capture-handler";
import { appendOnce, parseCapture } from "@/lib/capture";
import type { CollectionStore } from "@/lib/mcp-collections";

/**
 * CAPTURE RAPIDE — le gestionnaire, de bout en bout, contre une base EN MÉMOIRE
 * qui applique la même règle de révision que Supabase. Le jeton est factice.
 */

const TOKEN = "jeton-factice-capture-".padEnd(MIN_CAPTURE_TOKEN_LENGTH + 8, "x");
const NOW = new Date("2026-10-21T14:30:00");

function memoryDb(initial: Record<string, unknown[]> = {}, options: { conflictOnce?: boolean; failRead?: boolean } = {}) {
  const rows = new Map<string, { items: unknown[]; revision: number }>(Object.entries(initial).map(([k, v]) => [k, { items: v, revision: 1 }]));
  let conflicts = options.conflictOnce ? 1 : 0;
  const touched: string[] = [];
  const store = (_user: string, collection: string): CollectionStore => ({
    async read() {
      touched.push(collection);
      if (options.failRead) throw new Error("relation public.user_collections SECRETE");
      const row = rows.get(collection);
      return row ? { items: row.items, revision: row.revision } : null;
    },
    async write(items, baseRevision) {
      if (conflicts > 0) {
        conflicts -= 1;
        return "conflict";
      }
      const row = rows.get(collection);
      if ((row?.revision ?? 0) !== baseRevision) return "conflict";
      rows.set(collection, { items: items as unknown[], revision: baseRevision + 1 });
      return "ok";
    },
  });
  return { rows, store, touched };
}

function env(db: ReturnType<typeof memoryDb>, overrides: Partial<CaptureEnv> = {}): CaptureEnv {
  return { token: TOKEN, userId: "moi", store: db.store as CaptureEnv["store"], now: () => NOW, ...overrides };
}

const post = (e: CaptureEnv, body: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }, url = "http://localhost/api/capture") =>
  handleCapture(new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), e);

const SEANCE = { type: "seance", matiere: "Mathématiques", minutes: 45 };
const EXO = { type: "exercice", matiere: "Physique", resultat: "réussi", aide: "sans" };

describe("capture — fermé par défaut", () => {
  it.each([
    ["sans jeton configuré", { token: undefined }],
    ["jeton configuré trop court", { token: "court" }],
    ["sans compte cible (MCP_USER_ID)", { userId: undefined }],
  ])("503 %s, sans rien écrire", async (_name, override) => {
    const db = memoryDb();
    const response = await post(env(db, override as Partial<CaptureEnv>), SEANCE);
    expect(response.status).toBe(503);
    expect(db.touched).toEqual([]);
  });

  it.each([
    ["sans en-tête", {}],
    ["mauvais schéma", { authorization: `Basic ${TOKEN}` }],
    ["mauvais jeton", { authorization: `Bearer ${TOKEN}y` }],
  ])("401 %s", async (_name, headers) => {
    const db = memoryDb();
    expect((await post(env(db), SEANCE, headers)).status).toBe(401);
    expect(db.touched).toEqual([]);
  });

  it("un jeton dans l'URL ne suffit pas", async () => {
    const db = memoryDb();
    expect((await post(env(db), SEANCE, {}, `http://localhost/api/capture?token=${TOKEN}`)).status).toBe(401);
  });
});

describe("capture — validation (listes fermées, valeurs bornées)", () => {
  it.each([
    ["matière inconnue", { ...SEANCE, matiere: "Histoire" }],
    ["minutes nulles", { ...SEANCE, minutes: 0 }],
    ["minutes énormes", { ...SEANCE, minutes: 9999 }],
    ["minutes en texte", { ...SEANCE, minutes: "45" }],
    ["jour inconnu", { ...SEANCE, jour: "demain" }],
    ["type inconnu", { type: "supprimer", matiere: "Physique" }],
    ["résultat inconnu", { ...EXO, resultat: "génial" }],
    ["aide inconnue", { ...EXO, aide: "triche" }],
    ["id trop court", { ...SEANCE, id: "abc" }],
    ["corps non objet", [1, 2, 3]],
  ])("400 : %s", async (_name, body) => {
    const db = memoryDb();
    expect((await post(env(db), body)).status).toBe(400);
    expect(db.touched).toEqual([]);
  });

  it("400 si le JSON est illisible, 413 si la requête est trop grande", async () => {
    const db = memoryDb();
    expect((await post(env(db), "{pas du json")).status).toBe(400);
    expect((await post(env(db), JSON.stringify({ ...SEANCE, note: "x".repeat(5000) }))).status).toBe(413);
  });

  it("un texte libre passé en plus n'est jamais enregistré", async () => {
    const db = memoryDb();
    await post(env(db), { ...SEANCE, note: "TEXTE LIBRE", titre: "TEXTE LIBRE" });
    expect(JSON.stringify([...db.rows.values()])).not.toContain("TEXTE LIBRE");
  });

  it("parseCapture expose les valeurs permises dans son message d'erreur", () => {
    const result = parseCapture({ ...EXO, resultat: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("réussi");
  });
});

describe("capture — écriture", () => {
  it("ajoute une séance bien formée, comptée comme une saisie rapide", async () => {
    const db = memoryDb();
    const response = await post(env(db), { ...SEANCE, id: "req-00000001" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enregistre: "seance", doublon: false });
    const items = db.rows.get("sessions")!.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "capture-req-00000001", subject: "Mathématiques", duration_seconds: 2700, note: "Saisie rapide", result: null });
  });

  it("ajoute une tentative lisible par le moteur, dans `attempts`", async () => {
    const db = memoryDb();
    const response = await post(env(db), { ...EXO, minutes: 20, id: "req-00000002" });
    expect(await response.json()).toEqual({ enregistre: "exercice", doublon: false });
    const [attempt] = db.rows.get("attempts")!.items as Record<string, unknown>[];
    expect(attempt).toMatchObject({ id: "capture-req-00000002", subject: "Physique", result: "réussi", help: "sans", minutes: 20, day: "2026-10-21" });
    expect(db.rows.has("sessions")).toBe(false);
  });

  it("une relance avec le même id n'ajoute rien (idempotence)", async () => {
    const db = memoryDb();
    await post(env(db), { ...SEANCE, id: "req-00000003" });
    const second = await post(env(db), { ...SEANCE, id: "req-00000003" });
    expect(await second.json()).toEqual({ enregistre: "seance", doublon: true });
    expect(db.rows.get("sessions")!.items).toHaveLength(1);
  });

  it("sans id, deux envois font deux séances", async () => {
    const db = memoryDb();
    await post(env(db), SEANCE);
    await post(env(db), SEANCE);
    expect(db.rows.get("sessions")!.items).toHaveLength(2);
  });

  it("conserve les éléments existants tels quels, sans les reformater", async () => {
    const existing = { id: "ancienne", champ_inconnu: { a: [1, 2] }, subject: "Chimie" };
    const db = memoryDb({ sessions: [existing] });
    await post(env(db), SEANCE);
    expect(db.rows.get("sessions")!.items[0]).toBe(existing);
    expect(db.rows.get("sessions")!.items).toHaveLength(2);
  });

  it("ne perd rien quand un appareil écrit en même temps (conflit puis nouvel essai)", async () => {
    const db = memoryDb({ sessions: [{ id: "a" }] }, { conflictOnce: true });
    const response = await post(env(db), SEANCE);
    expect(response.status).toBe(200);
    expect(db.rows.get("sessions")!.items).toHaveLength(2);
  });

  it("ne touche que la collection visée", async () => {
    const db = memoryDb();
    await post(env(db), SEANCE);
    await post(env(db), EXO);
    expect([...new Set(db.touched)].sort()).toEqual(["attempts", "sessions"]);
  });

  it("répond sans rien dire des données (aucune lecture renvoyée)", async () => {
    const db = memoryDb({ sessions: [{ id: "secret-existant", note: "CONFIDENTIEL" }] });
    const text = await (await post(env(db), SEANCE)).text();
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["doublon", "enregistre"]);
    expect(text).not.toContain("CONFIDENTIEL");
  });

  it("500 sans fuite quand la base échoue", async () => {
    const db = memoryDb({}, { failRead: true });
    const response = await post(env(db), SEANCE);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRETE");
  });
});

describe("appendOnce", () => {
  it("part d'une liste vide quand la collection n'existe pas encore", () => {
    expect(appendOnce(undefined, { id: "x" })).toEqual({ items: [{ id: "x" }], duplicate: false });
  });
});
