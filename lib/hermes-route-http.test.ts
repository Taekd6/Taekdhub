import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * L'ACCÈS HERMES, PAR SA VRAIE ROUTE — requêtes HTTP réelles (sans réseau)
 * contre le gestionnaire de app/api/mcp-hermes/route.ts.
 *
 * Le jeton est une valeur FACTICE fabriquée ici ; aucune variable Supabase
 * n'est définie, donc aucune base n'est jamais contactée.
 */

const TOKEN = "jeton-factice-de-test-".padEnd(48, "x");
const URL_BASE = "http://localhost/api/mcp-hermes";
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };

let route: typeof import("@/app/api/mcp-hermes/route");
const previousTz = process.env.TZ;

beforeAll(async () => {
  vi.stubEnv("MCP_HERMES_TOKEN", TOKEN);
  for (const name of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "MCP_USER_ID", "MCP_SECRET"]) vi.stubEnv(name, "");
  route = await import("@/app/api/mcp-hermes/route");
});

afterAll(() => {
  vi.unstubAllEnvs();
  // La route fixe le fuseau de l'élève au chargement : on le rend tel qu'il était pour les autres tests.
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

function rpc(method: string, params: unknown, headers: Record<string, string> = {}, url = URL_BASE) {
  return route.POST(new Request(url, { method: "POST", headers: { ...HEADERS, ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
}

const bearer = (value: string) => ({ authorization: `Bearer ${value}` });
const LIST = ["tools/list", {}] as const;

describe("route Hermes — refus", () => {
  it.each([
    ["sans en-tête", {}],
    ["autre schéma", { authorization: `Basic ${TOKEN}` }],
    ["mauvais jeton", bearer("mauvais-jeton-".padEnd(48, "y"))],
    ["jeton vide", { authorization: "Bearer " }],
  ])("%s : 401, sans détail", async (_label, headers) => {
    const response = await rpc(...LIST, headers);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("le jeton dans l'URL ne suffit pas", async () => {
    expect((await rpc(...LIST, {}, `${URL_BASE}?token=${TOKEN}`)).status).toBe(401);
    expect((await rpc(...LIST, {}, `${URL_BASE}/${TOKEN}`)).status).toBe(401);
  });

  it("GET et DELETE sont soumis au même contrôle", async () => {
    expect((await route.GET(new Request(URL_BASE, { method: "GET", headers: HEADERS }))).status).toBe(401);
    expect((await route.DELETE(new Request(URL_BASE, { method: "DELETE", headers: HEADERS }))).status).toBe(401);
  });
});

describe("route Hermes — outils exposés par le serveur", () => {
  it("tools/list ne renvoie que get_today et list_echeances", async () => {
    const response = await rpc(...LIST, bearer(TOKEN));
    expect(response.status).toBe(200);
    const body = await response.text();
    const names = [...body.matchAll(/"name":"([a-z_]+)"/g)].map((match) => match[1]).sort();
    expect(names).toEqual(["get_today", "list_echeances"]);
  });

  it.each(["add_echeance", "update_echeance", "delete_echeance", "add_cards", "review_cards", "log_exercise", "get_progress"])("%s : l'outil n'existe pas sur ce serveur, même avec un jeton valide", async (name) => {
    const response = await rpc("tools/call", { name, arguments: {} }, bearer(TOKEN));
    const body = await response.text();
    // Une erreur de protocole « outil inconnu », jamais un résultat d'outil.
    expect(body).toMatch(/"error"|"isError":true/);
    expect(body).not.toMatch(/Enregistré|ajoutée|Supprimée|créée|Notes enregistrées/);
  });
});

describe("route Hermes — aucune fuite par les erreurs", () => {
  it.each(["get_today", "list_echeances"])("%s sans base configurée : message fixe, aucune exception relayée", async (name) => {
    const response = await rpc("tools/call", { name, arguments: {} }, bearer(TOKEN));
    const body = await response.text();
    expect(body).toContain("Erreur : lecture impossible pour le moment.");
    expect(body).not.toMatch(/supabase/i);
    expect(body).not.toMatch(/Error:|at \w+|stack/);
  });

  it("le jeton n'apparaît dans aucune réponse", async () => {
    const bodies = await Promise.all([rpc(...LIST, bearer(TOKEN)), rpc(...LIST, {}), rpc("tools/call", { name: "get_today", arguments: {} }, bearer(TOKEN))].map(async (pending) => (await pending).text()));
    for (const body of bodies) expect(body).not.toContain(TOKEN);
  });
});

describe("route Hermes — fermée par défaut", () => {
  it("sans MCP_HERMES_TOKEN configuré, même un en-tête plausible est refusé", async () => {
    vi.stubEnv("MCP_HERMES_TOKEN", "");
    try {
      expect((await rpc(...LIST, bearer(TOKEN))).status).toBe(401);
      expect((await rpc(...LIST, bearer(""))).status).toBe(401);
    } finally {
      vi.stubEnv("MCP_HERMES_TOKEN", TOKEN);
    }
  });
});
