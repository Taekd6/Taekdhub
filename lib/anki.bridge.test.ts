import { describe, expect, it } from "vitest";
import { AnkiConnectError, ankiConnectConfig, ownDeckQuery, readAnkiSnapshot, type AnkiTransport } from "@/lib/anki-connect";
import { ankiByChapter, deckSubject, mainDeck, mapDecks } from "@/lib/anki-mapping";
import {
  ANKI_SNAPSHOT_KEEP,
  latestDueInfo,
  latestFullSnapshot,
  normalizeAnkiSnapshot,
  snapshotFromFile,
  snapshotToFile,
  upsertSnapshot,
  type AnkiSnapshot,
} from "@/lib/anki-snapshot";

const NOW = new Date(2026, 9, 2, 18, 5);

/** Une fausse collection Anki : chaque paquet a des identifiants de cartes par requête. */
function fakeAnki(counts: Record<string, Partial<Record<string, number>>>, extra: Partial<Record<string, unknown>> = {}): { transport: AnkiTransport; calls: string[] } {
  const calls: string[] = [];
  const transport: AnkiTransport = async (action, params) => {
    calls.push(action);
    if (action in extra) return extra[action];
    if (action === "requestPermission") return { permission: "granted" };
    if (action === "deckNames") return Object.keys(counts);
    if (action === "getNumCardsReviewedByDay") return [["2026-10-01", 120], ["2026-10-02", 80]];
    if (action === "multi") {
      const actions = (params as { actions: { params: { query: string } }[] }).actions;
      return actions.map(({ params: { query } }) => {
        const deck = Object.keys(counts).find((name) => query.startsWith(ownDeckQuery(name)))!;
        const filter = query.slice(ownDeckQuery(deck).length).trim() || "total";
        return { result: Array.from({ length: counts[deck][filter] ?? 0 }, (_, index) => index), error: null };
      });
    }
    throw new Error(`action inattendue ${action}`);
  };
  return { transport, calls };
}

describe("AnkiConnect — lecture seule", () => {
  it("relève chaque paquet, sous-paquets exclus, et le volume par jour", async () => {
    const { transport, calls } = fakeAnki({
      "MP::Maths::Réduction": { total: 120, "is:due": 14, "rated:30": 80, "rated:30:1": 20, "prop:ivl>=21": 60, "prop:lapses>=4": 3 },
      "MP::Maths": { total: 0 },
    });
    const snapshot = await readAnkiSnapshot(transport, NOW);
    expect(snapshot).toMatchObject({ id: "anki:2026-10-02", source: "ankiconnect" });
    expect(snapshot.decks).toEqual([{ name: "MP::Maths::Réduction", total: 120, due: 14, reviewed30: 80, failed30: 20, mature: 60, lapsing: 3 }]);
    expect(snapshot.reviewsByDay).toEqual([{ day: "2026-10-01", count: 120 }, { day: "2026-10-02", count: 80 }]);
    // Aucune action d'écriture.
    expect([...new Set(calls)].sort()).toEqual(["deckNames", "getNumCardsReviewedByDay", "multi", "requestPermission"]);
  });

  it("refus d'accès : une erreur claire, pas un relevé vide", async () => {
    const { transport } = fakeAnki({}, { requestPermission: { permission: "denied" } });
    await expect(readAnkiSnapshot(transport, NOW)).rejects.toBeInstanceOf(AnkiConnectError);
  });

  it("la requête d'un paquet échappe les caractères spéciaux et exclut les sous-paquets", () => {
    expect(ownDeckQuery('Maths::"Séries"_*')).toBe('deck:"Maths::\\"Séries\\"\\_\\*" -deck:"Maths::\\"Séries\\"\\_\\*::*"');
  });

  it("la configuration à coller autorise l'adresse de TaekdHub", () => {
    expect(JSON.parse(ankiConnectConfig("https://taekdhub.vercel.app")).webCorsOriginList).toContain("https://taekdhub.vercel.app");
  });
});

function snapshot(day: string, hour: number, extra: Partial<AnkiSnapshot> = {}): AnkiSnapshot {
  return normalizeAnkiSnapshot({
    day,
    takenAt: `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`,
    source: "ankiconnect",
    decks: [{ name: "MP::Maths::Réduction", total: 100, due: hour, reviewed30: 50, failed30: 5, mature: 40, lapsing: 1 }],
    reviewsByDay: [],
    ...extra,
  })!;
}

