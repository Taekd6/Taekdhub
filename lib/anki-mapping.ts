import { foldText, toSubject } from "@/lib/annales";
import { PROGRAMME, PROGRAMME_BY_ID, type ProgrammeChapter } from "@/lib/programme-data";
import type { AnkiDeckStat, AnkiSnapshot } from "@/lib/anki-snapshot";
import type { Subject } from "@/lib/supabase/types";

/**
 * PAQUETS ANKI → CHAPITRES DU PROGRAMME.
 *
 * Une association n'est utilisée par le diagnostic que si elle est SÛRE :
 *
 *   manuelle   choisie par l'élève (`Preferences.ankiDeckChapters`) — prime
 *              sur tout, y compris « aucun chapitre » ;
 *   certaine   le nom du paquet (dernier segment) est EXACTEMENT le titre
 *              ou un alias d'un chapitre (sans casse ni accents), dans la
 *              matière lue dans le chemin du paquet, et d'un seul chapitre ;
 *   héritée    le paquet parent est associé (« Maths::Réduction::Exos »
 *              hérite de « Maths::Réduction ») ; un parent écarté par
 *              l'élève (« aucun chapitre ») écarte toute sa branche ;
 *   proposée   un rapprochement partiel (un nom contient l'autre) : MONTRÉE
 *              à l'élève pour confirmation, JAMAIS utilisée telle quelle ;
 *   non classé rien de sûr.
 *
 * On associe des PAQUETS, pas des cartes : le nom d'une carte (son recto)
 * ne suffit pas à dire de quel chapitre elle vient.
 *
 * Fonctions pures.
 */

export type MappingKind = "manuelle" | "certaine" | "héritée" | "proposée" | "non-classé" | "ignoré";

export interface DeckMapping {
  deck: string;
  /** Segments du chemin : « MP », « Maths », « Réduction ». */
  path: string[];
  subject: Subject | null;
  kind: MappingKind;
  /** Chapitre UTILISÉ (manuelle, certaine, héritée) — `null` sinon. */
  chapterId: string | null;
  /** Chapitre PROPOSÉ (kind « proposée »), à confirmer. */
  suggestionId: string | null;
}

const MIN_PARTIAL = 5;

function deckPath(deck: string): string[] {
  return deck.split("::").map((segment) => segment.trim()).filter(Boolean);
}

/** La matière du paquet : le segment le plus proche de la feuille qui en désigne une (« Maths », « Physique-chimie » → physique…). */
export function deckSubject(path: string[]): Subject | null {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const subject = toSubject(path[index]);
    if (subject) return subject;
  }
  return null;
}

function keysOf(chapter: ProgrammeChapter): string[] {
  return [chapter.title, ...chapter.aliases].map(foldText).filter(Boolean);
}

/** Correspondance exacte d'un segment : un seul chapitre, sinon rien (ambigu). */
function exactMatch(segment: string, candidates: readonly ProgrammeChapter[]): ProgrammeChapter | null {
  const key = foldText(segment);
  if (!key) return null;
  const hits = candidates.filter((chapter) => keysOf(chapter).includes(key));
  return hits.length === 1 ? hits[0] : null;
}

/** Rapprochement partiel : le plus long nom commun, un seul gagnant, sinon rien. */
function partialMatch(segment: string, candidates: readonly ProgrammeChapter[]): ProgrammeChapter | null {
  const key = foldText(segment);
  if (key.length < MIN_PARTIAL) return null;
  let best: { chapter: ProgrammeChapter; length: number } | null = null;
  let tie = false;
  for (const chapter of candidates) {
    for (const candidate of keysOf(chapter)) {
      if (candidate.length < MIN_PARTIAL || !(key.includes(candidate) || candidate.includes(key))) continue;
      const length = Math.min(candidate.length, key.length);
      if (!best || length > best.length) {
        best = { chapter, length };
        tie = false;
      } else if (length === best.length && best.chapter.id !== chapter.id) tie = true;
    }
  }
  return best && !tie ? best.chapter : null;
}

