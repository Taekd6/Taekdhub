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

function state(overrides: Partial<ReviewSchedule> = {}): ReviewSchedule {
  return { dueAt: "2026-09-23", intervalDays: 1, step: 0, reviews: 0, lapses: 0, lastReviewedAt: null, ...overrides };
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
    expect(schedule(state(), "again", at(2026, 3, 1, 0, 5)).dueAt).toBe("2026-03-02");
  });
});

describe("une entrée jamais révisée", () => {
  it("est due le lendemain de sa création, au premier barreau", () => {
    const fresh = item({ createdAt: at(2026, 1, 31, 22).toISOString() });
    expect(effectiveSchedule(fresh)).toEqual({ dueAt: "2026-02-01", intervalDays: 1, step: 0, reviews: 0, lapses: 0, lastReviewedAt: null });
  });

  it("n'est pas due le jour même", () => {
    const fresh = item({ createdAt: at(2026, 9, 23, 8).toISOString() });
    expect(isDue(fresh, at(2026, 9, 23, 22))).toBe(false);
    expect(isDue(fresh, at(2026, 9, 24, 7))).toBe(true);
  });
});

describe("les quatre notes", () => {
  const now = at(2026, 9, 23);

  it("« Bien » monte l'échelle 1 → 3 → 7 → 16 → 35 → 90, puis plafonne", () => {
    let current = state();
    const intervals: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      current = schedule(current, "good", now);
      intervals.push(current.intervalDays);
    }
    expect(intervals).toEqual([3, 7, 16, 35, 90, 90, 90]);
    expect(current.step).toBe(SRS_LADDER.length - 1);
    expect(current.reviews).toBe(7);
  });

  it("« Facile » saute un barreau", () => {
    const first = schedule(state(), "easy", now);
    expect(first.intervalDays).toBe(7);
    expect(schedule(first, "easy", now).intervalDays).toBe(35);
    expect(schedule(state({ step: 4, intervalDays: 35 }), "easy", now).intervalDays).toBe(90);
  });

  it("« À revoir » remet à demain, au premier barreau, et compte l'oubli", () => {
    const next = schedule(state({ step: 3, intervalDays: 16, lapses: 1, reviews: 5 }), "again", now);
    expect(next).toMatchObject({ dueAt: "2026-09-24", intervalDays: 1, step: 0, lapses: 2, reviews: 6 });
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it("« Difficile » multiplie par 1,2 sans jamais descendre sous un jour", () => {
    expect(schedule(state({ intervalDays: 1 }), "hard", now).intervalDays).toBe(1);
    expect(schedule(state({ step: 1, intervalDays: 3 }), "hard", now).intervalDays).toBe(4);
    expect(schedule(state({ step: 3, intervalDays: 16 }), "hard", now).intervalDays).toBe(19);
  });

  it("« Bien » après des « Difficile » repart toujours vers le haut", () => {
    let current = state({ step: 1, intervalDays: 3 });
    for (let index = 0; index < 4; index += 1) current = schedule(current, "hard", now);
    // 3 → 4 → 5 → 6 → 7 : au barreau « 7 jours ».
    expect(current.intervalDays).toBe(7);
    const good = schedule(current, "good", now);
    expect(good.intervalDays).toBeGreaterThan(current.intervalDays);
    expect(good.intervalDays).toBe(16);
  });

  it("« Bien » ne raccourcit jamais un intervalle au-delà du plafond", () => {
    expect(schedule(state({ step: 5, intervalDays: 108 }), "good", now).intervalDays).toBe(108);
  });

  it("une carte en retard repart d'aujourd'hui, pas de son ancienne échéance", () => {
    expect(schedule(state({ dueAt: "2026-09-01" }), "good", now).dueAt).toBe("2026-09-26");
  });

  it("previewRatings annonce ce que donnerait chaque bouton", () => {
    expect(previewRatings(item(), now)).toEqual({ again: 1, hard: 1, good: 3, easy: 7 });
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
    expect(rated[0].srs).toMatchObject({ dueAt: "2026-09-26", step: 1, reviews: 1 });
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
  });
});

describe("normalisation du calendrier — frontière de confiance", () => {
  it("un aller-retour JSON ne perd rien, verso et calendrier compris", () => {
    const rated = rateReviewItem([item({ id: "x", answer: "Monotone + bornée\n⇒ convergente" })], "x", "good", at(2026, 9, 23))[0];
    expect(rated.srs?.step).toBe(1);
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
    expect(normalizeReviewSchedule({ dueAt: "2026-09-23", step: 42, intervalDays: -3, reviews: "beaucoup", lapses: 1.6, lastReviewedAt: "hier" })).toEqual({
      dueAt: "2026-09-23",
      intervalDays: 90,
      step: 5,
      reviews: 0,
      lapses: 2,
      lastReviewedAt: null,
    });
  });

  it("un verso vide disparaît", () => {
    expect("answer" in normalizeReviewItem({ subject: "Chimie", text: "pKa", answer: "   " })!).toBe(false);
  });
});
