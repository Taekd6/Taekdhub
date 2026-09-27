import { AT_RISK_THRESHOLD, chapterTime } from "@/lib/chapter-memory";
import { dayDiff, DESIRED_RETENTION, retrievabilityOn, reviewMemory, shiftDay } from "@/lib/fsrs";
import { dueReviewItems } from "@/lib/spaced-repetition";
import { activeWorkItems } from "@/lib/work-items";
import type { ChapterMemory, ErrorEntry, ReviewItem, WorkItem, WorkItemKind, WorkItemScope } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * PRÊT POUR LE DS ? — le programme d'une épreuve, lu à travers la mémoire.
 *
 * Un DS ou un concours blanc porte sur des CHAPITRES. L'élève les rattache à
 * l'échéance (`WorkItem.scope`), et TaekdHub lit, pour chacun, ce que FSRS
 * sait déjà (lib/fsrs.ts) :
 *
 *   - la chance de s'en souvenir AUJOURD'HUI ;
 *   - la chance de s'en souvenir LE JOUR J si rien n'est révisé d'ici là —
 *     la courbe d'oubli prolongée jusqu'à la date de l'épreuve ;
 *   - la même chance si le chapitre est révisé aujourd'hui (rappel réussi,
 *     note « Bien ») : le gain concret d'un rappel maintenant.
 *
 * Ce n'est PAS une prédiction de note. C'est la probabilité, selon le modèle
 * de mémoire que l'élève alimente déjà dans Mémoire, de retrouver le
 * contenu d'un chapitre sans ses notes. L'écran le dit en toutes lettres.
 *
 * Puis un plan court et daté : les chapitres qui n'atteindraient pas 90 %
 * le jour J, du plus menacé au moins menacé, répartis sur les jours qui
 * restent (jamais le jour même de l'épreuve), et la veille réservée à la
 * relecture des erreurs sans « bonne idée ».
 *
 * Fonctions pures ; `today` est une clé `AAAA-MM-JJ` locale passée par
 * l'appelant.
 */

/** Les échéances qui sont des ÉPREUVES — celles qui ont un programme. */
export const EXAM_KINDS: readonly WorkItemKind[] = ["ds", "concours"];

/** Horizon au-delà duquel une épreuve n'est pas encore « à préparer ». */
export const EXAM_PREP_HORIZON_DAYS = 21;

/** Fenêtre des erreurs à relire avant l'épreuve. */
export const EXAM_ERROR_WINDOW_DAYS = 60;

/** Borne haute du programme : au-delà, ce n'est plus un DS, c'est l'année. */
export const EXAM_SCOPE_MAX = 24;

/** Rappels proposés par jour dans le plan — au-delà, le plan ne serait pas tenu. */
const RECALLS_PER_DAY = 2;

export type ChapterReadinessLevel = "solide" | "à consolider" | "fragile";

export interface ChapterReadiness {
  chapter: ChapterMemory;
  /** R aujourd'hui (0–1). */
  today: number;
  /** R le jour J sans révision d'ici là. */
  onExam: number;
  /** R le jour J si un rappel réussi (« Bien ») a lieu aujourd'hui. */
  ifReviewedToday: number;
  level: ChapterReadinessLevel;
  /** Minutes chronométrées sur ce chapitre, toutes séances confondues. */
  minutesTotal: number;
  /** Dernier rappel noté, ou la date d'apprentissage. */
  lastRecallDay: string;
  /** Déjà révisé aujourd'hui — le plan ne le repropose pas. */
  reviewedToday: boolean;
}

export interface PrepStep {
  /** Jour `AAAA-MM-JJ`. */
  day: string;
  kind: "rappel" | "erreurs";
  /** Chapitres du jour (vide pour une étape « erreurs »). */
  chapters: ChapterMemory[];
}

export interface ExamPrep {
  item: WorkItem;
  subject: Subject | null;
  examDay: string;
  /** Jours avant l'épreuve (0 = aujourd'hui). */
  daysLeft: number;
  /** Chapitres du programme, le plus menacé le jour J d'abord. */
  chapters: ChapterReadiness[];
  /** Moyenne de `onExam` — `null` sans chapitre. */
  expectedOnExam: number | null;
  /** Moyenne de `today` — `null` sans chapitre. */
  expectedToday: number | null;
  /** Chapitres qui n'atteindraient pas 90 % le jour J. */
  toConsolidate: number;
  /** Erreurs récentes de la matière dont la « bonne idée » manque encore. */
  unfixedErrors: ErrorEntry[];
  /** Erreurs récentes de la matière, bonne idée notée — à relire la veille. */
  recentErrors: number;
  /** Cartes « À revoir » de la matière dues aujourd'hui. */
  dueCards: number;
  plan: PrepStep[];
  /** Identifiants du programme introuvables ou rangés (chapitre supprimé, archivé). */
  missing: number;
}

export function isExamItem(item: Pick<WorkItem, "kind">): boolean {
  return (EXAM_KINDS as readonly string[]).includes(item.kind);
}

/** Les identifiants du programme, tels qu'enregistrés (jamais `undefined`). */
export function scopeIds(item: Pick<WorkItem, "scope">): string[] {
  return item.scope?.chapterIds ?? [];
}

/**
 * Nouveau programme — dédoublonné, borné, horodaté (l'horodatage départage
 * deux appareils qui l'ont modifié chacun de leur côté, voir
 * lib/sync/collections.ts). Un programme VIDÉ reste présent, liste vide et
 * horodaté : sans cette trace, la version d'un autre appareil qui l'avait
 * encore l'emporterait à la synchronisation et le ferait revenir. Un travail
 * qui n'a jamais eu de programme n'en reçoit pas.
 */
export function withScope(item: WorkItem, chapterIds: string[], now: Date = new Date()): WorkItem {
  const ids = [...new Set(chapterIds.filter((id) => typeof id === "string" && id))].slice(0, EXAM_SCOPE_MAX);
  const next: WorkItem = { ...item };
  if (ids.length === 0 && !item.scope) delete next.scope;
  else next.scope = { chapterIds: ids, updatedAt: now.toISOString() } satisfies WorkItemScope;
  return next;
}

/**
 * Épreuves à venir, la plus proche d'abord : DS et concours blancs actifs,
 * datés entre aujourd'hui et `horizonDays`. Filtrées sur une matière si
 * `subject` est donné.
 */
export function upcomingExams(workItems: WorkItem[], today: string, options: { subject?: Subject | null; horizonDays?: number } = {}): WorkItem[] {
  const horizon = options.horizonDays ?? EXAM_PREP_HORIZON_DAYS;
  return activeWorkItems(workItems)
    .filter((item) => isExamItem(item) && item.dueDate !== null)
    .filter((item) => (options.subject ? item.subject === options.subject : true))
    .filter((item) => {
      const days = dayDiff(today, item.dueDate!);
      return days >= 0 && days <= horizon;
    })
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.createdAt.localeCompare(b.createdAt));
}

