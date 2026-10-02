import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ISOLATION ENTRE ÉLÈVES — vérifications statiques des garde-fous.
 *
 * La RLS ne se teste vraiment que contre une base Postgres ; ces tests
 * empêchent au moins qu'une modification retire en silence une condition
 * `auth.uid()`, accorde l'écriture au navigateur, ou fasse lire au connecteur
 * des lignes d'un autre compte.
 */

const read = (path: string) => readFileSync(path, "utf8");
const statements = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

describe("user_collections (0006) : chaque élève ne voit que ses lignes", () => {
  const sql = statements(read("supabase/migrations/0006_user_collections_sync.sql"));
  it("RLS activée et quatre politiques conditionnées à auth.uid()", () => {
    expect(sql).toContain("alter table public.user_collections enable row level security");
    for (const operation of ["select", "insert", "update", "delete"]) {
      const policy = sql.slice(sql.indexOf(`for ${operation}`), sql.indexOf(";", sql.indexOf(`for ${operation}`)));
      expect(policy).toMatch(/user_id = auth\.uid\(\)/);
    }
    expect(sql).toContain("revoke all on public.user_collections from anon");
  });

  it("0008 n'ajoute que des collections, sans toucher aux politiques", () => {
    const migration = statements(read("supabase/migrations/0008_attempts_anki_sync.sql"));
    expect(migration).not.toMatch(/policy/i);
    expect(migration).not.toMatch(/\bdrop table\b|\bdelete from\b|\btruncate\b/i);
  });
});

describe("exercise_logs (0007) : lecture et suppression par le propriétaire, écriture par le seul connecteur", () => {
  const sql = statements(read("supabase/migrations/0007_exercise_logs_owner.sql"));
  it("politiques de lecture et de suppression conditionnées au propriétaire, aucune d'écriture", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toMatch(/for select\s+to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(sql).toMatch(/for delete\s+to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(sql).not.toMatch(/for (insert|update)/);
    expect(sql).toContain("revoke insert, update on public.exercise_logs from authenticated");
    expect(sql).toContain("revoke all on public.exercise_logs from anon");
  });
});

describe("connecteur MCP : la clé secrète contourne la RLS, donc chaque requête filtre le propriétaire", () => {
  const route = read("app/api/mcp/[key]/route.ts");
  it("chaque lecture d'exercise_logs ou de user_collections est filtrée par user_id", () => {
    const reads = route.match(/from\("(exercise_logs|user_collections)"\)\.select\([^)]*\)[^;\n]*/g) ?? [];
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const query of reads) expect(query).toContain('.eq("user_id", user_id)');
  });

  it("chaque écriture pose user_id, et l'accès exige le secret", () => {
    const inserts = route.match(/\.insert\(\{[^}]*\}\)/g) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) expect(insert).toContain("user_id");
    expect(route).toMatch(/if \(!secret \|\| key !== secret\)/);
  });

  it("la clé secrète n'est jamais exposée au navigateur", () => {
    expect(route).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
    expect(read("lib/supabase/client.ts")).not.toMatch(/SECRET|service_role\b(?!`)/);
  });
});
