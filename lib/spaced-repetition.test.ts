import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  dueReviewItems,
  effectiveSchedule,
  formatDueDay,
  formatInterval,
  isDue,
  nextReviewDay,
  previewRatings,
  rateReviewItem,
  schedule,
  SRS_LADDER,
} from "@/lib/spaced-repetition";
import { normalizeReviewItem, normalizeReviewSchedule, type ReviewItem, type ReviewSchedule } from "@/lib/storage";

/** Dates construites en heure LOCALE, comme l'élève les vit — les tests passent quel que soit le fuseau de la machine (essayé sous TZ=Pacific/Auckland et America/Sao_Paulo). */
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute);

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    subject: "Mathématiques",
    text: "Montrer qu'une suite converge ?",
    kind: "méthode",
    createdAt: at(2026, 9, 20, 18).toISOString(),
    doneAt: null,
    ...overrides,
  };
}

/** Un calendrier déjà noté une fois (« Bien » il y a 3 jours) — la forme FSRS. */
function state(overrides: Partial<ReviewSchedule> = {}): ReviewSchedule {
  return {
    dueAt: "2026-09-23",
    intervalDays: 3,
    stability: 2.3065,
    difficulty: 2.118,
    state: "review",
    reviews: 1,
    lapses: 0,
    lastReviewedAt: at(2026, 9, 20).toISOString(),
    ...overrides,
  };
}

describe("jours calendaires — pas d'heures, pas de fuseau", () => {
  it("addDays traverse les fins de mois et d'année", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-09-30", 35)).toBe("2026-11-04");
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31");
  });

  it("addDays enjambe le passage à l'heure d'hiver sans perdre ni gagner un jour", () => {
    // Nuit du 24 au 25 octobre 2026 en Europe.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("daysBetween compte des dates, pas des tranches de 24 h", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-09-23", "2026-09-20")).toBe(-3);
  });

  it("une note à 23 h 50 le 31 : « demain » est le 1er, pas le 2", () => {
    const next = schedule(state(), "again", at(2026, 10, 31, 23, 50));
    expect(next.dueAt).toBe("2026-11-01");
  });

  it("une note à 0 h 05 compte pour le jour qui commence", () => {
    const february = state({ dueAt: "2026-02-26", lastReviewedAt: at(2026, 2, 23).toISOString() });
    expect(schedule(february, "again", at(2026, 3, 1, 0, 5)).dueAt).toBe("2026-03-02");
  });
});

describe("une entrée jamais révisée", () => {
  it("est due le lendemain de sa création, état FSRS « new »", () => {
    const fresh = item({ createdAt: at(2026, 1, 31, 22).toISOString() });
    expect(effectiveSchedule(fresh)).toEqual({
      dueAt: "2026-02-01",
      intervalDays: 1,
      stability: 0,
      difficulty: 0,
      state: "new",
      reviews: 0,
      lapses: 0,
      lastReviewedAt: null,
    });
  });

  it("n'est pas due le jour même", () => {
    const fresh = item({ createdAt: at(2026, 9, 23, 8).toISOString() });
    expect(isDue(fresh, at(2026, 9, 23, 22))).toBe(false);
    expect(isDue(fresh, at(2026, 9, 24, 7))).toBe(true);
  });
});

