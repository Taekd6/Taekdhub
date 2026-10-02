import { EXERCISE_LEVEL_LABEL, isCleanSuccess, type ExerciseLevel } from "@/lib/attempts";
import type { Exercise } from "@/lib/exercises";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

/**
 * CONTRÔLE QUALITÉ DES EXERCICES — « un moteur de progression est inutile
 * s'il recommande des exercices mal choisis ».
 *
 * TaekdHub ne stocke ni énoncés ni corrigés : ils viennent du TD, des
 * annales, ou de Claude. Ce module contrôle donc ce qui PEUT l'être :
 *
 *   1. les données d'un exercice noté — sans chapitre, il n'alimente aucun
 *      diagnostic ; sans niveau, impossible de dire si une réussite prouve
 *      une méthode ou seulement une application directe ; un échec sans
 *      cause ne dit pas quoi travailler ; une aide déduite reste douteuse ;
 *   2. le NIVEAU à viser ensuite dans un chapitre : on monte quand deux
 *      réussites sans aide le justifient, jamais d'après le temps passé ;
 *   3. la VARIÉTÉ : des réussites toutes au même niveau facile ne prouvent
 *      pas la méthode dans un problème ;
 *   4. la DEMANDE faite à Claude : chapitre ET sous-thème, niveau, prérequis,
 *      objectif, correction complète et rigoureuse — gardée pour après l'essai.
 *
 * Fonctions pures.
 */

export type QualityIssue = "chapitre" | "niveau" | "cause" | "aide";

export const QUALITY_ISSUE_LABEL: Record<QualityIssue, string> = {
  chapitre: "sans chapitre : n'alimente pas le diagnostic",
  niveau: "niveau inconnu : la réussite ne dit pas quelle difficulté tu maîtrises",
  cause: "échec sans cause : on ne sait pas quoi travailler",
  aide: "aide déduite des indices, pas déclarée",
};

export function qualityIssues(exercise: Exercise): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!exercise.chapterId) issues.push("chapitre");
  if (!exercise.steps.some((step) => step.level !== null)) issues.push("niveau");
  if (exercise.steps.some((step) => step.result !== "réussi" && step.cause === null)) issues.push("cause");
  if (exercise.steps.some((step) => !step.helpDeclared)) issues.push("aide");
  return issues;
}

/** Corrigeables ici : chapitre et niveau d'un exercice saisi dans l'application (une annale se corrige à la source). */
export function fixableIssues(exercise: Exercise): QualityIssue[] {
  if (!exercise.steps.some((step) => step.source === "app")) return [];
  return qualityIssues(exercise).filter((issue) => issue === "chapitre" || issue === "niveau");
}

const ORDER: ExerciseLevel[] = ["direct", "classique", "difficile"];
/** Réussites sans aide à un niveau avant de viser le suivant. */
export const LEVEL_UP_AFTER = 2;

export interface LevelTarget {
  level: ExerciseLevel;
  reason: string;
}

/** Le niveau à demander pour le prochain exercice d'un chapitre. */
export function levelToRequest(exercises: Exercise[], chapterId: string): LevelTarget {
  const clean: Record<ExerciseLevel, number> = { direct: 0, classique: 0, difficile: 0 };
  let failedHard = 0;
  for (const exercise of exercises) {
    if (exercise.chapterId !== chapterId) continue;
    for (const step of exercise.steps) {
      if (!step.level) continue;
      if (isCleanSuccess(step)) clean[step.level] += 1;
      else if (step.level === "difficile") failedHard += 1;
    }
  }
  if (clean.difficile > 0) return { level: "difficile", reason: `${clean.difficile} problème${clean.difficile > 1 ? "s" : ""} difficile${clean.difficile > 1 ? "s" : ""} déjà réussi${clean.difficile > 1 ? "s" : ""} sans aide : on reste à ce niveau` };
  if (clean.classique >= LEVEL_UP_AFTER) {
    return { level: "difficile", reason: `${clean.classique} classiques réussis sans aide${failedHard > 0 ? `, ${failedHard} difficile${failedHard > 1 ? "s" : ""} raté${failedHard > 1 ? "s" : ""}` : ""} : on monte au difficile` };
  }
  if (clean.direct >= LEVEL_UP_AFTER) return { level: "classique", reason: `${clean.direct} applications directes réussies sans aide : on monte au classique` };
  const known = clean.direct + clean.classique;
  return { level: "classique", reason: known === 0 ? "Pas encore de réussite sans aide de niveau connu : on part du classique" : `Pas encore ${LEVEL_UP_AFTER} réussites sans aide au même niveau : on reste au classique` };
}

