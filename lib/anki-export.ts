import type { AnkiTransport } from "@/lib/anki-connect";
import type { ReviewItem } from "@/lib/storage";

/**
 * ENVOYER DES FICHES VERS ANKI — le seul cas où TaekdHub ÉCRIT dans Anki,
 * et seulement sur un clic.
 *
 * Anki est l'outil de révision espacée de l'élève ; TaekdHub ne le
 * duplique pas. Mais certaines fiches NAISSENT dans TaekdHub (fiches de
 * méthode tirées d'un blocage, notes « À revoir » avec un verso) : plutôt
 * que de les réviser à deux endroits, on peut les verser dans Anki.
 *
 *   quoi        les fiches qui ont un verso — une carte sans réponse ne se
 *               révise pas dans Anki ; les méthodes même maîtrisées (c'est un
 *               aide-mémoire), les autres seulement si elles sont ouvertes ;
 *   où          un paquet `TaekdHub::<matière>`, créé s'il manque ;
 *   comment     AnkiConnect `addNotes` avec le modèle « Basique » / « Basic »
 *               de la collection (deux champs), étiquette `taekdhub` ;
 *   doublons    refusés par Anki lui-même (même recto dans le même paquet) :
 *               renvoyer deux fois ne crée rien — aucune trace à garder ici ;
 *   sans AnkiConnect  un fichier texte à importer (Fichier › Importer).
 */

export const ANKI_DECK_PREFIX = "TaekdHub";
export const ANKI_TAG = "taekdhub";

export function exportableItems(items: ReviewItem[]): ReviewItem[] {
  return items.filter((item) => item.answer?.trim() && (item.kind === "méthode" || item.doneAt === null));
}

/** Les fiches du verrou de cours (Claude) vont dans le paquet de leur chapitre : `TaekdHub::Mathématiques::Réduction`. */
export function deckFor(item: Pick<ReviewItem, "subject" | "chapter" | "origin">): string {
  if (item.origin === "claude" && item.chapter) return `${ANKI_DECK_PREFIX}::${item.subject}::${item.chapter.replace(/::/g, " ")}`;
  return `${ANKI_DECK_PREFIX}::${item.subject}`;
}

