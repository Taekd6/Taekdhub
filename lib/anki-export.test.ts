import { describe, expect, it } from "vitest";
import { ankiTextExport, exportableItems, pickBasicModel, sendToAnki } from "@/lib/anki-export";
import type { ReviewItem } from "@/lib/storage";

function item(id: string, extra: Partial<ReviewItem> = {}): ReviewItem {
  return { id, subject: "Mathématiques", text: `Recto ${id}`, kind: "à revoir", createdAt: "2026-10-01T10:00:00.000Z", doneAt: null, answer: `Verso ${id}`, ...extra };
}

describe("fiches exportables", () => {
  it("seulement avec un verso ; les notes faites non, les méthodes maîtrisées oui", () => {
    const items = [item("a"), item("b", { answer: undefined }), item("c", { doneAt: "2026-10-02T10:00:00.000Z" }), item("d", { kind: "méthode", doneAt: "2026-10-02T10:00:00.000Z" })];
    expect(exportableItems(items).map((entry) => entry.id)).toEqual(["a", "d"]);
  });
});

describe("modèle de carte", () => {
  it("« Basique » d'une collection française, jamais l'inversée ni le texte à trous", () => {
    expect(pickBasicModel({ "Basique (et carte inversée)": ["Recto", "Verso"], "Texte à trous": ["Texte", "Extra"], Basique: ["Recto", "Verso"] })).toEqual({ name: "Basique", front: "Recto", back: "Verso" });
    expect(pickBasicModel({ Basic: ["Front", "Back"] })).toEqual({ name: "Basic", front: "Front", back: "Back" });
    expect(pickBasicModel({ "Texte à trous": ["Texte", "Extra"] })).toBeNull();
  });
});

describe("envoi par AnkiConnect", () => {
  it("crée le paquet, n'ajoute que ce qui n'existe pas, et compte honnêtement", async () => {
    const calls: { action: string; params?: Record<string, unknown> }[] = [];
    const transport = async (action: string, params?: Record<string, unknown>) => {
      calls.push({ action, params });
      if (action === "modelNames") return ["Basique", "Texte à trous"];
      if (action === "multi") return [{ result: ["Recto", "Verso"], error: null }, { result: ["Texte", "Extra"], error: null }];
      if (action === "createDeck") return 1;
      if (action === "canAddNotes") return [true, false, true];
      if (action === "addNotes") return [111, null];
      return null;
    };
    const result = await sendToAnki(transport, [item("a", { answer: "x < y\nligne 2" }), item("b"), item("c", { subject: "Physique" })]);
    expect(result).toEqual({ added: 1, duplicates: 1, failed: 1, inAnki: ["a", "b"] });
    expect(calls.filter((call) => call.action === "createDeck").map((call) => call.params!.deck)).toEqual(["TaekdHub::Mathématiques", "TaekdHub::Physique"]);
    const added = calls.find((call) => call.action === "addNotes")!.params!.notes as { fields: Record<string, string>; deckName: string; tags: string[]; options: { allowDuplicate: boolean } }[];
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ deckName: "TaekdHub::Mathématiques", fields: { Recto: "Recto a", Verso: "x &lt; y<br>ligne 2" }, tags: ["taekdhub", "à-revoir"], options: { allowDuplicate: false } });
  });

  it("rien à envoyer : aucun appel à Anki", async () => {
    let called = false;
    const result = await sendToAnki(async () => ((called = true), null), [item("a", { answer: undefined })]);
    expect(result.added).toBe(0);
    expect(called).toBe(false);
  });
});

describe("fichier à importer", () => {
  it("en-têtes Anki, une ligne par fiche, paquet et étiquettes en colonnes", () => {
    const text = ankiTextExport([item("a", { kind: "méthode", text: "Quand\tje vois" })]);
    expect(text.split("\n").slice(0, 5)).toEqual(["#separator:tab", "#html:true", "#deck column:3", "#tags column:4", "Quand je vois\tVerso a\tTaekdHub::Mathématiques\ttaekdhub méthode"]);
  });
});
