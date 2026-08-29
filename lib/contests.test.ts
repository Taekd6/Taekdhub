import { describe, expect, it } from "vitest";
import {
  contestChapterOptions,
  contestPapers,
  contestPaperKinds,
  contestPaperStatuses,
  contestProgressCounts,
  contestResourceAvailable,
  defaultContestFilters,
  distinctContestCompetitions,
  distinctContestDifficulties,
  distinctContestYears,
  filterContestPapers,
  resolveContestChapters,
  updateContestProgress,
  withContestProgress,
  type ContestFilters,
} from "@/lib/contests";
import { subjects } from "@/lib/study";
import type { Chapter, Competition, ContestPaper, ContestProgress } from "@/lib/storage";

const KNOWN_COMPETITIONS: Competition[] = ["CCINP", "Mines-Ponts", "Centrale", "e3a", "PT", "X", "ENS"];
const KNOWN_LICENSE_STATUSES = ["libre", "à vérifier", "restreint"];

function makeChapters(): Chapter[] {
  return [
    { id: "ch-integration", subject: "Mathématiques", label: "Intégration" },
    { id: "ch-polynomes", subject: "Mathématiques", label: "Polynômes" },
    { id: "ch-suites", subject: "Mathématiques", label: "Suites numériques" },
  ];
}

