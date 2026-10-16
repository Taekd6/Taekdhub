import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ACCÈS HERMES — une lecture Supabase qui échoue UNE fois (constaté sur le
 * Preview) est retentée une fois ; deux échecs donnent toujours le message
 * générique, jamais l'erreur de la base. Supabase est simulé : aucun réseau.
 */

const TOKEN = "jeton-factice-de-test-".padEnd(48, "x");
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` };

const state = { collectionFailures: 0, collectionCalls: 0 };

function query(result: () => { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "in", "order", "limit"]) chain[name] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: "eleve-unique" }] }, error: null }) } },
    from: (table: string) =>
      table === "user_collections"
        ? query(() => {
            state.collectionCalls += 1;
            if (state.collectionFailures > 0) {
              state.collectionFailures -= 1;
              return { data: null, error: { message: "relation interne user_collections : délai dépassé" } };
            }
            return { data: [{ collection: "sessions", items: [], updated_at: new Date().toISOString() }], error: null };
          })
        : query(() => ({ data: [], error: null })),
  }),
}));

let route: typeof import("@/app/api/mcp-hermes/route");
const previousTz = process.env.TZ;

beforeAll(async () => {
  vi.stubEnv("MCP_HERMES_TOKEN", TOKEN);
  vi.stubEnv("SUPABASE_URL", "https://exemple.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", "cle-factice");
  vi.stubEnv("MCP_USER_ID", "");
  route = await import("@/app/api/mcp-hermes/route");
});

afterAll(() => {
  vi.unstubAllEnvs();
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

beforeEach(() => {
  state.collectionFailures = 0;
  state.collectionCalls = 0;
});

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const response = await route.POST(
    new Request("http://localhost/api/mcp-hermes", { method: "POST", headers: HEADERS, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) })
  );
  const body = await response.text();
  const trimmed = body.trim();
  const json = trimmed.startsWith("{") ? JSON.parse(trimmed) : JSON.parse(trimmed.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).pop()!);
  return json.result.content[0].text as string;
}

describe("route Hermes — lecture passagèrement en échec", () => {
  it("un échec puis une réussite : la réponse est la bonne, sans trace de l'échec", async () => {
    state.collectionFailures = 1;
    const out = await callTool("list_echeances");
    expect(state.collectionCalls).toBe(2);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(out).not.toMatch(/relation|délai|user_collections/);
  });

  it("deux échecs : message générique, jamais le message de la base", async () => {
    state.collectionFailures = 5;
    const out = await callTool("list_echeances");
    expect(state.collectionCalls).toBe(2);
    expect(out).toBe("Erreur : lecture impossible pour le moment.");
  });

  it("aucun échec : une seule lecture", async () => {
    await callTool("list_echeances");
    expect(state.collectionCalls).toBe(1);
  });
});
