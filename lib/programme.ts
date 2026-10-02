import { countResults, foldText, type AnnaleLog } from "@/lib/annales";
import { AT_RISK_THRESHOLD, retrievabilityToday } from "@/lib/chapter-memory";
import { DESIRED_RETENTION } from "@/lib/fsrs";
import { PROGRAMME, type ProgrammeChapter } from "@/lib/programme-data";
import type { ChapterMemory } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LA CARTE DU PROGRAMME — « qu'est-ce qui est solide, qu'est-ce qui
 * s'efface, qu'est-ce que je n'ai jamais revu ? »
 *
 * Chaque chapitre du programme (lib/programme-data.ts) est confronté à ce
 * que l'élève a RÉELLEMENT laissé comme traces :
 *
 *   Mémoire (FSRS)  la chance de s'en souvenir aujourd'hui, si un chapitre
 *                   de Mémoire lui correspond ;
 *   Annales         le taux de réussite des exercices de concours sur ce
 *                   chapitre (lib/annales.ts) ;
 *   Vu en cours     la déclaration de l'élève (`Preferences.programmeSeen`).
 *
 * Et en tire UN statut, explicable en une phrase :
 *
 *   pas-vu     aucune trace : pas encore traité en classe (ou pas déclaré) ;
 *   jamais     vu en cours, mais jamais revu ni travaillé en annale ;
 *   fragile    la mémoire passe sous 85 %, ou les annales réussissent
 *              moins d'une fois sur deux ;
 *   en-cours   des traces, sans alerte, mais pas encore solide ;
 *   solide     mémoire ≥ 90 % (ou au moins deux annales) et annales
 *              réussies au moins 7 fois sur 10.
 *
 * Fonctions pures.
 */

export type ProgrammeStatus = "pas-vu" | "jamais" | "fragile" | "en-cours" | "solide";

export const PROGRAMME_STATUS_META: Record<ProgrammeStatus, { label: string; hint: string }> = {
  solide: { label: "Solide", hint: "Mémoire et annales au vert" },
  "en-cours": { label: "En cours", hint: "Des traces, pas encore solide" },
  fragile: { label: "Fragile", hint: "S'efface ou rate en annale" },
  jamais: { label: "Jamais revu", hint: "Vu en cours, jamais retravaillé" },
  "pas-vu": { label: "Pas encore vu", hint: "Aucune trace" },
};

/** Ordre d'affichage et de priorité de révision. */
export const PROGRAMME_STATUSES: readonly ProgrammeStatus[] = ["fragile", "jamais", "en-cours", "solide", "pas-vu"];

const ANNALES_FRAGILE = 0.5;
const ANNALES_SOLID = 0.7;
const ANNALES_SOLID_MIN = 2;
/** Mot le plus court accepté pour rapprocher deux titres — « TD » ne doit coller à rien. */
const MIN_MATCH_LENGTH = 4;

export interface ChapterMastery {
  chapter: ProgrammeChapter;
  status: ProgrammeStatus;
  /** Chapitres de Mémoire reconnus (non rangés). */
  memory: ChapterMemory[];
  /** La plus BASSE chance de souvenir parmi eux — le maillon faible. `null` sans Mémoire. */
  retrievability: number | null;
  annales: AnnaleLog[];
  /** Réussite des annales (partiel = ½), `null` sans annale. */
  annalesRate: number | null;
  /** Déclaré « vu en cours » par l'élève. */
  declaredSeen: boolean;
  /** La phrase qui justifie le statut. */
  reason: string;
}

function keysOf(chapter: ProgrammeChapter): string[] {
  return [chapter.title, ...chapter.aliases].map(foldText).filter((key) => key.length >= MIN_MATCH_LENGTH);
}

/**
 * Force du rapprochement entre un titre libre et un chapitre : la longueur
 * du nom (ou de l'alias) reconnu, 0 si rien ne correspond. Un titre
 * identique l'emporte sur une simple inclusion.
 */
