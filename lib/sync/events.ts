/**
 * Événement émis sur `window` quand la synchronisation a RÉÉCRIT des données
 * locales (téléchargement, fusion, effacement). Les écrans l'écoutent pour
 * relire le disque — hooks/use-prepahub-data.ts — exactement comme ils
 * écoutent déjà l'événement `storage` d'un autre onglet.
 */
export const DATA_CHANGED_EVENT = "prepahub:data-changed";

export function announceDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
