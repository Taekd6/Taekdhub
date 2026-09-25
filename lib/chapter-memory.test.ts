import { describe, expect, it } from "vitest";
import {
  AT_RISK_THRESHOLD,
  atRisk,
  createChapter,
  dueDay,
  editChapter,
  forecastCurve,
  formatChance,
  rateChapter,
  reminderDay,
  retrievabilityToday,
  setArchived,
  summarizeBySubject,
} from "@/lib/chapter-memory";
import { retrievabilityAfter, shiftDay } from "@/lib/fsrs";
import { normalizeChapterMemory } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

const NOW = new Date("2026-09-24T10:00:00.000Z");

function chapter(title: string, learnedAt: string, subject: Subject = "Mathématiques", ankiDeck?: string) {
  return createChapter({ subject, title, learnedAt, ankiDeck }, NOW, `id-${title}`);
}

describe("createChapter — l'apprentissage est la première révision", () => {
  it("stabilité initiale w₂ (« Bien »), aucune révision dans l'historique", () => {
    const created = chapter("Intégrales", "2026-09-01", "Mathématiques", "  Maths::Intégrales ");
    expect(created.card.stability).toBeCloseTo(2.3065, 4);
    expect(created.card.lastReview).toBe("2026-09-01");
    expect(created.reviews).toEqual([]);
    expect(created.ankiDeck).toBe("Maths::Intégrales");
    expect(created.archived).toBe(false);
    expect("ankiDeck" in chapter("Sans paquet", "2026-09-01")).toBe(false);
  });

  it("R vaut 1 le jour même, puis décroît selon la courbe FSRS", () => {
    const created = chapter("Suites", "2026-09-20");
    expect(retrievabilityToday(created, "2026-09-20")).toBe(1);
    expect(retrievabilityToday(created, "2026-09-27")).toBeCloseTo(retrievabilityAfter(created.card.stability, 7), 10);
  });
});

describe("un chapitre jamais révisé depuis l'apprentissage", () => {
  const old = chapter("Espaces vectoriels", "2026-06-15");

  it("est très menacé trois mois plus tard, mais jamais à zéro (loi puissance)", () => {
    const r = retrievabilityToday(old, "2026-09-24");
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.7);
  });

  it("son rappel est passé depuis longtemps et sa révision conseillée aussi", () => {
    expect(reminderDay(old) < "2026-09-24").toBe(true);
    expect(dueDay(old) < reminderDay(old)).toBe(true);
  });
});

describe("rateChapter", () => {
  it("un « Bien » remonte R à 1 et repousse la révision conseillée", () => {
    const learned = chapter("Thermo", "2026-09-01");
    const rated = rateChapter(learned, "good", "2026-09-24");
    expect(rated.reviews).toEqual([{ day: "2026-09-24", rating: "good" }]);
    expect(retrievabilityToday(rated, "2026-09-24")).toBe(1);
    expect(rated.card.stability).toBeGreaterThan(learned.card.stability);
    expect(dueDay(rated) > "2026-09-24").toBe(true);
  });

  it("« Oublié » garde une stabilité faible : rappel très proche", () => {
    const rated = rateChapter(chapter("Optique", "2026-09-01"), "again", "2026-09-24");
    expect(rated.card.lapses).toBe(1);
    expect(reminderDay(rated) <= shiftDay("2026-09-24", 3)).toBe(true);
  });

  it("révision datée en fin de mois : les jours sont comptés sur le calendrier", () => {
    const learned = chapter("Probas", "2026-01-31");
    const rated = rateChapter(learned, "good", "2026-02-28");
    expect(rated.card.lastReview).toBe("2026-02-28");
    expect(retrievabilityToday(learned, "2026-03-01")).toBeCloseTo(retrievabilityAfter(learned.card.stability, 29), 10);
  });

  it("une révision rétroactive rejoue l'historique dans l'ordre", () => {
    const base = chapter("Chimie orga", "2026-09-01");
    const a = rateChapter(rateChapter(base, "good", "2026-09-04"), "good", "2026-09-15");
    const b = rateChapter(rateChapter(base, "good", "2026-09-15"), "good", "2026-09-04");
    expect(b.reviews.map((entry) => entry.day)).toEqual(["2026-09-04", "2026-09-15"]);
    expect(b.card).toEqual(a.card);
  });

  it("une révision datée avant l'apprentissage est ramenée au jour de l'apprentissage", () => {
    expect(rateChapter(chapter("X", "2026-09-10"), "good", "2026-09-01").reviews[0].day).toBe("2026-09-10");
  });
});

