import { foldText, type AnnaleLog } from "@/lib/annales";
import { isCleanSuccess, type AttemptCause, type ExerciseLevel, type AttemptHelp, type AttemptOrigin, type AttemptResult, type ExerciseAttempt } from "@/lib/attempts";
import { bestProgrammeMatch } from "@/lib/programme";
import type { ErrorEntry } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * EXERCICES ET « REFAIRE SANS AIDE ».
 *
 * Un exercice = toutes les tentatives qui partagent une clé, d'où qu'elles
 * viennent :
 *
 *   annales corrigées par Claude  `exercise_logs` (Supabase), clé
 *                                 `annale:<source>|<chapitre>` ;
 *   tentatives saisies dans l'app  collection `attempts` (lib/attempts.ts) :
 *                                 nouvelles tentatives, questions de DS…
 *
 * Les deux sources ne sont jamais recopiées l'une dans l'autre : elles sont
 * RÉUNIES ici, à la lecture.
 *
 * RÈGLES — explicites, sans algorithme opaque :
 *
 *   1. Un exercice est PROUVÉ quand sa dernière tentative est réussie SANS
 *      AIDE. Lire la correction, cocher une case ou réussir avec la
 *      correction ouverte ne prouve rien.
 *   2. Sinon, une nouvelle tentative est programmée `délai` jours après la
 *      dernière, où `délai` = retryDelaysDays[n − 1] et n le nombre de
 *      tentatives non prouvées d'affilée à la fin (2, 5 puis 12 jours par
 *      défaut ; Réglages). Assez tard pour que la correction ne soit plus en
 *      mémoire immédiate, assez tôt pour que l'exercice reste pertinent.
 *   3. Après `CHANGE_APPROACH_AFTER` tentatives non prouvées d'affilée,
 *      refaire le MÊME exercice ne suffit plus : une autre action est
 *      proposée, choisie d'après la dernière cause déclarée.
 *
 * Fonctions pures.
 */

export const CHANGE_APPROACH_AFTER = 3;

export interface ExerciseStep {
  id: string;
  /** Instant (ISO) — l'ordre des tentatives. */
  at: string;
  day: string;
  result: AttemptResult;
  help: AttemptHelp;
  /** `false` quand l'aide a été DÉDUITE (annale sans colonne `aide` : 0 indice ⇒ « sans »). */
  helpDeclared: boolean;
  hints: number | null;
  minutes: number | null;
  plannedMinutes: number | null;
  cause: AttemptCause | null;
  lackOfTime: boolean;
  source: "annale" | "app";
  /** Niveau, quand il est connu (tentative saisie, ou concours de l'annale). */
  level: ExerciseLevel | null;
}

/** Le niveau d'une annale d'après son concours : CCINP = classique ; Mines, Centrale, X-ENS = difficile. Inconnu sinon. */
export function annaleLevel(level: AnnaleLog["level"]): ExerciseLevel | null {
  if (level === "CCINP") return "classique";
  if (level === "Mines" || level === "Centrale" || level === "X-ENS") return "difficile";
  return null;
}

export type ExerciseStatus =
  /** Réussi sans aide dès la première tentative connue. */
  | "réussi"
  /** Raté puis réussi sans aide : la correction est VÉRIFIÉE. */
  | "vérifié"
  /** Nouvelle tentative due aujourd'hui ou en retard. */
  | "à-refaire"
  /** Nouvelle tentative programmée plus tard. */
  | "programmé";

export interface Exercise {
  key: string;
  label: string;
  subject: Subject | null;
  /** Chapitre de la carte du programme : celui d'une tentative, sinon déduit du chapitre de l'annale (rapprochement certain seulement). */
  chapterId: string | null;
  origin: AttemptOrigin;
  steps: ExerciseStep[];
  status: ExerciseStatus;
  /** Tentatives non prouvées d'affilée à la fin. */
  failedStreak: number;
  /** Jour de la prochaine tentative (statuts à-refaire / programmé). */
  nextRetryDay: string | null;
  /** Jour de la tentative qui a prouvé la correction (statut vérifié). */
  verifiedOn: string | null;
  /** Quand refaire le même exercice ne suffit plus : l'autre action à mener. */
  changeApproach: string | null;
}

export function annaleKey(log: Pick<AnnaleLog, "id" | "source" | "chapterKey">): string {
  // Sans source, deux annales du même chapitre ne sont pas le même exercice : chacune reste seule.
  return log.source ? `annale:${foldText(log.source)}|${log.chapterKey}` : `annale:id:${log.id}`;
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + days, 12).toLocaleDateString("en-CA");
}

