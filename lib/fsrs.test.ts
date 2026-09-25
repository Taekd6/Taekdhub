import { describe, expect, it } from "vitest";
import {
  DESIRED_RETENTION,
  FSRS_DECAY,
  FSRS_DEFAULT_WEIGHTS,
  FSRS_FACTOR,
  dayDiff,
  daysUntilRetrievability,
  emptyMemory,
  firstDayBelow,
  initialDifficulty,
  normalizeFsrsMemory,
  previewIntervals,
  replayMemory,
  retrievabilityAfter,
  retrievabilityOn,
  reviewMemory,
  shiftDay,
} from "@/lib/fsrs";

/**
 * Le modèle FSRS vérifié contre ses propres définitions publiées
 * (github.com/open-spaced-repetition, « The Algorithm ») : ce ne sont pas des
 * valeurs recopiées de notre sortie, ce sont les propriétés que les formules
 * DOIVENT avoir.
 */
describe("FSRS — les coefficients par défaut", () => {
  it("FSRS-6 : 21 coefficients, w₂₀ = décroissance 0,1542", () => {
    expect(FSRS_DEFAULT_WEIGHTS).toHaveLength(21);
    expect(FSRS_DEFAULT_WEIGHTS.slice(0, 4)).toEqual([0.212, 1.2931, 2.3065, 8.2956]);
    expect(FSRS_DECAY).toBeCloseTo(-0.1542, 6);
    // F = 0,9^(1/C) − 1, pour que R(S) = 0,9.
    expect(FSRS_FACTOR).toBeCloseTo(Math.pow(0.9, 1 / -0.1542) - 1, 6);
    expect(DESIRED_RETENTION).toBe(0.9);
  });
});

describe("FSRS — la courbe d'oubli R(t) = (1 + F·t/S)^C", () => {
  it("vaut 1 au jour de la révision, 0,9 exactement à t = S", () => {
    expect(retrievabilityAfter(10, 0)).toBe(1);
    for (const stability of [0.5, 2.3065, 10, 180]) expect(retrievabilityAfter(stability, stability)).toBeCloseTo(0.9, 6);
  });

  it("décroît avec le temps, moins vite quand la stabilité est grande", () => {
    expect(retrievabilityAfter(5, 10)).toBeLessThan(retrievabilityAfter(5, 3));
    expect(retrievabilityAfter(50, 10)).toBeGreaterThan(retrievabilityAfter(5, 10));
  });

  it("valeur de référence : S = 2,3065 j (un « Bien » initial), 7 jours plus tard ≈ 80,8 %", () => {
    const expected = Math.pow(1 + (FSRS_FACTOR * 7) / 2.3065, -0.1542);
    expect(retrievabilityAfter(2.3065, 7)).toBeCloseTo(expected, 12);
    expect(retrievabilityAfter(2.3065, 7)).toBeCloseTo(0.808, 3);
  });

  it("daysUntilRetrievability est l'inverse exact de la courbe", () => {
    expect(daysUntilRetrievability(12, 0.9)).toBeCloseTo(12, 5);
    const t = daysUntilRetrievability(12, 0.85);
    expect(retrievabilityAfter(12, t)).toBeCloseTo(0.85, 10);
  });
});

