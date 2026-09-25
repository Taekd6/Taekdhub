import { computeDecayFactor, createEmptyCard, default_w, fsrs, State, type Card, type Grade } from "ts-fsrs";

/**
 * FSRS — LE MODÈLE DE MÉMOIRE, en jours calendaires.
 *
 * FSRS (« Free Spaced Repetition Scheduler ») est l'algorithme de Jarrett Ye
 * et de la communauté open-spaced-repetition. Il décrit chaque souvenir par
 * DEUX nombres, et c'est tout son intérêt :
 *
 *   — la STABILITÉ S (en jours) : le temps au bout duquel la probabilité de
 *     se souvenir est retombée à 90 %. Plus elle est grande, plus la courbe
 *     d'oubli est plate ;
 *   — la DIFFICULTÉ D (de 1 à 10) : à quel point S grandit peu à chaque
 *     révision réussie.
 *
 * De S et du temps écoulé t, il tire la RÉCUPÉRABILITÉ — la probabilité de
 * retrouver le souvenir aujourd'hui :
 *
 *     R(t) = (1 + F · t / S) ^ C        avec C = −w₂₀ et F = 0,9^(1/C) − 1
 *
 * F est choisi pour que R(S) = 0,9 exactement : « stabilité » veut dire
 * « jours avant de tomber à 90 % ». C'est une loi PUISSANCE, pas une
 * exponentielle : sur des données réelles, qui mêlent des souvenirs de
 * solidité différente, l'oubli ralentit avec le temps (Wixted & Ebbesen,
 * 1991), et une puissance le décrit mieux.
 *
 * À chaque révision notée (Oublié / Dur / Bien / Facile), S et D sont mis à
 * jour par des formules dont les 21 coefficients (w₀…w₂₀) ont été ajustés
 * sur des centaines de millions de révisions Anki réelles — c'est ce qui
 * distingue FSRS d'une échelle d'intervalles écrite à la main. Anki l'intègre
 * depuis la version 23.10 (FSRS-4.5 à l'époque, FSRS-6 aujourd'hui).
 *
 * CE QU'ON NE FAIT PAS : optimiser les coefficients pour CET élève. Anki le
 * propose une fois qu'on a quelques centaines de révisions ; un carnet de
 * quelques dizaines de chapitres n'y arrivera pas. On garde donc les
 * coefficients PAR DÉFAUT de la bibliothèque `ts-fsrs` (FSRS-6), c'est-à-dire
 * ceux qu'Anki applique à tout nouveau paquet — une moyenne sur la
 * population, pas un portrait de l'élève. Les pourcentages affichés sont des
 * ESTIMATIONS de ce modèle moyen, et l'interface les présente comme telles
 * (« ≈ 72 % »).
 *
 * TOUT EST EN JOURS CALENDAIRES LOCAUX (`AAAA-MM-JJ`), comme le reste de
 * TaekdHub (voir lib/spaced-repetition.ts#addDays). `ts-fsrs` raisonne en
 * instants : on lui donne MIDI UTC du jour, et il compte les jours écoulés
 * par différence de dates UTC (`dateDiffInDays`) — deux jours locaux
 * consécutifs sont donc toujours séparés d'exactement un jour pour lui, quel
 * que soit le fuseau ou le changement d'heure. Pas d'étapes d'apprentissage
 * en minutes (`enable_short_term: false`) : on révise un chapitre à l'échelle
 * du jour, pas de la minute.
 *
 * Module PUR : aucune dépendance à localStorage, React ou au DOM.
 */

/** La rétention visée : on programme la révision au jour où R retombe à 90 %. Valeur par défaut d'Anki. */
export const DESIRED_RETENTION = 0.9;

export type FsrsRating = "again" | "hard" | "good" | "easy";
export const FSRS_RATINGS: readonly FsrsRating[] = ["again", "hard", "good", "easy"];

/** Les quatre états de FSRS. Sans étapes en minutes, « learning » ne dure jamais : une carte passe de « new » à « review » dès sa première note. */
export type FsrsState = "new" | "learning" | "review" | "relearning";
const STATES: readonly FsrsState[] = ["new", "learning", "review", "relearning"];

/**
 * L'état mémoire d'un souvenir — ce que FSRS a besoin de savoir, rien de
 * plus. Jours calendaires locaux, jamais d'instant.
 */
