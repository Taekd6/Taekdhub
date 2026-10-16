import { ATTEMPT_HELPS, EXERCISE_LEVELS, type AttemptHelp, type ExerciseLevel } from "@/lib/attempts";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * FICHES D'EXERCICE — le point d'entrée vers l'entraînement.
 *
 * Une fiche est UN exercice que l'élève s'apprête à faire : son énoncé, et de
 * quoi le situer — la matière, le chapitre du programme, la notion, la
 * compétence visée, la difficulté. Elle dit aussi d'OÙ il vient :
 *
 *   ia       exercice ORIGINAL généré par une IA (Claude, via la demande de
 *            lib/exercise-quality.ts). Aucune source : c'est un énoncé neuf.
 *   externe  RESSOURCE EXTERNE : un site, un sujet de concours, un TD, un
 *            livre. La source (nom, et lien quand il y en a un) est
 *            OBLIGATOIRE et conservée — on ne présente jamais comme sien un
 *            énoncé trouvé ailleurs.
 *
 * ORDRE D'APPARITION. L'énoncé vient TOUJOURS d'abord. Les indices ne sont
 * montrés qu'un à un, sur demande ; la correction n'est montrée qu'après une
 * confirmation. Chaque ouverture est comptée : elle fixe l'AIDE qui sera
 * enregistrée avec la tentative (`helpFromReveal`), sans que l'élève puisse
 * déclarer « sans aide » après avoir lu la correction — la règle qui fonde
 * tout le suivi (lib/attempts.ts#isCleanSuccess).
 *
 * L'ESSAI REJOINT LE SUIVI EXISTANT : la tentative est une `ExerciseAttempt`
 * (lib/attempts.ts) dont la clé est `fiche:<id>` ; lib/exercises.ts,
 * le diagnostic et Next Move la lisent comme toute autre.
 *
 * STOCKAGE. Local à l'appareil (aucune collection synchronisée de plus :
 * cela exigerait une migration). Les TENTATIVES, elles, se synchronisent.
 * Une fiche perdue ne perd donc pas le suivi, seulement l'énoncé.
 *
 * Fonctions pures.
 */

export type SheetOrigin = "ia" | "externe";
export const SHEET_ORIGINS: readonly SheetOrigin[] = ["ia", "externe"];
export const SHEET_ORIGIN_LABEL: Record<SheetOrigin, string> = {
  ia: "Exercice original généré par IA",
  externe: "Ressource externe",
};

export const SHEET_KEY_PREFIX = "fiche:";

export const STATEMENT_MAX = 6000;
export const COMPETENCE_MAX = 200;
export const NOTION_MAX = 120;
export const HINT_MAX = 600;
export const HINTS_MAX = 5;
export const CORRECTION_MAX = 8000;
export const SOURCE_NAME_MAX = 160;
export const URL_MAX = 500;
/** Au-delà, le stockage local d'un appareil se remplit pour rien. */
export const SHEETS_MAX = 300;

export interface ExerciseSource {
  /** « Centrale-Supélec 2022, Maths 1 », « TD 4 de Mme X », « exo7.emath.fr ». */
  name: string;
  /** Lien http(s) vers l'énoncé, ou `null` (sujet papier, document de classe). */
  url: string | null;
}

export interface ExerciseSheet {
  id: string;
  subject: Subject;
  /** Chapitre de la carte du programme (lib/programme-data.ts). */
  chapterId: string;
  /** Notion précise dans le chapitre (« intégrale à paramètre »), facultative. */
  notion: string | null;
  /** Ce que l'exercice entraîne, en une phrase (« justifier l'interversion série-intégrale »). */
  competence: string;
  level: ExerciseLevel;
  origin: SheetOrigin;
  statement: string;
  /** Indices, du plus discret au plus révélateur. */
  hints: string[];
  correction: string | null;
  /** Obligatoire pour `externe`, toujours `null` pour `ia`. */
  source: ExerciseSource | null;
  /** Durée que l'élève prévoit, en minutes. */
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export function sheetKey(id: string): string {
  return `${SHEET_KEY_PREFIX}${id}`;
}

/** L'identifiant d'une fiche d'après la clé d'exercice de ses tentatives, ou `null` si la clé n'est pas celle d'une fiche. */
export function sheetIdOfKey(key: string): string | null {
  return key.startsWith(SHEET_KEY_PREFIX) && key.length > SHEET_KEY_PREFIX.length ? key.slice(SHEET_KEY_PREFIX.length) : null;
}

/** L'adresse du lecteur d'une fiche. */
export function sheetHref(id: string): string {
  return `/entrainement?fiche=${encodeURIComponent(id)}`;
}

/** Où chercher/ajouter un exercice d'un chapitre (et d'un niveau) — l'entrée depuis le programme de révision. */
export function trainingHref(input: { chapterId?: string | null; level?: ExerciseLevel | null }): string {
  const params = new URLSearchParams();
  if (input.chapterId) params.set("chapitre", input.chapterId);
  if (input.level) params.set("niveau", input.level);
  const query = params.toString();
  return query ? `/entrainement?${query}` : "/entrainement";
}

/* ── Saisie ───────────────────────────────────────────────────────── */

export interface SheetDraft {
  subject: Subject | "";
  chapterId: string;
  notion: string;
  competence: string;
  level: ExerciseLevel | "";
  origin: SheetOrigin | "";
  statement: string;
  hints: string[];
  correction: string;
  sourceName: string;
  sourceUrl: string;
  estimatedMinutes: string;
}

export const EMPTY_DRAFT: SheetDraft = {
  subject: "",
  chapterId: "",
  notion: "",
  competence: "",
  level: "",
  origin: "",
  statement: "",
  hints: [],
  correction: "",
  sourceName: "",
  sourceUrl: "",
  estimatedMinutes: "",
};

/** Un lien http(s) normalisé, ou `null`. `javascript:`, `data:` et consorts sont refusés : le lien sera cliquable. */
export function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > URL_MAX) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clean(value: string, max: number): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