/** L'action de rechange, d'après la cause la plus récente déclarée. */
export function changeApproachFor(cause: AttemptCause | null): string {
  switch (cause) {
    case "cours":
      return "Revois d'abord le cours du chapitre (rappel actif, cartes Anki du paquet), puis retente.";
    case "méthode":
    case "démarrage":
      return "Fais-toi expliquer la méthode (par Claude ou ton prof), puis fais un exercice plus accessible du même chapitre avant de revenir à celui-ci.";
    case "calcul":
      return "Refais uniquement les calculs, posément, en vérifiant chaque ligne (signe, homogénéité, cas particulier).";
    case "temps":
      return "Retente en te fixant un temps par question, et passe à la suite quand il tombe.";
    case "compréhension":
      return "Reformule l'énoncé par écrit (données, inconnue, ce qu'on demande) avant de chercher.";
    default:
      return "Prends un exercice plus accessible du même chapitre, puis reviens à celui-ci.";
  }
}

function stepFromAttempt(attempt: ExerciseAttempt): ExerciseStep {
  return {
    id: attempt.id,
    at: attempt.createdAt,
    day: attempt.day,
    result: attempt.result,
    help: attempt.help,
    helpDeclared: true,
    hints: null,
    minutes: attempt.minutes,
    plannedMinutes: attempt.plannedMinutes,
    cause: attempt.cause,
    lackOfTime: attempt.lackOfTime,
    source: "app",
    level: attempt.level ?? null,
  };
}

function stepFromAnnale(log: AnnaleLog): ExerciseStep {
  return {
    id: log.id,
    at: log.createdAt,
    day: log.day,
    result: log.result,
    help: log.help,
    helpDeclared: log.helpDeclared,
    hints: log.hints,
    minutes: log.minutes,
    plannedMinutes: log.plannedMinutes,
    cause: null,
    lackOfTime: false,
    source: "annale",
    level: annaleLevel(log.level),
  };
}

export function buildExercises(input: { annales: AnnaleLog[]; attempts: ExerciseAttempt[]; retryDelaysDays: number[]; today: string }): Exercise[] {
  const groups = new Map<string, { steps: ExerciseStep[]; label: string; subject: Subject | null; chapterId: string | null; origin: AttemptOrigin }>();

  for (const log of input.annales) {
    const key = annaleKey(log);
    const group = groups.get(key) ?? {
      steps: [],
      label: log.source ? `${log.chapter} — ${log.source}` : log.chapter,
      subject: log.subject,
      chapterId: bestProgrammeMatch(log.subject, log.chapter)?.id ?? null,
      origin: "annale" as const,
    };
    group.steps.push(stepFromAnnale(log));
    groups.set(key, group);
  }
  for (const attempt of input.attempts) {
    const group = groups.get(attempt.exerciseKey) ?? { steps: [], label: attempt.label, subject: attempt.subject, chapterId: attempt.chapterId, origin: attempt.origin };
    // Le chapitre déclaré par l'élève l'emporte sur un rapprochement de titres.
    if (attempt.chapterId) group.chapterId = attempt.chapterId;
    group.steps.push(stepFromAttempt(attempt));
    groups.set(attempt.exerciseKey, group);
  }

  const delays = input.retryDelaysDays.length > 0 ? input.retryDelaysDays : [2, 5, 12];
  const out: Exercise[] = [];
  for (const [key, group] of groups) {
    const steps = group.steps.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const last = steps[steps.length - 1];
    let streak = 0;
    for (let index = steps.length - 1; index >= 0 && !isCleanSuccess(steps[index]); index -= 1) streak += 1;

    let status: ExerciseStatus;
    let nextRetryDay: string | null = null;
    let verifiedOn: string | null = null;
    if (streak === 0) {
      status = steps.length > 1 ? "vérifié" : "réussi";
      verifiedOn = steps.length > 1 ? last.day : null;
    } else {
      nextRetryDay = addDays(last.day, delays[Math.min(streak, delays.length) - 1]);
      status = nextRetryDay <= input.today ? "à-refaire" : "programmé";
    }
    const lastCause = [...steps].reverse().find((step) => step.cause !== null)?.cause ?? null;
    out.push({
      key,
      label: group.label,
      subject: group.subject,
      chapterId: group.chapterId,
      origin: group.origin,
      steps,
      status,
      failedStreak: streak,
      nextRetryDay,
      verifiedOn,
      changeApproach: streak >= CHANGE_APPROACH_AFTER ? changeApproachFor(lastCause) : null,
    });
  }
  return out;
}