export interface FsrsMemory {
  /** Jours avant que R retombe à 90 %. > 0. */
  stability: number;
  /** 1 (facile) à 10 (très difficile). */
  difficulty: number;
  state: FsrsState;
  /** Nombre de notes, toutes confondues. */
  reps: number;
  /** Nombre d'« Oublié ». */
  lapses: number;
  /** Jour de la dernière note, `null` si jamais notée. */
  lastReview: string | null;
  /** Jour conseillé pour la prochaine révision (celui que FSRS a programmé). */
  due: string;
}

const scheduler = fsrs({ request_retention: DESIRED_RETENTION, enable_fuzz: false, enable_short_term: false });
const { decay: DECAY, factor: FACTOR } = computeDecayFactor(default_w);

const GRADE: Record<FsrsRating, Grade> = { again: 1, hard: 2, good: 3, easy: 4 };

/** Midi UTC du jour : un instant sans ambiguïté, qui ne change jamais de date UTC. */
function noonUtc(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12));
}

/** L'inverse de `noonUtc` — lu en UTC, donc stable quel que soit le fuseau. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Jours calendaires entre deux clés `AAAA-MM-JJ` (négatif si `to` précède `from`). */
export function dayDiff(from: string, to: string): number {
  return Math.round((noonUtc(to).getTime() - noonUtc(from).getTime()) / 86_400_000);
}

/** `day` + `days` jours calendaires — fins de mois et années bissextiles comprises. */
export function shiftDay(day: string, days: number): string {
  const date = noonUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDay(date);
}

/** Un souvenir jamais noté : dû le jour même, stabilité nulle (pas encore de courbe). */
export function emptyMemory(day: string): FsrsMemory {
  return { stability: 0, difficulty: 0, state: "new", reps: 0, lapses: 0, lastReview: null, due: day };
}

function toCard(memory: FsrsMemory): Card {
  const card = createEmptyCard(noonUtc(memory.due));
  if (memory.state === "new" || memory.lastReview === null) return card;
  return {
    ...card,
    stability: memory.stability,
    difficulty: memory.difficulty,
    state: State[memory.state === "review" ? "Review" : memory.state === "learning" ? "Learning" : "Relearning"],
    reps: memory.reps,
    lapses: memory.lapses,
    last_review: noonUtc(memory.lastReview),
    scheduled_days: Math.max(0, dayDiff(memory.lastReview, memory.due)),
  };
}

function fromCard(card: Card, day: string): FsrsMemory {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    state: STATES[card.state] ?? "review",
    reps: card.reps,
    lapses: card.lapses,
    lastReview: day,
    due: utcDay(card.due),
  };
}

/**
 * Le nouvel état après une note donnée le jour `day`. Une note en retard
 * repart de `day` : c'est aujourd'hui qu'on vient de vérifier le souvenir,
 * et FSRS tient compte du retard (réussir malgré une R basse fait grandir S
 * DAVANTAGE — c'est la « difficulté désirable » de Bjork).
 *
 * Une note datée AVANT la précédente (saisie rétroactive désordonnée) est
 * ramenée au jour de la précédente : FSRS n'a pas de sens à rebours.
 */
export function reviewMemory(memory: FsrsMemory, day: string, rating: FsrsRating): FsrsMemory {
  const effectiveDay = memory.lastReview && day < memory.lastReview ? memory.lastReview : day;
  const next = scheduler.next(toCard(memory), noonUtc(effectiveDay), GRADE[rating]).card;
  return fromCard(next, effectiveDay);
}

/** Le nombre de jours jusqu'à la prochaine révision pour chacune des quatre notes — les aperçus sous les boutons. */
export function previewIntervals(memory: FsrsMemory, day: string): Record<FsrsRating, number> {
  const result = {} as Record<FsrsRating, number>;
  for (const rating of FSRS_RATINGS) {
    const next = reviewMemory(memory, day, rating);
    result[rating] = Math.max(1, dayDiff(next.lastReview ?? day, next.due));
  }
  return result;
}

