import { describe, expect, it, vi } from "vitest";

vi.stubEnv("MCP_SECRET", "secret-de-test-local");

/**
 * Appelle l'outil `chercher_referentiel` par le VRAI protocole MCP (JSON-RPC sur HTTP, via la route et son
 * authentification), sans réseau ni base de données : cet outil ne lit que `data/referentiel-index.json`.
 */
const URL_OK = "http://localhost/api/mcp/secret-de-test-local";

async function rpc(method: string, params: unknown, path = URL_OK) {
  const { POST } = await import("@/app/api/mcp/[key]/route");
  const response = await POST(
    new Request(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const raw = await response.text();
  const payload = raw.startsWith("event:") || raw.includes("\ndata:") ? raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim())[0] : raw;
  return { status: response.status, body: response.status === 200 && payload ? JSON.parse(payload) : null };
}

async function call(args: Record<string, unknown>) {
  const { status, body } = await rpc("tools/call", { name: "chercher_referentiel", arguments: args });
  expect(status).toBe(200);
  const result = body.result as { content: { type: string; text: string }[]; isError?: boolean };
  return { isError: result.isError ?? false, text: result.content[0].text };
}

describe("outil MCP chercher_referentiel (protocole réel)", () => {
  it("est annoncé, en lecture seule, avec ses paramètres", async () => {
    const { status, body } = await rpc("tools/list", {});
    expect(status).toBe(200);
    const tool = (body.result.tools as { name: string; description: string; inputSchema: { properties: Record<string, unknown> } }[]).find((t) => t.name === "chercher_referentiel")!;
    expect(tool).toBeDefined();
    expect(tool.description).toContain("LECTURE SEULE");
    expect(Object.keys(tool.inputSchema.properties).sort()).toEqual(["chapitre", "limite", "matiere", "q", "type"]);
  });

  it("refuse sans la bonne clé, avant toute lecture", async () => {
    const { status } = await rpc("tools/call", { name: "chercher_referentiel", arguments: { q: "spectral" } }, "http://localhost/api/mcp/mauvaise-cle");
    expect(status).toBe(401);
  });

  it("renvoie plusieurs résultats pertinents avec sources lues et niveau de validation", async () => {
    const { isError, text } = await call({ q: "théorème spectral", matiere: "maths", limite: 5 });
    expect(isError).toBe(false);
    const result = JSON.parse(text);
    expect(result.total).toBeGreaterThan(1);
    expect(result.affiches).toBe(result.resultats.length);
    expect(result.affiches).toBeLessThanOrEqual(5);
    for (const hit of result.resultats) {
      expect(hit.matiere).toBe("Mathématiques");
      expect(["confirmé", "à confirmer"]).toContain(hit.exigibilite);
      expect(hit.recto).toBeTruthy();
      for (const source of hit.sources) {
        expect(source.id).toMatch(/^[A-Z0-9-]+$/);
        expect(source.titre).toBeTruthy();
      }
    }
    expect(result.resultats.some((hit: { sources: unknown[] }) => hit.sources.length > 0)).toBe(true);
  });

  it("dit clairement qu'il n'y a aucun résultat", async () => {
    const result = JSON.parse((await call({ q: "zzzqxv plorf" })).text);
    expect(result.total).toBe(0);
    expect(result.resultats).toEqual([]);
    expect(result.avertissements.join(" ")).toContain("Aucune carte du référentiel ne correspond");
  });

  it("refuse une requête vide ou sans mot exploitable, sans rien chercher", async () => {
    for (const args of [{}, { q: "" }, { q: "   " }, { q: "∑ ∫ ‖ ?!" }, { q: "de la" }]) {
      const result = JSON.parse((await call(args)).text);
      expect(result.total, JSON.stringify(args)).toBe(0);
      expect(result.avertissements[0], JSON.stringify(args)).toContain("Rien n'a été cherché");
    }
  });

  it("rejette les paramètres invalides (matière ou chapitre inconnus, limite hors bornes)", async () => {
    expect((await call({ q: "x", matiere: "astrologie" })).text).toContain("Erreur");
    expect((await call({ q: "x", chapitre: "chapitre-inexistant-xyz" })).text).toContain("Erreur");
    const { body } = await rpc("tools/call", { name: "chercher_referentiel", arguments: { q: "spectral", limite: 1000 } });
    expect(JSON.stringify(body)).toMatch(/limite|too_big|Too big|invalid|error/i);
  });

  it("signale quand les résultats sont tronqués", async () => {
    const result = JSON.parse((await call({ matiere: "physique", limite: 3 })).text);
    expect(result.total).toBeGreaterThan(result.affiches);
    expect(result.avertissements.join(" ")).toContain("tronqués");
  });
});
