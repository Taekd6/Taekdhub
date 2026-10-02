import type { AnkiDeckStat, AnkiSnapshot } from "@/lib/anki-snapshot";

/**
 * ANKICONNECT — lire les chiffres de la collection Anki, sans rien y écrire.
 *
 * AnkiConnect (module complémentaire d'Anki sur ORDINATEUR, code 2055492159)
 * ouvre un petit serveur HTTP local (http://127.0.0.1:8765) tant qu'Anki
 * est lancé. TaekdHub, ouvert dans un navigateur de la MÊME machine, peut
 * l'interroger.
 *
 * CE MODULE N'APPELLE QUE DES ACTIONS DE LECTURE : `version`,
 * `requestPermission`, `deckNames`, `findCards`, `getNumCardsReviewedByDay`
 * (et `multi` pour les regrouper). Aucune carte n'est créée, modifiée ou
 * replanifiée ; la planification FSRS d'Anki n'est pas touchée.
 *
 * Prérequis (affichés à l'écran, lib/anki-connect.ts#ANKICONNECT_SETUP) :
 *   — Anki lancé sur l'ordinateur, AnkiConnect installé ;
 *   — l'adresse de TaekdHub autorisée dans la configuration d'AnkiConnect
 *     (`webCorsOriginList`), sinon le navigateur bloque la réponse (CORS) ;
 *   — un navigateur qui accepte qu'une page https parle à 127.0.0.1
 *     (Chrome, Edge, Firefox ; Chrome peut demander l'autorisation d'accéder
 *     au réseau local).
 *
 * N'EXISTE PAS sur iPhone/iPad : AnkiMobile n'expose aucune interface de ce
 * genre. Voir l'écran /anki pour les alternatives.
 *
 * Le transport est injecté (`AnkiTransport`) : les tests simulent Anki.
 */

export const ANKICONNECT_URL = "http://127.0.0.1:8765";
export const ANKICONNECT_VERSION = 6;

export type AnkiTransport = (action: string, params?: Record<string, unknown>) => Promise<unknown>;

export class AnkiConnectError extends Error {
  constructor(
    message: string,
    readonly kind: "injoignable" | "refusé" | "réponse"
  ) {
    super(message);
  }
}

/** Le transport réel : un `fetch` vers AnkiConnect, avec un délai maximal. */
export function fetchTransport(url = ANKICONNECT_URL, timeoutMs = 20_000): AnkiTransport {
  return async (action, params) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ action, version: ANKICONNECT_VERSION, params: params ?? {} }),
        signal: controller.signal,
      });
    } catch {
      throw new AnkiConnectError(
        "Anki ne répond pas. Vérifie qu'Anki est ouvert sur CET ordinateur, qu'AnkiConnect est installé, et que l'adresse de TaekdHub est autorisée (voir la configuration ci-dessous).",
        "injoignable"
      );
    } finally {
      clearTimeout(timer);
    }
    let body: { result?: unknown; error?: unknown };
    try {
      body = (await response.json()) as { result?: unknown; error?: unknown };
    } catch {
      throw new AnkiConnectError("Réponse illisible d'AnkiConnect.", "réponse");
    }
    if (body.error) throw new AnkiConnectError(`AnkiConnect : ${String(body.error)}`, "réponse");
    return body.result;
  };
}

/** Requête Anki : le paquet SEUL, sous-paquets exclus — `deck:"A::B" -deck:"A::B::*"`. */
export function ownDeckQuery(deck: string): string {
  const escaped = deck.replace(/[\\"*_]/g, (char) => `\\${char}`);
  return `deck:"${escaped}" -deck:"${escaped}::*"`;
}

/** Les mesures relevées par paquet, et la requête qui donne chacune. */
const MEASURES: { field: Exclude<keyof AnkiDeckStat, "name">; filter: string }[] = [
  { field: "total", filter: "" },
  { field: "due", filter: "is:due" },
  { field: "reviewed30", filter: "rated:30" },
  { field: "failed30", filter: "rated:30:1" },
  { field: "mature", filter: "prop:ivl>=21" },
  { field: "lapsing", filter: "prop:lapses>=4" },
];

const BATCH = 120;

function asNumberArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Résultat d'une sous-action de `multi` : AnkiConnect ≥ 6 renvoie `{ result, error }` par action. */
function unwrapMulti(entry: unknown): unknown {
  if (entry && typeof entry === "object" && "result" in entry) {
    const { result, error } = entry as { result: unknown; error: unknown };
    if (error) throw new AnkiConnectError(`AnkiConnect : ${String(error)}`, "réponse");
    return result;
  }
  return entry;
}

export interface SnapshotProgress {
  done: number;
  total: number;
}

/**
 * Relève la collection : chaque paquet (sous-paquets exclus), et le volume
 * de révisions par jour. Les paquets vides sont omis.
 */
export async function readAnkiSnapshot(transport: AnkiTransport, now: Date, onProgress?: (progress: SnapshotProgress) => void): Promise<AnkiSnapshot> {
  const permission = (await transport("requestPermission")) as { permission?: string } | null;
  if (permission && permission.permission && permission.permission !== "granted") {
    throw new AnkiConnectError("Anki a refusé l'accès à TaekdHub. Accepte la demande dans Anki, ou ajoute l'adresse de TaekdHub à webCorsOriginList.", "refusé");
  }
  const names = await transport("deckNames");
  if (!Array.isArray(names)) throw new AnkiConnectError("Liste des paquets illisible.", "réponse");
  const decks = names.filter((name): name is string => typeof name === "string" && name.trim() !== "").sort();

  const actions: { deck: number; measure: number; query: string }[] = [];
  decks.forEach((deck, deckIndex) =>
    MEASURES.forEach((measure, measureIndex) => actions.push({ deck: deckIndex, measure: measureIndex, query: `${ownDeckQuery(deck)} ${measure.filter}`.trim() }))
  );
  const stats: AnkiDeckStat[] = decks.map((name) => ({ name, total: 0, due: 0, reviewed30: 0, failed30: 0, mature: 0, lapsing: 0 }));
  for (let start = 0; start < actions.length; start += BATCH) {
    const batch = actions.slice(start, start + BATCH);
    const results = await transport("multi", { actions: batch.map((action) => ({ action: "findCards", params: { query: action.query } })) });
    if (!Array.isArray(results) || results.length !== batch.length) throw new AnkiConnectError("Réponse incomplète d'AnkiConnect.", "réponse");
    batch.forEach((action, index) => {
      stats[action.deck][MEASURES[action.measure].field] = asNumberArrayLength(unwrapMulti(results[index]));
    });
    onProgress?.({ done: Math.min(actions.length, start + BATCH), total: actions.length });
  }

  const byDay = await transport("getNumCardsReviewedByDay");
  const reviewsByDay = (Array.isArray(byDay) ? byDay : [])
    .filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number")
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-60);

  const day = now.toLocaleDateString("en-CA");
  return {
    id: `anki:${day}`,
    day,
    takenAt: now.toISOString(),
    source: "ankiconnect",
    decks: stats.filter((deck) => deck.total > 0),
    reviewsByDay,
    manual: null,
  };
}

/** La configuration à coller dans Anki → Outils → Modules → AnkiConnect → Configuration. */
export function ankiConnectConfig(origin: string): string {
  return JSON.stringify(
    {
      apiKey: null,
      apiLogPath: null,
      webBindAddress: "127.0.0.1",
      webBindPort: 8765,
      webCorsOriginList: ["http://localhost", origin],
    },
    null,
    4
  );
}