describe("datasets/contest-papers.json — qualité des données (Phase 7 du chantier)", () => {
  it("n'est pas vide — la banque livrée est réellement représentative", () => {
    expect(contestPapers.length).toBeGreaterThan(0);
  });

  it("n'a aucun id dupliqué", () => {
    const ids = contestPapers.map((paper) => paper.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne référence que des matières et concours reconnus par TaekdHub", () => {
    for (const paper of contestPapers) {
      expect(subjects).toContain(paper.subject);
      expect(KNOWN_COMPETITIONS).toContain(paper.competition);
      expect(contestPaperKinds).toContain(paper.kind);
      expect(KNOWN_LICENSE_STATUSES).toContain(paper.licenseStatus);
    }
  });

  it("a une année plausible (pas dans le futur, pas absurdement ancienne)", () => {
    const currentYear = new Date().getFullYear();
    for (const paper of contestPapers) {
      expect(paper.year).toBeGreaterThan(2000);
      expect(paper.year).toBeLessThanOrEqual(currentYear);
    }
  });

  it("a une difficulté valide (1 à 5) ou explicitement non évaluée (null) — jamais une valeur inventée", () => {
    for (const paper of contestPapers) {
      if (paper.difficulty !== null) {
        expect(paper.difficulty).toBeGreaterThanOrEqual(1);
        expect(paper.difficulty).toBeLessThanOrEqual(5);
      }
    }
  });

  it("ne pointe jamais un lien direct vers un fichier — seulement le portail officiel du concours, ou aucune ressource", () => {
    for (const paper of contestPapers) {
      if (paper.resourceUrl !== null) {
        expect(paper.resourceUrl).toMatch(/^https:\/\//);
        expect(paper.resourceUrl.toLowerCase()).not.toMatch(/\.pdf$/);
      }
    }
  });

  it("ne reproduit jamais l'énoncé — chaque sujet référencé porte une note honnête sur l'absence de contenu reproduit", () => {
    for (const paper of contestPapers) {
      expect(paper.note).toBeTruthy();
    }
  });
});

describe("withContestProgress — l'absence d'entrée de progression vaut « à faire, jamais commencé »", () => {
  const paper: ContestPaper = contestPapers[0];

  it("un sujet jamais touché reste à faire, non favori", () => {
    const [view] = withContestProgress([paper], []);
    expect(view.status).toBe("à faire");
    expect(view.favorite).toBe(false);
    expect(view.startedAt).toBeNull();
    expect(view.completedAt).toBeNull();
  });

  it("une entrée de progression existante est reflétée fidèlement", () => {
    const progress: ContestProgress[] = [
      { paperId: paper.id, status: "en cours", favorite: true, startedAt: "2026-01-01T00:00:00.000Z", completedAt: null, updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    const [view] = withContestProgress([paper], progress);
    expect(view.status).toBe("en cours");
    expect(view.favorite).toBe(true);
    expect(view.startedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("updateContestProgress — écrit la progression d'un sujet sans jamais dupliquer par id", () => {
  const paperId = "ccinp-2024-maths1";

  it("crée l'entrée au premier contact (démarrage d'un sujet jamais touché)", () => {
    const now = new Date("2026-02-01T10:00:00.000Z");
    const next = updateContestProgress([], paperId, { status: "en cours", startedAt: now.toISOString() }, now);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ paperId, status: "en cours", startedAt: now.toISOString(), favorite: false, completedAt: null });
  });

  it("met à jour l'entrée existante sans créer de doublon", () => {
    const now1 = new Date("2026-02-01T10:00:00.000Z");
    const now2 = new Date("2026-02-03T10:00:00.000Z");
    let progress = updateContestProgress([], paperId, { status: "en cours", startedAt: now1.toISOString() }, now1);
    progress = updateContestProgress(progress, paperId, { status: "fait", completedAt: now2.toISOString() }, now2);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ paperId, status: "fait", startedAt: now1.toISOString(), completedAt: now2.toISOString() });
  });

  it("un patch partiel (ex. juste le favori) ne touche jamais aux autres champs déjà écrits", () => {
    const now1 = new Date("2026-02-01T10:00:00.000Z");
    const now2 = new Date("2026-02-02T10:00:00.000Z");
    let progress = updateContestProgress([], paperId, { status: "en cours", startedAt: now1.toISOString() }, now1);
    progress = updateContestProgress(progress, paperId, { favorite: true }, now2);
    expect(progress[0]).toMatchObject({ status: "en cours", startedAt: now1.toISOString(), favorite: true });
  });

  it("reprendre un sujet terminé (repasse « en cours ») ne perd pas la date de première réalisation si elle n'est pas explicitement effacée", () => {
    const now1 = new Date("2026-02-01T10:00:00.000Z");
    const now2 = new Date("2026-02-05T10:00:00.000Z");
    let progress = updateContestProgress([], paperId, { status: "fait", completedAt: now1.toISOString() }, now1);
    progress = updateContestProgress(progress, paperId, { status: "en cours" }, now2);
    expect(progress[0].status).toBe("en cours");
    expect(progress[0].completedAt).toBe(now1.toISOString());
  });

  it("persiste correctement après une simulation de reload (round-trip via un tableau simple, sans état caché)", () => {
    const now = new Date("2026-02-01T10:00:00.000Z");
    const progress = updateContestProgress([], paperId, { status: "en cours", startedAt: now.toISOString() }, now);
    const serialized = JSON.parse(JSON.stringify(progress)) as ContestProgress[];
    expect(serialized).toEqual(progress);
  });
});

describe("resolveContestChapters — résolution par libellé, jamais par id fixe", () => {
  const chapters = makeChapters();

  it("résout un libellé connu vers le chapitre réel de l'utilisateur", () => {
    const paper = contestPapers.find((item) => item.chapterLabels.includes("Intégration"))!;
    const resolved = resolveContestChapters(paper, chapters);
    expect(resolved.map((chapter) => chapter.label)).toContain("Intégration");
  });

  it("omet silencieusement un libellé qui ne correspond à aucun chapitre existant (supprimé/renommé) — jamais une erreur", () => {
    const paper: ContestPaper = { ...contestPapers[0], subject: "Mathématiques", chapterLabels: ["Chapitre inexistant"] };
    expect(resolveContestChapters(paper, chapters)).toEqual([]);
  });

  it("un sujet sans chapitre identifié retourne un tableau vide, jamais une couverture inventée", () => {
    const paper: ContestPaper = { ...contestPapers[0], chapterLabels: [] };
    expect(resolveContestChapters(paper, chapters)).toEqual([]);
  });
});

describe("filterContestPapers — filtres combinables, jamais un catalogue de fallback inventé", () => {
  const chapters = makeChapters();
  const views = withContestProgress(contestPapers, []);

  it("sans filtre, retourne tout le catalogue", () => {
    expect(filterContestPapers(views, defaultContestFilters, chapters)).toHaveLength(views.length);
  });

  it("filtre par matière", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, subject: "Chimie" }, chapters);
    expect(filtered.length).toBeGreaterThan(0);
    for (const paper of filtered) expect(paper.subject).toBe("Chimie");
  });

  it("filtre par concours", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, competition: "Centrale" }, chapters);
    expect(filtered.length).toBeGreaterThan(0);
    for (const paper of filtered) expect(paper.competition).toBe("Centrale");
  });

  it("filtre par année", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, year: 2023 }, chapters);
    expect(filtered.length).toBeGreaterThan(0);
    for (const paper of filtered) expect(paper.year).toBe(2023);
  });

  it("combine matière + concours + année sans qu'un filtre écrase l'autre", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, subject: "Mathématiques", competition: "CCINP", year: 2024 }, chapters);
    expect(filtered).toHaveLength(2); // Maths 1 et Maths 2, CCINP 2024
  });

  it("recherche par texte — thème, concours, année", () => {
    const byTheme = filterContestPapers(views, { ...defaultContestFilters, query: "Wallis" }, chapters);
    expect(byTheme).toHaveLength(1);
    const byYear = filterContestPapers(views, { ...defaultContestFilters, query: "2023" }, chapters);
    expect(byYear.every((paper) => paper.year === 2023)).toBe(true);
    expect(byYear.length).toBeGreaterThan(0);
  });

  it("sujets sans corrigé — withCorrectionOnly retourne une liste vide sur le catalogue actuel (aucun corrigé vérifié à ce jour), sans planter", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, withCorrectionOnly: true }, chapters);
    expect(filtered).toEqual([]);
  });

  it("sujets sans chapitre identifié — le filtre chapitre ne renvoie que ceux qui le référencent réellement", () => {
    const target = contestPapers.find((paper) => paper.chapterLabels.includes("Polynômes"))!;
    const filtered = filterContestPapers(views, { ...defaultContestFilters, chapter: "ch-polynomes" }, chapters);
    expect(filtered.map((p) => p.id)).toContain(target.id);
    for (const paper of filtered) expect(paper.chapterLabels).toContain("Polynômes");
  });

  it("favoritesOnly filtre sur la progression réelle, pas sur le catalogue statique", () => {
    const progress: ContestProgress[] = [{ paperId: contestPapers[0].id, status: "à faire", favorite: true, startedAt: null, completedAt: null, updatedAt: "2026-01-01T00:00:00.000Z" }];
    const viewsWithFavorite = withContestProgress(contestPapers, progress);
    const filtered = filterContestPapers(viewsWithFavorite, { ...defaultContestFilters, favoritesOnly: true }, chapters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(contestPapers[0].id);
  });

  it("filtre par statut de progression", () => {
    const progress: ContestProgress[] = [{ paperId: contestPapers[0].id, status: "fait", favorite: false, startedAt: null, completedAt: null, updatedAt: "2026-01-01T00:00:00.000Z" }];
    const viewsWithStatus = withContestProgress(contestPapers, progress);
    const filtered = filterContestPapers(viewsWithStatus, { ...defaultContestFilters, status: "fait" }, chapters);
    expect(filtered).toHaveLength(1);
    const untouched = filterContestPapers(viewsWithStatus, { ...defaultContestFilters, status: "à faire" }, chapters);
    expect(untouched).toHaveLength(contestPapers.length - 1);
  });

  it("aucun résultat après un filtre trop restrictif — liste vide, jamais une erreur", () => {
    const filtered = filterContestPapers(views, { ...defaultContestFilters, competition: "PT" }, chapters);
    expect(filtered).toEqual([]);
  });
});

