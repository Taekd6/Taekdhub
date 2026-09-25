import {
  DESIRED_RETENTION,
  dayDiff,
  firstDayBelow,
  replayMemory,
  retrievabilityAfter,
  retrievabilityOn,
  reviewMemory,
  shiftDay,
  type FsrsRating,
} from "@/lib/fsrs";
import type { ChapterMemory } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * MÉMOIRE DES CHAPITRES — « tu risques d'oublier ce chapitre ».
 *
 * L'élève déclare un chapitre appris (« Intégrales généralisées », le 2 sept.),
 * puis, à chaque fois qu'il le révise — dans Anki, sur une fiche, en refaisant
 * un exercice —, il vient dire comment ça s'est passé : Oublié, Dur, Bien,
 * Facile. FSRS (lib/fsrs.ts) en déduit, jour après jour, la probabilité
 * qu'il s'en souvienne encore, et TaekdHub le prévient quand elle passe sous
 * un seuil.
 *
 * Pourquoi un SEUIL (85 %) distinct de la rétention visée (90 %) : la date
 * « idéale » de révision est celle où R atteint 90 % (`dueDay`) — c'est ce
 * que ferait Anki. L'alerte de l'accueil, elle, ne doit pas crier au premier
 * jour : à 85 %, le chapitre a un peu dépassé son échéance et le rappel a
 * une raison d'être. Les deux dates sont affichées là où elles servent.
 *
 * Tout est en jours calendaires locaux ; `today` est TOUJOURS passé par
 * l'appelant (`dayKey(new Date())`) pour que les fonctions restent pures et
 * testables à date fixe.
 */

/** Seuil de l'alerte « À ne pas oublier » — voir l'en-tête. */
export const AT_RISK_THRESHOLD = 0.85;

/** Borne de saisie d'un titre de chapitre — une ligne, pas un paragraphe. */
export const CHAPTER_TITLE_MAX = 120;
export const ANKI_DECK_MAX = 160;

export const CHAPTER_RATING_META: Record<FsrsRating, { label: string; hint: string }> = {
  again: { label: "Oublié", hint: "Je ne m'en souvenais presque plus" },
  hard: { label: "Dur", hint: "Retrouvé, mais avec peine" },
  good: { label: "Bien", hint: "Retrouvé sans trop d'effort" },
  easy: { label: "Facile", hint: "Tout était là" },
};

export interface NewChapterInput {
  subject: Subject;
  title: string;
  learnedAt: string;
  ankiDeck?: string;
}

/**
 * Un nouveau chapitre. L'apprentissage compte comme une première note
 * « Bien » le jour `learnedAt` — la stabilité initiale est donc w₂ ≈ 2,3
 * jours : sans révision, un chapitre fraîchement appris tombe sous 90 %
 * au bout de deux à trois jours. C'est la courbe d'Ebbinghaus, et c'est
 * exactement pourquoi le premier rappel arrive si vite.
 */
export function createChapter(input: NewChapterInput, now: Date = new Date(), id: string = crypto.randomUUID()): ChapterMemory {
  const deck = input.ankiDeck?.trim().slice(0, ANKI_DECK_MAX) ?? "";
  return {
    id,
    subject: input.subject,
    title: input.title.trim().slice(0, CHAPTER_TITLE_MAX),
    learnedAt: input.learnedAt,
    ...(deck ? { ankiDeck: deck } : {}),
    card: replayMemory(input.learnedAt, "good", []),
    reviews: [],
    archived: false,
    createdAt: now.toISOString(),
  };
}

/**
 * Note une révision faite le jour `day`. Une révision datée avant
 * l'apprentissage est ramenée au jour de l'apprentissage (on ne révise pas
 * ce qu'on n'a pas encore appris).
 */
export function rateChapter(chapter: ChapterMemory, rating: FsrsRating, day: string): ChapterMemory {
  const effectiveDay = day < chapter.learnedAt ? chapter.learnedAt : day;
  const reviews = [...chapter.reviews, { day: effectiveDay, rating }].sort((a, b) => a.day.localeCompare(b.day));
  // Une révision rétroactive (plus ancienne que la dernière) oblige à rejouer
  // l'historique ; sinon, un pas de FSRS suffit — et donne le même résultat.
  const inOrder = chapter.card.lastReview === null || effectiveDay >= chapter.card.lastReview;
  const card = inOrder ? reviewMemory(chapter.card, effectiveDay, rating) : replayMemory(chapter.learnedAt, "good", reviews);
  return { ...chapter, reviews, card };
}

