import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, type CollectionName } from "@/lib/sync/collections";
import type { PushResult, RemoteRow, RemoteStore } from "@/lib/sync/engine";

/**
 * Le serveur réel de lib/sync/engine.ts : la table `user_collections`
 * (supabase/migrations/0006_user_collections_sync.sql).
 *
 * `user_id` n'est jamais envoyé : la colonne vaut `auth.uid()` par défaut
 * et la RLS filtre toutes les lectures sur l'élève connecté. Le client ne
 * peut donc ni lire ni viser la ligne d'un autre, même en le voulant.
 */

const TABLE = "user_collections";
/** Code Postgres « violation d'unicité » : la ligne existe déjà, quelqu'un l'a créée avant nous. */
const UNIQUE_VIOLATION = "23505";

interface Row {
  collection: string;
  items: unknown;
  revision: number;
  updated_at: string;
}

function toRemote(row: Row): RemoteRow | null {
  if (!(COLLECTIONS as string[]).includes(row.collection)) return null;
  return { collection: row.collection as CollectionName, items: row.items, revision: row.revision, updatedAt: row.updated_at };
}

export function supabaseRemote(client: SupabaseClient): RemoteStore {
  return {
    async fetchAll() {
      const { data, error } = await client.from(TABLE).select("collection, items, revision, updated_at");
      if (error) throw new Error(error.message);
      return ((data ?? []) as Row[]).map(toRemote).filter((row): row is RemoteRow => row !== null);
    },

    async fetchOne(collection) {
      const { data, error } = await client.from(TABLE).select("collection, items, revision, updated_at").eq("collection", collection).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toRemote(data as Row) : null;
    },

    async push(collection, items, baseRevision): Promise<PushResult> {
      try {
        if (baseRevision === 0) {
          const { data, error } = await client.from(TABLE).insert({ collection, items, revision: 1 }).select("revision, updated_at").single();
          if (error) return error.code === UNIQUE_VIOLATION ? { ok: false, conflict: true } : { ok: false, conflict: false, error: error.message };
          return { ok: true, revision: data.revision, updatedAt: data.updated_at };
        }
        // Écriture CONDITIONNELLE : ne remplace que la révision attendue.
        const { data, error } = await client
          .from(TABLE)
          .update({ items, revision: baseRevision + 1 })
          .eq("collection", collection)
          .eq("revision", baseRevision)
          .select("revision, updated_at");
        if (error) return { ok: false, conflict: false, error: error.message };
        if (!data || data.length === 0) return { ok: false, conflict: true };
        return { ok: true, revision: data[0].revision, updatedAt: data[0].updated_at };
      } catch (cause) {
        // Réseau coupé : `fetch` lève. Ce n'est pas un conflit, on réessaiera.
        return { ok: false, conflict: false, error: cause instanceof Error ? cause.message : "réseau indisponible" };
      }
    },
  };
}