/** Les exercices à refaire aujourd'hui, le plus en retard d'abord, puis le plus raté. */
export function dueRetries(exercises: Exercise[]): Exercise[] {
  return exercises
    .filter((exercise) => exercise.status === "à-refaire")
    .sort((a, b) => (a.nextRetryDay ?? "").localeCompare(b.nextRetryDay ?? "") || b.failedStreak - a.failedStreak || a.key.localeCompare(b.key));
}

/** Les exercices programmés plus tard, le plus proche d'abord. */
export function upcomingRetries(exercises: Exercise[]): Exercise[] {
  return exercises.filter((exercise) => exercise.status === "programmé").sort((a, b) => (a.nextRetryDay ?? "").localeCompare(b.nextRetryDay ?? ""));
}

let counter = 0;
function newId(): string {
  counter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}-${counter}`;
}

/** La nouvelle tentative d'un exercice, saisie dans l'application. `null` sans matière connue (une annale « SII »). */
export function createRetryAttempt(
  exercise: Pick<Exercise, "key" | "label" | "subject" | "chapterId" | "origin"> & { steps?: ExerciseStep[] },
  input: { result: AttemptResult; help: AttemptHelp; minutes: number | null; cause: AttemptCause | null; lackOfTime?: boolean; note?: string | null; level?: ExerciseLevel | null },
  now: Date
): ExerciseAttempt | null {
  if (!exercise.subject) return null;
  const at = now.toISOString();
  // Le niveau : celui donné, sinon celui du dernier essai connu de l'exercice.
  const level = input.level ?? [...(exercise.steps ?? [])].reverse().find((step) => step.level !== null)?.level ?? null;
  return {
    id: newId(),
    exerciseKey: exercise.key,
    label: exercise.label,
    subject: exercise.subject,
    chapterId: exercise.chapterId,
    origin: exercise.origin,
    day: now.toLocaleDateString("en-CA"),
    createdAt: at,
    updatedAt: at,
    result: input.result,
    help: input.help,
    minutes: input.minutes !== null && Number.isFinite(input.minutes) && input.minutes > 0 ? Math.round(input.minutes) : null,
    plannedMinutes: null,
    cause: input.result === "réussi" ? null : input.cause,
    lackOfTime: input.lackOfTime ?? false,
    gradeId: null,
    note: input.note?.trim() ? input.note.trim().slice(0, 400) : null,
    ...(level ? { level } : {}),
  };
}

export type ErrorVerification =
  | { state: "vérifiée"; on: string }
  | { state: "à-vérifier"; on: string | null }
  | { state: "non-reliée" };

/**
 * Une erreur du carnet est-elle CORRIGÉE ? Seulement si l'exercice dont elle
 * vient a été réussi sans aide APRÈS elle. Une erreur sans exercice relié ne
 * peut pas être vérifiée (et ne se déclare pas corrigée pour autant).
 */
export function verifyError(error: Pick<ErrorEntry, "date" | "exerciseKey">, exercisesByKey: ReadonlyMap<string, Exercise>): ErrorVerification {
  if (!error.exerciseKey) return { state: "non-reliée" };
  const exercise = exercisesByKey.get(error.exerciseKey);
  if (!exercise) return { state: "à-vérifier", on: null };
  const proof = exercise.steps.find((step) => step.day >= error.date && isCleanSuccess(step) && exercise.status !== "à-refaire" && exercise.status !== "programmé");
  if (proof && exercise.verifiedOn) return { state: "vérifiée", on: exercise.verifiedOn };
  return { state: "à-vérifier", on: exercise.nextRetryDay };
}

/** Comparaison des tentatives successives : le temps et l'aide, de la première à la dernière. */
export function progressLine(exercise: Exercise): string | null {
  if (exercise.steps.length < 2) return null;
  const first = exercise.steps[0];
  const last = exercise.steps[exercise.steps.length - 1];
  const parts = [`${exercise.steps.length} tentatives`];
  if (first.minutes !== null && last.minutes !== null) parts.push(`${first.minutes} → ${last.minutes} min`);
  const helpWord = (step: ExerciseStep) => (step.help === "sans" ? "sans aide" : step.help === "indices" ? "avec indices" : "correction ouverte");
  parts.push(`${first.result} ${helpWord(first)} → ${last.result} ${helpWord(last)}`);
  return parts.join(" · ");
}