function matchScore(chapter: ProgrammeChapter, subject: Subject | null, title: string): number {
  if (subject !== chapter.subject) return 0;
  const key = foldText(title);
  if (key.length < MIN_MATCH_LENGTH) return 0;
  let best = 0;
  for (const candidate of keysOf(chapter)) {
    if (candidate === key) return 1000;
    if (key.includes(candidate) || candidate.includes(key)) best = Math.max(best, Math.min(candidate.length, key.length));
  }
  return best;
}

/** Un titre libre (« Réduction des endomorphismes », « diagonalisation ») correspond-il à ce chapitre ? */
export function matchesProgramme(chapter: ProgrammeChapter, subject: Subject | null, title: string): boolean {
  return matchScore(chapter, subject, title) > 0;
}

/**
 * LE chapitre du programme d'un titre libre — le rapprochement le plus fort,
 * le premier dans l'ordre du programme à égalité. Un seul : « Séries
 * entières » ne doit pas compter aussi pour « Séries numériques » parce que
 * les deux contiennent « séries ».
 */
export function bestProgrammeMatch(subject: Subject | null, title: string, programme: readonly ProgrammeChapter[] = PROGRAMME): ProgrammeChapter | null {
  let best: { chapter: ProgrammeChapter; score: number } | null = null;
  for (const chapter of programme) {
    const score = matchScore(chapter, subject, title);
    if (score > 0 && (!best || score > best.score)) best = { chapter, score };
  }
  return best?.chapter ?? null;
}

function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function classify(retrievability: number | null, rate: number | null, annalesCount: number, seen: boolean): { status: ProgrammeStatus; reason: string } {
  const hasMemory = retrievability !== null;
  const hasAnnales = rate !== null;
  if (!hasMemory && !hasAnnales) {
    return seen ? { status: "jamais", reason: "Vu en cours, ni dans Mémoire ni travaillé en annale" } : { status: "pas-vu", reason: "Aucune trace pour l'instant" };
  }
  const parts: string[] = [];
  if (hasMemory) parts.push(`mémoire ${percent(retrievability)}`);
  if (hasAnnales) parts.push(`annales ${percent(rate)} sur ${annalesCount}`);
  const detail = parts.join(" · ");

  if ((hasMemory && retrievability < AT_RISK_THRESHOLD) || (hasAnnales && rate < ANNALES_FRAGILE)) {
    return { status: "fragile", reason: detail };
  }
  const memoryOk = hasMemory ? retrievability >= DESIRED_RETENTION : annalesCount >= ANNALES_SOLID_MIN;
  const annalesOk = !hasAnnales || rate >= ANNALES_SOLID;
  if (memoryOk && annalesOk) return { status: "solide", reason: detail };
  return { status: "en-cours", reason: detail };
}

export interface ProgrammeInput {
  chapterMemory: ChapterMemory[];
  annales: AnnaleLog[];
  seen: string[];
  today: string;
}

export function computeMastery(input: ProgrammeInput, programme: readonly ProgrammeChapter[] = PROGRAMME): ChapterMastery[] {
  const seen = new Set(input.seen);
  const memoryById = new Map<string, ChapterMemory[]>();
  for (const entry of input.chapterMemory) {
    if (entry.archived) continue;
    const match = bestProgrammeMatch(entry.subject, entry.title, programme);
    if (match) memoryById.set(match.id, [...(memoryById.get(match.id) ?? []), entry]);
  }
  const annalesById = new Map<string, AnnaleLog[]>();
  for (const log of input.annales) {
    const match = bestProgrammeMatch(log.subject, log.chapter, programme);
    if (match) annalesById.set(match.id, [...(annalesById.get(match.id) ?? []), log]);
  }
  return programme.map((chapter) => {
    const memory = memoryById.get(chapter.id) ?? [];
    const annales = annalesById.get(chapter.id) ?? [];
    const retrievability = memory.length > 0 ? Math.min(...memory.map((entry) => retrievabilityToday(entry, input.today))) : null;
    const annalesRate = countResults(annales).successRate;
    const declaredSeen = seen.has(chapter.id);
    const { status, reason } = classify(retrievability, annalesRate, annales.length, declaredSeen);
    return { chapter, status, memory, retrievability, annales, annalesRate, declaredSeen, reason };
  });
}

