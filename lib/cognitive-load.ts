import type { AgendaTask } from "@/lib/day-agenda";
import type { Exercise } from "@/lib/exercises";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { bestProgrammeMatch } from "@/lib/programme";
import type { ChapterMemory, WorkItem } from "@/lib/storage";
import { daysUntilDue } from "@/lib/work-items";

/**
 * EXIGENCE COGNITIVE D'UNE TÂCHE — `elevee`, `moyenne` ou `legere`, par
 * RÈGLES LISIBLES, jamais par un score.
 *
 * Une tâche part d'un niveau DE BASE fixé par son type (grille ci-dessous),
 * puis peut être relevée ou abaissée d'un cran par trois informations déjà
 * connues : le niveau de l'exercice, la difficulté du chapitre dans la
 * mémoire de l'élève, et l'échéance. Chaque étape qui compte porte SA phrase ;
 * `explanation` les met bout à bout, pour que l'élève puisse contester le
 * verdict en relisant ses propres données.
 *
 * LA GRILLE DE BASE suit un principe ordinaire, pas une théorie de la
 * performance : lire et réviser avec correction immédiate demande moins que
 * retrouver de tête, qui demande moins que produire un raisonnement sur un
 * énoncé inédit.
 *
 *   elevee    produire un raisonnement nouveau : DS / concours, DM, transfert
 *             sur un énoncé différent, problème difficile, exercice en temps
 *             limité ;
 *   moyenne   retrouver de tête ou reprendre : rappel actif, khôlle, exercice
 *             à refaire, exercice ciblé, reprise d'erreurs ou de calculs,
 *             interrogation sur fiches, feuille d'exercices, bloc libre ;
 *   legere    réviser avec correction immédiate, ou relire : fiches espacées,
 *             Anki, relecture d'un cours.
 *
 * CE QUE CETTE CLASSIFICATION NE PRÉTEND PAS. Elle décrit le TYPE de travail,
 * pas la difficulté réelle d'un énoncé que TaekdHub ne connaît pas (« bloc »,
 * « exercices » : le contenu est sur les feuilles de l'élève → `moyenne` par
 * défaut, et la phrase le dit). Elle ne mesure ni sa fatigue, ni sa
 * concentration, ni sa performance. Les seuils d'ajustement sont des choix
 * de bon sens, pas des valeurs calibrées.
 *
 * Fonctions pures — aucun localStorage, aucun React.
 */

export type CognitiveLevel = "elevee" | "moyenne" | "legere";
export const COGNITIVE_LEVELS: readonly CognitiveLevel[] = ["legere", "moyenne", "elevee"];

export const COGNITIVE_LABEL: Record<CognitiveLevel, string> = {
  elevee: "exigeante",
  moyenne: "intermédiaire",
  legere: "légère",
};

export interface CognitiveLoad {
  level: CognitiveLevel;
  /** Les étapes qui ont fixé le niveau, dans l'ordre : d'abord la base, puis chaque ajustement. */
  reasons: string[];
  /** `reasons` en une phrase, prête à afficher. */
  explanation: string;
}

/** Ce que la classification lit — rien d'autre, rien d'écrit. */
export interface CognitiveContext {
  workItems: readonly WorkItem[];
  chapterMemory: readonly ChapterMemory[];
  exercises: readonly Exercise[];
  now: Date;
}

/** Difficulté FSRS (1 à 10) à partir de laquelle un chapitre est dit difficile pour l'élève. */
export const CHAPTER_HARD_DIFFICULTY = 7;
/** Difficulté FSRS jusqu'à laquelle un chapitre est dit facile pour l'élève. */
export const CHAPTER_EASY_DIFFICULTY = 3;
/**
 * Nombre minimal de notes avant de lire la difficulté d'un chapitre : avec
 * moins, c'est la valeur initiale du modèle, pas une observation.
 */
export const CHAPTER_MIN_REPS = 3;
/** Une échéance qui tombe dans ce nombre de jours (ou déjà passée) relève un travail intermédiaire. */
export const NEAR_DEADLINE_DAYS = 2;

interface Step {
  delta: -1 | 0 | 1;
  reason: string;
}

