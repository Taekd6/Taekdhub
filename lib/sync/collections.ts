import { STORAGE_KEYS } from "@/lib/storage";

/**
 * LES COLLECTIONS SYNCHRONISÉES — et comment deux versions d'une même
 * collection se réconcilient.
 *
 * UNE LIGNE PAR COLLECTION côté serveur (table `user_collections`), et non
 * une table par objet : ces collections sont déjà lues et écrites en bloc
 * par l'application (lib/storage.ts), normalisées à la lecture, et petites
 * (≈ 0,5 Mo par an pour les séances, la plus grosse, en JSON compact). Une
 * table par objet aurait obligé à redéfinir onze schémas en SQL, à les
 * garder alignés sur les types TypeScript, et à migrer la base à chaque
 * champ ajouté — pour aucun besoin réel : on ne requête jamais une séance
 * seule côté serveur.
 *
 * Restent LOCAUX, volontairement : le chrono en cours (sessionStorage — une
 * séance en cours appartient à un onglet), la date du dernier export (elle
 * décrit CET appareil), les mémoires de saisie (dernière matière choisie),
 * l'accueil reporté, et l'état de synchronisation lui-même.
 *
 * FUSION — utilisée seulement quand les deux côtés ont changé depuis le
 * dernier accord (conflit), ou au premier login quand l'élève choisit de
 * fusionner. Règle : NE RIEN PERDRE.
 *
 *   listes à identifiant   union ; pour un même identifiant, la version la
 *                          plus récente selon un horodatage propre à
 *                          l'objet (`stamp`), l'appareil courant à égalité ;
 *   listes datées          union par jour (check-ins : le plus récent gagne) ;
 *   préférences            un seul objet : le côté modifié le plus récemment.
 *
 * Limite connue et assumée : une entrée SUPPRIMÉE sur un appareil pendant
 * qu'un autre modifiait la même collection hors ligne peut réapparaître à
 * la fusion. Le contraire — perdre une saisie — serait pire.
 */

export type CollectionName = keyof typeof STORAGE_KEYS;

export const COLLECTIONS = Object.keys(STORAGE_KEYS) as CollectionName[];

/** Collections qui portent le TRAVAIL de l'élève — ce qui fait dire « des données existent ». Les préférences et les dérivés (bilans figés, intentions de planning, historique Next Move) n'en font pas partie. */
export const MEANINGFUL_COLLECTIONS: readonly CollectionName[] = ["sessions", "workItems", "grades", "reviewItems", "errors", "checkins", "chapterMemory"];

export const COLLECTION_LABELS: Record<CollectionName, string> = {
  sessions: "séances",
  preferences: "réglages",
  weekSnapshots: "bilans de semaine",
  workItems: "échéances",
  grades: "notes",
  dayPlans: "intentions de planning",
  reviewItems: "cartes à revoir",
  errors: "erreurs",
  checkins: "check-ins",
  chapterMemory: "chapitres",
  nextMoves: "recommandations",
};

type Item = Record<string, unknown>;