export interface ProgrammeSummary {
  total: number;
  counts: Record<ProgrammeStatus, number>;
  /** Chapitres avec au moins une trace ou déclarés vus. */
  seen: number;
  /** Part de solides parmi les chapitres vus — `null` si rien n'est vu. */
  solidShare: number | null;
}

export function summarizeMastery(mastery: ChapterMastery[]): ProgrammeSummary {
  const counts: Record<ProgrammeStatus, number> = { solide: 0, "en-cours": 0, fragile: 0, jamais: 0, "pas-vu": 0 };
  for (const entry of mastery) counts[entry.status] += 1;
  const seen = mastery.length - counts["pas-vu"];
  return { total: mastery.length, counts, seen, solidShare: seen > 0 ? counts.solide / seen : null };
}

/* ── Rétroplanning ────────────────────────────────────────────────── */

export interface PlanWeek {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  weekStart: string;
  chapters: ChapterMastery[];
}

export interface Retroplanning {
  /** Jours jusqu'à la date de concours. */
  daysLeft: number;
  weeks: PlanWeek[];
  /** Chapitres pas encore vus : hors plan, comptés seulement. */
  notSeen: number;
}

const STATUS_PRIORITY: Record<ProgrammeStatus, number> = { fragile: 0, jamais: 1, "en-cours": 2, solide: 3, "pas-vu": 4 };

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function toDay(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function mondayOf(day: string): Date {
  const date = parseDay(day);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

/**
 * Répartit ce qui n'est pas solide sur les semaines qui restent avant le
 * concours : le plus fragile d'abord (fragile → jamais revu → en cours, le
 * plus bas d'abord), autant par semaine, et la DERNIÈRE semaine laissée
 * libre pour une relecture générale quand il y en a au moins trois.
 * `null` sans date de concours, ou si elle est passée.
 */
export function buildRetroplanning(mastery: ChapterMastery[], contestDate: string, today: string): Retroplanning | null {
  if (!contestDate || contestDate <= today) return null;
  const daysLeft = Math.round((parseDay(contestDate).getTime() - parseDay(today).getTime()) / 86_400_000);
  const pending = mastery
    .filter((entry) => entry.status !== "solide" && entry.status !== "pas-vu")
    .sort(
      (a, b) =>
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
        (a.retrievability ?? a.annalesRate ?? 1) - (b.retrievability ?? b.annalesRate ?? 1) ||
        // À égalité, l'ordre du programme : on reprend dans l'ordre où on a appris.
        mastery.indexOf(a) - mastery.indexOf(b)
    );

  const firstMonday = mondayOf(today);
  const lastMonday = mondayOf(contestDate);
  const totalWeeks = Math.max(1, Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1);
  const workWeeks = totalWeeks >= 3 ? totalWeeks - 1 : totalWeeks;
  const perWeek = Math.max(1, Math.ceil(pending.length / workWeeks));

  const weeks: PlanWeek[] = [];
  for (let index = 0; index < totalWeeks; index += 1) {
    const start = new Date(firstMonday);
    start.setDate(start.getDate() + index * 7);
    const chapters = index < workWeeks ? pending.slice(index * perWeek, (index + 1) * perWeek) : [];
    weeks.push({ weekStart: toDay(start), chapters });
  }
  // Seules les semaines utiles : celles qui portent quelque chose, et la relecture finale.
  const useful = weeks.filter((week, index) => week.chapters.length > 0 || (index === totalWeeks - 1 && totalWeeks >= 3));
  return { daysLeft, weeks: useful, notSeen: mastery.filter((entry) => entry.status === "pas-vu").length };
}
