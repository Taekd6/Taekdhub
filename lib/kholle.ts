import { createReviewItem, REVIEW_TEXT_MAX } from "@/lib/review-items";
import { PROGRAMME_BY_ID, type ProgrammeChapter } from "@/lib/programme-data";
import { bestProgrammeMatch } from "@/lib/programme";
import type { ChapterMemory, ReviewItem } from "@/lib/storage";
import type { FsrsRating } from "@/lib/fsrs";

/**
 * MODE KHÔLLE — s'entraîner aux questions de cours comme au tableau.
 *
 * L'élève choisit son programme de colle de la semaine (des chapitres de
 * lib/programme-data.ts) ; TaekdHub tire une question de cours, lance le
 * chrono, et l'élève s'évalue honnêtement :
 *
 *   su        → la mémoire du chapitre est notée « bien » (FSRS) ;
 *   hésitant  → « difficile », et la question part dans « À revoir » ;
 *   pas su    → « à revoir », et la question part dans « À revoir ».
 *
 * LE TIRAGE N'EST PAS UNIFORME : une question ratée revient plus souvent,
 * une question sue moins souvent, et une question posée dans les dernières
 * 24 h presque jamais (rien n'est plus inutile que de réciter ce qu'on
 * vient de réciter). L'historique des tirages reste sur l'appareil.
 *
 * Fonctions pures — le hasard est injecté (`random`) pour les tests.
 */

export type KholleGrade = "su" | "hésitant" | "pas su";

export const KHOLLE_GRADES: readonly KholleGrade[] = ["su", "hésitant", "pas su"];

export const KHOLLE_GRADE_RATING: Record<KholleGrade, FsrsRating> = { su: "good", hésitant: "hard", "pas su": "again" };

/** Le temps d'une question de cours au tableau, avant de passer à l'exercice. */
export const KHOLLE_TARGET_MINUTES = 15;

export interface KholleQuestion {
  /** `chapitre#index` — stable tant que l'ordre des questions du chapitre ne change pas. */
  id: string;
  chapter: ProgrammeChapter;
  text: string;
}

/** Dernière évaluation de chaque question tirée sur cet appareil. */
export type KholleHistory = Record<string, { grade: KholleGrade; at: string }>;

export const KHOLLE_HISTORY_KEY = "prepahub:kholle-history";

export function questionsFor(chapterIds: string[]): KholleQuestion[] {
  const out: KholleQuestion[] = [];
  for (const id of chapterIds) {
    const chapter = PROGRAMME_BY_ID.get(id);
    if (!chapter) continue;
    chapter.questions.forEach((text, index) => out.push({ id: `${chapter.id}#${index}`, chapter, text }));
  }
  return out;
}

const GRADE_WEIGHT: Record<KholleGrade, number> = { "pas su": 4, hésitant: 2, su: 1 };
const NEVER_ASKED_WEIGHT = 3;
const RECENT_HOURS = 24;
const RECENT_FACTOR = 0.1;

/** Poids de tirage d'une question — exposé pour les tests et pour l'écran (« revient souvent »). */
export function questionWeight(question: KholleQuestion, history: KholleHistory, now: Date): number {
  const last = history[question.id];
  if (!last) return NEVER_ASKED_WEIGHT;
  const base = GRADE_WEIGHT[last.grade];
  const hours = (now.getTime() - new Date(last.at).getTime()) / 3_600_000;
  return hours >= 0 && hours < RECENT_HOURS ? base * RECENT_FACTOR : base;
}

/** Tire une question, pondérée ; `exclude` écarte celles déjà posées dans la séance. `null` s'il n'y a rien à tirer. */
export function drawQuestion(
  questions: KholleQuestion[],
  history: KholleHistory,
  now: Date,
  exclude: ReadonlySet<string> = new Set(),
  random: () => number = Math.random
): KholleQuestion | null {
  const pool = questions.filter((question) => !exclude.has(question.id));
  if (pool.length === 0) return null;
  const weights = pool.map((question) => questionWeight(question, history, now));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let index = 0; index < pool.length; index += 1) {
    target -= weights[index];
    if (target < 0) return pool[index];
  }
  return pool[pool.length - 1];
}

export function recordGrade(history: KholleHistory, questionId: string, grade: KholleGrade, now: Date): KholleHistory {
  return { ...history, [questionId]: { grade, at: now.toISOString() } };
}

/** Lecture blindée de l'historique stocké (texte JSON), questions et notes inconnues ignorées. */
export function parseKholleHistory(raw: string | null): KholleHistory {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: KholleHistory = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const { grade, at } = value as { grade?: unknown; at?: unknown };
      if (KHOLLE_GRADES.includes(grade as KholleGrade) && typeof at === "string" && !Number.isNaN(new Date(at).getTime())) {
        out[id] = { grade: grade as KholleGrade, at };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Les chapitres de Mémoire qui correspondent à un chapitre du programme (même rapprochement que la carte). */
export function memoryFor(chapter: ProgrammeChapter, chapterMemory: ChapterMemory[]): ChapterMemory[] {
  return chapterMemory.filter((entry) => !entry.archived && bestProgrammeMatch(entry.subject, entry.title)?.id === chapter.id);
}

/**
 * La carte « À revoir » d'une question pas sue : du par-cœur (« à
 * apprendre »), la question telle quelle. `null` si une carte OUVERTE porte
 * déjà exactement ce texte — on ne l'ajoute pas deux fois.
 */
export function reviewCardFor(question: KholleQuestion, existing: ReviewItem[], now: Date): ReviewItem | null {
  const text = question.text.length > REVIEW_TEXT_MAX ? `${question.text.slice(0, REVIEW_TEXT_MAX - 1)}…` : question.text;
  if (existing.some((item) => item.doneAt === null && item.text === text)) return null;
  return createReviewItem({ subject: question.chapter.subject, text, kind: "à apprendre" }, now);
}

export interface KholleTally {
  asked: number;
  su: number;
  hésitant: number;
  "pas su": number;
}

export function tally(results: { grade: KholleGrade }[]): KholleTally {
  const out: KholleTally = { asked: results.length, su: 0, hésitant: 0, "pas su": 0 };
  for (const result of results) out[result.grade] += 1;
  return out;
}
