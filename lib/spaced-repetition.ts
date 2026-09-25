import { emptyMemory, FSRS_RATINGS, reviewMemory, type FsrsMemory, type FsrsRating } from "@/lib/fsrs";
import { dayKey } from "@/lib/study";
import type { ReviewItem, ReviewSchedule } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * RÉVISIONS ESPACÉES — quand revoir chaque entrée du carnet.
 *
 * Modèle pur, même contrat que lib/review-items.ts : aucune dépendance à
 * localStorage, React ou au DOM. La persistance du calendrier vit dans
 * `ReviewItem.srs` (lib/storage.ts).
 *
 * CE QUE L'ON EMPRUNTE À LA RECHERCHE.
 *
 *   — L'effet d'espacement (méta-analyse de Cepeda et al., 2006,
 *     Psychological Bulletin) : à temps de travail égal, des révisions
 *     réparties dans le temps retiennent mieux que des révisions massées.
 *   — L'effet de test (Roediger & Karpicke, 2006, Psychological Science) :
 *     chercher la réponse de tête consolide davantage que relire. C'est la
 *     raison d'être du verso (`ReviewItem.answer`) et de la séance qui le
 *     cache (components/review/review-session.tsx).
 *   — FSRS (lib/fsrs.ts) pour CHOISIR les intervalles : un modèle de la
 *     mémoire (stabilité, difficulté, courbe d'oubli) dont les coefficients
 *     ont été ajustés sur des centaines de millions de révisions Anki. On
 *     programme la prochaine révision au jour où la probabilité estimée de
 *     s'en souvenir retombe à 90 %.
 *
 * HISTOIRE. Le carnet utilisait d'abord une ÉCHELLE FIXE (1 → 3 → 7 → 16 →
 * 35 → 90 jours), facile à prévoir mais aveugle : un « Bien » obtenu en
 * retard de dix jours comptait comme un « Bien » à l'heure. FSRS en tient
 * compte. Les calendriers écrits avec l'échelle sont convertis à la lecture
 * (lib/storage.ts#normalizeReviewSchedule) sans que leur échéance bouge.
 *
 * Quatre notes, comme Anki :
 *
 *   « À revoir »  oublié. FSRS réduit fortement la stabilité : retour demain
 *                 (ou presque), un oubli de plus.
 *   « Difficile » retrouvé de justesse. La stabilité grandit peu.
 *   « Bien »      retrouvé. La stabilité grandit — d'autant plus que le
 *                 souvenir était fragile au moment de la révision.
 *   « Facile »    évident. La stabilité grandit fortement.
 *
 * Chaque bouton affiche l'intervalle qu'il produirait (`previewRatings`) :
 * FSRS n'est pas prévisible de tête, l'aperçu est ce qui le rend lisible.
 *
 * TOUT EST EN JOURS CALENDAIRES LOCAUX (`dayKey`). « À réviser demain » veut
 * dire la prochaine date du calendrier de l'élève, qu'il révise à 7 h ou à
 * 23 h 50 — jamais « dans 24 heures », qui ferait glisser une carte notée le
 * soir au surlendemain matin, ni une date UTC, qui la ferait changer de jour
 * autour de minuit.
 */

/**
 * HÉRITAGE — l'ancienne échelle fixe, en jours. Plus utilisée pour
 * programmer ; seulement pour relire un ancien calendrier dont l'intervalle
 * serait illisible (lib/storage.ts#normalizeReviewSchedule).
 */
export const SRS_LADDER = [1, 3, 7, 16, 35, 90] as const;

export type ReviewRating = FsrsRating;
export const REVIEW_RATINGS: readonly ReviewRating[] = FSRS_RATINGS;

/** `key` : le raccourci clavier de la séance. */
export const REVIEW_RATING_META: Record<ReviewRating, { label: string; key: string; hint: string }> = {
  again: { label: "À revoir", key: "1", hint: "Je ne l'ai pas retrouvé" },
  hard: { label: "Difficile", key: "2", hint: "Retrouvé, mais de justesse" },
  good: { label: "Bien", key: "3", hint: "Retrouvé" },
  easy: { label: "Facile", key: "4", hint: "Évident" },
};

/**
 * `AAAA-MM-JJ` décalé de `days` jours du calendrier.
 *
 * Construit à MIDI local, pas à minuit : dans les fuseaux où le changement
 * d'heure tombe à minuit, « minuit du jour J » peut ne pas exister et se
 * retrouver la veille à 23 h. `new Date(a, m, j + n)` gère seul les fins de
 * mois et d'année (31 janvier + 1 → 1er février).
 */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + days, 12));
}

/** Nombre de jours calendaires de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  // Date.UTC : deux minuits UTC sont toujours séparés d'un multiple exact de
  // 24 h, ce qui n'est pas vrai de deux minuits locaux autour d'un changement
  // d'heure.
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Le calendrier d'une entrée, qu'elle ait déjà été révisée ou non.
 *
 * Jamais révisée : due le LENDEMAIN de sa création, état FSRS « new ». Le
 * lendemain, pas le jour même — relire le soir ce qu'on vient de noter
 * l'après-midi n'est pas une révision, c'est encore de la mémoire immédiate.
 */