/** R après `elapsedDays` jours pour une stabilité `stability` — la courbe d'oubli elle-même. */
export function retrievabilityAfter(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** R le jour `day`, ou `null` pour un souvenir jamais noté (pas de courbe à lire). */
export function retrievabilityOn(memory: FsrsMemory, day: string): number | null {
  if (memory.lastReview === null || memory.stability <= 0) return null;
  return retrievabilityAfter(memory.stability, dayDiff(memory.lastReview, day));
}

/**
 * Combien de jours après la dernière révision R descend à `target`. Inverse
 * exact de la courbe : t = S / F · (target^(1/C) − 1). Pour target = 0,9,
 * t = S par construction.
 */
export function daysUntilRetrievability(stability: number, target: number): number {
  if (stability <= 0) return 0;
  return (stability / FACTOR) * (Math.pow(target, 1 / DECAY) - 1);
}

/**
 * Le PREMIER jour où R passe strictement sous `target` — « à partir de
 * quand ce chapitre est-il menacé ». `null` pour un souvenir jamais noté.
 */
export function firstDayBelow(memory: FsrsMemory, target: number): string | null {
  if (memory.lastReview === null || memory.stability <= 0) return null;
  const exact = daysUntilRetrievability(memory.stability, target);
  // R(t) = target exactement tombe sur un entier ⇒ le jour suivant est le premier « sous ».
  const days = Number.isInteger(exact) ? exact + 1 : Math.ceil(exact);
  return shiftDay(memory.lastReview, Math.max(1, days));
}

/**
 * Coefficients par défaut exposés pour l'affichage et les tests (w₀…w₃ sont
 * les stabilités initiales après une première note Oublié/Dur/Bien/Facile).
 */
export const FSRS_DEFAULT_WEIGHTS: readonly number[] = default_w;
export const FSRS_DECAY = DECAY;
export const FSRS_FACTOR = FACTOR;

/**
 * La difficulté initiale après une première note — D₀(G) = w₄ − e^(w₅·(G−1)) + 1,
 * bornée à [1, 10]. Sert à la migration de l'ancienne échelle, qui n'avait
 * aucune notion de difficulté.
 */
export function initialDifficulty(rating: FsrsRating): number {
  const [, , , , w4, w5] = default_w;
  const value = w4 - Math.exp(w5 * (GRADE[rating] - 1)) + 1;
  return Math.min(10, Math.max(1, value));
}

/** Normalise un état mémoire lu du disque — `null` s'il est inexploitable. */
export function normalizeFsrsMemory(raw: unknown, fallbackDay: string): FsrsMemory | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const isDay = (entry: unknown): entry is string => typeof entry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry);
  const finite = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry);
  const count = (entry: unknown) => (finite(entry) && entry >= 0 ? Math.round(entry) : 0);
  const state = STATES.includes(value.state as FsrsState) ? (value.state as FsrsState) : null;
  const lastReview = isDay(value.lastReview) ? value.lastReview : null;
  if (state === null) return null;
  if (state === "new" || lastReview === null) return emptyMemory(isDay(value.due) ? value.due : fallbackDay);
  if (!finite(value.stability) || value.stability <= 0) return null;
  const difficulty = finite(value.difficulty) ? Math.min(10, Math.max(1, value.difficulty)) : initialDifficulty("good");
  return {
    stability: value.stability,
    difficulty,
    state,
    reps: Math.max(1, count(value.reps)),
    lapses: count(value.lapses),
    lastReview,
    due: isDay(value.due) ? value.due : shiftDay(lastReview, Math.max(1, Math.round(value.stability))),
  };
}

/**
 * Rejoue un historique complet : une première note le jour `firstDay`, puis
 * chaque note dans l'ordre des jours. L'état qui en sort ne dépend QUE de
 * l'historique — c'est ce qui permet de corriger après coup la date
 * d'apprentissage d'un chapitre, ou de reconstruire un état abîmé sur le
 * disque, sans rien inventer.
 */
export function replayMemory(firstDay: string, firstRating: FsrsRating, reviews: ReadonlyArray<{ day: string; rating: FsrsRating }>): FsrsMemory {
  let memory = reviewMemory(emptyMemory(firstDay), firstDay, firstRating);
  for (const entry of [...reviews].sort((a, b) => a.day.localeCompare(b.day))) memory = reviewMemory(memory, entry.day, entry.rating);
  return memory;
}
