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

export function deckFor(item: Pick<ReviewItem, "subject">): string {
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
  /** Les fiches réellement ajoutées ou déjà présentes — elles sont dans Anki. */
  inAnki: string[];
}

export async function sendToAnki(transport: AnkiTransport, items: ReviewItem[]): Promise<AnkiExportResult> {
  const cards = exportableItems(items);
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

  for (const deck of new Set(cards.map(deckFor))) await transport("createDeck", { deck });

  const notes = cards.map((item) => ({
    deckName: deckFor(item),
    modelName: model.name,
    fields: { [model.front]: html(item.text), [model.back]: html(item.answer!.trim()) },
    tags: [ANKI_TAG, item.kind === "méthode" ? "méthode" : "à-revoir"],
    options: { allowDuplicate: false, duplicateScope: "deck" },
  }));
  const addable = (await transport("canAddNotes", { notes })) as boolean[];
  const toAdd = notes.filter((_, index) => addable[index]);
  const ids = toAdd.length > 0 ? ((await transport("addNotes", { notes: toAdd })) as (number | null)[]) : [];

  const inAnki: string[] = [];
  let added = 0;
  let failed = 0;
  let cursor = 0;
  cards.forEach((item, index) => {
    if (!addable[index]) {
      inAnki.push(item.id);
      return;
    }
    const id = ids[cursor++];
    if (typeof id === "number") {
      added += 1;
      inAnki.push(item.id);
    } else failed += 1;
  });
  return { added, duplicates: cards.length - added - failed, failed, inAnki };
}

/** Fichier texte importable dans Anki (Fichier › Importer) : recto, verso, paquet, étiquettes. */
export function ankiTextExport(items: ReviewItem[]): string {
  const cell = (value: string) => html(value).replace(/\t/g, " ");
  const lines = exportableItems(items).map((item) => [cell(item.text), cell(item.answer!.trim()), deckFor(item), `${ANKI_TAG} ${item.kind === "méthode" ? "méthode" : "à-revoir"}`].join("\t"));
  return ["#separator:tab", "#html:true", "#deck column:3", "#tags column:4", ...lines].join("\n") + "\n";
}
