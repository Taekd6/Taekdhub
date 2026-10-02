import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * TENTATIVES D'EXERCICE — ce que l'élève a SU FAIRE, et avec quelle aide.
 *
 * Une tentative = un essai sur UN exercice (une annale, une question de DS
 * ou d'épreuve blanche, un exercice de TD) : le résultat, l'aide utilisée,
 * le temps, et, en cas d'échec, la cause déclarée.
 *
 * Collection LOCALE d'abord, synchronisée avec le compte comme les autres
 * (`attempts`, lib/sync) : on refait un exercice dans le train, sans réseau.
 * Les annales corrigées par Claude, elles, restent dans Supabase
 * (`exercise_logs`) : lib/exercises.ts réunit les deux sources par
 * `exerciseKey` sans les recopier.
 *
 * L'AIDE est ce qui distingue « je sais le faire » de « je l'ai compris en
 * lisant la correction » :
 *
 *   sans        aucune aide — la seule tentative qui prouve quelque chose ;
 *   indices     un ou plusieurs indices ;
 *   correction  la correction a été ouverte pendant l'essai.
 */

export type AttemptResult = "réussi" | "partiel" | "échec";
export const ATTEMPT_RESULTS: readonly AttemptResult[] = ["réussi", "partiel", "échec"];

export type AttemptHelp = "sans" | "indices" | "correction";
export const ATTEMPT_HELPS: readonly AttemptHelp[] = ["sans", "indices", "correction"];
export const ATTEMPT_HELP_LABEL: Record<AttemptHelp, string> = { sans: "Sans aide", indices: "Avec indices", correction: "Correction ouverte" };

export type AttemptOrigin = "annale" | "ds" | "épreuve" | "exercice";
export const ATTEMPT_ORIGINS: readonly AttemptOrigin[] = ["annale", "ds", "épreuve", "exercice"];

/**
 * La cause d'un échec, telle que l'élève la déclare. Distincte du type
 * d'erreur du carnet (lib/error-log.ts) parce que deux causes comptent ici
 * et n'y existent pas : « démarrage » (je n'ai pas su par où commencer) et
 * « compréhension » (je n'ai pas compris ce qu'on demandait). Voir
 * `ERROR_TYPE_FOR_CAUSE` pour le passage au carnet.
 */
export type AttemptCause = "cours" | "méthode" | "calcul" | "compréhension" | "démarrage" | "temps" | "rédaction";
export const ATTEMPT_CAUSES: readonly AttemptCause[] = ["cours", "méthode", "calcul", "compréhension", "démarrage", "temps", "rédaction"];
export const ATTEMPT_CAUSE_LABEL: Record<AttemptCause, string> = {
  cours: "Cours (je ne savais pas)",
  méthode: "Méthode (je ne voyais pas l'outil)",
  calcul: "Calcul",
  compréhension: "Compréhension de l'énoncé",
  démarrage: "Démarrage (bloqué au début)",
  temps: "Manque de temps",
  rédaction: "Rédaction",
};

/**
 * NIVEAU d'un exercice — pour distinguer « je réussis les classiques » de
 * « je bloque dès que c'est difficile ».
 *
 *   direct      application immédiate du cours ;
 *   classique   exercice type de TD, niveau CCINP ;
 *   difficile   problème long ou peu guidé, niveau Mines, Centrale, X-ENS.
 */
export type ExerciseLevel = "direct" | "classique" | "difficile";
export const EXERCISE_LEVELS: readonly ExerciseLevel[] = ["direct", "classique", "difficile"];
export const EXERCISE_LEVEL_LABEL: Record<ExerciseLevel, string> = {
  direct: "Application directe",
  classique: "Classique (TD, CCINP)",
  difficile: "Difficile (Mines, Centrale, X-ENS)",
};

/**
 * « COMPRENDRE POURQUOI JE BLOQUE » — l'analyse d'un échec, en quatre
 * réponses courtes. Elle devient une fiche de méthode dans « À revoir »
 * (lib/transfer.ts) : ce qu'il faudra RECONNAÎTRE, et le RÉFLEXE à avoir.
 */
export interface BlockAnalysis {
  /** Ce que je n'ai pas compris. */
  missed: string;
  /** La première étape où mon raisonnement a déraillé. */
  derailedAt: string;
  /** Le réflexe ou le théorème à mobiliser. */
  tool: string;
  /** Ce que je dois reconnaître la prochaine fois (l'indice dans l'énoncé). */
  cue: string;
}

export interface ExerciseAttempt {
  id: string;
  /** Identifie l'EXERCICE : toutes ses tentatives partagent cette clé (lib/exercises.ts#annaleKey, `ds:<note>:<question>`…). */
  exerciseKey: string;
  /** « Mines 2023 MP1 — partie II », « DS 2 — Q3 ». */
  label: string;
  subject: Subject;
  /** Chapitre de la carte du programme (lib/programme-data.ts), ou `null` si l'élève ne l'a pas dit. */
  chapterId: string | null;
  origin: AttemptOrigin;
  /** Jour local de l'essai (AAAA-MM-JJ). */
  day: string;
  createdAt: string;
  /** Dernière modification — départage la synchronisation. */
  updatedAt: string;
  result: AttemptResult;
  help: AttemptHelp;
  minutes: number | null;
  plannedMinutes: number | null;
  cause: AttemptCause | null;
  /** « J'ai manqué de temps » — indépendant de la cause : on peut rater un calcul ET manquer de temps. */
  lackOfTime: boolean;
  /** La note (lib/grades.ts) dont vient la question, pour un DS ou une épreuve. */
  gradeId: string | null;
  note: string | null;
  /** Niveau de l'exercice, s'il est connu. Absent des tentatives antérieures à ce champ. */
  level?: ExerciseLevel;
  /** Analyse du blocage, après un échec. */
  analysis?: BlockAnalysis;
  /**
   * EXERCICE DE TRANSFERT : la clé de l'exercice d'origine dont cet essai,
   * sur un énoncé DIFFÉRENT, vérifie la méthode (lib/transfer.ts).
   */
  transferOf?: string;
}

/** Une tentative qui PROUVE la maîtrise : réussie, sans aucune aide. */
export function isCleanSuccess(attempt: { result: AttemptResult; help: AttemptHelp }): boolean {
  return attempt.result === "réussi" && attempt.help === "sans";
}

/* ── Normalisation (lecture du stockage, synchronisation, sauvegarde) ── */

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

function day(raw: unknown): string | null {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function minutes(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.min(600, Math.round(raw)) : null;
}

function oneOf<T extends string>(values: readonly T[], raw: unknown): T | null {
  return (values as readonly unknown[]).includes(raw) ? (raw as T) : null;
}

/** Une tentative lisible, ou `null` : sans clé d'exercice, sans matière connue, sans résultat ni jour, elle ne dit rien. */
export function normalizeAttempt(raw: unknown): ExerciseAttempt | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id, 120);
  const exerciseKey = text(raw.exerciseKey, 300);
  const subject = oneOf(subjects, raw.subject);
  const result = oneOf(ATTEMPT_RESULTS, raw.result);
  const createdAt = iso(raw.createdAt);
  const attemptDay = day(raw.day) ?? (createdAt ? createdAt.slice(0, 10) : null);
  if (!id || !exerciseKey || !subject || !result || !createdAt || !attemptDay) return null;
  return {
    id,
    exerciseKey,
    label: text(raw.label, 160) ?? exerciseKey,
    subject,
    chapterId: text(raw.chapterId, 80),
    origin: oneOf(ATTEMPT_ORIGINS, raw.origin) ?? "exercice",
    day: attemptDay,
    createdAt,
    updatedAt: iso(raw.updatedAt) ?? createdAt,
    result,
    help: oneOf(ATTEMPT_HELPS, raw.help) ?? "sans",
    minutes: minutes(raw.minutes),
    plannedMinutes: minutes(raw.plannedMinutes),
    cause: oneOf(ATTEMPT_CAUSES, raw.cause),
    lackOfTime: raw.lackOfTime === true,
    gradeId: text(raw.gradeId, 120),
    note: text(raw.note, 400),
    ...(oneOf(EXERCISE_LEVELS, raw.level) ? { level: oneOf(EXERCISE_LEVELS, raw.level)! } : {}),
    ...(normalizeAnalysis(raw.analysis) ? { analysis: normalizeAnalysis(raw.analysis)! } : {}),
    ...(text(raw.transferOf, 300) ? { transferOf: text(raw.transferOf, 300)! } : {}),
  };
}

/** Une analyse lisible : au moins le réflexe ou ce qu'il faut reconnaître. */
export function normalizeAnalysis(raw: unknown): BlockAnalysis | null {
  if (!isRecord(raw)) return null;
  const analysis = { missed: text(raw.missed, 300) ?? "", derailedAt: text(raw.derailedAt, 300) ?? "", tool: text(raw.tool, 300) ?? "", cue: text(raw.cue, 300) ?? "" };
  return analysis.tool || analysis.cue ? analysis : null;
}

export function normalizeAttempts(raw: unknown): ExerciseAttempt[] {
  return Array.isArray(raw) ? raw.map(normalizeAttempt).filter((item): item is ExerciseAttempt => item !== null) : [];
}

/** Ajoute ou remplace (même `id`) — la liste entrante n'est jamais modifiée. */
export function upsertAttempts(list: ExerciseAttempt[], incoming: ExerciseAttempt[]): ExerciseAttempt[] {
  const byId = new Map(list.map((attempt) => [attempt.id, attempt]));
  for (const attempt of incoming) byId.set(attempt.id, attempt);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function removeAttempt(list: ExerciseAttempt[], id: string): ExerciseAttempt[] {
  return list.filter((attempt) => attempt.id !== id);
}