/** Modifie titre, date d'apprentissage ou paquet Anki ; l'état FSRS est REJOUÉ depuis l'historique si la date change. */
export function editChapter(chapter: ChapterMemory, patch: Partial<Pick<ChapterMemory, "title" | "learnedAt" | "ankiDeck" | "subject">>): ChapterMemory {
  const title = patch.title !== undefined ? patch.title.trim().slice(0, CHAPTER_TITLE_MAX) : chapter.title;
  const learnedAt = patch.learnedAt ?? chapter.learnedAt;
  const deck = patch.ankiDeck !== undefined ? patch.ankiDeck.trim().slice(0, ANKI_DECK_MAX) : (chapter.ankiDeck ?? "");
  // Des révisions désormais ANTÉRIEURES à la date d'apprentissage sont
  // ramenées à celle-ci plutôt que jetées : l'élève a corrigé une date, pas
  // effacé son travail.
  const reviews = chapter.reviews.map((entry) => (entry.day < learnedAt ? { ...entry, day: learnedAt } : entry));
  const next: ChapterMemory = {
    ...chapter,
    subject: patch.subject ?? chapter.subject,
    title: title || chapter.title,
    learnedAt,
    reviews,
    card: learnedAt === chapter.learnedAt ? chapter.card : replayMemory(learnedAt, "good", reviews),
  };
  // Absent plutôt que `""` — même règle que la normalisation.
  if (deck) next.ankiDeck = deck;
  else delete next.ankiDeck;
  return next;
}

export function setArchived(chapter: ChapterMemory, archived: boolean): ChapterMemory {
  return { ...chapter, archived };
}

/** Probabilité estimée de s'en souvenir le jour `today` (0 à 1). */
export function retrievabilityToday(chapter: ChapterMemory, today: string): number {
  return retrievabilityOn(chapter.card, today) ?? 0;
}

/** Jour conseillé de révision : celui où R atteint la rétention visée (90 %), tel que FSRS l'a programmé. */
export function dueDay(chapter: ChapterMemory): string {
  return chapter.card.due;
}

/** Premier jour où le chapitre passe sous le seuil d'alerte — la date du prochain RAPPEL. */
export function reminderDay(chapter: ChapterMemory, threshold: number = AT_RISK_THRESHOLD): string {
  return firstDayBelow(chapter.card, threshold) ?? chapter.learnedAt;
}

export interface AtRiskChapter {
  chapter: ChapterMemory;
  retrievability: number;
}

/**
 * Les chapitres menacés : non rangés, R strictement sous le seuil
 * aujourd'hui, le plus menacé d'abord (à R égale : le plus ancien appris,
 * pour un ordre stable).
 */
export function atRisk(chapters: ChapterMemory[], today: string, threshold: number = AT_RISK_THRESHOLD): AtRiskChapter[] {
  return chapters
    .filter((chapter) => !chapter.archived)
    .map((chapter) => ({ chapter, retrievability: retrievabilityToday(chapter, today) }))
    .filter((entry) => entry.retrievability < threshold)
    .sort((a, b) => a.retrievability - b.retrievability || a.chapter.learnedAt.localeCompare(b.chapter.learnedAt));
}

export interface SubjectMemorySummary {
  subject: Subject;
  /** Chapitres suivis (non rangés). */
  count: number;
  atRisk: number;
  /** R moyenne aujourd'hui, `null` sans chapitre. */
  meanRetrievability: number | null;
  /** Le prochain rappel à venir (après aujourd'hui), `null` s'il n'y en a pas. */
  nextReminder: string | null;
}

/** Une ligne par matière ayant au moins un chapitre suivi, dans l'ordre de `subjects`. */
export function summarizeBySubject(chapters: ChapterMemory[], today: string, subjects: readonly Subject[], threshold: number = AT_RISK_THRESHOLD): SubjectMemorySummary[] {
  return subjects
    .map((subject) => {
      const own = chapters.filter((chapter) => chapter.subject === subject && !chapter.archived);
      const values = own.map((chapter) => retrievabilityToday(chapter, today));
      const upcoming = own.map((chapter) => reminderDay(chapter, threshold)).filter((day) => day > today).sort();
      return {
        subject,
        count: own.length,
        atRisk: values.filter((value) => value < threshold).length,
        meanRetrievability: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        nextReminder: upcoming[0] ?? null,
      };
    })
    .filter((entry) => entry.count > 0);
}

/**
 * La courbe d'oubli à venir : R pour chacun des `days` prochains jours
 * (aujourd'hui compris), EN SUPPOSANT qu'on ne révise pas d'ici là. C'est
 * ce que montre le graphique de /memoire.
 */
export function forecastCurve(chapter: ChapterMemory, today: string, days = 30): Array<{ day: string; retrievability: number }> {
  const last = chapter.card.lastReview ?? chapter.learnedAt;
  return Array.from({ length: days + 1 }, (_, offset) => {
    const day = shiftDay(today, offset);
    return { day, retrievability: retrievabilityAfter(chapter.card.stability, dayDiff(last, day)) };
  });
}

/** « 72 % » — arrondi à l'unité, jamais « 100 % » tant qu'un jour s'est écoulé (FSRS ne promet jamais la certitude). */
export function formatChance(retrievability: number): string {
  const percent = Math.round(retrievability * 100);
  return `${retrievability < 1 && percent === 100 ? 99 : percent} %`;
}

export { DESIRED_RETENTION };
