import { createClient } from "@supabase/supabase-js";
import { handleCapture, type CaptureEnv } from "@/lib/capture-handler";
import type { CollectionStore } from "@/lib/mcp-collections";

/**
 * CAPTURE RAPIDE (Apple Watch / Raccourcis) — voir lib/capture.ts et
 * lib/capture-handler.ts. Variables : `CAPTURE_TOKEN` (≥ 32 caractères,
 * `openssl rand -hex 32`), `MCP_USER_ID` (le compte à qui écrire),
 * `SUPABASE_URL` et `SUPABASE_SECRET_KEY`. Les dates sont celles de l'élève :
 * `MCP_TIMEZONE`, Europe/Paris par défaut, comme le connecteur.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";
export const dynamic = "force-dynamic";

/** Même règle de révision que les appareils ; la clé secrète contourne la RLS, donc `user_id` est filtré à la main. */
function store(user_id: string, collection: string): CollectionStore {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  return {
    async read() {
      const { data, error } = await client.from("user_collections").select("items, revision").eq("user_id", user_id).eq("collection", collection).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { items: data.items, revision: data.revision as number } : null;
    },
    async write(items, baseRevision) {
      if (baseRevision === 0) {
        const { error } = await client.from("user_collections").insert({ user_id, collection, items, revision: 1 });
        if (!error) return "ok";
        return error.code === "23505" ? "conflict" : { error: error.message };
      }
      const { data, error } = await client.from("user_collections").update({ items, revision: baseRevision + 1 }).eq("user_id", user_id).eq("collection", collection).eq("revision", baseRevision).select("revision");
      if (error) return { error: error.message };
      return data && data.length > 0 ? "ok" : "conflict";
    },
  };
}

export async function POST(req: Request) {
  const env: CaptureEnv = {
    token: process.env.CAPTURE_TOKEN,
    userId: process.env.MCP_USER_ID,
    store: (userId, collection) => store(userId, collection),
    now: () => new Date(),
  };
  if (env.token && env.userId && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)) {
    return Response.json({ error: "Capture non configurée sur le serveur." }, { status: 503 });
  }
  return handleCapture(req, env);
}
