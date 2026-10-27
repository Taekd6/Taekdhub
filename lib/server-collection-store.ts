import { createClient } from "@supabase/supabase-js";
import type { CollectionStore } from "@/lib/mcp-collections";

/**
 * Une collection synchronisée du compte `user_id`, lue et écrite depuis le
 * SERVEUR avec la clé secrète — même règle de révision que les appareils
 * (lib/mcp-collections.ts). La clé contourne la RLS : `user_id` est filtré à
 * la main. Partagé par la capture rapide et la synchro Rappels.
 */
export function serverCollectionStore(user_id: string, collection: string): CollectionStore {
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
