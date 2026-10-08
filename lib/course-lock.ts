import { foldText, toSubject } from "@/lib/annales";
import { bestProgrammeMatch } from "@/lib/programme";
import { sanitizeReviewAnswer, sanitizeReviewText } from "@/lib/review-items";
import { dueReviewItems, isLockRecalled, rateReviewItem } from "@/lib/spaced-repetition";
import { dayKey } from "@/lib/study";
import type { ReviewItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE VERROU DE COURS — « reprends ton cours avant de refaire des exercices ».
 *
 * Quand un exercice rate parce que le COURS n'est pas su (une définition, un
 * théorème et ses hypothèses, une méthode), Claude crée des fiches recto /
 * verso sur ce qui manquait (outil MCP `add_cards`). Ces fiches VERROUILLENT
 * le chapitre : tant qu'elles ne sont pas retrouvées de tête, TaekdHub ne
 * propose plus d'exercice sur ce chapitre (Next Move), et Claude refuse d'en
 * donner (il lit les verrous dans `get_today`).
 *
 * POURQUOI. Refaire des exercices sur un cours mal su, c'est chercher la
 * méthode dans l'énoncé au lieu de la tirer de sa mémoire : on « réussit »
 * avec la correction sous les yeux et on rate le jour du DS. L'effet de test
 * (Roediger & Karpicke, 2006) dit l'inverse : c'est l'effort de RETROUVER
 * qui consolide. Le verrou impose cet ordre : cours d'abord, exercice ensuite.
 *
 * QUAND LE VERROU SAUTE. Une fiche est « retrouvée » quand sa dernière note
 * est « Bien » ou « Facile », donnée un jour APRÈS sa création. Le jour même,
 * la réponse sort de la mémoire immédiate (on vient de la lire dans le
 * corrigé) : ça ne prouve rien. Le chapitre est déverrouillé quand TOUTES
 * ses fiches sont retrouvées. Une fiche oubliée plus tard (« À revoir »)
 * reverrouille : oublier le cours, c'est revenir au cours.
 *
 * « Fait » (`doneAt`) ne déverrouille PAS : cocher n'est pas retrouver.
 * Seule la note de la séance de révision compte.
 *
 * Pur : aucune dépendance au stockage, à React ou au réseau.
 */

/** Nombre maximal de fiches par appel de `add_cards` : au-delà, c'est un chapitre entier à recopier, pas ce qui a manqué. */
export const LOCK_CARDS_MAX = 8;

export interface LockCardInput {
  matiere: string;
  chapitre: string;
  recto: string;
  verso: string;
  /** Ce qui a été raté (« a appliqué le théorème sans vérifier la continuité »). */
  raison?: string;
}

export interface CourseLock {
  /** Identifiant stable du chapitre verrouillé (voir `lockKey`). */
  key: string;
  subject: Subject;
  /** Le titre du chapitre tel que Claude l'a écrit sur la première fiche. */
  chapter: string;
  total: number;
  /** Fiches pas encore retrouvées. */
  remaining: ReviewItem[];
  /** Parmi elles, celles qu'on peut réviser AUJOURD'HUI (les autres ont été créées aujourd'hui : demain). */
  reviewableToday: number;
  /** Ce qui a été raté, une ligne par fiche qui le dit. */
  reasons: string[];
}

/**
 * Identifiant du chapitre : celui du programme officiel quand le titre s'en
 * rapproche (« réduction », « Diagonalisation » → le même chapitre), sinon
 * le titre replié (sans accents ni majuscules). C'est ce qui permet de
 * reconnaître le chapitre d'un exercice écrit autrement que la fiche.
 */
export function lockKey(subject: Subject, chapter: string): string {
  return bestProgrammeMatch(subject, chapter)?.id ?? `libre:${subject}:${foldText(chapter)}`;
}

export function isLockCard(item: ReviewItem): item is ReviewItem & { chapter: string; origin: "claude" } {
  return item.origin === "claude" && typeof item.chapter === "string" && item.chapter.length > 0;
}