function resolve(base: CognitiveLevel, baseReason: string, steps: Step[]): CognitiveLoad {
  let rank = COGNITIVE_LEVELS.indexOf(base);
  const reasons = [baseReason];
  for (const step of steps) {
    const next = Math.max(0, Math.min(COGNITIVE_LEVELS.length - 1, rank + step.delta));
    // Un ajustement sans effet (déjà au plafond ou au plancher) n'explique rien du verdict : il n'est pas cité.
    if (next !== rank || step.delta === 0) reasons.push(step.reason);
    rank = next;
  }
  const level = COGNITIVE_LEVELS[rank];
  return { level, reasons, explanation: `${reasons.join(" ; ")}.` };
}

/** La difficulté du chapitre du programme, lue dans la mémoire de l'élève — `null` si elle n'est pas fiable. */
function chapterStep(programmeChapterId: string | null | undefined, memories: readonly ChapterMemory[]): Step | null {
  if (!programmeChapterId) return null;
  const chapter = PROGRAMME_BY_ID.get(programmeChapterId);
  if (!chapter) return null;
  let hardest: ChapterMemory | null = null;
  for (const memory of memories) {
    if (memory.archived || memory.card.reps < CHAPTER_MIN_REPS) continue;
    if (bestProgrammeMatch(memory.subject, memory.title)?.id !== programmeChapterId) continue;
    if (!hardest || memory.card.difficulty > hardest.card.difficulty) hardest = memory;
  }
  return hardest ? difficultyStep(hardest, chapter.title) : null;
}

function difficultyStep(memory: ChapterMemory, title: string): Step | null {
  const { difficulty, reps } = memory.card;
  const seen = `difficulté estimée ${difficulty.toFixed(1).replace(".", ",")}/10 après ${reps} révisions, d'après le modèle de mémoire — une estimation, pas une mesure`;
  if (difficulty >= CHAPTER_HARD_DIFFICULTY) return { delta: 1, reason: `Chapitre « ${title} » difficile pour toi (${seen})` };
  if (difficulty <= CHAPTER_EASY_DIFFICULTY) return { delta: -1, reason: `Chapitre « ${title} » plutôt facile pour toi (${seen})` };
  return null;
}

function levelStep(exercise: Exercise | undefined): Step {
  const level = [...(exercise?.steps ?? [])].reverse().find((step) => step.level !== null)?.level ?? null;
  if (level === "difficile") return { delta: 1, reason: "exercice de niveau difficile (Mines, Centrale, X-ENS)" };
  if (level === "direct") return { delta: -1, reason: "exercice d'application directe" };
  if (level === "classique") return { delta: 0, reason: "exercice de niveau classique, sans ajustement" };
  return { delta: 0, reason: "niveau de l'exercice non renseigné, sans ajustement" };
}

function workItemLoad(item: WorkItem | undefined, ctx: CognitiveContext): CognitiveLoad {
  if (!item) return resolve("moyenne", "Nature du travail inconnue : niveau intermédiaire par défaut", []);
  const steps: Step[] = [];
  const days = daysUntilDue(item, ctx.now);
  switch (item.kind) {
    case "ds":
    case "concours":
      return resolve("elevee", "Préparer une épreuve (DS, concours) : raisonner sur des problèmes inédits, sous contrainte", steps);
    case "dm":
      return resolve("elevee", "Devoir maison : des problèmes longs à raisonner et à rédiger", steps);
    case "colle":
      steps.push(...nearDeadline(days));
      return resolve("moyenne", "Préparer une colle : retrouver le cours et s'entraîner à l'oral", steps);
    case "chapitre":
      steps.push(...nearDeadline(days));
      return resolve("moyenne", "Travail sur un chapitre : apprendre et retrouver le cours", steps);
    case "exercices":
      steps.push(...nearDeadline(days));
      return resolve("moyenne", "Feuille d'exercices : leur niveau n'est pas connu de TaekdHub, niveau intermédiaire par défaut", steps);
    default:
      steps.push(...nearDeadline(days));
      return resolve("moyenne", "Nature du travail inconnue : niveau intermédiaire par défaut", steps);
  }
}

function nearDeadline(days: number | null): Step[] {
  if (days === null || days > NEAR_DEADLINE_DAYS) return [];
  const when = days < 0 ? "déjà passée" : days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
  return [{ delta: 1, reason: `échéance ${when} : l'enjeu demande ta meilleure attention` }];
}