/** Ce qui manque ou ne va pas dans un brouillon — des phrases d'élève, vide si la fiche peut être enregistrée. */
export function sheetIssues(draft: SheetDraft): string[] {
  const issues: string[] = [];
  if (!draft.origin) issues.push("Dis d'où vient l'exercice : généré par IA, ou ressource externe.");
  if (!draft.subject || !(subjects as readonly string[]).includes(draft.subject)) issues.push("Choisis la matière.");
  const chapter = PROGRAMME_BY_ID.get(draft.chapterId);
  if (!chapter) issues.push("Choisis le chapitre du programme.");
  else if (draft.subject && chapter.subject !== draft.subject) issues.push("Ce chapitre n'est pas dans cette matière.");
  if (!clean(draft.competence, COMPETENCE_MAX)) issues.push("Dis la compétence visée, en une phrase.");
  if (!draft.level || !EXERCISE_LEVELS.includes(draft.level)) issues.push("Choisis la difficulté.");
  if (!clean(draft.statement, STATEMENT_MAX)) issues.push("Colle l'énoncé.");
  if (draft.statement.trim().length > STATEMENT_MAX) issues.push(`L'énoncé dépasse ${STATEMENT_MAX} caractères : garde l'exercice entier mais en plusieurs fiches.`);
  if (draft.origin === "externe") {
    if (!clean(draft.sourceName, SOURCE_NAME_MAX)) issues.push("Une ressource externe garde sa source : indique son nom (concours, TD, site…).");
    if (draft.sourceUrl.trim() && !safeUrl(draft.sourceUrl)) issues.push("Le lien doit commencer par http:// ou https://.");
  }
  const minutes = draft.estimatedMinutes.trim();
  if (minutes && !(Number(minutes) > 0 && Number(minutes) <= 300)) issues.push("La durée prévue est un nombre de minutes entre 1 et 300.");
  return issues;
}