describe("Options de filtre — dérivées des données réelles, jamais un catalogue inventé", () => {
  it("distinctContestCompetitions ne propose que les concours réellement présents (X/ENS absents tant qu'aucun sujet ne les référence)", () => {
    const competitions = distinctContestCompetitions(contestPapers);
    expect(competitions).not.toContain("X");
    expect(competitions).not.toContain("ENS");
    expect(competitions.length).toBeGreaterThan(0);
  });

  it("distinctContestYears trie du plus récent au plus ancien", () => {
    const years = distinctContestYears(contestPapers);
    for (let i = 1; i < years.length; i++) expect(years[i]).toBeLessThan(years[i - 1]);
  });

  it("distinctContestDifficulties reste vide tant qu'aucun sujet n'a de difficulté évaluée — jamais 1..5 inventé", () => {
    expect(distinctContestDifficulties(contestPapers)).toEqual([]);
  });

  it("contestChapterOptions ne retourne que les chapitres réellement référencés par au moins un sujet du périmètre", () => {
    const chapters = makeChapters();
    const options = contestChapterOptions(contestPapers, chapters, "Mathématiques");
    expect(options.map((chapter) => chapter.label).sort()).toEqual(["Intégration", "Polynômes"]);
    // "Suites numériques" existe dans le catalogue de chapitres de l'utilisateur mais aucun sujet ne le référence : absent des options.
    expect(options.map((chapter) => chapter.label)).not.toContain("Suites numériques");
  });
});