/** Le suffixe d'une clé de tâche (`refaire:<clé>`), ou `null` si le préfixe ne correspond pas. */
function after(key: string, prefix: string): string | null {
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

/**
 * L'exigence d'une tâche du plan du jour.
 *
 * La tâche est reconnue par sa CLÉ (`MoveCandidate.key`, lib/next-move/engine.ts),
 * dont les formats sont stables : `échéance:<id>`, `refaire:<exercice>`,
 * `transfert:<exercice>`, `exercice:<chapitre>[:difficile|:temps]`,
 * `rappel:<mémoire>`, `cours:<chapitre>`, `kholle:<chapitre>`, `cartes:<matière>`,
 * `anki:…`, `erreurs:…`, `calcul:<chapitre>`, `bloc:<matière>`,
 * `verrou:<clé>[:cours]`. Une clé inconnue donne `moyenne`, et le dit.
 */
export function classifyCognitiveLoad(task: Pick<AgendaTask, "key" | "workItemId">, ctx: CognitiveContext): CognitiveLoad {
  const { key } = task;

  const workItemId = after(key, "échéance:");
  if (workItemId !== null) return workItemLoad(ctx.workItems.find((item) => item.id === (task.workItemId ?? workItemId)), ctx);

  const exerciseKey = after(key, "refaire:");
  if (exerciseKey !== null) {
    const exercise = ctx.exercises.find((entry) => entry.key === exerciseKey);
    const steps = [levelStep(exercise), chapterStep(exercise?.chapterId, ctx.chapterMemory)].filter((step): step is Step => step !== null);
    return resolve("moyenne", "Refaire sans aide un exercice déjà raté : retrouver la méthode sans la correction", steps);
  }

  if (after(key, "transfert:") !== null) {
    return resolve("elevee", "Vérifier la méthode sur un énoncé différent : l'appliquer à du nouveau, sans la correction", []);
  }

  const targeted = after(key, "exercice:");
  if (targeted !== null) {
    const [chapterId, variant] = targeted.split(":");
    if (variant === "difficile") return resolve("elevee", "Problème difficile, peu guidé, à découper", []);
    if (variant === "temps") return resolve("elevee", "Exercice en temps limité : produire vite sous contrainte", []);
    const step = chapterStep(chapterId, ctx.chapterMemory);
    return resolve("moyenne", "Exercice ciblé sur un point faible repéré par le diagnostic", step ? [step] : []);
  }

  const memoryId = after(key, "rappel:");
  if (memoryId !== null) {
    const memory = ctx.chapterMemory.find((entry) => entry.id === memoryId);
    const step = memory && memory.card.reps >= CHAPTER_MIN_REPS ? difficultyStep(memory, memory.title) : null;
    return resolve("moyenne", "Rappel actif d'un chapitre : le retrouver de tête, sans le relire", step ? [step] : []);
  }

  const khollePart = after(key, "kholle:");
  if (khollePart !== null) {
    const step = chapterStep(khollePart, ctx.chapterMemory);
    return resolve("moyenne", "Khôlle : répondre à des questions de cours à l'oral", step ? [step] : []);
  }

  const coursePart = after(key, "cours:");
  if (coursePart !== null) {
    const step = chapterStep(coursePart, ctx.chapterMemory);
    return resolve("moyenne", "Rappel de cours : retrouver le chapitre de tête", step ? [step] : []);
  }

  if (after(key, "calcul:") !== null) return resolve("moyenne", "Reprise de calculs ratés : attention soutenue, peu de nouveauté", []);
  if (after(key, "erreurs:") !== null) return resolve("moyenne", "Reprise ciblée d'erreurs récentes : comprendre la cause, puis refaire", []);
  if (after(key, "cartes:") !== null) return resolve("legere", "Révision de fiches espacées : rappel court, avec correction immédiate", []);
  if (after(key, "anki:") !== null) return resolve("legere", "Révisions Anki : cartes courtes, avec correction immédiate", []);
  if (after(key, "bloc:") !== null) return resolve("moyenne", "Bloc de travail libre : son contenu n'est pas connu de TaekdHub, niveau intermédiaire par défaut", []);

  const lock = after(key, "verrou:");
  if (lock !== null) {
    return lock.endsWith(":cours")
      ? resolve("legere", "Relecture du cours d'un chapitre verrouillé : relire demande moins que retrouver de tête", [])
      : resolve("moyenne", "Interrogation sur les fiches d'un chapitre verrouillé : répondre de tête, sans notes", []);
  }

  return resolve("moyenne", "Type de tâche non reconnu : niveau intermédiaire par défaut", []);
}