let counter = 0;
function newId(): string {
  counter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${counter}`;
}

/** La fiche d'un brouillon valide, ou `null` s'il reste des problèmes (`sheetIssues`). */
export function createSheet(draft: SheetDraft, now: Date, id: string = newId()): ExerciseSheet | null {
  if (sheetIssues(draft).length > 0) return null;
  const at = now.toISOString();
  const origin = draft.origin as SheetOrigin;
  const hints = draft.hints.map((hint) => clean(hint, HINT_MAX)).filter(Boolean).slice(0, HINTS_MAX);
  const correction = clean(draft.correction, CORRECTION_MAX);
  const notion = clean(draft.notion, NOTION_MAX);
  const minutes = draft.estimatedMinutes.trim() ? Math.round(Number(draft.estimatedMinutes)) : null;
  return {
    id,
    subject: draft.subject as Subject,
    chapterId: draft.chapterId,
    notion: notion || null,
    competence: clean(draft.competence, COMPETENCE_MAX),
    level: draft.level as ExerciseLevel,
    origin,
    statement: clean(draft.statement, STATEMENT_MAX),
    hints,
    correction: correction || null,
    source: origin === "externe" ? { name: clean(draft.sourceName, SOURCE_NAME_MAX), url: draft.sourceUrl.trim() ? safeUrl(draft.sourceUrl) : null } : null,
    estimatedMinutes: minutes,
    createdAt: at,
    updatedAt: at,
  };
}

/* ── Lecture du stockage ──────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(raw: unknown, max: number): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, max) : null;
}

function iso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Une fiche lisible, ou `null`. Une fiche sans énoncé, sans matière ni
 * chapitre connus, sans compétence ou sans difficulté ne dit rien ; une
 * ressource externe sans source n'est PAS lue (on ne rend pas anonyme un
 * énoncé qui ne l'était pas), et un lien non http(s) est retiré plutôt que
 * rendu cliquable.
 */
export function normalizeSheet(raw: unknown): ExerciseSheet | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id, 120);
  const subject = (subjects as readonly unknown[]).includes(raw.subject) ? (raw.subject as Subject) : null;
  const chapterId = text(raw.chapterId, 80);
  const chapter = chapterId ? PROGRAMME_BY_ID.get(chapterId) : undefined;
  const competence = text(raw.competence, COMPETENCE_MAX);
  const statement = text(raw.statement, STATEMENT_MAX);
  const level = (EXERCISE_LEVELS as readonly unknown[]).includes(raw.level) ? (raw.level as ExerciseLevel) : null;
  const origin = (SHEET_ORIGINS as readonly unknown[]).includes(raw.origin) ? (raw.origin as SheetOrigin) : null;
  const createdAt = iso(raw.createdAt);
  if (!id || !subject || !chapterId || !chapter || !competence || !statement || !level || !origin || !createdAt) return null;

  let source: ExerciseSource | null = null;
  if (origin === "externe") {
    const sourceRecord = isRecord(raw.source) ? raw.source : null;
    const name = sourceRecord ? text(sourceRecord.name, SOURCE_NAME_MAX) : null;
    if (!name) return null;
    source = { name, url: sourceRecord && typeof sourceRecord.url === "string" ? safeUrl(sourceRecord.url) : null };
  }
  const hints = Array.isArray(raw.hints) ? raw.hints.map((hint) => text(hint, HINT_MAX)).filter((hint): hint is string => hint !== null).slice(0, HINTS_MAX) : [];
  const minutes = typeof raw.estimatedMinutes === "number" && Number.isFinite(raw.estimatedMinutes) && raw.estimatedMinutes > 0 ? Math.min(300, Math.round(raw.estimatedMinutes)) : null;
  return {
    id,
    subject,
    chapterId,
    notion: text(raw.notion, NOTION_MAX),
    competence,
    level,
    origin,
    statement,
    hints,
    correction: text(raw.correction, CORRECTION_MAX),
    source,
    estimatedMinutes: minutes,
    createdAt,
    updatedAt: iso(raw.updatedAt) ?? createdAt,
  };
}

export function normalizeSheets(raw: unknown): ExerciseSheet[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ExerciseSheet[] = [];
  for (const entry of raw) {
    const sheet = normalizeSheet(entry);
    if (!sheet || seen.has(sheet.id)) continue;
    seen.add(sheet.id);
    out.push(sheet);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, SHEETS_MAX);
}

/** Ajoute ou remplace (même `id`) — la liste entrante n'est jamais modifiée. */
export function upsertSheet(list: ExerciseSheet[], sheet: ExerciseSheet): ExerciseSheet[] {
  return normalizeSheets([...list.filter((entry) => entry.id !== sheet.id), sheet]);
}

export function removeSheet(list: ExerciseSheet[], id: string): ExerciseSheet[] {
  return list.filter((sheet) => sheet.id !== id);
}

/* ── Ce que l'élève a ouvert pendant l'essai ──────────────────────── */

export interface Reveal {
  /** Nombre d'indices montrés (0 à `hints.length`). */
  hintsShown: number;
  correctionShown: boolean;
}

export const NOTHING_REVEALED: Reveal = { hintsShown: 0, correctionShown: false };

/** Montre l'indice suivant — s'il y en a un. */
export function revealNextHint(reveal: Reveal, sheet: Pick<ExerciseSheet, "hints">): Reveal {
  return reveal.hintsShown >= sheet.hints.length ? reveal : { ...reveal, hintsShown: reveal.hintsShown + 1 };
}

/** Montre la correction — s'il y en a une. */
export function revealCorrection(reveal: Reveal, sheet: Pick<ExerciseSheet, "correction">): Reveal {
  return sheet.correction ? { ...reveal, correctionShown: true } : reveal;
}

/** L'aide RÉELLEMENT utilisée : la correction ouverte l'emporte sur les indices, qui l'emportent sur rien. */
export function helpFromReveal(reveal: Reveal): AttemptHelp {
  return reveal.correctionShown ? "correction" : reveal.hintsShown > 0 ? "indices" : "sans";
}

/** Les aides que l'élève peut déclarer : jamais plus légère que celle qu'il a utilisée. */
export function declarableHelps(reveal: Reveal): AttemptHelp[] {
  const floor = ATTEMPT_HELPS.indexOf(helpFromReveal(reveal));
  return ATTEMPT_HELPS.filter((_, index) => index >= floor);
}

/* ── Quelle fiche proposer ────────────────────────────────────────── */

export interface SheetStatus {
  attempts: number;
  /** Dernière tentative réussie sans aide : la fiche est « faite ». */
  proven: boolean;
}

/** Les fiches d'un chapitre (et d'un niveau, s'il est demandé), les jamais tentées d'abord. */
export function sheetsForChapter(sheets: ExerciseSheet[], statuses: ReadonlyMap<string, SheetStatus>, chapterId: string, level?: ExerciseLevel | null): ExerciseSheet[] {
  return sheets
    .filter((sheet) => sheet.chapterId === chapterId && (!level || sheet.level === level))
    .sort((a, b) => {
      const sa = statuses.get(a.id) ?? { attempts: 0, proven: false };
      const sb = statuses.get(b.id) ?? { attempts: 0, proven: false };
      return Number(sa.proven) - Number(sb.proven) || sa.attempts - sb.attempts || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    });
}
