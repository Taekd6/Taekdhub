import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog, type AnnaleLog } from "@/lib/annales";
import { createChapter, rateChapter } from "@/lib/chapter-memory";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";
import { bestProgrammeMatch, buildRetroplanning, computeMastery, matchesProgramme, summarizeMastery } from "@/lib/programme";
import type { ChapterMemory } from "@/lib/storage";

const TODAY = "2026-10-02";
const reduction = PROGRAMME_BY_ID.get("m2-reduction")!;

let seq = 0;
function annale(chapitre: string, resultat: string, matiere = "maths"): AnnaleLog {
  seq += 1;
  return normalizeAnnaleLog({ id: `a${seq}`, created_at: "2026-09-30T10:00:00Z", matiere, chapitre, resultat })!;
}

function memory(title: string, learnedAt: string, subject: ChapterMemory["subject"] = "Mathématiques"): ChapterMemory {
  return createChapter({ subject, title, learnedAt }, new Date(`${learnedAt}T12:00:00`), title);
}

function masteryOf(id: string, input: Partial<Parameters<typeof computeMastery>[0]> = {}) {
  return computeMastery({ chapterMemory: [], annales: [], seen: [], today: TODAY, ...input }).find((entry) => entry.chapter.id === id)!;
}

describe("données du programme", () => {
  it("des identifiants uniques et des questions pour chaque chapitre", () => {
    expect(new Set(PROGRAMME.map((chapter) => chapter.id)).size).toBe(PROGRAMME.length);
    for (const chapter of PROGRAMME) expect(chapter.questions.length).toBeGreaterThan(0);
  });
});

describe("rapprochement des titres", () => {
  it("reconnaît un titre libre ou un alias, dans la bonne matière", () => {
    expect(matchesProgramme(reduction, "Mathématiques", "Réduction des endomorphismes")).toBe(true);
    expect(matchesProgramme(reduction, "Mathématiques", "diagonalisation")).toBe(true);
    expect(matchesProgramme(reduction, "Physique", "Réduction")).toBe(false);
    expect(matchesProgramme(reduction, "Mathématiques", "TD")).toBe(false);
  });

  it("un seul chapitre par titre : le rapprochement le plus fort", () => {
    expect(bestProgrammeMatch("Mathématiques", "Séries entières")?.id).toBe("m2-series-entieres");
    expect(bestProgrammeMatch("Mathématiques", "Séries numériques")?.id).toBe("m1-series");
    expect(bestProgrammeMatch("Physique", "Théorème de Gauss")?.id).toBe("p2-electrostatique");
    expect(bestProgrammeMatch("Mathématiques", "Chapitre inventé")).toBeNull();
  });
});

describe("statut d'un chapitre", () => {
  it("sans trace : pas vu, ou jamais revu s'il est déclaré vu en cours", () => {
    expect(masteryOf("m2-reduction").status).toBe("pas-vu");
    expect(masteryOf("m2-reduction", { seen: ["m2-reduction"] }).status).toBe("jamais");
  });

  it("fragile quand la mémoire passe sous 85 %", () => {
    const entry = masteryOf("m2-reduction", { chapterMemory: [memory("Réduction", "2026-06-01")] });
    expect(entry.status).toBe("fragile");
    expect(entry.reason).toContain("mémoire");
  });

  it("solide juste après un rappel réussi", () => {
    const fresh = rateChapter(memory("Réduction", "2026-09-01"), "good", "2026-10-02");
    expect(masteryOf("m2-reduction", { chapterMemory: [fresh] }).status).toBe("solide");
  });

  it("fragile quand les annales ratent, même avec une bonne mémoire", () => {
    const fresh = rateChapter(memory("Réduction", "2026-09-01"), "good", "2026-10-02");
    const entry = masteryOf("m2-reduction", { chapterMemory: [fresh], annales: [annale("réduction", "échec"), annale("Réduction", "partiel")] });
    expect(entry.status).toBe("fragile");
    expect(entry.annalesRate).toBe(0.25);
  });

  it("deux annales réussies suffisent à rendre solide sans Mémoire ; une seule laisse « en cours »", () => {
    expect(masteryOf("m2-series-entieres", { annales: [annale("Séries entières", "réussi")] }).status).toBe("en-cours");
    expect(masteryOf("m2-series-entieres", { annales: [annale("Séries entières", "réussi"), annale("series entieres", "réussi")] }).status).toBe("solide");
  });

  it("le bilan compte les solides parmi les seuls chapitres vus", () => {
    const summary = summarizeMastery(computeMastery({ chapterMemory: [], annales: [annale("Séries entières", "réussi"), annale("Séries entières", "réussi")], seen: ["m2-reduction"], today: TODAY }));
    expect(summary.seen).toBe(2);
    expect(summary.solidShare).toBe(0.5);
    expect(summary.counts.jamais).toBe(1);
  });
});

describe("rétroplanning", () => {
  const mastery = computeMastery({
    chapterMemory: [memory("Réduction", "2026-06-01"), memory("Électrostatique", "2026-06-01", "Physique")],
    annales: [],
    seen: ["m2-evn", "m2-probas"],
    today: TODAY,
  });

  it("rien sans date de concours ou avec une date passée", () => {
    expect(buildRetroplanning(mastery, "", TODAY)).toBeNull();
    expect(buildRetroplanning(mastery, "2026-09-01", TODAY)).toBeNull();
  });

  it("le plus fragile d'abord, tout est placé, et la dernière semaine reste libre", () => {
    const plan = buildRetroplanning(mastery, "2026-10-30", TODAY)!;
    expect(plan.daysLeft).toBe(28);
    const placed = plan.weeks.flatMap((week) => week.chapters.map((entry) => entry.chapter.id));
    expect(placed.sort()).toEqual(["m2-evn", "m2-probas", "m2-reduction", "p2-electrostatique"].sort());
    expect(plan.weeks[0].chapters[0].status).toBe("fragile");
    expect(plan.weeks[plan.weeks.length - 1].chapters).toEqual([]);
  });
});
