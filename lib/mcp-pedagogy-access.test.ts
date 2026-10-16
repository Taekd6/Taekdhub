import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.stubEnv("MCP_SECRET", "le-bon-secret");

const ROUTE = "app/api/mcp/[key]/route.ts";

describe("(8) aucun accès sans autorisation, et la mémoire pédagogique se lit sans s'écrire", () => {
  it("refuse une clé fausse, absente ou vide — avant toute lecture de données", async () => {
    const { GET, POST } = await import("@/app/api/mcp/[key]/route");
    for (const path of ["mauvais-secret", "le-bon-secre", "le-bon-secret-"]) {
      for (const handler of [GET, POST]) {
        const response = await handler(new Request(`http://localhost/api/mcp/${path}`, { method: "POST", body: "{}" }));
        expect(response.status).toBe(401);
      }
    }
  });

  it("sans MCP_SECRET configuré, plus rien n'est accessible", async () => {
    vi.stubEnv("MCP_SECRET", "");
    const { POST } = await import("@/app/api/mcp/[key]/route");
    expect((await POST(new Request("http://localhost/api/mcp/n-importe-quoi", { method: "POST", body: "{}" }))).status).toBe(401);
    vi.stubEnv("MCP_SECRET", "le-bon-secret");
  });

  it("les outils du pipeline débrief et démonstrations n'écrivent rien : aucune insertion, mise à jour ni mutation de collection", () => {
    const source = readFileSync(ROUTE, "utf8");
    for (const tool of ["debrief_format", "get_debriefs", "get_recommandations", "restitution_format", "get_demonstrations", "get_contexte_revision"]) {
      const start = source.indexOf(`"${tool}"`);
      expect(start, `${tool} doit être enregistré`).toBeGreaterThan(-1);
      const next = source.indexOf("server.registerTool(", start);
      const body = source.slice(start, next === -1 ? undefined : next);
      expect(body).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|mutateCollection|collectionStore\(/);
      expect(body).toMatch(/LECTURE SEULE/);
    }
  });
});