export function mapDecks(decks: string[], overrides: Record<string, string | null>): DeckMapping[] {
  const sorted = [...new Set(decks)].sort();
  const byName = new Map<string, DeckMapping>();
  for (const deck of sorted) {
    const path = deckPath(deck);
    const subject = deckSubject(path);
    const base = { deck, path, subject, suggestionId: null };

    if (deck in overrides) {
      const chapterId = overrides[deck];
      byName.set(deck, chapterId === null ? { ...base, kind: "ignoré", chapterId: null } : { ...base, kind: "manuelle", chapterId: PROGRAMME_BY_ID.has(chapterId) ? chapterId : null });
      continue;
    }
    const candidates = subject ? PROGRAMME.filter((chapter) => chapter.subject === subject) : [];
    const parentName = path.slice(0, -1).join("::");
    const parent = parentName ? byName.get(parentName) : undefined;
    // Un parent écarté par l'élève écarte toute sa branche : son choix n'est jamais contredit par une déduction.
    if (parent && parent.kind === "ignoré") {
      byName.set(deck, { ...base, kind: "ignoré", chapterId: null });
      continue;
    }
    // Le NOM DU PAQUET lui-même (dernier segment) est un titre ou un alias : certain.
    const exact = path.length > 0 ? exactMatch(path[path.length - 1], candidates) : null;
    if (exact) {
      byName.set(deck, { ...base, kind: "certaine", chapterId: exact.id });
      continue;
    }
    // Sous-paquet d'un paquet associé (« Réduction::Exercices ») : hérite.
    if (parent && (parent.kind === "manuelle" || parent.kind === "certaine" || parent.kind === "héritée") && parent.chapterId) {
      byName.set(deck, { ...base, kind: "héritée", chapterId: parent.chapterId });
      continue;
    }
    const partial = path.length > 0 ? partialMatch(path[path.length - 1], candidates) : null;
    byName.set(deck, { ...base, kind: partial ? "proposée" : "non-classé", chapterId: null, suggestionId: partial?.id ?? null });
  }
  return sorted.map((deck) => byName.get(deck)!);
}

export interface ChapterAnki {
  chapterId: string;
  decks: string[];
  total: number;
  due: number;
  reviewed30: number;
  failed30: number;
  mature: number;
  lapsing: number;
  /** Part des cartes révisées sur 30 jours où « À revoir » a été pressé — `null` sous `ANKI_MIN_REVIEWED`. */
  failRate: number | null;
}

/** En dessous, un taux d'échec sur 30 jours ne dit rien (trop peu de cartes révisées). */
export const ANKI_MIN_REVIEWED = 20;

/** Les chiffres Anki par chapitre — seuls les paquets associés avec sûreté comptent. */
export function ankiByChapter(snapshot: AnkiSnapshot | null, overrides: Record<string, string | null>): Map<string, ChapterAnki> {
  const out = new Map<string, ChapterAnki>();
  if (!snapshot) return out;
  const stats = new Map<string, AnkiDeckStat>(snapshot.decks.map((deck) => [deck.name, deck]));
  for (const mapping of mapDecks(snapshot.decks.map((deck) => deck.name), overrides)) {
    if (!mapping.chapterId) continue;
    const deck = stats.get(mapping.deck)!;
    const entry = out.get(mapping.chapterId) ?? { chapterId: mapping.chapterId, decks: [], total: 0, due: 0, reviewed30: 0, failed30: 0, mature: 0, lapsing: 0, failRate: null };
    entry.decks.push(mapping.deck);
    entry.total += deck.total;
    entry.due += deck.due;
    entry.reviewed30 += deck.reviewed30;
    entry.failed30 += deck.failed30;
    entry.mature += deck.mature;
    entry.lapsing += deck.lapsing;
    out.set(mapping.chapterId, entry);
  }
  for (const entry of out.values()) entry.failRate = entry.reviewed30 >= ANKI_MIN_REVIEWED ? entry.failed30 / entry.reviewed30 : null;
  return out;
}

/** Le nom de paquet le plus parlant d'un chapitre (le plus gros), pour « ouvre le paquet … dans Anki ». */
export function mainDeck(entry: ChapterAnki | undefined, snapshot: AnkiSnapshot | null): string | null {
  if (!entry || !snapshot) return null;
  const sizes = new Map(snapshot.decks.map((deck) => [deck.name, deck.total]));
  return [...entry.decks].sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0))[0] ?? null;
}