function levelOf(onExam: number): ChapterReadinessLevel {
  if (onExam >= DESIRED_RETENTION) return "solide";
  if (onExam >= 0.7) return "à consolider";
  return "fragile";
}

/** Lecture d'un chapitre du programme — voir `ChapterReadiness`. */
export function chapterReadiness(chapter: ChapterMemory, today: string, examDay: string, sessions: ReadonlyArray<WorkSession>): ChapterReadiness {
  const r = (day: string) => retrievabilityOn(chapter.card, day) ?? 0;
  const lastRecallDay = chapter.reviews.length > 0 ? chapter.reviews[chapter.reviews.length - 1].day : chapter.learnedAt;
  const reviewedToday = chapter.reviews.some((review) => review.day === today);
  const onExam = r(examDay);
  // Réviser aujourd'hui un chapitre déjà révisé aujourd'hui ne change rien
  // de réel : on n'affiche pas un gain fictif.
  const ifReviewedToday = reviewedToday || chapter.card.lastReview === null ? onExam : (retrievabilityOn(reviewMemory(chapter.card, today, "good"), examDay) ?? onExam);
  return {
    chapter,
    today: r(today),
    onExam,
    ifReviewedToday: Math.max(onExam, ifReviewedToday),
    level: levelOf(onExam),
    minutesTotal: chapterTime(chapter.id, sessions, today).totalMinutes,
    lastRecallDay,
    reviewedToday,
  };
}

/**
 * Le plan jusqu'au jour J. Les chapitres sous 90 % le jour J (et pas déjà
 * révisés aujourd'hui), le plus menacé d'abord, à raison de
 * `RECALLS_PER_DAY` par jour à partir d'aujourd'hui ; jamais le jour de
 * l'épreuve. S'il reste moins de jours que nécessaire, les derniers jours se
 * chargent plutôt que de laisser un chapitre de côté — le plan le montre.
 * La veille (ou aujourd'hui si l'épreuve est demain) : relire les erreurs.
 */
