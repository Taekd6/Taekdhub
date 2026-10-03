import type { AttemptCause, AttemptHelp, AttemptResult, ExerciseAttempt, ExerciseLevel } from "@/lib/attempts";
import { createRetryAttempt, type Exercise } from "@/lib/exercises";
import type { NextMoveRecord } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import { createTransferAttempt } from "@/lib/transfer";

/**
 * BILAN DE SÉANCE — « qu'as-tu fait pendant ces 47 minutes ? »
 *
 * Le chrono ne mesure que du TEMPS. Or le temps ne prouve rien : TaekdHub
 * ne sait ce que l'élève sait faire que par des TENTATIVES (lib/attempts.ts).
 * À l'arrêt du chrono, quelques gestes suffisent à les noter :
 *
 *   refaire     la séance venait d'un « refaire sans aide » de Next Move :
 *               l'essai s'attache à CET exercice (même clé) ;
 *   transfert   elle venait d'un exercice de transfert : l'essai porte
 *               `transferOf` (lib/transfer.ts) ;
 *   nouveau     tout autre exercice, rattaché au chapitre visé s'il est connu.
 *
 * Chaque essai noté ici est la PREUVE que Next Move attend pour clore sa
 * recommandation (lib/next-move/history.ts) — le temps passé, lui, ne la
 * clôt jamais.
 *
 * Fonctions pures.
 */

export type DebriefMode = "refaire" | "transfert" | "nouveau";

export interface DebriefEntry {
  mode: DebriefMode;
  /** Exercice à refaire, ou exercice d'origine d'un transfert. */
  exerciseKey: string | null;
  /** Énoncé (nouveau, transfert). */
  label: string;
  chapterId: string | null;
  result: AttemptResult | null;
  help: AttemptHelp;
  cause: AttemptCause | null;
  level: ExerciseLevel | null;
}

/**
 * Clé d'un exercice saisi à la main — EXACTEMENT celle de « Noter un
 * exercice » (« À refaire ») : le même énoncé noté ici ou là doit retomber
 * sur le même exercice, y compris pour les tentatives déjà enregistrées.
 */
export function manualExerciseKey(label: string): string {
  return `exercice:${label.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
}

function blank(mode: DebriefMode, extra: Partial<DebriefEntry> = {}): DebriefEntry {
  return { mode, exerciseKey: null, label: "", chapterId: null, result: null, help: "sans", cause: null, level: null, ...extra };
}

export function emptyEntry(chapterId: string | null = null): DebriefEntry {
  return blank("nouveau", { chapterId });
}

/**
 * La première ligne du bilan, pré-remplie d'après la recommandation commencée
 * — seulement si elle porte sur la matière de la séance.
 */
export function prefillEntry(move: NextMoveRecord | null, subject: Subject, exercises: Exercise[]): DebriefEntry {
  if (!move || (move.subject !== null && move.subject !== subject)) return emptyEntry();
  if (move.key.startsWith("refaire:")) {
    const exercise = exercises.find((entry) => entry.key === move.key.slice("refaire:".length));
    if (exercise) return blank("refaire", { exerciseKey: exercise.key, label: exercise.label, chapterId: exercise.chapterId });
  }
  if (move.key.startsWith("transfert:")) {
    const origin = exercises.find((entry) => entry.key === move.key.slice("transfert:".length));
    if (origin) return blank("transfert", { exerciseKey: origin.key, chapterId: origin.chapterId });
  }
  // `exercice:<chapitre>` ou `exercice:<chapitre>:<variante>` — un exercice ciblé du diagnostic.
  if (move.key.startsWith("exercice:")) {
    const chapterId = move.key.slice("exercice:".length).split(":")[0];
    return blank("nouveau", { chapterId, level: move.key.endsWith(":difficile") ? "difficile" : null });
  }
  return emptyEntry();
}

/** Une ligne est enregistrable quand son résultat est dit — et son énoncé, sauf pour un exercice déjà connu. */
export function isComplete(entry: DebriefEntry): boolean {
  if (!entry.result) return false;
  return entry.mode === "refaire" ? entry.exerciseKey !== null : entry.label.trim().length > 0;
}

/**
 * Les tentatives à enregistrer. Datées de la FIN de la séance, une seconde
 * d'écart entre chacune pour garder l'ordre de saisie ; les lignes
 * incomplètes sont ignorées.
 */
export function attemptsFromDebrief(entries: DebriefEntry[], session: Pick<WorkSession, "subject" | "ended_at">, exercises: Exercise[]): ExerciseAttempt[] {
  const end = new Date(session.ended_at ?? new Date().toISOString());
  const out: ExerciseAttempt[] = [];
  entries.filter(isComplete).forEach((entry, index) => {
    const at = new Date(end.getTime() + index * 1000);
    const input = { result: entry.result!, help: entry.help, minutes: null, cause: entry.cause, level: entry.level };
    if (entry.mode === "refaire") {
      const exercise = exercises.find((item) => item.key === entry.exerciseKey);
      const attempt = exercise ? createRetryAttempt(exercise, input, at) : null;
      if (attempt) out.push(attempt);
      return;
    }
    if (entry.mode === "transfert") {
      const origin = exercises.find((item) => item.key === entry.exerciseKey);
      const attempt = origin ? createTransferAttempt(origin, { ...input, label: entry.label }, at) : null;
      if (attempt) out.push(attempt);
      return;
    }
    const label = entry.label.trim().slice(0, 160);
    const attempt = createRetryAttempt({ key: manualExerciseKey(label), label, subject: session.subject, chapterId: entry.chapterId, origin: "exercice" }, input, at);
    if (attempt) out.push(attempt);
  });
  return out;
}
