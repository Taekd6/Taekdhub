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
 * CE QUE L'ON EMPRUNTE À LA RECHERCHE, ET CE QU'ON N'Y PREND PAS.
 *
 *   — L'effet d'espacement (méta-analyse de Cepeda et al., 2006,
 *     Psychological Bulletin) : à temps de travail égal, des révisions
 *     réparties dans le temps retiennent mieux que des révisions massées.
 *   — L'effet de test (Roediger & Karpicke, 2006, Psychological Science) :
 *     chercher la réponse de tête consolide davantage que relire. C'est la
 *     raison d'être du verso (`ReviewItem.answer`) et de la séance qui le
 *     cache (components/review/review-session.tsx).
 *
 * Ni l'un ni l'autre ne fournit LA bonne suite d'intervalles : l'écart
 * optimal dépend de l'horizon visé, et les algorithmes « optimaux » (SM-2,
 * FSRS…) supposent des milliers de révisions pour s'ajuster. On retient donc
 * une ÉCHELLE FIXE et croissante, qu'un élève peut comprendre et prévoir :
 *
 *     1 → 3 → 7 → 16 → 35 → 90 jours
 *
 * Quatre notes, quatre règles, rien d'autre :
 *
 *   « À revoir »  oublié. Retour au premier barreau : demain. Un oubli de plus.
 *   « Difficile » retrouvé de justesse. On NE monte PAS : l'intervalle actuel
 *                 × 1,2 (au moins un jour) — un pas prudent.
 *   « Bien »      retrouvé. Barreau suivant.
 *   « Facile »    évident. On saute un barreau.
 *
 * Pas de facteur de facilité propre à chaque carte (le « ease » de SM-2) :
 * c'est lui qui rend les intervalles d'Anki impossibles à anticiper, et sur
 * un carnet de quelques dizaines de lignes il n'aurait jamais le temps de
 * converger. Le barreau `step` en tient lieu.
 *
 * TOUT EST EN JOURS CALENDAIRES LOCAUX (`dayKey`). « À réviser demain » veut
 * dire la prochaine date du calendrier de l'élève, qu'il révise à 7 h ou à
 * 23 h 50 — jamais « dans 24 heures », qui ferait glisser une carte notée le
 * soir au surlendemain matin, ni une date UTC, qui la ferait changer de jour
 * autour de minuit.
 */

/** L'échelle des intervalles, en jours. Le dernier barreau est un plafond : trois mois, c'est déjà l'horizon d'un trimestre de prépa. */
export const SRS_LADDER = [1, 3, 7, 16, 35, 90] as const;

export type ReviewRating = "again" | "hard" | "good" | "easy";
export const REVIEW_RATINGS: readonly ReviewRating[] = ["again", "hard", "good", "easy"];

/** `key` : le raccourci clavier de la séance. */
export const REVIEW_RATING_META: Record<ReviewRating, { label: string; key: string; hint: string }> = {
  again: { label: "À revoir", key: "1", hint: "Je ne l'ai pas retrouvé" },
  hard: { label: "Difficile", key: "2", hint: "Retrouvé, mais de justesse" },
  good: { label: "Bien", key: "3", hint: "Retrouvé" },
  easy: { label: "Facile", key: "4", hint: "Évident" },
};

const MAX_STEP = SRS_LADDER.length - 1;

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
 * Jamais révisée : due le LENDEMAIN de sa création, au premier barreau. Le
 * lendemain, pas le jour même — relire le soir ce qu'on vient de noter
 * l'après-midi n'est pas une révision, c'est encore de la mémoire immédiate.
 */
export function effectiveSchedule(item: ReviewItem): ReviewSchedule {
  if (item.srs) return item.srs;
  return {
    dueAt: addDays(dayKey(item.createdAt), 1),
    intervalDays: SRS_LADDER[0],
    step: 0,
    reviews: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

/** Le plus haut barreau dont l'intervalle ne dépasse pas `interval` — pour qu'un « Bien » après des « Difficile » reparte toujours VERS LE HAUT. */
function stepFor(interval: number): number {
  let step = 0;
  for (let index = 0; index <= MAX_STEP; index += 1) if (SRS_LADDER[index] <= interval) step = index;
  return step;
}

/**
 * Le nouveau calendrier après une note. Voir l'en-tête pour les règles.
 *
 * `now` fixe le jour de la révision : une carte en retard de dix jours et
 * notée « Bien » repart de AUJOURD'HUI, pas de son ancienne échéance — c'est
 * aujourd'hui qu'on vient de vérifier qu'on s'en souvient.
 */
export function schedule(current: ReviewSchedule, rating: ReviewRating, now: Date = new Date()): ReviewSchedule {
  let step = current.step;
  let intervalDays: number;
  let lapses = current.lapses;

  switch (rating) {
    case "again":
      step = 0;
      intervalDays = SRS_LADDER[0];
      lapses += 1;
      break;
    case "hard":
      intervalDays = Math.max(1, Math.round(current.intervalDays * 1.2));
      step = stepFor(intervalDays);
      break;
    case "good":
      step = Math.min(MAX_STEP, current.step + 1);
      // `max` : au plafond, ou après une série de « Difficile » au-delà de
      // 90 jours, « Bien » ne doit jamais RACCOURCIR l'intervalle.
      intervalDays = Math.max(SRS_LADDER[step], current.intervalDays);
      break;
    case "easy":
      step = Math.min(MAX_STEP, current.step + 2);
      intervalDays = Math.max(SRS_LADDER[step], current.intervalDays);
      break;
  }

  return {
    dueAt: addDays(dayKey(now), intervalDays),
    intervalDays,
    step,
    reviews: current.reviews + 1,
    lapses,
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

/** Intervalle court pour les boutons de note : « 1 j », « 16 j », « 3 mois ». */
export function formatInterval(days: number): string {
  if (days >= 60 && days % 30 === 0) return `${days / 30} mois`;
  return `${days} j`;
}