/** Les réussites d'un chapitre sont-elles trop uniformes pour prouver la méthode ? `null` sinon. */
export function varietyWarning(exercises: Exercise[], chapterId: string): string | null {
  const levels = exercises
    .filter((exercise) => exercise.chapterId === chapterId)
    .flatMap((exercise) => exercise.steps.filter(isCleanSuccess).map((step) => step.level));
  if (levels.length < 3) return null;
  if (levels.every((level) => level === null)) return `${levels.length} réussites sans aide, mais aucune de niveau connu : impossible de dire si elles prouvent la méthode dans un problème.`;
  const highest = ORDER.filter((level) => levels.includes(level)).pop()!;
  if (highest === "difficile") return null;
  return `${levels.length} réussites sans aide, toutes au plus « ${EXERCISE_LEVEL_LABEL[highest].toLowerCase()} » : elles ne prouvent pas encore la méthode dans un problème plus long.`;
}

export interface ExerciseRequestInput {
  subject: string;
  chapter: string;
  level: ExerciseLevel;
  /** La méthode, le réflexe visé, s'il est connu. */
  method?: string | null;
  /** Transfert : l'énoncé dont il faut s'écarter. */
  differentFrom?: string | null;
}

/** La demande d'exercice à envoyer à Claude : les cinq exigences de qualité, et la correction gardée pour après. */
export function exerciseRequest(input: ExerciseRequestInput): string {
  const lines = [
    `Propose-moi UN exercice de prépa MP en ${input.subject}, chapitre « ${input.chapter} ».`,
    "Avant l'énoncé, indique :",
    "- le sous-thème précis ;",
    `- le niveau : ${EXERCISE_LEVEL_LABEL[input.level]} ;`,
    "- les prérequis (définitions, théorèmes) ;",
    `- l'objectif : la compétence visée, en une phrase${input.method ? ` (méthode à travailler : ${input.method})` : ""}.`,
  ];
  if (input.differentFrom) lines.push(`L'énoncé doit être DIFFÉRENT de « ${input.differentFrom} » mais demander la même méthode, sans la nommer dans l'énoncé.`);
  lines.push(
    "Ne donne PAS la correction : je te la demanderai après mon essai. Elle devra alors être complète et rigoureuse — chaque étape justifiée, les hypothèses de chaque théorème vérifiées.",
    "Après la correction, enregistre l'exercice avec log_exercise (chapitre, niveau, résultat, aide réellement utilisée)."
  );
  return lines.join("\n");
}

/** Niveau de l'exercice d'origine (dernier connu) — un transfert se vérifie au même niveau. */
export function exerciseLevel(exercise: Exercise): ExerciseLevel | null {
  return [...exercise.steps].reverse().find((step) => step.level !== null)?.level ?? null;
}

/** La demande d'exercice de TRANSFERT : même chapitre, même niveau, même méthode, autre énoncé. */
export function transferRequest(exercise: Exercise, method: string | null): string {
  const chapter = exercise.chapterId ? PROGRAMME_BY_ID.get(exercise.chapterId)?.title ?? null : null;
  return exerciseRequest({
    subject: exercise.subject ?? "maths",
    chapter: chapter ?? exercise.label,
    level: exerciseLevel(exercise) ?? "classique",
    method,
    differentFrom: exercise.label,
  });
}
