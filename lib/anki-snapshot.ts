/**
 * INSTANTANÉS ANKI — ce que TaekdHub sait de la collection Anki, et QUAND
 * il l'a su.
 *
 * Anki reste l'outil de mémorisation : TaekdHub ne crée, ne modifie et ne
 * planifie aucune carte. Il garde seulement des CHIFFRES par paquet, relevés
 * à un instant précis (lib/anki-connect.ts, ou un fichier, ou une saisie
 * depuis AnkiMobile), pour les croiser avec le travail réel (lib/diagnostic.ts).
 *
 * Tous les chiffres sont ceux de l'instant du relevé : « 34 cartes dues »
 * veut dire « 34 dues le 2 octobre à 18 h 05 », jamais « dues maintenant ».
 * L'écran le dit (`takenAt`, `snapshotAge`).
 *
 * Collection synchronisée (`ankiSnapshots`) : un relevé fait sur
 * l'ordinateur (seul endroit où AnkiConnect existe) se lit sur le téléphone.
 * Un relevé par jour et par source : un nouvel import du même jour
 * REMPLACE le précédent (identifiant `anki:<jour>`), si bien que relancer
 * l'import ne crée jamais de doublon. Seuls les `ANKI_SNAPSHOT_KEEP`
 * derniers jours sont gardés.
 */

export type AnkiSource = "ankiconnect" | "fichier" | "manuel";
export const ANKI_SOURCE_LABEL: Record<AnkiSource, string> = {
  ankiconnect: "AnkiConnect (Anki sur ordinateur)",
  fichier: "Fichier importé",
  manuel: "Saisie depuis AnkiMobile",
};

/** Chiffres d'UN paquet, sous-paquets EXCLUS (sinon un paquet parent compterait ses enfants deux fois). */
export interface AnkiDeckStat {
  /** Nom complet, avec la hiérarchie : « MP::Maths::Réduction ». */
  name: string;
  /** Cartes du paquet. */
  total: number;
  /** Cartes de révision ou d'apprentissage dues au moment du relevé (hors nouvelles). */
  due: number;
  /** Cartes révisées au moins une fois sur les 30 derniers jours. */
  reviewed30: number;
  /** Parmi elles, cartes où « À revoir » (Again) a été pressé au moins une fois. */
  failed30: number;
  /** Cartes « mûres » (intervalle ≥ 21 jours). */
  mature: number;
  /** Cartes oubliées au moins 4 fois depuis leur création. */
  lapsing: number;
}

export interface AnkiSnapshot {
  /** `anki:<jour>` (relevé complet) ou `anki-manuel:<jour>` (saisie). */
  id: string;
  day: string;
  takenAt: string;
  source: AnkiSource;
  decks: AnkiDeckStat[];
  /** Cartes révisées par jour (toutes confondues), les derniers jours — pour la courbe de volume. */
  reviewsByDay: { day: string; count: number }[];
  /** Saisie manuelle (AnkiMobile) : les deux seuls chiffres que l'écran de l'application montre facilement. */
  manual: { due: number | null; reviewedToday: number | null } | null;
}

export const ANKI_SNAPSHOT_KEEP = 14;
/** Au-delà, les cartes « dues » d'un relevé ne disent plus rien d'aujourd'hui. */
export const ANKI_DUE_STALE_HOURS = 24;
/** Au-delà, même les tendances sur 30 jours sont trop vieilles pour décider. */
export const ANKI_TREND_STALE_DAYS = 7;
const MAX_DECKS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
}

function nullableCount(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
}

export function normalizeDeckStat(raw: unknown): AnkiDeckStat | null {
  if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const reviewed30 = count(raw.reviewed30);
  return {
    name: raw.name.trim().slice(0, 300),
    total: count(raw.total),
    due: count(raw.due),
    reviewed30,
    failed30: Math.min(count(raw.failed30), reviewed30),
    mature: count(raw.mature),
    lapsing: count(raw.lapsing),
  };
}