describe("FSRS — les mises à jour", () => {
  it("première note : stabilité initiale = w₀…w₃, difficulté D₀(G) = w₄ − e^(w₅(G−1)) + 1", () => {
    const [w0, w1, w2, w3, w4, w5] = FSRS_DEFAULT_WEIGHTS;
    const ratings = ["again", "hard", "good", "easy"] as const;
    ratings.forEach((rating, index) => {
      const memory = reviewMemory(emptyMemory("2026-09-01"), "2026-09-01", rating);
      expect(memory.stability).toBeCloseTo([w0, w1, w2, w3][index], 6);
      expect(memory.difficulty).toBeCloseTo(Math.min(10, Math.max(1, w4 - Math.exp(w5 * index) + 1)), 6);
      expect(memory.lastReview).toBe("2026-09-01");
      expect(memory.reps).toBe(1);
    });
    expect(initialDifficulty("good")).toBeCloseTo(w4 - Math.exp(w5 * 2) + 1, 10);
  });

  it("un « Bien » à l'échéance multiplie la stabilité ; un « Oublié » la fait chuter et compte l'oubli", () => {
    const learned = reviewMemory(emptyMemory("2026-09-01"), "2026-09-01", "good");
    const good = reviewMemory(learned, learned.due, "good");
    expect(good.stability).toBeGreaterThan(learned.stability * 2);
    const forgot = reviewMemory(good, good.due, "again");
    expect(forgot.stability).toBeLessThan(good.stability);
    expect(forgot.lapses).toBe(1);
    expect(forgot.difficulty).toBeGreaterThan(good.difficulty);
  });

  it("programme la révision au jour où R ≈ 0,9 (intervalle ≈ S)", () => {
    const learned = reviewMemory(emptyMemory("2026-09-01"), "2026-09-01", "good");
    const good = reviewMemory(learned, learned.due, "good");
    expect(Math.abs(dayDiff(good.lastReview!, good.due) - good.stability)).toBeLessThanOrEqual(1);
  });

  it("aperçus : Oublié ≤ Dur < Bien < Facile", () => {
    const learned = replayMemory("2026-09-01", "good", [{ day: "2026-09-04", rating: "good" }]);
    const preview = previewIntervals(learned, "2026-09-15");
    expect(preview.again).toBeLessThanOrEqual(preview.hard);
    expect(preview.hard).toBeLessThan(preview.good);
    expect(preview.good).toBeLessThan(preview.easy);
  });

  it("une note antérieure à la précédente est ramenée à celle-ci", () => {
    const learned = reviewMemory(emptyMemory("2026-09-10"), "2026-09-10", "good");
    expect(reviewMemory(learned, "2026-09-01", "good").lastReview).toBe("2026-09-10");
  });

  it("replayMemory ne dépend que de l'historique, pas de l'ordre de saisie", () => {
    const a = replayMemory("2026-09-01", "good", [
      { day: "2026-09-04", rating: "good" },
      { day: "2026-09-20", rating: "hard" },
    ]);
    const b = replayMemory("2026-09-01", "good", [
      { day: "2026-09-20", rating: "hard" },
      { day: "2026-09-04", rating: "good" },
    ]);
    expect(a).toEqual(b);
  });
});

describe("jours calendaires", () => {
  it("shiftDay et dayDiff traversent fins de mois, années et années bissextiles", () => {
    expect(shiftDay("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayDiff("2026-01-31", "2026-03-01")).toBe(29);
    expect(dayDiff("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("firstDayBelow : premier jour strictement sous le seuil", () => {
    const learned = reviewMemory(emptyMemory("2026-09-01"), "2026-09-01", "good");
    const day = firstDayBelow(learned, 0.85)!;
    expect(retrievabilityOn(learned, day)!).toBeLessThan(0.85);
    expect(retrievabilityOn(learned, shiftDay(day, -1))!).toBeGreaterThanOrEqual(0.85);
    expect(firstDayBelow(emptyMemory("2026-09-01"), 0.85)).toBeNull();
  });
});

describe("normalizeFsrsMemory — frontière de confiance", () => {
  it("accepte un état valide et borne la difficulté", () => {
    const memory = normalizeFsrsMemory({ stability: 4, difficulty: 42, state: "review", reps: 3, lapses: 1, lastReview: "2026-09-01", due: "2026-09-05" }, "2026-09-01");
    expect(memory).toEqual({ stability: 4, difficulty: 10, state: "review", reps: 3, lapses: 1, lastReview: "2026-09-01", due: "2026-09-05" });
  });

  it("refuse une stabilité absente ou négative, un état inconnu", () => {
    expect(normalizeFsrsMemory({ stability: -1, state: "review", lastReview: "2026-09-01" }, "2026-09-01")).toBeNull();
    expect(normalizeFsrsMemory({ stability: 3, state: "bof", lastReview: "2026-09-01" }, "2026-09-01")).toBeNull();
    expect(normalizeFsrsMemory("n'importe quoi", "2026-09-01")).toBeNull();
  });
});