describe("contestResourceAvailable — honnêteté de l'affichage « ressource à ajouter »", () => {
  it("vrai seulement si une ressource officielle est réellement renseignée", () => {
    expect(contestResourceAvailable({ ...contestPapers[0], resourceUrl: "https://example.fr" })).toBe(true);
    expect(contestResourceAvailable({ ...contestPapers[0], resourceUrl: null })).toBe(false);
  });
});

describe("contestProgressCounts — comptage par statut, source unique pour l'en-tête de /contests", () => {
  it("tout le catalogue non touché compte comme « à faire »", () => {
    const views = withContestProgress(contestPapers, []);
    const counts = contestProgressCounts(views);
    expect(counts["à faire"]).toBe(contestPapers.length);
    expect(counts["en cours"]).toBe(0);
    expect(counts.fait).toBe(0);
  });

  it("reflète un mélange réaliste de statuts (élève irrégulier : certains commencés, un terminé, le reste à faire)", () => {
    const progress: ContestProgress[] = [
      { paperId: contestPapers[0].id, status: "fait", favorite: false, startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" },
      { paperId: contestPapers[1].id, status: "en cours", favorite: false, startedAt: "2026-01-03T00:00:00.000Z", completedAt: null, updatedAt: "2026-01-03T00:00:00.000Z" },
    ];
    const counts = contestProgressCounts(withContestProgress(contestPapers, progress));
    expect(counts.fait).toBe(1);
    expect(counts["en cours"]).toBe(1);
    expect(counts["à faire"]).toBe(contestPapers.length - 2);
  });
});

describe("Statuts de sujet — vocabulaire volontairement plus simple qu'un exercice", () => {
  it("n'a que trois valeurs, aucune notion de maîtrise graduée", () => {
    expect(contestPaperStatuses).toEqual(["à faire", "en cours", "fait"]);
  });
});

// Édge case explicite Phase 8 : filtres avec un catalogue à un seul élément
// (ne doit jamais planter ni renvoyer un résultat incohérent).
describe("Cas limite — catalogue à un seul sujet", () => {
  it("filtrer/rechercher sur un catalogue à un seul sujet reste correct", () => {
    const chapters = makeChapters();
    const single = withContestProgress([contestPapers[0]], []);
    expect(filterContestPapers(single, defaultContestFilters, chapters)).toHaveLength(1);
    expect(filterContestPapers(single, { ...defaultContestFilters, competition: "Mines-Ponts" as ContestFilters["competition"] }, chapters)).toEqual(
      contestPapers[0].competition === "Mines-Ponts" ? single : []
    );
  });
});