export function normalizeAnkiSnapshot(raw: unknown): AnkiSnapshot | null {
  if (!isRecord(raw)) return null;
  const takenAt = typeof raw.takenAt === "string" && !Number.isNaN(new Date(raw.takenAt).getTime()) ? new Date(raw.takenAt).toISOString() : null;
  const day = typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? raw.day : null;
  const source = raw.source === "ankiconnect" || raw.source === "fichier" || raw.source === "manuel" ? raw.source : null;
  if (!takenAt || !day || !source) return null;
  const seen = new Set<string>();
  const decks: AnkiDeckStat[] = [];
  for (const entry of Array.isArray(raw.decks) ? raw.decks.slice(0, MAX_DECKS) : []) {
    const deck = normalizeDeckStat(entry);
    if (deck && !seen.has(deck.name)) {
      seen.add(deck.name);
      decks.push(deck);
    }
  }
  const reviewsByDay = (Array.isArray(raw.reviewsByDay) ? raw.reviewsByDay : [])
    .filter((entry): entry is { day: string; count: number } => isRecord(entry) && typeof entry.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.day))
    .map((entry) => ({ day: entry.day, count: count(entry.count) }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-90);
  const manual = isRecord(raw.manual) ? { due: nullableCount(raw.manual.due), reviewedToday: nullableCount(raw.manual.reviewedToday) } : null;
  return {
    id: source === "manuel" ? `anki-manuel:${day}` : `anki:${day}`,
    day,
    takenAt,
    source,
    decks,
    reviewsByDay,
    manual: source === "manuel" ? (manual ?? { due: null, reviewedToday: null }) : null,
  };
}

export function normalizeAnkiSnapshots(raw: unknown): AnkiSnapshot[] {
  return Array.isArray(raw) ? raw.map(normalizeAnkiSnapshot).filter((item): item is AnkiSnapshot => item !== null) : [];
}

/**
 * Range un relevé : il remplace celui du même jour et de la même nature
 * (même `id`) s'il est plus récent, puis seuls les `ANKI_SNAPSHOT_KEEP`
 * jours les plus récents sont gardés. IDEMPOTENT : réimporter le même
 * fichier ne change rien.
 */
export function upsertSnapshot(list: AnkiSnapshot[], snapshot: AnkiSnapshot): AnkiSnapshot[] {
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const current = byId.get(snapshot.id);
  if (!current || snapshot.takenAt >= current.takenAt) byId.set(snapshot.id, snapshot);
  const days = [...new Set([...byId.values()].map((entry) => entry.day))].sort().slice(-ANKI_SNAPSHOT_KEEP);
  return [...byId.values()].filter((entry) => days.includes(entry.day)).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Le dernier relevé COMPLET (par paquet) — les saisies manuelles n'en ont pas. */
export function latestFullSnapshot(list: AnkiSnapshot[]): AnkiSnapshot | null {
  return list.filter((entry) => entry.source !== "manuel").reduce<AnkiSnapshot | null>((best, entry) => (!best || entry.takenAt > best.takenAt ? entry : best), null);
}

/** La dernière information sur les cartes dues, d'où qu'elle vienne. */
export function latestDueInfo(list: AnkiSnapshot[]): { due: number; takenAt: string; source: AnkiSource } | null {
  let best: { due: number; takenAt: string; source: AnkiSource } | null = null;
  for (const entry of list) {
    const due = entry.source === "manuel" ? entry.manual?.due ?? null : entry.decks.reduce((sum, deck) => sum + deck.due, 0);
    if (due === null) continue;
    if (!best || entry.takenAt > best.takenAt) best = { due, takenAt: entry.takenAt, source: entry.source };
  }
  return best;
}

export function snapshotAgeHours(takenAt: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(takenAt).getTime()) / 3_600_000);
}

/** Fichier d'échange : un relevé, signé de son format, pour l'emporter d'un navigateur à l'autre. */
export const ANKI_FILE_FORMAT = "taekdhub-anki-snapshot";

export function snapshotToFile(snapshot: AnkiSnapshot): string {
  return JSON.stringify({ format: ANKI_FILE_FORMAT, version: 1, snapshot }, null, 2);
}

/** Lit un fichier d'échange. Le relevé garde sa date d'origine ; sa source devient « fichier » s'il venait d'AnkiConnect. */
export function snapshotFromFile(content: string): AnkiSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || parsed.format !== ANKI_FILE_FORMAT) return null;
    const snapshot = normalizeAnkiSnapshot(parsed.snapshot);
    if (!snapshot || snapshot.source === "manuel") return snapshot;
    return { ...snapshot, source: "fichier" };
  } catch {
    return null;
  }
}
