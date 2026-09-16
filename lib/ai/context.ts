import { sessionsForExercise, resultCounts } from "@/lib/history";
import { minutesByExerciseMap } from "@/lib/study";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";
import type { AIContext, AIExerciseContext, AILearnerContext } from "@/lib/ai/types";

/**
 * CONSTRUCTION DU CONTEXTE IA — ce qui part, et surtout ce qui ne part pas.
 *
 * Fonction PURE, exécutée dans le navigateur, avant tout appel réseau. C'est
 * délibéré et c'est le cœur de la garantie de confidentialité : le serveur ne
 * reçoit jamais la banque, ni l'historique, ni les préférences, ni les notes,
 * ni les échéances. Il reçoit un objet construit ici, champ par champ, à
 * partir de ce que la tâche demande vraiment. « Ne jamais envoyer aveuglément
 * tout le localStorage » n'est pas une consigne de prudence : c'est une
 * propriété que ce fichier établit, et que ses tests vérifient.
 *
 * Trois bornes, pour trois raisons distinctes :
 *   — le COÛT, un contexte qui enfle est facturé à chaque appel ;
 *   — la QUALITÉ, un modèle noyé sous le hors-sujet répond moins bien ;
 *   — la VIE PRIVÉE, ce qui n'est pas envoyé ne peut pas fuiter.
 */

/** Au-delà, un énoncé est tronqué — assez pour un sujet de concours complet, pas assez pour un chapitre entier. */
export const MAX_STATEMENT_CHARS = 4000;
/** Le corrigé sert de vérité terrain : on lui laisse plus de place qu'à l'énoncé, mais pas l'infini. */
export const MAX_CORRECTION_CHARS = 6000;
/** Les indices du professeur sont courts par nature ; au-delà, c'est déjà une correction. */
export const MAX_HINT_CHARS = 600;
/** Nombre d'indices transmis au plus — les derniers paliers n'en ont pas besoin de vingt. */
export const MAX_HINTS = 6;
/** Ce que l'élève écrit lui-même : borné aussi, c'est une entrée libre. */
export const MAX_STUDENT_TEXT_CHARS = 1500;

/** Coupe sans mentir : la troncature se voit, pour que le modèle sache qu'il lui manque la fin. */
export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}\n[…texte tronqué]`;
}

/** Normalise une saisie libre de l'élève avant envoi — jamais `undefined` déguisé en chaîne vide. */
export function clipStudentText(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? clip(trimmed, MAX_STUDENT_TEXT_CHARS) : undefined;
}

export function buildExerciseContext(exercise: Exercise, chapters: Chapter[]): AIExerciseContext {
  const chapter = exercise.chapter_id ? (chapters.find((entry) => entry.id === exercise.chapter_id)?.label ?? null) : null;
  const correction = (exercise.correction ?? "").trim();
  return {
    title: exercise.title,
    subject: exercise.subject,
    // Le LIBELLÉ, pas l'identifiant : « Réduction des endomorphismes » porte du
    // sens pour le modèle, un UUID n'en porte aucun et coûte des jetons.
    chapter,
    statement: clip(exercise.statement, MAX_STATEMENT_CHARS),
    hints: exercise.hints.slice(0, MAX_HINTS).map((hint) => clip(hint, MAX_HINT_CHARS)),
    // `null` et non `""` : l'absence de corrigé change ce que l'IA a le droit
    // d'affirmer, et doit donc être distinguable d'un corrigé vide.
    correction: correction ? clip(correction, MAX_CORRECTION_CHARS) : null,
    difficulty: exercise.difficulty,
    level: exercise.level,
    prerequisites: exercise.prerequisites.slice(0, 8),
    pedagogicalGoal: exercise.pedagogical_goal,
  };
}

export function buildLearnerContext(exercise: Exercise, sessions: WorkSession[], exercises: Exercise[]): AILearnerContext {
  const own = sessionsForExercise(sessions, exercise.id);
  const counts = resultCounts(own);
  const minutes = minutesByExerciseMap(sessions).get(exercise.id) ?? 0;

  // La maîtrise du CHAPITRE vient du moteur existant (lib/progress.ts), jamais
  // d'un calcul refait ici : une seconde définition de « maîtrise » est
  // exactement ce que l'audit précédent a passé son temps à supprimer.
  const chapterPeers = exercise.chapter_id
    ? exercises.filter((entry) => !entry.archived && entry.chapter_id === exercise.chapter_id)
    : [];
  const chapterMastery =
    chapterPeers.length > 0
      ? Math.round(chapterPeers.reduce((sum, entry) => sum + entry.mastery, 0) / chapterPeers.length)
      : null;

  return {
    classe: "MP",
    exerciseMastery: exercise.mastery,
    chapterMastery,
    attemptsOnExercise: exercise.attempts,
    minutesOnExercise: minutes,
    // `null` quand RIEN n'a été noté : compter zéro réussite sur zéro
    // tentative laisserait croire à un échec systématique.
    previousResults:
      counts.attempted > 0 ? { succeeded: counts.success, partial: counts.partial, failed: counts.failure } : null,
  };
}

export function buildAIContext(
  exercise: Exercise,
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[]
): AIContext {
  return {
    exercise: buildExerciseContext(exercise, chapters),
    learner: buildLearnerContext(exercise, sessions, exercises),
  };
}

/**
 * Poids approximatif du contexte, en caractères — sert de garde-fou de COÛT,
 * pas de mesure de jetons. Le serveur refuse au-delà (voir app/api/ai/route.ts),
 * ce qui évite qu'un énoncé collé de 200 Ko parte en facturation.
 */
export function contextWeight(context: AIContext): number {
  return JSON.stringify(context).length;
}

/** Plafond accepté par la route. Large pour un exercice normal, infranchissable pour un accident. */
export const MAX_CONTEXT_CHARS = 24000;