function isItem(value: unknown): value is Item {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function maxStamp(...values: unknown[]): string {
  return values.map(str).reduce((best, value) => (value > best ? value : best), "");
}

/**
 * Horodatage de « dernière modification » d'un objet, reconstruit depuis ses
 * propres champs (aucune collection n'a de `updatedAt` générique). Sert
 * seulement à départager deux versions d'un MÊME identifiant.
 */
const STAMPS: Partial<Record<CollectionName, (item: Item) => string>> = {
  sessions: (item) => maxStamp(item.created_at, item.ended_at),
  workItems: (item) => {
    const postponements = Array.isArray(item.postponements) ? item.postponements.filter(isItem).map((entry) => entry.at) : [];
    return maxStamp(item.createdAt, item.completedAt, ...postponements, item.status === "abandonné" ? "9" : "");
  },
  // Une note résolue (score connu) l'emporte sur la même note encore en attente.
  grades: (item) => `${typeof item.score === "number" ? 1 : 0}${str(item.createdAt)}`,
  reviewItems: (item) => maxStamp(item.createdAt, item.doneAt, isItem(item.srs) ? item.srs.lastReviewedAt : ""),
  errors: (item) => str(item.createdAt),
  chapterMemory: (item) => {
    const reviews = Array.isArray(item.reviews) ? item.reviews.filter(isItem).map((entry) => entry.day) : [];
    return `${maxStamp(item.learnedAt, ...reviews)}|${String(reviews.length).padStart(4, "0")}|${item.archived ? 1 : 0}`;
  },
  nextMoves: (item) => maxStamp(item.proposedAt, item.startedAt, item.resolvedAt),
};

/** Collections dont la clé n'est pas `id`. */
const KEY_FIELDS: Partial<Record<CollectionName, string>> = {
  checkins: "date",
  dayPlans: "date",
  weekSnapshots: "weekStart",
};

function keyOf(collection: CollectionName, item: Item): string | null {
  const value = item[KEY_FIELDS[collection] ?? "id"];
  return typeof value === "string" && value ? value : null;
}

function pick(collection: CollectionName, local: Item, remote: Item): Item {
  if (collection === "checkins") return str(remote.updatedAt) > str(local.updatedAt) ? remote : local;
  // Bilans figés et intentions de la veille ne se réécrivent jamais : la version locale fait foi.
  if (collection === "dayPlans" || collection === "weekSnapshots") return local;
  const stamp = STAMPS[collection];
  if (!stamp) return local;
  return stamp(remote) > stamp(local) ? remote : local;
}

/** Fusion d'une liste : union par clé, la version la plus récente pour une clé commune, l'ordre local d'abord. Les entrées sans clé lisible sont gardées telles quelles. */
export function mergeList(collection: CollectionName, local: unknown, remote: unknown): unknown[] {
  const localItems = Array.isArray(local) ? local : [];
  const remoteItems = Array.isArray(remote) ? remote : [];
  const remoteByKey = new Map<string, Item>();
  for (const item of remoteItems) {
    if (!isItem(item)) continue;
    const key = keyOf(collection, item);
    if (key) remoteByKey.set(key, item);
  }
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of localItems) {
    if (!isItem(item)) continue;
    const key = keyOf(collection, item);
    if (!key) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const other = remoteByKey.get(key);
    out.push(other ? pick(collection, item, other) : item);
  }
  for (const item of remoteItems) {
    if (!isItem(item)) continue;
    const key = keyOf(collection, item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Fusion de deux versions d'une collection. `localNewer` ne sert qu'aux
 * préférences (un objet unique n'a pas d'union possible).
 */
export function mergeCollection(collection: CollectionName, local: unknown, remote: unknown, localNewer: boolean): unknown {
  if (collection === "preferences") {
    const localPrefs = isItem(local) ? local : null;
    const remotePrefs = isItem(remote) ? remote : null;
    if (!localPrefs) return remotePrefs ?? {};
    if (!remotePrefs) return localPrefs;
    return localNewer ? localPrefs : remotePrefs;
  }
  return mergeList(collection, local, remote);
}

/** Nombre d'entrées d'une collection (préférences : 0 ou 1). */
export function countItems(collection: CollectionName, value: unknown): number {
  if (collection === "preferences") return isItem(value) && Object.keys(value).length > 0 ? 1 : 0;
  return Array.isArray(value) ? value.length : 0;
}

/** Sérialise une valeur de collection, ou lit la valeur locale brute — tolérant à tout ce que le stockage peut contenir. */
export function parseStored(collection: CollectionName, raw: string | null): unknown {
  const empty = collection === "preferences" ? {} : [];
  if (raw === null) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (collection === "preferences") return isItem(parsed) ? parsed : {};
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return empty;
  }
}
