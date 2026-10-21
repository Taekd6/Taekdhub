import { describe, expect, it } from "vitest";
import { computeAnkiProgress, PROGRESS_MIN_REVIEWED } from "@/lib/anki-progress";
import type { AnkiDeckStat, AnkiSnapshot } from "@/lib/anki-snapshot";

const NOW = new Date("2026-10-21T14:00:00");

const deck = (name: string, extra: Partial<AnkiDeckStat> = {}): AnkiDeckStat => ({ name, total: 100, due: 0, reviewed30: 0, failed30: 0, mature: 0, lapsing: 0, ...extra });
const snap = (day: string, decks: AnkiDeckStat[], takenAt = `${day}T08:00:00`): AnkiSnapshot => ({ id: `anki:${day}`, day, takenAt, source: "ankiconnect", decks, reviewsByDay: [], manual: null });
const recent = (name: string, reviewed7: number, failed7: number, introduced7: number, extra: Partial<AnkiDeckStat> = {}) =>
  deck(name, { reviewed7, failed7, introduced7, reviewedToday: 0, introducedToday: 0, ...extra });

describe("computeAnkiProgress — données absentes", () => {
  it("sans relevé : indisponible, avec le geste à faire", () => {
    const progress = computeAnkiProgress([], {}, NOW);
    expect(progress.available).toBe(false);
    expect(progress.sentence).toContain("fais-en un");
  });

  it("un relevé SANS l'activité récente n'est pas lu comme « rien fait »", () => {
    const progress = computeAnkiProgress([snap("2026-10-21", [deck("Maths")])], {}, NOW);
    expect(progress.available).toBe(false);
    expect(progress.decks).toEqual([]);
    expect(progress.sentence).toContain("7 derniers jours");
  });
});

describe("computeAnkiProgress — verdict par paquet (seuils 80 % et 70 %)", () => {
  const verdicts = (decks: AnkiDeckStat[]) => Object.fromEntries(computeAnkiProgress([snap("2026-10-21", decks)], {}, NOW).decks.map((entry) => [entry.deck, entry.verdict]));

  it("solide, correct, fragile, peu, calme", () => {
    expect(
      verdicts([
        recent("A", 20, 4, 5), // 80 % : solide
        recent("B", 20, 5, 5), // 75 % : correct
        recent("C", 20, 7, 5), // 65 % : fragile
        recent("D", PROGRESS_MIN_REVIEWED - 1, 0, 3), // trop peu
        recent("E", 0, 0, 0), // calme
      ])
    ).toEqual({ A: "solide", B: "moyen", C: "fragile", D: "peu", E: "calme" });
  });

  it("le seuil de 80 % est inclus, celui de 70 % est exclu", () => {
    expect(verdicts([recent("A", 10, 2, 0), recent("B", 10, 3, 0)])).toEqual({ A: "solide", B: "moyen" });
  });

  it("des nouvelles cartes sans révisions ne sont ni « calme » ni jugées", () => {
    expect(verdicts([recent("A", 0, 0, 8)])).toEqual({ A: "peu" });
  });

  it("failed7 ne dépasse jamais reviewed7 (donnée incohérente)", () => {
    const [entry] = computeAnkiProgress([snap("2026-10-21", [recent("A", 10, 99, 0)])], {}, NOW).decks;
    expect(entry.failed7).toBe(10);
    expect(entry.keptRate).toBe(0);
  });
});

describe("computeAnkiProgress — totaux, comparaison et phrase", () => {
  it("additionne les paquets et trie par activité", () => {
    const progress = computeAnkiProgress(
      [snap("2026-10-21", [recent("Petit", 10, 1, 2, { reviewedToday: 3, introducedToday: 1 }), recent("Gros", 40, 4, 12, { reviewedToday: 20, introducedToday: 5 })])],
      {},
      NOW
    );
    expect(progress.decks.map((entry) => entry.deck)).toEqual(["Gros", "Petit"]);
    expect(progress.totals).toEqual({ reviewed7: 50, introduced7: 14, reviewedToday: 23, introducedToday: 6, keptRate: 45 / 50 });
    expect(progress.lines[0]).toBe("Cette semaine : 50 cartes révisées, 14 cartes nouvelles apprises.");
    expect(progress.sentence).toContain("solidement");
    expect(progress.sentence).toContain("90 %");
  });

  it("cartes mûres : variation depuis le plus ancien relevé d'un AUTRE jour", () => {
    const progress = computeAnkiProgress(
      [snap("2026-10-10", [deck("A", { mature: 30 })]), snap("2026-10-15", [deck("A", { mature: 35 })]), snap("2026-10-21", [recent("A", 20, 2, 4, { mature: 42 })])],
      {},
      NOW
    );
    expect(progress.matureChange).toEqual({ delta: 12, since: "2026-10-10" });
    expect(progress.lines.join(" ")).toContain("+12 depuis le relevé du 10 octobre");
  });

  it("cartes mûres : un paquet apparu depuis ne gonfle pas la variation", () => {
    const progress = computeAnkiProgress(
      [snap("2026-10-10", [deck("A", { mature: 30 })]), snap("2026-10-21", [recent("A", 20, 2, 4, { mature: 33 }), recent("Nouveau", 10, 1, 5, { mature: 80 })])],
      {},
      NOW
    );
    expect(progress.matureChange).toEqual({ delta: 3, since: "2026-10-10" });
  });

  it("pas de comparaison sans relevé plus ancien", () => {
    expect(computeAnkiProgress([snap("2026-10-21", [recent("A", 20, 2, 4)])], {}, NOW).matureChange).toBeNull();
  });

  it("beaucoup d'oublis : la phrase dit de consolider avant d'ajouter", () => {
    const { sentence } = computeAnkiProgress([snap("2026-10-21", [recent("A", 30, 12, 6)])], {}, NOW);
    expect(sentence).toContain("consolide");
    expect(sentence).toContain("40 %");
  });

  it("aucune activité : le dit sans juger", () => {
    const { sentence, totals } = computeAnkiProgress([snap("2026-10-21", [recent("A", 0, 0, 0)])], {}, NOW);
    expect(sentence).toBe("Aucune activité Anki relevée cette semaine.");
    expect(totals.keptRate).toBeNull();
  });

  it("un relevé de plus de 24 h le signale, un relevé du jour non", () => {
    expect(computeAnkiProgress([snap("2026-10-18", [recent("A", 20, 1, 3)])], {}, NOW).stale).toBe(true);
    expect(computeAnkiProgress([snap("2026-10-21", [recent("A", 20, 1, 3)])], {}, NOW).stale).toBe(false);
    expect(computeAnkiProgress([snap("2026-10-18", [recent("A", 20, 1, 3)])], {}, NOW).lines.join(" ")).toContain("plus de 24 h");
  });

  it("n'ajoute jamais de note globale", () => {
    const progress = computeAnkiProgress([snap("2026-10-21", [recent("A", 20, 1, 3)])], {}, NOW);
    expect(Object.keys(progress).sort()).toEqual(["available", "decks", "lines", "matureChange", "sentence", "stale", "takenAt", "totals"]);
  });
});