describe("editChapter", () => {
  it("changer la date d'apprentissage rejoue l'état FSRS", () => {
    const original = rateChapter(chapter("Méca", "2026-09-10"), "good", "2026-09-13");
    const edited = editChapter(original, { learnedAt: "2026-09-01" });
    expect(edited.learnedAt).toBe("2026-09-01");
    expect(edited.reviews).toEqual(original.reviews);
    expect(edited.card).not.toEqual(original.card);
  });

  it("vider le paquet Anki le retire, un titre vide est refusé", () => {
    const withDeck = chapter("Ondes", "2026-09-10", "Physique", "Physique::Ondes");
    const edited = editChapter(withDeck, { ankiDeck: "  ", title: "   " });
    expect("ankiDeck" in edited).toBe(false);
    expect(edited.title).toBe("Ondes");
  });
});

describe("atRisk — « À ne pas oublier »", () => {
  const today = "2026-09-24";
  const chapters = [
    chapter("Fraîchement appris", "2026-09-23"),
    chapter("Appris il y a une semaine", "2026-09-17"),
    chapter("Appris en juin", "2026-06-15"),
    setArchived(chapter("Rangé", "2026-05-01"), true),
    rateChapter(chapter("Révisé hier", "2026-09-01"), "good", "2026-09-23"),
  ];

  it("ne garde que les chapitres sous le seuil, non rangés, le plus menacé d'abord", () => {
    const list = atRisk(chapters, today);
    expect(list.map((entry) => entry.chapter.title)).toEqual(["Appris en juin", "Appris il y a une semaine"]);
    expect(list[0].retrievability).toBeLessThan(list[1].retrievability);
    for (const entry of list) expect(entry.retrievability).toBeLessThan(AT_RISK_THRESHOLD);
  });

  it("le seuil est réglable", () => {
    expect(atRisk(chapters, today, 0.6).map((entry) => entry.chapter.title)).toEqual(["Appris en juin"]);
    expect(atRisk(chapters, today, 1.01)).toHaveLength(4);
  });
});

describe("summarizeBySubject", () => {
  it("compte, moyenne et prochain rappel par matière", () => {
    const chapters = [
      chapter("A", "2026-06-15"),
      chapter("B", "2026-09-23"),
      chapter("C", "2026-09-23", "Physique"),
      setArchived(chapter("D", "2026-09-23", "Chimie"), true),
    ];
    const summary = summarizeBySubject(chapters, "2026-09-24", ["Mathématiques", "Physique", "Chimie"]);
    expect(summary.map((entry) => entry.subject)).toEqual(["Mathématiques", "Physique"]);
    expect(summary[0]).toMatchObject({ count: 2, atRisk: 1 });
    expect(summary[0].meanRetrievability).toBeGreaterThan(0);
    expect(summary[0].nextReminder! > "2026-09-24").toBe(true);
  });
});

describe("forecastCurve et formats", () => {
  it("31 points, décroissants, qui commencent à R aujourd'hui", () => {
    const learned = chapter("Courbe", "2026-09-20");
    const curve = forecastCurve(learned, "2026-09-24", 30);
    expect(curve).toHaveLength(31);
    expect(curve[0]).toEqual({ day: "2026-09-24", retrievability: retrievabilityToday(learned, "2026-09-24") });
    expect(curve[30].day).toBe("2026-10-24");
    for (let index = 1; index < curve.length; index += 1) expect(curve[index].retrievability).toBeLessThan(curve[index - 1].retrievability);
  });

  it("formatChance ne promet jamais 100 % après un jour écoulé", () => {
    expect(formatChance(0.7234)).toBe("72 %");
    expect(formatChance(0.998)).toBe("99 %");
    expect(formatChance(1)).toBe("100 %");
  });
});

describe("normalizeChapterMemory — frontière de confiance", () => {
  it("un aller-retour JSON ne perd rien", () => {
    const rated = rateChapter(chapter("Aller-retour", "2026-09-01", "Mathématiques", "Maths"), "hard", "2026-09-10");
    expect(normalizeChapterMemory(JSON.parse(JSON.stringify(rated)))).toEqual(rated);
  });

  it("écarte un chapitre sans titre, sans matière connue ou sans date d'apprentissage", () => {
    expect(normalizeChapterMemory({ title: " ", subject: "Mathématiques", learnedAt: "2026-09-01" })).toBeNull();
    expect(normalizeChapterMemory({ title: "X", subject: "Latin", learnedAt: "2026-09-01" })).toBeNull();
    expect(normalizeChapterMemory({ title: "X", subject: "Mathématiques", learnedAt: "bientôt" })).toBeNull();
  });

  it("reconstruit un état FSRS abîmé en rejouant l'historique, jette les révisions illisibles", () => {
    const reference = rateChapter(chapter("Rejoué", "2026-09-01"), "good", "2026-09-05");
    const damaged = { ...reference, card: { stability: "beaucoup" }, reviews: [...reference.reviews, { day: "hier", rating: "good" }, { day: "2026-09-06", rating: "super" }] };
    const normalized = normalizeChapterMemory(JSON.parse(JSON.stringify(damaged)))!;
    expect(normalized.reviews).toEqual(reference.reviews);
    expect(normalized.card).toEqual(reference.card);
  });
});
