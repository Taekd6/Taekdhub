/**
 * CHRONO ORPHELIN — un chrono en cours dont l'onglet a disparu.
 *
 * Le chrono vit en `sessionStorage` (une séance en cours appartient à UN
 * onglet — voir hooks/use-work-timer.ts). Mais un téléphone verrouillé sur
 * le chrono pendant qu'on travaille sur papier voit souvent son onglet
 * « déchargé » par le système, et un onglet fermé par erreur emporte tout :
 * 2 h de travail disparaissaient sans trace.
 *
 * D'où un MIROIR en `localStorage` : l'état du chrono, l'onglet qui le
 * porte, et un battement (`heartbeatAt`) rafraîchi tant que l'onglet vit.
 * Un onglet qui s'ouvre sans chrono à lui, face à un miroir dont le
 * battement s'est tu, propose de le reprendre. À la fin d'une séance, une
 * PIERRE TOMBALE (`startedAt` de la séance close) empêche un second onglet
 * resté ouvert sur le même chrono de l'enregistrer une deuxième fois.
 *
 * Fonctions pures.
 */

/** Sans battement depuis ce délai, l'onglet porteur est présumé disparu. Large : un onglet en arrière-plan ne bat plus qu'une fois par minute. */
export const ORPHAN_AFTER_MS = 3 * 60_000;

/** Séances closes dont on garde la trace : un vieil onglet qui se réveille après plusieurs séances doit encore reconnaître la sienne. */
export const TOMBSTONES_KEPT = 20;

/** Les pierres tombales — liste JSON ; une valeur isolée (première version) reste lue. */
export function parseTombstones(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [raw];
  }
}

/** Ajoute `startedAt` (sans doublon), en ne gardant que les `TOMBSTONES_KEPT` plus récentes. */
export function addTombstone(raw: string | null, startedAt: string): string {
  const list = parseTombstones(raw).filter((entry) => entry !== startedAt);
  return JSON.stringify([...list, startedAt].slice(-TOMBSTONES_KEPT));
}

/** Un chrono abandonné depuis plus longtemps n'est plus proposé : ce n'est plus une séance, c'est un oubli. */
export const ORPHAN_MAX_AGE_MS = 36 * 3_600_000;

export interface TimerMirror<TSnapshot> {
  tabId: string;
  heartbeatAt: string;
  snapshot: TSnapshot;
}

export function parseMirror<TSnapshot extends { startedAt: string }>(raw: string | null): TimerMirror<TSnapshot> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TimerMirror<TSnapshot>>;
    if (typeof value?.tabId !== "string" || typeof value.heartbeatAt !== "string" || !value.snapshot || typeof value.snapshot.startedAt !== "string") return null;
    if (!Number.isFinite(new Date(value.heartbeatAt).getTime()) || !Number.isFinite(new Date(value.snapshot.startedAt).getTime())) return null;
    return value as TimerMirror<TSnapshot>;
  } catch {
    return null;
  }
}

/**
 * Le miroir est-il ORPHELIN, vu d'un onglet `tabId` qui n'a pas de chrono ?
 * Oui si un autre onglet le portait, qu'il ne bat plus depuis
 * `ORPHAN_AFTER_MS`, que la séance n'est pas trop ancienne, et qu'elle n'a
 * pas déjà été enregistrée (pierre tombale).
 */
export function isOrphan(mirror: TimerMirror<{ startedAt: string }> | null, tabId: string, tombstones: readonly string[], now: Date): boolean {
  if (!mirror || mirror.tabId === tabId) return false;
  if (tombstones.includes(mirror.snapshot.startedAt)) return false;
  const t = now.getTime();
  if (t - new Date(mirror.heartbeatAt).getTime() < ORPHAN_AFTER_MS) return false;
  return t - new Date(mirror.snapshot.startedAt).getTime() <= ORPHAN_MAX_AGE_MS;
}
