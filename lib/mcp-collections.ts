/**
 * ÉCRIRE DANS UNE COLLECTION SYNCHRONISÉE DEPUIS LE SERVEUR (connecteur MCP).
 *
 * Les collections de l'élève (`user_collections`, une ligne JSON par
 * collection) sont écrites par ses appareils avec une RÉVISION : « je
 * remplace la révision 7 », refusé si le serveur est déjà à 8
 * (lib/sync/engine.ts). Le connecteur suit EXACTEMENT la même règle :
 * relire, modifier, écrire « si la révision est encore N », recommencer en
 * cas de refus. Ainsi ni le connecteur n'écrase un appareil, ni un appareil
 * n'écrase le connecteur : l'appareil voit la révision avancer, télécharge
 * (ou fusionne, s'il avait lui-même des changements — union par identifiant,
 * les fiches de Claude ne se perdent pas).
 *
 * Le stockage est INJECTÉ : la boucle se teste sans Supabase.
 */

export interface CollectionRow {
  items: unknown;
  revision: number;
}

export interface CollectionStore {
  read(): Promise<CollectionRow | null>;
  /** Écrit si et seulement si la révision serveur est encore `baseRevision` (0 = la ligne n'existe pas). */
  write(items: unknown, baseRevision: number): Promise<"ok" | "conflict" | { error: string }>;
}

export type MutateOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_ATTEMPTS = 4;

/**
 * `mutate` reçoit le contenu ACTUEL et renvoie le nouveau contenu, ou une
 * erreur métier (rien n'est alors écrit). Il peut être rappelé plusieurs
 * fois (conflit) : il doit être pur.
 */
export async function mutateCollection<T>(
  store: CollectionStore,
  mutate: (current: unknown) => { ok: true; items: unknown; value: T } | { ok: false; error: string }
): Promise<MutateOutcome<T>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const row = await store.read();
    const result = mutate(row?.items ?? []);
    if (!result.ok) return result;
    const written = await store.write(result.items, row?.revision ?? 0);
    if (written === "ok") return { ok: true, value: result.value };
    if (written !== "conflict") return { ok: false, error: written.error };
  }
  return { ok: false, error: "Un appareil écrivait en même temps : réessaie dans un instant." };
}