/** Retrouvée de tête, un jour après sa création, et pas oubliée depuis — voir lib/spaced-repetition.ts#isLockRecalled. */
export const isRecalled = isLockRecalled;

/** Les chapitres verrouillés, le plus chargé d'abord. */
export function courseLocks(items: ReviewItem[], now: Date = new Date()): CourseLock[] {
  const today = dayKey(now);
  const groups = new Map<string, CourseLock>();
  for (const item of items) {
    if (!isLockCard(item)) continue;
    const key = lockKey(item.subject, item.chapter);
    const lock = groups.get(key) ?? { key, subject: item.subject, chapter: item.chapter, total: 0, remaining: [], reviewableToday: 0, reasons: [] };
    lock.total += 1;
    if (!isRecalled(item)) {
      lock.remaining.push(item);
      if (dayKey(item.createdAt) < today) lock.reviewableToday += 1;
      if (item.reason && !lock.reasons.includes(item.reason)) lock.reasons.push(item.reason);
    }
    groups.set(key, lock);
  }
  return [...groups.values()].filter((lock) => lock.remaining.length > 0).sort((a, b) => b.remaining.length - a.remaining.length || a.chapter.localeCompare(b.chapter));
}

/** Le verrou qui couvre ce chapitre (titre libre ou identifiant du programme), ou `null`. */
export function lockFor(locks: CourseLock[], subject: Subject | null, chapter: string | null): CourseLock | null {
  if (!subject || !chapter) return null;
  const direct = locks.find((lock) => lock.subject === subject && lock.key === chapter);
  return direct ?? locks.find((lock) => lock.subject === subject && lock.key === lockKey(subject, chapter)) ?? null;
}

/**
 * La séance « À revoir » de CE verrou : `?verrou=` porte la clé du chapitre
 * jusqu'à la séance (components/review/review-session.tsx), qui n'y montre
 * que ses fiches. Avant, le lien ne portait que la matière : « Cours
 * d'abord : Réduction » ouvrait toutes les cartes dues de maths, et la durée
 * annoncée (≈ 2 min par fiche) ne correspondait plus à ce qui s'affichait.
 * Next Move et les alertes passent tous deux par ici.
 */
export function lockSessionHref(lock: Pick<CourseLock, "subject" | "key">): string {
  return `/revoir/session?subject=${encodeURIComponent(lock.subject)}&verrou=${encodeURIComponent(lock.key)}`;
}

/** Les fiches du verrou `key` à retrouver aujourd'hui (même ordre que `dueReviewItems`). */
export function dueLockCards(items: ReviewItem[], now: Date, key: string): ReviewItem[] {
  return dueReviewItems(items, now).filter((item) => isLockCard(item) && lockKey(item.subject, item.chapter) === key);
}

/** « 3 fiches de cours à retrouver sur « Réduction » avant de refaire un exercice » — la phrase montrée partout. */
export function lockSentence(lock: CourseLock): string {
  const count = lock.remaining.length;
  return `${count} fiche${count > 1 ? "s" : ""} de cours à retrouver sur « ${lock.chapter} » avant de refaire un exercice`;
}

export type LockCardsResult = { ok: true; items: ReviewItem[]; added: ReviewItem[]; skipped: number } | { ok: false; error: string };

/**
 * Ajoute au carnet les fiches envoyées par Claude. Une fiche dont le recto
 * existe déjà, ouvert, dans la même matière n'est pas recréée (Claude peut
 * renvoyer la même liste deux fois). Toute fiche illisible fait refuser
 * l'appel entier : mieux vaut que Claude corrige que d'en perdre une en silence.
 */
