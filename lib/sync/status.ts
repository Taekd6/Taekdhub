import type { CollectionName } from "@/lib/sync/collections";
import type { SyncMeta } from "@/lib/sync/engine";

/**
 * ÉTAT DE SYNCHRONISATION D'UNE COLLECTION, tel que CET appareil le connaît.
 *
 * Répond à « ce que je vois ici est-il aussi dans mon compte ? » — la question
 * qu'aucun écran ne posait : on voyait la copie locale, jamais son sort.
 *
 *   envoyée        le serveur a accepté la version locale (révision > 0, rien en attente) ;
 *   en-attente     modifiée ici, pas encore acceptée (réseau, cycle pas encore passé) ;
 *   jamais-envoyée du contenu local, mais aucune révision serveur connue : à envoyer au
 *                  prochain cycle — si cela dure, la synchronisation de cette collection a un problème ;
 *   vide           rien ici, rien connu du serveur ;
 *   hors-compte    non connecté, ou le cache appartient à un autre compte : rien n'est envoyé.
 *
 * Ce que l'appareil SAIT, pas une lecture du serveur : un autre appareil peut avoir écrit depuis.
 * Fonction pure.
 */
export type CollectionSyncState = "envoyée" | "en-attente" | "jamais-envoyée" | "vide" | "hors-compte";

export interface CollectionSyncStatus {
  collection: CollectionName;
  state: CollectionSyncState;
  /** Entrées présentes sur cet appareil. */
  localCount: number;
  /** Révision serveur connue (0 = jamais vue). */
  revision: number;
}

export function collectionSyncStatus(meta: SyncMeta, collection: CollectionName, localCount: number, userId: string | null): CollectionSyncStatus {
  const entry = meta.collections[collection];
  const revision = entry?.revision ?? 0;
  const base = { collection, localCount, revision };
  if (!userId || meta.ownerId !== userId) return { ...base, state: "hors-compte" };
  if (entry?.dirty) return { ...base, state: "en-attente" };
  if (revision > 0) return { ...base, state: "envoyée" };
  return { ...base, state: localCount > 0 ? "jamais-envoyée" : "vide" };
}

export const SYNC_STATE_LABEL: Record<CollectionSyncState, string> = {
  envoyée: "dans ton compte",
  "en-attente": "en attente d'envoi",
  "jamais-envoyée": "pas encore dans ton compte",
  vide: "rien à envoyer",
  "hors-compte": "aucun compte connecté, rien n'est envoyé",
};