describe("les quatre notes — FSRS", () => {
  const now = at(2026, 9, 23);

  it("première note : les stabilités initiales w₀…w₃ de FSRS, et des intervalles strictement croissants", () => {
    const first = previewRatings(item(), now);
    // Oublié 1 j · Dur 2 j · Bien 3 j · Facile 8 j — valeurs FSRS-6 par défaut,
    // l'ordre « Dur < Bien < Facile » étant imposé comme dans Anki.
    expect(first).toEqual({ again: 1, hard: 2, good: 3, easy: 8 });
    const good = schedule(effectiveSchedule(item()), "good", now);
    expect(good.stability).toBeCloseTo(2.3065, 4);
    expect(good.state).toBe("review");
    expect(good.reviews).toBe(1);
  });

  it("« Bien » à l'heure fait grandir l'intervalle révision après révision", () => {
    let current = effectiveSchedule(item());
    let day = now;
    const intervals: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      current = schedule(current, "good", day);
      intervals.push(current.intervalDays);
      day = at(...(current.dueAt.split("-").map(Number) as [number, number, number]));
    }
    for (let index = 1; index < intervals.length; index += 1) expect(intervals[index]).toBeGreaterThan(intervals[index - 1]);
    expect(current.reviews).toBe(6);
  });

  it("l'ordre des boutons est toujours respecté : Oublié ≤ Dur < Bien < Facile", () => {
    for (const srs of [state(), state({ stability: 16, intervalDays: 16, dueAt: "2026-09-23", lastReviewedAt: at(2026, 9, 7).toISOString() })]) {
      const preview = previewRatings(item({ srs }), now);
      expect(preview.again).toBeLessThanOrEqual(preview.hard);
      expect(preview.hard).toBeLessThan(preview.good);
      expect(preview.good).toBeLessThan(preview.easy);
    }
  });

  it("« À revoir » fait chuter la stabilité, ramène à très court terme et compte l'oubli", () => {
    const before = state({ stability: 16, intervalDays: 16, lapses: 1, reviews: 5, lastReviewedAt: at(2026, 9, 7).toISOString() });
    const next = schedule(before, "again", now);
    expect(next.stability).toBeLessThan(before.stability / 2);
    expect(next.intervalDays).toBeLessThanOrEqual(3);
    expect(next).toMatchObject({ lapses: 2, reviews: 6 });
    expect(next.difficulty).toBeGreaterThan(before.difficulty);
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it("un « Bien » en retard compte davantage qu'un « Bien » à l'heure (FSRS voit que le souvenir a tenu)", () => {
    const onTime = schedule(state({ lastReviewedAt: at(2026, 9, 20).toISOString() }), "good", now);
    const late = schedule(state({ lastReviewedAt: at(2026, 9, 3).toISOString() }), "good", now);
    expect(late.stability).toBeGreaterThan(onTime.stability);
  });

  it("une carte en retard repart d'aujourd'hui, pas de son ancienne échéance", () => {
    const next = schedule(state({ dueAt: "2026-09-01" }), "good", now);
    expect(next.dueAt).toBe(addDays("2026-09-23", next.intervalDays));
  });
});

describe("migration de l'ancienne échelle fixe", () => {
  const now = at(2026, 9, 23, 9);
  /** Un calendrier tel que l'ancienne version l'écrivait : `step`, pas de stabilité. */
  const legacy = { dueAt: "2026-09-30", intervalDays: 16, step: 3, reviews: 4, lapses: 1, lastReviewedAt: at(2026, 9, 14, 20).toISOString() };

  it("garde l'échéance et l'intervalle, prend l'intervalle pour stabilité", () => {
    const converted = normalizeReviewSchedule(legacy)!;
    // Difficulté : le milieu de l'échelle (5), +1 par oubli déjà compté.
    expect(converted).toMatchObject({ dueAt: "2026-09-30", intervalDays: 16, stability: 16, difficulty: 6, state: "review", reviews: 4, lapses: 1 });
    expect(converted.difficulty).toBeGreaterThanOrEqual(1);
    expect(converted.difficulty).toBeLessThanOrEqual(10);
    expect("step" in converted).toBe(false);
  });

  it("une entrée migrée n'est PAS due avant son ancienne échéance, et l'est à partir d'elle", () => {
    const migrated = normalizeReviewItem(item({ id: "m", srs: legacy as unknown as ReviewSchedule }))!;
    expect(isDue(migrated, now)).toBe(false);
    expect(isDue(migrated, at(2026, 9, 30, 8))).toBe(true);
    expect(dueReviewItems([migrated], at(2026, 10, 2)).map((entry) => entry.id)).toEqual(["m"]);
  });

  it("noter une entrée migrée à l'échéance prolonge l'intervalle (le souvenir a tenu 16 jours)", () => {
    const migrated = normalizeReviewItem(item({ id: "m", srs: legacy as unknown as ReviewSchedule }))!;
    const next = rateReviewItem([migrated], "m", "good", at(2026, 9, 30))[0].srs!;
    expect(next.intervalDays).toBeGreaterThan(16);
    expect(next.stability).toBeGreaterThan(16);
  });

  it("un intervalle illisible reprend la valeur de l'ancien barreau", () => {
    expect(normalizeReviewSchedule({ dueAt: "2026-09-23", step: 2 })?.intervalDays).toBe(SRS_LADDER[2]);
  });
});

describe("la file du jour", () => {
  const now = at(2026, 9, 23, 9);

  it("rassemble les dues et les en retard, les plus en retard d'abord", () => {
    const list = [
      item({ id: "demain", srs: state({ dueAt: "2026-09-24" }) }),
      item({ id: "aujourdhui", srs: state({ dueAt: "2026-09-23" }) }),
      item({ id: "retard", srs: state({ dueAt: "2026-09-10" }) }),
      item({ id: "neuve-hier", createdAt: at(2026, 9, 22, 20).toISOString() }),
      item({ id: "neuve-ce-matin", createdAt: at(2026, 9, 23, 8).toISOString() }),
    ];
    expect(dueReviewItems(list, now).map((entry) => entry.id)).toEqual(["retard", "aujourdhui", "neuve-hier"]);
  });

  it("une entrée cochée quitte la file, décochée elle y revient", () => {
    const done = item({ id: "a", doneAt: now.toISOString(), srs: state({ dueAt: "2026-09-01" }) });
    expect(dueReviewItems([done], now)).toEqual([]);
    expect(dueReviewItems([{ ...done, doneAt: null }], now).map((entry) => entry.id)).toEqual(["a"]);
  });

  it("filtre par matière", () => {
    const list = [item({ id: "m" }), item({ id: "p", subject: "Physique" })];
    expect(dueReviewItems(list, now, "Physique").map((entry) => entry.id)).toEqual(["p"]);
  });

  it("noter sort l'entrée de la file et ne touche pas aux autres", () => {
    const list = [item({ id: "a" }), item({ id: "b" })];
    const rated = rateReviewItem(list, "a", "good", now);
    expect(rated[1]).toBe(list[1]);
    expect(rated[0].srs).toMatchObject({ dueAt: "2026-09-26", state: "review", reviews: 1 });
    expect(dueReviewItems(rated, now).map((entry) => entry.id)).toEqual(["b"]);
  });

  it("nextReviewDay trouve la prochaine échéance et combien y tombent", () => {
    const list = [
      item({ srs: state({ dueAt: "2026-09-23" }) }),
      item({ srs: state({ dueAt: "2026-09-27" }) }),
      item({ srs: state({ dueAt: "2026-09-25" }) }),
      item({ srs: state({ dueAt: "2026-09-25" }) }),
      item({ srs: state({ dueAt: "2026-09-24" }), doneAt: now.toISOString() }),
    ];
    expect(nextReviewDay(list, now)).toEqual({ day: "2026-09-25", count: 2 });
    expect(nextReviewDay([], now)).toBeNull();
  });
});

describe("formats", () => {
  const now = at(2026, 9, 23);
  it("dit « demain », « dans N jours », puis une date", () => {
    expect(formatDueDay("2026-09-23", now)).toBe("aujourd'hui");
    expect(formatDueDay("2026-09-24", now)).toBe("demain");
    expect(formatDueDay("2026-09-30", now)).toBe("dans 7 jours");
    expect(formatDueDay("2026-10-12", now)).toBe("le 12 oct.");
    expect(formatDueDay("2026-12-01", now)).toBe("le 1er déc.");
  });

  it("intervalles courts", () => {
    expect(formatInterval(1)).toBe("1 j");
    expect(formatInterval(16)).toBe("16 j");
    expect(formatInterval(90)).toBe("3 mois");
    expect(formatInterval(47)).toBe("47 j");
    expect(formatInterval(113)).toBe("4 mois");
    expect(formatInterval(400)).toBe("1 an");
    expect(formatInterval(550)).toBe("1,5 an");
  });
});

describe("normalisation du calendrier — frontière de confiance", () => {
  it("un aller-retour JSON ne perd rien, verso et calendrier compris", () => {
    const rated = rateReviewItem([item({ id: "x", answer: "Monotone + bornée\n⇒ convergente" })], "x", "good", at(2026, 9, 23))[0];
    expect(rated.srs?.stability).toBeGreaterThan(0);
    expect(normalizeReviewItem(JSON.parse(JSON.stringify(rated)))).toEqual(rated);
  });

  it("une entrée d'avant les révisions reste sans calendrier ni verso", () => {
    const legacy = { id: "l", subject: "Physique", text: "Revoir l'optique", kind: "à revoir", createdAt: "2026-09-01T10:00:00.000Z", doneAt: null };
    const normalized = normalizeReviewItem(legacy)!;
    expect(normalized).toEqual(legacy);
    expect("srs" in normalized).toBe(false);
    expect("answer" in normalized).toBe(false);
  });

  it("jette un calendrier sans échéance lisible, répare le reste", () => {
    expect(normalizeReviewSchedule({ dueAt: "bientôt", step: 2 })).toBeUndefined();
    expect(normalizeReviewSchedule("2026-09-23")).toBeUndefined();
    expect(normalizeReviewSchedule({ dueAt: "2026-09-23", step: 42, intervalDays: -3, reviews: "beaucoup", lapses: 1.6, lastReviewedAt: "hier" })).toMatchObject({
      dueAt: "2026-09-23",
      intervalDays: 90,
      stability: 90,
      state: "review",
      reviews: 0,
      lapses: 2,
      lastReviewedAt: null,
    });
    // Une stabilité FSRS aberrante retombe sur l'intervalle, une difficulté hors bornes est ramenée dans [1, 10].
    expect(normalizeReviewSchedule({ dueAt: "2026-09-23", intervalDays: 5, stability: -2, difficulty: 42, state: "review" })).toMatchObject({
      stability: 5,
      difficulty: 10,
    });
  });

  it("un verso vide disparaît", () => {
    expect("answer" in normalizeReviewItem({ subject: "Chimie", text: "pKa", answer: "   " })!).toBe(false);
  });
});