describe("relevés : idempotence, doublons, données périmées", () => {
  it("un nouvel import du même jour remplace l'ancien ; réimporter ne crée pas de doublon", () => {
    let list = upsertSnapshot([], snapshot("2026-10-02", 8));
    list = upsertSnapshot(list, snapshot("2026-10-02", 18));
    list = upsertSnapshot(list, snapshot("2026-10-02", 18));
    expect(list).toHaveLength(1);
    expect(list[0].decks[0].due).toBe(18);
    // Un relevé plus ANCIEN du même jour ne remplace pas le récent.
    expect(upsertSnapshot(list, snapshot("2026-10-02", 6))[0].decks[0].due).toBe(18);
  });

  it(`ne garde que ${ANKI_SNAPSHOT_KEEP} jours`, () => {
    let list: AnkiSnapshot[] = [];
    for (let day = 1; day <= 20; day += 1) list = upsertSnapshot(list, snapshot(`2026-09-${String(day).padStart(2, "0")}`, 12));
    expect(list).toHaveLength(ANKI_SNAPSHOT_KEEP);
    expect(list[0].day).toBe("2026-09-07");
  });

  it("une saisie manuelle (AnkiMobile) ne remplace pas le relevé complet, mais donne l'information la plus récente sur les cartes dues", () => {
    const manual = normalizeAnkiSnapshot({ day: "2026-10-02", takenAt: "2026-10-02T20:00:00.000Z", source: "manuel", manual: { due: 42, reviewedToday: 130 } })!;
    const list = upsertSnapshot([snapshot("2026-10-02", 8)], manual);
    expect(list).toHaveLength(2);
    expect(latestFullSnapshot(list)!.source).toBe("ankiconnect");
    expect(latestDueInfo(list)).toEqual({ due: 42, takenAt: "2026-10-02T20:00:00.000Z", source: "manuel" });
  });

  it("fichier d'échange : aller-retour fidèle, source « fichier », contenu étranger refusé", () => {
    const original = snapshot("2026-10-02", 18);
    const back = snapshotFromFile(snapshotToFile(original))!;
    expect(back).toEqual({ ...original, source: "fichier" });
    expect(snapshotFromFile('{"format":"autre"}')).toBeNull();
    expect(snapshotFromFile("pas du json")).toBeNull();
  });

  it("un relevé abîmé est écarté ; des paquets en double sont dédoublonnés ; failed30 ≤ reviewed30", () => {
    expect(normalizeAnkiSnapshot({ day: "2026-10-02", source: "ankiconnect" })).toBeNull();
    const fixed = normalizeAnkiSnapshot({
      day: "2026-10-02",
      takenAt: "2026-10-02T10:00:00.000Z",
      source: "ankiconnect",
      decks: [{ name: "A", total: 5, reviewed30: 3, failed30: 9 }, { name: "A", total: 7 }, { name: "" }],
    })!;
    expect(fixed.decks).toEqual([{ name: "A", total: 5, due: 0, reviewed30: 3, failed30: 3, mature: 0, lapsing: 0 }]);
  });
});

describe("paquets → chapitres", () => {
  it("lit la matière dans le chemin", () => {
    expect(deckSubject(["MP", "Maths", "Réduction"])).toBe("Mathématiques");
    expect(deckSubject(["Physique", "Électromagnétisme"])).toBe("Physique");
    expect(deckSubject(["Divers"])).toBeNull();
  });

  it("certaine : un segment est exactement un titre ou un alias ; les sous-paquets héritent", () => {
    const mappings = mapDecks(["MP::Maths::Réduction", "MP::Maths::Réduction::Exos", "MP::Maths::Diagonalisation"], {});
    expect(mappings.map((entry) => [entry.deck, entry.kind, entry.chapterId])).toEqual([
      ["MP::Maths::Diagonalisation", "certaine", "m2-reduction"],
      ["MP::Maths::Réduction", "certaine", "m2-reduction"],
      ["MP::Maths::Réduction::Exos", "héritée", "m2-reduction"],
    ]);
  });

  it("incertain : proposé sans être utilisé ; ambigu ou sans matière : non classé", () => {
    const [proposed] = mapDecks(["Maths::Réduction des endomorphismes (chap 3)"], {});
    expect(proposed).toMatchObject({ kind: "proposée", chapterId: null, suggestionId: "m2-reduction" });
    // « Séries » est un alias de deux chapitres : on ne choisit pas.
    expect(mapDecks(["Maths::Séries"], {})[0]).toMatchObject({ kind: "non-classé", chapterId: null });
    expect(mapDecks(["Divers::Réduction"], {})[0]).toMatchObject({ kind: "non-classé", chapterId: null });
  });

  it("le choix de l'élève prime, y compris « aucun chapitre », transmis aux sous-paquets", () => {
    const mappings = mapDecks(["Maths::Séries", "Maths::Réduction", "Maths::Réduction::Vieux"], { "Maths::Séries": "m2-series-entieres", "Maths::Réduction": null });
    expect(mappings.map((entry) => [entry.deck, entry.kind, entry.chapterId])).toEqual([
      ["Maths::Réduction", "ignoré", null],
      ["Maths::Réduction::Vieux", "ignoré", null],
      ["Maths::Séries", "manuelle", "m2-series-entieres"],
    ]);
  });

  it("agrège par chapitre sans compter deux fois, avec un taux d'échec seulement au-delà de 20 cartes révisées", () => {
    const snap = normalizeAnkiSnapshot({
      day: "2026-10-02",
      takenAt: "2026-10-02T10:00:00.000Z",
      source: "ankiconnect",
      decks: [
        { name: "Maths::Réduction", total: 100, due: 10, reviewed30: 30, failed30: 9, mature: 50, lapsing: 2 },
        { name: "Maths::Réduction::Exos", total: 20, due: 2, reviewed30: 10, failed30: 1, mature: 5, lapsing: 0 },
        { name: "Maths::Séries entières", total: 40, due: 1, reviewed30: 5, failed30: 1, mature: 10, lapsing: 0 },
        // « Probabilités » existe en sup ET en spé : ambigu, donc ignoré par l'agrégation.
        { name: "Maths::Probabilités", total: 40, due: 1, reviewed30: 50, failed30: 20, mature: 10, lapsing: 0 },
        { name: "Divers", total: 10 },
      ],
    })!;
    const byChapter = ankiByChapter(snap, {});
    expect(byChapter.get("m2-reduction")).toMatchObject({ total: 120, due: 12, reviewed30: 40, failed30: 10, failRate: 0.25 });
    expect(byChapter.get("m2-series-entieres")).toMatchObject({ reviewed30: 5, failRate: null });
    expect(byChapter.has("m2-probas")).toBe(false);
    expect(byChapter.has("m1-probas")).toBe(false);
    expect(mainDeck(byChapter.get("m2-reduction"), snap)).toBe("Maths::Réduction");
    expect(ankiByChapter(null, {}).size).toBe(0);
  });
});
