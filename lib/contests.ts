import contestPapersData from "@/datasets/contest-papers.json";
import { getChaptersForSubject } from "@/lib/chapters";
import { subjects } from "@/lib/study";
import type { Chapter, Competition, ContestDocumentAvailability, ContestPaper, ContestPaperKind, ContestPaperStatus, ContestProgress } from "@/lib/storage";
import type { Difficulty, Subject } from "@/lib/supabase/types";

/**
 * Banque de sujets de concours (chantier dédié) — un document d'épreuve
 * ENTIER (ex. "Mathématiques 1" de Centrale 2024), une granularité
 * complémentaire de la banque d'exercices, jamais fusionnée avec elle (voir
 * la doc de `ContestPaper`, lib/storage.ts).
 *
 * RÉFÉRENCE BIBLIOGRAPHIQUE, PAS UN MOTEUR DE RECOMMANDATION : ce module ne
 * touche jamais `lib/recommendation.ts` ni `lib/plan.ts`. Un sujet de
 * concours n'est proposé que par recherche/filtre explicite de l'élève sur
 * /contests — jamais injecté dans le plan du jour ni dans le score
 * d'urgence, qui restent scopés aux `Exercise` (consigne du chantier).
 *
 * Catalogue LIVRÉ avec l'app (`datasets/contest-papers.json`), jamais copié
 * en `localStorage` : voir la doc de `ContestPaper`. Seule `ContestProgress`
 * (une entrée par sujet touché) est réellement persistée.
 */
export const contestPapers: ContestPaper[] = contestPapersData as ContestPaper[];

export const contestPaperKinds: ContestPaperKind[] = ["écrit", "oral"];
export const contestPaperStatuses: ContestPaperStatus[] = ["à faire", "en cours", "fait"];

export const contestPaperStatusMeta: Record<ContestPaperStatus, { label: string; className: string }> = {
  "à faire": { label: "À faire", className: "bg-inset text-muted" },
  "en cours": { label: "En cours", className: "bg-sky-400/15 text-sky-200" },
  fait: { label: "Fait", className: "bg-emerald-400/15 text-emerald-200" },
};

/** Vue d'un sujet enrichie de la progression de l'élève — voir `withContestProgress`. */
export interface ContestPaperView extends ContestPaper {
  status: ContestPaperStatus;
  favorite: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Combine le catalogue (statique) et la progression (stockée) — l'absence
 * de `ContestProgress` pour un sujet vaut "à faire, jamais commencé, pas
 * favori", jamais une entrée stockée explicitement (voir la doc de
 * `ContestProgress`, lib/storage.ts).
 */
export function withContestProgress(papers: ContestPaper[], progress: ContestProgress[]): ContestPaperView[] {
  const byId = new Map(progress.map((entry) => [entry.paperId, entry]));
  return papers.map((paper) => {
    const entry = byId.get(paper.id);
    return {
      ...paper,
      status: entry?.status ?? "à faire",
      favorite: entry?.favorite ?? false,
      startedAt: entry?.startedAt ?? null,
      completedAt: entry?.completedAt ?? null,
    };
  });
}

/**
 * Écrit un patch de progression pour UN sujet — crée l'entrée si elle
 * n'existait pas encore (premier contact avec ce sujet), la met à jour
 * sinon. Jamais de doublon par `paperId` : condition pour que
 * `withContestProgress` reste un simple `Map`.
 */
export function updateContestProgress(
  progress: ContestProgress[],
  paperId: string,
  patch: Partial<Omit<ContestProgress, "paperId" | "updatedAt">>,
  now: Date = new Date()
): ContestProgress[] {
  const updatedAt = now.toISOString();
  const existing = progress.find((entry) => entry.paperId === paperId);
  if (existing) {
    return progress.map((entry) => (entry.paperId === paperId ? { ...entry, ...patch, updatedAt } : entry));
  }
  return [
    ...progress,
    { paperId, status: "à faire", favorite: false, startedAt: null, completedAt: null, ...patch, updatedAt },
  ];
}

/**
 * Résout les libellés de chapitres d'un sujet (`ContestPaper.chapterLabels`)
 * vers les chapitres RÉELS de l'utilisateur pour sa matière — jamais par
 * id (voir la doc de `ContestPaper.chapterLabels`, lib/storage.ts). Un
 * libellé qui ne correspond plus à aucun chapitre existant (supprimé,
 * renommé) est simplement omis, jamais une erreur.
 */
export function resolveContestChapters(paper: ContestPaper, chapters: Chapter[]): Chapter[] {
  if (paper.chapterLabels.length === 0) return [];
  const scoped = getChaptersForSubject(chapters, paper.subject);
  return paper.chapterLabels
    .map((label) => scoped.find((chapter) => chapter.label === label))
    .filter((chapter): chapter is Chapter => chapter !== undefined);
}

/**
 * Disponibilité RÉELLE du sujet — toujours dérivée de `localDocumentPath`/
 * `resourceUrl`, jamais d'un champ dénormalisé (voir la doc de
 * `ContestDocumentAvailability`, lib/storage.ts). C'est la SEULE source de
 * vérité que l'UI doit interroger pour décider quel CTA afficher — jamais
 * `paper.resourceUrl`/`localDocumentPath` directement, pour ne jamais
 * dupliquer cette logique de priorité (bundled avant official-link).
 */
export function contestDocumentAvailability(paper: ContestPaper): ContestDocumentAvailability {
  if (paper.localDocumentPath) return "bundled";
  if (paper.resourceUrl) return "official-link";
  return "unavailable";
}

