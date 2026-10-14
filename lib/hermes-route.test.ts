import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * GARDE STATIQUE de l'accès Hermes : ce que la route ne PEUT pas faire, lu
 * dans son source. Un test de comportement ne prouve pas l'absence d'un
 * outil ; la liste exacte des outils enregistrés et l'absence d'écriture, si.
 */

const read = (path: string) => readFileSync(path, "utf-8");
const ROUTE = read("app/api/mcp-hermes/route.ts");
const SNAPSHOT = read("lib/hermes-snapshot.ts");
const AUTH = read("lib/hermes-auth.ts");

/** Le code sans commentaires : les phrases d'explication ne doivent pas déclencher (ni masquer) une règle. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const WRITE_TOOLS = ["log_exercise", "add_cards", "review_cards", "add_echeance", "update_echeance", "delete_echeance"];

describe("accès Hermes — outils exposés, côté serveur", () => {
  it("enregistre exactement get_today et list_echeances, et rien d'autre", () => {
    const names = [...code(ROUTE).matchAll(/registerTool\(\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(names).toEqual(["get_today", "list_echeances"]);
  });

  it("ne mentionne aucun outil d'écriture, même en passant", () => {
    for (const name of WRITE_TOOLS) expect(code(ROUTE)).not.toContain(name);
  });

  it("l'autorisation précède toute exécution : le gestionnaire n'est appelé qu'après le contrôle du jeton", () => {
    const source = code(ROUTE);
    expect(source.indexOf("isHermesAuthorized(")).toBeGreaterThan(-1);
    expect(source.indexOf("isHermesAuthorized(")).toBeLessThan(source.indexOf("return mcp(req)"));
    expect(source).toMatch(/status:\s*401/);
  });
});

describe("accès Hermes — aucune écriture, aucune fuite", () => {
  const sources: Array<[string, string]> = [
    ["route", code(ROUTE)],
    ["lib/hermes-snapshot.ts", code(SNAPSHOT)],
    ["lib/hermes-auth.ts", code(AUTH)],
  ];

  it.each(sources)("%s : aucun appel d'écriture", (_name, source) => {
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/mutateCollection|addEcheances|updateEcheance|deleteEcheance|addLockCards|rateLockCards/);
  });

  it.each(sources)("%s : aucune journalisation", (_name, source) => {
    expect(source).not.toMatch(/console\s*\./);
    expect(source).not.toMatch(/verboseLogs|onEvent/);
  });

  it("la route ne lit jamais « toutes les colonnes » : les textes libres des annales ne sont pas lus", () => {
    const source = code(ROUTE);
    expect(source).not.toMatch(/select\(\s*["'`]\s*\*/);
    const annales = /from\("exercise_logs"\)\.select\("([^"]+)"\)/.exec(source);
    expect(annales).not.toBeNull();
    const columns = annales![1].split(",").map((column) => column.trim());
    expect(columns).not.toContain("commentaire");
    expect(columns).not.toContain("erreurs");
  });

  it("les seules variables d'environnement touchées sont celles attendues (TZ : le fuseau de l'élève, comme le connecteur de Claude), et jamais le secret du connecteur de Claude", () => {
    const names = new Set([...code(ROUTE).matchAll(/process\.env\.([A-Z_]+)/g)].map((match) => match[1]));
    expect([...names].sort()).toEqual(["MCP_HERMES_TOKEN", "MCP_TIMEZONE", "MCP_USER_ID", "SUPABASE_SECRET_KEY", "SUPABASE_URL", "TZ"].sort());
    expect(code(ROUTE)).not.toContain("MCP_SECRET");
  });

  it("n'importe que les modules de lecture : aucun module d'écriture du connecteur de Claude", () => {
    const imports = [...code(ROUTE).matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
    expect(imports).toEqual(["@/lib/hermes-auth", "@/lib/hermes-snapshot", "@supabase/supabase-js", "mcp-handler", "zod"].sort());
  });

  it("les erreurs de la base ne sont jamais relayées", () => {
    expect(code(ROUTE)).not.toMatch(/error\.message|\.message\b/);
  });
});

describe("accès Hermes — le connecteur de Claude n'est pas touché", () => {
  it("la route existante ne connaît pas Hermes et reste protégée par son propre secret", () => {
    const claude = read("app/api/mcp/[key]/route.ts");
    expect(claude.toLowerCase()).not.toContain("hermes");
    expect(claude).toContain("isMcpKeyValid(key, secret)");
  });
});