function html(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

/** Le modèle à deux champs de la collection : « Basic » / « Basique » d'abord, sinon le premier modèle simple à deux champs. */
export function pickBasicModel(fieldsByModel: Record<string, string[]>): { name: string; front: string; back: string } | null {
  const simple = Object.entries(fieldsByModel).filter(([name, fields]) => fields.length === 2 && !/revers|invers|cloze|trou|type|tap/i.test(name));
  const preferred = simple.find(([name]) => /^(basic|basique|einfach|básico|base)$/i.test(name.trim())) ?? simple[0];
  return preferred ? { name: preferred[0], front: preferred[1][0], back: preferred[1][1] } : null;
}

export interface AnkiExportResult {
  added: number;
  duplicates: number;
  failed: number;
  /** Cartes qu'Anki avait rangées ailleurs que dans le paquet demandé, et que TaekdHub y a déplacées (voir `ensureDeck`). */
  moved?: number;
  /** Cartes rangées ailleurs que dans le paquet demandé et qu'on n'a pas pu déplacer : à ranger à la main. */
  unplaced?: number;
  /** Les fiches réellement ajoutées ou déjà présentes — elles sont dans Anki. */
  inAnki: string[];
}

/**
 * LE PAQUET DEMANDÉ N'EST PAS TOUJOURS CELUI OBTENU. Constaté avec le vrai
 * AnkiConnect (version du dépôt) sur un Anki récent : le paramètre `deckName`
 * d'`addNotes` est ignoré et la note tombe dans « Default » — du coup les
 * cartes ne sont plus dans le paquet du chapitre (le pont Anki ne les associe
 * plus à rien) et la détection de doublons « dans le paquet » ne voit rien.
 * Après chaque ajout, on VÉRIFIE donc où sont les cartes des notes qu'on vient
 * de créer, et on déplace celles qui sont ailleurs (`changeDeck`). Seules les
 * notes créées par cet envoi sont concernées. Tout échec est compté, jamais
 * levé : les notes sont déjà dans Anki.
 */
export async function ensureDeck(transport: AnkiTransport, placements: { noteIds: number[]; deck: string }[]): Promise<{ moved: number; unplaced: number }> {
  let moved = 0;
  let unplaced = 0;
  for (const { noteIds, deck } of placements) {
    if (noteIds.length === 0) continue;
    try {
      const cards = await transport("findCards", { query: `nid:${noteIds.join(",")}` });
      if (!Array.isArray(cards) || cards.length === 0) continue;
      const info = await transport("cardsInfo", { cards });
      if (!Array.isArray(info)) continue;
      const wrong = info.filter((card: { deckName?: string }) => card.deckName !== deck).map((card: { cardId: number }) => card.cardId);
      if (wrong.length === 0) continue;
      try {
        await transport("changeDeck", { cards: wrong, deck });
        moved += wrong.length;
      } catch {
        unplaced += wrong.length;
      }
    } catch {
      // Vérification impossible : on ne prétend pas que tout est en place, mais on ne casse pas un envoi réussi.
      unplaced += noteIds.length;
    }
  }
  return { moved, unplaced };
}

/** Une carte à verser dans Anki — fiche de TaekdHub ou carte de cours (lib/course-cards.ts). */
export interface AnkiCard {
  id: string;
  front: string;
  back: string;
  deck: string;
  tags: string[];
}

export function cardFromItem(item: ReviewItem): AnkiCard {
  return { id: item.id, front: item.text, back: item.answer!.trim(), deck: deckFor(item), tags: [ANKI_TAG, item.kind === "méthode" ? "méthode" : "à-revoir", ...(item.origin === "claude" ? ["claude", "verrou-cours"] : [])] };
}

/** Les fiches de TaekdHub qui ont un verso. */
export async function sendToAnki(transport: AnkiTransport, items: ReviewItem[]): Promise<AnkiExportResult> {
  return sendCards(transport, exportableItems(items).map(cardFromItem));
}

/** Verse des cartes dans Anki : paquets créés s'il manquent, doublons (même recto dans le paquet) refusés par Anki. */
export async function sendCards(transport: AnkiTransport, cards: AnkiCard[]): Promise<AnkiExportResult> {
  if (cards.length === 0) return { added: 0, duplicates: 0, failed: 0, inAnki: [] };

  const names = (await transport("modelNames")) as string[];
  const fields = (await transport("multi", { actions: names.map((name) => ({ action: "modelFieldNames", params: { modelName: name } })) })) as unknown[];
  const fieldsByModel: Record<string, string[]> = {};
  names.forEach((name, index) => {
    const entry = fields[index];
    const list = Array.isArray(entry) ? entry : entry && typeof entry === "object" && Array.isArray((entry as { result?: unknown }).result) ? ((entry as { result: string[] }).result) : null;
    if (list) fieldsByModel[name] = list as string[];
  });
  const model = pickBasicModel(fieldsByModel);
  if (!model) throw new Error("Aucun modèle de carte simple (recto / verso) dans ta collection Anki : ajoute le modèle « Basique » (Outils › Gérer les types de notes).");

  for (const deck of new Set(cards.map((card) => card.deck))) await transport("createDeck", { deck });

  const notes = cards.map((card) => ({
    deckName: card.deck,
    modelName: model.name,
    fields: { [model.front]: html(card.front), [model.back]: html(card.back) },
    tags: card.tags,
    options: { allowDuplicate: false, duplicateScope: "deck" },
  }));
  const addable = (await transport("canAddNotes", { notes })) as boolean[];
  const toAdd = notes.filter((_, index) => addable[index]);
  const ids = toAdd.length > 0 ? ((await transport("addNotes", { notes: toAdd })) as (number | null)[]) : [];

  const inAnki: string[] = [];
  const created = new Map<string, number[]>();
  let added = 0;
  let failed = 0;
  let cursor = 0;
  cards.forEach((card, index) => {
    if (!addable[index]) {
      inAnki.push(card.id);
      return;
    }
    const id = ids[cursor++];
    if (typeof id === "number") {
      added += 1;
      inAnki.push(card.id);
      created.set(card.deck, [...(created.get(card.deck) ?? []), id]);
    } else failed += 1;
  });
  const placed = await ensureDeck(transport, [...created].map(([deck, noteIds]) => ({ deck, noteIds })));
  return { added, duplicates: cards.length - added - failed, failed, ...placed, inAnki };
}

/** Fichier texte importable dans Anki (Fichier › Importer) : recto, verso, paquet, étiquettes. */
export function ankiTextExport(items: ReviewItem[]): string {
  return cardsTextExport(exportableItems(items).map(cardFromItem));
}

export function cardsTextExport(cards: AnkiCard[]): string {
  const cell = (value: string) => html(value).replace(/\t/g, " ");
  const lines = cards.map((card) => [cell(card.front), cell(card.back), card.deck, card.tags.join(" ")].join("\t"));
  return ["#separator:tab", "#html:true", "#deck column:3", "#tags column:4", ...lines].join("\n") + "\n";
}