/** Même principe que `contestDocumentAvailability`, pour le CORRIGÉ (`localCorrectionPath`/`correctionUrl`) — un sujet et son corrigé ont chacun leur propre disponibilité, jamais couplée. */
export function contestCorrectionAvailability(paper: ContestPaper): ContestDocumentAvailability {
  if (paper.localCorrectionPath) return "bundled";
  if (paper.correctionUrl) return "official-link";
  return "unavailable";
}

/** Lien à ouvrir pour LIRE le sujet — le PDF embarqué en priorité, sinon le portail officiel, `null` si aucun des deux n'existe. Centralise l'ordre de priorité pour que l'UI n'ait jamais à le recalculer elle-même. */
export function contestDocumentHref(paper: ContestPaper): string | null {
  const availability = contestDocumentAvailability(paper);
  if (availability === "bundled") return paper.localDocumentPath;
  if (availability === "official-link") return paper.resourceUrl;
  return null;
}

/** Même principe que `contestDocumentHref`, pour le corrigé. */
export function contestCorrectionHref(paper: ContestPaper): string | null {
  const availability = contestCorrectionAvailability(paper);
  if (availability === "bundled") return paper.localCorrectionPath;
  if (availability === "official-link") return paper.correctionUrl;
  return null;
}

/** État complet des filtres + recherche de la banque de sujets — même convention que `ExerciseFilters` (lib/exercise-filters.ts). */
export interface ContestFilters {
  query: string;
  subject: Subject | "Toutes";
  competition: Competition | "Tous";
  year: number | "Toutes";
  difficulty: Difficulty | "Toutes";
  /** Identifiant de chapitre RÉSOLU (voir `resolveContestChapters`) ou "Tous". */
  chapter: string | "Tous";
  status: ContestPaperStatus | "Tous";
  withCorrectionOnly: boolean;
  favoritesOnly: boolean;
}

export const defaultContestFilters: ContestFilters = {
  query: "",
  subject: "Toutes",
  competition: "Tous",
  year: "Toutes",
  difficulty: "Toutes",
  chapter: "Tous",
  status: "Tous",
  withCorrectionOnly: false,
  favoritesOnly: false,
};

/** Recherche instantanée sur le titre, le thème, la source, le concours, l'année et les tags — même principe que `matchesSearch` (lib/exercise-filters.ts). */
function matchesContestSearch(paper: ContestPaper, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [paper.title, paper.theme ?? "", paper.source, paper.competition, String(paper.year), ...paper.tags].join(" ").toLowerCase();
  return haystack.includes(trimmed);
}

/** Filtre + recherche des sujets, combinables par construction — même convention que `filterExercises` (lib/exercise-filters.ts). */
export function filterContestPapers(papers: ContestPaperView[], filters: ContestFilters, chapters: Chapter[]): ContestPaperView[] {
  return papers
    .filter((paper) => filters.subject === "Toutes" || paper.subject === filters.subject)
    .filter((paper) => filters.competition === "Tous" || paper.competition === filters.competition)
    .filter((paper) => filters.year === "Toutes" || paper.year === filters.year)
    .filter((paper) => filters.difficulty === "Toutes" || paper.difficulty === filters.difficulty)
    .filter((paper) => filters.chapter === "Tous" || resolveContestChapters(paper, chapters).some((chapter) => chapter.id === filters.chapter))
    .filter((paper) => filters.status === "Tous" || paper.status === filters.status)
    .filter((paper) => !filters.withCorrectionOnly || contestCorrectionAvailability(paper) !== "unavailable")
    .filter((paper) => !filters.favoritesOnly || paper.favorite)
    .filter((paper) => matchesContestSearch(paper, filters.query));
}

/** Concours réellement présents dans le catalogue — jamais la liste complète de `Competition` (voir la doc de ce type, lib/storage.ts) : X/ENS n'apparaissent au filtre que le jour où un sujet réel les référence. */
export function distinctContestCompetitions(papers: ContestPaper[]): Competition[] {
  return Array.from(new Set(papers.map((paper) => paper.competition)));
}

/** Années réellement présentes, les plus récentes en premier — même convention que `distinctYears` (lib/exercise-filters.ts). */
export function distinctContestYears(papers: ContestPaper[]): number[] {
  return Array.from(new Set(papers.map((paper) => paper.year))).sort((a, b) => b - a);
}

/** Difficultés réellement évaluées dans le catalogue — même convention que `difficultyOptionsForFilters` : jamais un catalogue inventé. */
export function distinctContestDifficulties(papers: ContestPaper[]): Difficulty[] {
  return Array.from(new Set(papers.filter((paper) => paper.difficulty !== null).map((paper) => paper.difficulty as Difficulty))).sort((a, b) => a - b);
}

/** Chapitres réellement associés à au moins un sujet du périmètre choisi (matière) — mêmes conventions que `chapterOptionsForSubject` (lib/exercise-filters.ts), mais restreint à ceux que la banque de sujets référence vraiment. */
export function contestChapterOptions(papers: ContestPaper[], chapters: Chapter[], subject: Subject | "Toutes"): Chapter[] {
  const scoped = subject === "Toutes" ? papers : papers.filter((paper) => paper.subject === subject);
  const ids = new Set(scoped.flatMap((paper) => resolveContestChapters(paper, chapters).map((chapter) => chapter.id)));
  return (subject === "Toutes" ? subjects.flatMap((item) => getChaptersForSubject(chapters, item)) : getChaptersForSubject(chapters, subject)).filter(
    (chapter) => ids.has(chapter.id)
  );
}

/** Compte des sujets par statut de progression — alimente l'en-tête de /contests ("N sujets, M travaillés"). */
export function contestProgressCounts(papers: ContestPaperView[]): Record<ContestPaperStatus, number> {
  const counts: Record<ContestPaperStatus, number> = { "à faire": 0, "en cours": 0, fait: 0 };
  for (const paper of papers) counts[paper.status]++;
  return counts;
}
