import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * CLIENT SUPABASE — navigateur uniquement, et facultatif.
 *
 * Seules deux variables PUBLIQUES sont lues : l'URL du projet et la clé
 * « anon » (publishable). Elle est faite pour être dans le navigateur : ce
 * qui protège les données, ce sont les politiques RLS de
 * supabase/migrations/0006_user_collections_sync.sql, pas le secret de la clé.
 * La clé `service_role` ne doit JAMAIS apparaître ici ni dans une variable
 * `NEXT_PUBLIC_*` : elle contourne la RLS.
 *
 * Sans ces variables (développement local, fork), `supabase` vaut `null` :
 * l'application fonctionne exactement comme avant, en local seul, et la
 * section « Compte » des Réglages le dit.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  typeof window !== "undefined" && url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Le lien magique revient avec la session dans l'URL : le client la lit tout seul.
          detectSessionInUrl: true,
        },
      })
    : null;

/** `true` quand le compte peut fonctionner sur ce déploiement. */
export const accountsEnabled = Boolean(url && anonKey);