export function buildPrepPlan(chapters: ChapterReadiness[], today: string, examDay: string, hasErrorsToReread: boolean): PrepStep[] {
  const daysBefore = Math.max(0, dayDiff(today, examDay));
  if (daysBefore === 0) return [];
  const queue = chapters.filter((entry) => entry.onExam < DESIRED_RETENTION && !entry.reviewedToday).map((entry) => entry.chapter);
  const perDay = Math.max(RECALLS_PER_DAY, Math.ceil(queue.length / daysBefore));
  const steps: PrepStep[] = [];
  for (let offset = 0; offset < daysBefore && queue.length > 0; offset++) {
    steps.push({ day: shiftDay(today, offset), kind: "rappel", chapters: queue.splice(0, perDay) });
  }
  if (hasErrorsToReread) steps.push({ day: shiftDay(examDay, -1), kind: "erreurs", chapters: [] });
  return steps.sort((a, b) => a.day.localeCompare(b.day) || (a.kind === "rappel" ? -1 : 1));
}

export interface ExamPrepSources {
  chapterMemory: ChapterMemory[];
  errors: ErrorEntry[];
  reviewItems: ReviewItem[];
  sessions: WorkSession[];
}

/** Tout ce que l'écran « Prêt pour le DS ? » affiche, pour une épreuve datée. `null` si l'échéance n'a pas de date. */
export function buildExamPrep(item: WorkItem, sources: ExamPrepSources, now: Date = new Date()): ExamPrep | null {
  if (!item.dueDate) return null;
  const today = now.toLocaleDateString("en-CA");
  const examDay = item.dueDate;
  const ids = scopeIds(item);
  const byId = new Map(sources.chapterMemory.filter((chapter) => !chapter.archived).map((chapter) => [chapter.id, chapter]));
  const inScope = ids.map((id) => byId.get(id)).filter((chapter): chapter is ChapterMemory => chapter !== undefined);

  const chapters = inScope
    .map((chapter) => chapterReadiness(chapter, today, examDay, sources.sessions))
    .sort((a, b) => a.onExam - b.onExam || a.chapter.learnedAt.localeCompare(b.chapter.learnedAt));
  const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

  const since = shiftDay(today, -EXAM_ERROR_WINDOW_DAYS);
  const subjectErrors = item.subject ? sources.errors.filter((entry) => entry.subject === item.subject && entry.date >= since && entry.date <= today) : [];
  const unfixedErrors = subjectErrors.filter((entry) => !entry.fix).sort((a, b) => b.date.localeCompare(a.date));
  const dueCards = item.subject ? dueReviewItems(sources.reviewItems, now, item.subject).length : 0;

  return {
    item,
    subject: item.subject,
    examDay,
    daysLeft: Math.max(0, dayDiff(today, examDay)),
    chapters,
    expectedOnExam: mean(chapters.map((entry) => entry.onExam)),
    expectedToday: mean(chapters.map((entry) => entry.today)),
    toConsolidate: chapters.filter((entry) => entry.onExam < DESIRED_RETENTION).length,
    unfixedErrors,
    recentErrors: subjectErrors.length,
    dueCards,
    plan: buildPrepPlan(chapters, today, examDay, subjectErrors.length > 0),
    missing: ids.length - inScope.length,
  };
}

/**
 * Chapitres au programme d'une épreuve proche, pour Next Move : identifiant
 * du chapitre → l'épreuve la plus proche qui le contient. Une seule épreuve
 * par chapitre (la plus proche), pour ne pas compter deux fois le même bonus.
 */
export function examScopeIndex(workItems: WorkItem[], today: string, horizonDays: number): Map<string, { item: WorkItem; days: number }> {
  const index = new Map<string, { item: WorkItem; days: number }>();
  for (const item of upcomingExams(workItems, today, { horizonDays })) {
    const days = dayDiff(today, item.dueDate!);
    for (const id of scopeIds(item)) if (!index.has(id)) index.set(id, { item, days });
  }
  return index;
}

/** Le seuil d'alerte habituel, réexporté pour l'écran (« sous 85 % aujourd'hui »). */
export { AT_RISK_THRESHOLD };