export function addLockCards(items: ReviewItem[], inputs: LockCardInput[], now: Date = new Date()): LockCardsResult {
  if (inputs.length === 0) return { ok: false, error: "Aucune fiche reçue." };
  if (inputs.length > LOCK_CARDS_MAX) return { ok: false, error: `Trop de fiches (${inputs.length}) : ${LOCK_CARDS_MAX} au plus, sur ce qui a réellement manqué.` };

  const fresh: ReviewItem[] = [];
  for (const [index, input] of inputs.entries()) {
    const label = `Fiche ${index + 1}`;
    const subject = toSubject(input.matiere);
    if (!subject) return { ok: false, error: `${label} : matière inconnue « ${input.matiere} » (maths, physique, chimie, info…).` };
    const chapter = input.chapitre.trim().slice(0, 120);
    if (!chapter) return { ok: false, error: `${label} : chapitre manquant.` };
    const text = sanitizeReviewText(input.recto);
    if (text === null) return { ok: false, error: `${label} : recto vide ou trop long (200 caractères au plus).` };
    const answer = sanitizeReviewAnswer(input.verso);
    if (answer === null) return { ok: false, error: `${label} : verso vide ou trop long (400 caractères au plus).` };
    const reason = input.raison?.trim().slice(0, 200);
    fresh.push({
      id: crypto.randomUUID(),
      subject,
      text,
      kind: "à apprendre",
      createdAt: now.toISOString(),
      doneAt: null,
      answer,
      chapter,
      origin: "claude",
      ...(reason ? { reason } : {}),
    });
  }

  const seen = new Set(items.filter((item) => item.doneAt === null || isLockCard(item)).map((item) => `${item.subject}|${foldText(item.text)}`));
  const added: ReviewItem[] = [];
  for (const item of fresh) {
    const signature = `${item.subject}|${foldText(item.text)}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    added.push(item);
  }
  return { ok: true, items: [...items, ...added], added, skipped: fresh.length - added.length };
}

export type CardNote = "again" | "hard" | "good" | "easy";

/**
 * Claude interroge l'élève dans la conversation (recto seul, réponse de
 * tête), compare au verso, et note : c'est une séance de révision comme une
 * autre, la note passe par le même calendrier FSRS. Seules les fiches du
 * verrou sont notables ainsi — le connecteur ne touche pas au reste du carnet.
 */
export function rateLockCards(
  items: ReviewItem[],
  notes: Array<{ id: string; note: CardNote }>,
  now: Date = new Date()
): { ok: true; items: ReviewItem[]; unlocked: string[]; stillLocked: string[] } | { ok: false; error: string } {
  if (notes.length === 0) return { ok: false, error: "Aucune note reçue." };
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const { id } of notes) {
    const item = byId.get(id);
    if (!item || !isLockCard(item)) return { ok: false, error: `Fiche inconnue : ${id} (prends les identifiants de get_today → verrous).` };
  }
  const before = new Set(courseLocks(items, now).map((lock) => lock.key));
  const next = notes.reduce((current, { id, note }) => rateReviewItem(current, id, note, now), items);
  const after = courseLocks(next, now);
  const afterKeys = new Set(after.map((lock) => lock.key));
  const unlocked = [...before].filter((key) => !afterKeys.has(key));
  const chapterOf = (key: string) => items.find((item) => isLockCard(item) && lockKey(item.subject, item.chapter) === key)?.chapter ?? key;
  return { ok: true, items: next, unlocked: unlocked.map(chapterOf), stillLocked: after.map((lock) => lockSentence(lock)) };
}

/** Les verrous tels que Claude les lit dans `get_today` : de quoi interroger l'élève et refuser un exercice. */
export function locksForClaude(items: ReviewItem[], now: Date = new Date()) {
  const today = dayKey(now);
  return courseLocks(items, now).map((lock) => ({
    matiere: lock.subject,
    chapitre: lock.chapter,
    fiches_restantes: lock.remaining.length,
    rate: lock.reasons,
    fiches: lock.remaining.map((item) => ({
      id: item.id,
      recto: item.text,
      verso: item.answer ?? "",
      // Créée aujourd'hui : la retrouver maintenant ne prouverait rien (mémoire immédiate).
      interrogeable: dayKey(item.createdAt) < today,
    })),
  }));
}