export function effectiveSchedule(item: ReviewItem): ReviewSchedule {
  if (item.srs) return item.srs;
  return {
    dueAt: addDays(dayKey(item.createdAt), 1),
    intervalDays: 1,
    stability: 0,
    difficulty: 0,
    state: "new",
    reviews: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

/**
 * L'état FSRS d'un calendrier. Le jour de la dernière note vient de
 * `lastReviewedAt` ; à défaut (calendrier ancien sans horodatage), de
 * `dueAt − intervalDays`, qui est exactement le jour où l'intervalle a été
 * posé.
 */
export function memoryOf(current: ReviewSchedule): FsrsMemory {
  if (current.state === "new" || current.stability <= 0) return { ...emptyMemory(current.dueAt), reps: current.reviews, lapses: current.lapses };
  return {
    stability: current.stability,
    difficulty: current.difficulty,
    state: current.state,
    reps: current.reviews,
    lapses: current.lapses,
    lastReview: current.lastReviewedAt ? dayKey(current.lastReviewedAt) : addDays(current.dueAt, -current.intervalDays),
    due: current.dueAt,
  };
}

/**
 * Le nouveau calendrier après une note — voir lib/fsrs.ts#reviewMemory.
 *
 * `now` fixe le jour de la révision : une carte en retard de dix jours et
 * notée « Bien » repart de AUJOURD'HUI, pas de son ancienne échéance — c'est
 * aujourd'hui qu'on vient de vérifier qu'on s'en souvient, et FSRS compte le
 * retard (un souvenir retrouvé malgré le retard était plus solide qu'on ne
 * le pensait).
 */
export function schedule(current: ReviewSchedule, rating: ReviewRating, now: Date = new Date()): ReviewSchedule {
  const today = dayKey(now);
  const next = reviewMemory(memoryOf(current), today, rating);
  return {
    dueAt: next.due,
    intervalDays: Math.max(1, daysBetween(next.lastReview ?? today, next.due)),
    stability: next.stability,
    difficulty: next.difficulty,
    state: next.state,
    reviews: current.reviews + 1,
    lapses: next.lapses,
    lastReviewedAt: now.toISOString(),
  };
}

/** Ce que donnerait chaque note — affiché sous les boutons, pour que l'élève sache ce qu'il choisit (« Bien · dans 7 j »). */
export function previewRatings(item: ReviewItem, now: Date = new Date()): Record<ReviewRating, number> {
  const current = effectiveSchedule(item);
  return {
    again: schedule(current, "again", now).intervalDays,
    hard: schedule(current, "hard", now).intervalDays,
    good: schedule(current, "good", now).intervalDays,
    easy: schedule(current, "easy", now).intervalDays,
  };
}

/** Note une entrée du carnet ; les autres ne bougent pas (même référence). */
export function rateReviewItem(items: ReviewItem[], id: string, rating: ReviewRating, now: Date = new Date()): ReviewItem[] {
  return items.map((item) => (item.id === id ? { ...item, srs: schedule(effectiveSchedule(item), rating, now) } : item));
}

/**
 * À réviser aujourd'hui (ou en retard). Une entrée cochée — revue, apprise,
 * méthode maîtrisée — quitte la file : l'élève a dit qu'il n'y avait plus
 * rien à en faire, la lui remontrer contredirait ce geste.
 *
 * Ordre : la plus en retard d'abord (c'est elle que l'oubli menace le plus),
 * puis la plus ancienne notée — un ordre stable, pour qu'une séance
 * interrompue reprenne là où elle s'était arrêtée.
 */
export function dueReviewItems(items: ReviewItem[], now: Date = new Date(), subject: Subject | null = null): ReviewItem[] {
  const today = dayKey(now);
  return items
    .filter((item) => item.doneAt === null && (!subject || item.subject === subject) && effectiveSchedule(item).dueAt <= today)
    .sort((a, b) => effectiveSchedule(a).dueAt.localeCompare(effectiveSchedule(b).dueAt) || a.createdAt.localeCompare(b.createdAt));
}

export function isDue(item: ReviewItem, now: Date = new Date()): boolean {
  return item.doneAt === null && effectiveSchedule(item).dueAt <= dayKey(now);
}

/** La prochaine échéance APRÈS aujourd'hui parmi les entrées ouvertes, et combien tombent ce jour-là — pour dire « prochaine révision demain · 3 » quand il n'y a rien aujourd'hui. */
export function nextReviewDay(items: ReviewItem[], now: Date = new Date(), subject: Subject | null = null): { day: string; count: number } | null {
  const today = dayKey(now);
  let day: string | null = null;
  let count = 0;
  for (const item of items) {
    if (item.doneAt !== null || (subject && item.subject !== subject)) continue;
    const due = effectiveSchedule(item).dueAt;
    if (due <= today) continue;
    if (day === null || due < day) {
      day = due;
      count = 1;
    } else if (due === day) count += 1;
  }
  return day === null ? null : { day, count };
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « aujourd'hui », « demain », « dans 5 jours », puis une date (« le 12 oct. ») au-delà de deux semaines — personne ne compte en « dans 47 jours ». */
export function formatDueDay(day: string, now: Date = new Date()): string {
  const delta = daysBetween(dayKey(now), day);
  if (delta <= 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta < 14) return `dans ${delta} jours`;
  const [, month, date] = day.split("-").map(Number);
  return `le ${date === 1 ? "1er" : date} ${MONTHS[month - 1]}`;
}

/**
 * Intervalle court pour les boutons de note : « 1 j », « 16 j », « 3 mois »,
 * « 1,5 an ». FSRS produit des intervalles quelconques (47 j, 113 j) : au-delà
 * de deux mois on arrondit au mois, au-delà d'un an au demi-an — l'ordre de
 * grandeur est ce qui compte pour choisir un bouton.
 */
export function formatInterval(days: number): string {
  if (days >= 365) {
    const years = Math.round((days / 365) * 2) / 2;
    return `${years.toLocaleString("fr-FR")} an${years >= 2 ? "s" : ""}`;
  }
  if (days >= 60) return `${Math.round(days / 30)} mois`;
  return `${days} j`;
}
