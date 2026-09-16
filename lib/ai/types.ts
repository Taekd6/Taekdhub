import type { Subject } from "@/lib/supabase/types";

/**
 * COUCHE IA — TYPES PARTAGÉS.
 *
 * Ce fichier ne dépend ni de React, ni du réseau, ni d'un fournisseur : il est
 * importé aussi bien par le navigateur (construction du contexte, validation
 * de la réponse) que par le gestionnaire de route côté serveur. C'est la seule
 * chose que les deux moitiés ont en commun.
 *
 * PRINCIPE DIRECTEUR, et il gouverne tout le reste : l'IA est un COPILOTE
 * PÉDAGOGIQUE, pas une source de vérité. Les moteurs déterministes
 * (lib/recommendation.ts, lib/planning.ts, lib/deadlines.ts, lib/analytics/*)
 * gardent l'exclusivité de tout ce qui est CHIFFRÉ — charge, échéances,
 * faisabilité, priorités, progression. L'IA n'en reçoit que le résultat déjà
 * calculé, et n'a jamais de quoi le recalculer autrement.
 */

/* ══════════════════════════════════════════════════════════════════
   LE CONTEXTE — minimal, ciblé, jamais « tout le localStorage »
   ══════════════════════════════════════════════════════════════════ */

/**
 * Ce que l'IA sait de l'EXERCICE en cours.
 *
 * `statement`, `hints` et `correction` sont la VÉRITÉ TERRAIN : sur une
 * question de maths ou de physique, le modèle doit s'appuyer sur ce que
 * TaekdHub lui fournit plutôt que sur sa connaissance générale, qui n'a pas
 * été écrite pour le programme de MP et se trompe de convention une fois sur
 * deux. Le prompt le lui impose explicitement (voir lib/ai/service.ts).
 */
export interface AIExerciseContext {
  title: string;
  subject: Subject;
  /** Libellé du chapitre, jamais son identifiant : un UUID n'apprend rien au modèle. */
  chapter: string | null;
  statement: string;
  /** Indices RÉDIGÉS PAR LE PROFESSEUR, déjà présents dans la banque — l'échelle IA s'y adosse au lieu de les concurrencer. */
  hints: string[];
  /** `null` quand la fiche n'a pas de corrigé : l'IA doit alors le DIRE, pas en inventer un. */
  correction: string | null;
  difficulty: number;
  /** Palier pédagogique 1–6 de la fiche, ou `null` si non classifié. */
  level: number | null;
  prerequisites: string[];
  pedagogicalGoal: string | null;
}

/**
 * Ce que l'IA sait de L'ÉLÈVE — le strict nécessaire pour calibrer une aide.
 *
 * Aucune donnée nominative, aucun historique brut, aucune séance complète :
 * des agrégats déjà calculés par les moteurs existants. Un élève qui a raté
 * trois fois cet exercice n'a pas besoin du même indice qu'un élève qui
 * l'ouvre pour la première fois — c'est tout ce que ces champs servent à
 * établir.
 */
export interface AILearnerContext {
  /** Fixe pour ce produit — un élève de MP, pas « un utilisateur ». */
  classe: "MP";
  /** Maîtrise déclarée de CETTE fiche, 0–100. */
  exerciseMastery: number;
  /** Maîtrise moyenne du chapitre, 0–100, ou `null` si le chapitre n'est pas renseigné. */
  chapterMastery: number | null;
  attemptsOnExercise: number;
  minutesOnExercise: number;
  /**
   * Résultats déclarés sur les tentatives PRÉCÉDENTES de cet exercice —
   * `null` quand aucune n'a été notée. Jamais 0 : « on ne sait pas » et
   * « il a échoué » sont deux choses différentes (même règle que
   * lib/analytics/outcomes.ts).
   */
  previousResults: { succeeded: number; partial: number; failed: number } | null;
}

export interface AIContext {
  exercise: AIExerciseContext;
  learner: AILearnerContext;
}

/* ══════════════════════════════════════════════════════════════════
   L'ÉCHELLE D'INDICES — le cœur pédagogique
   ══════════════════════════════════════════════════════════════════ */

/**
 * Les six paliers, du plus discret au plus explicite.
 *
 * Le problème que cette échelle attaque est précis : un élève de prépa réussit
 * un exercice proche d'un exercice déjà vu, et bloque sur une situation
 * nouvelle. Donner la solution ne corrige pas ça — ça l'entretient. Chaque
 * palier est donc une QUESTION avant d'être une réponse, et le palier 6
 * n'existe que parce qu'il faut bien une sortie.
 */
export const HINT_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

export const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
  1: "Reformuler la question",
  2: "Identifier la notion",
  3: "La propriété à utiliser",
  4: "La première étape",
  5: "Résolution guidée",
  6: "Solution complète",
};

/** Ce que chaque palier a le droit de dire — repris mot pour mot dans le prompt. */
export const HINT_LEVEL_RULES: Record<HintLevel, string> = {
  1: "Reformule la question dans tes mots, sans aucune piste de résolution. Fais préciser ce qui est demandé et ce qui est donné.",
  2: "Nomme la NOTION du programme en jeu, sans dire quelle propriété appliquer ni comment.",
  3: "Nomme la propriété, le théorème ou la méthode, ET l'hypothèse qui autorise à l'utiliser. Ne l'applique pas.",
  4: "Donne UNIQUEMENT la première étape concrète du raisonnement. Arrête-toi là.",
  5: "Déroule le raisonnement étape par étape, mais laisse les calculs et la conclusion à l'élève.",
  6: "Donne la solution complète.",
};

/* ══════════════════════════════════════════════════════════════════
   LES TÂCHES
   ══════════════════════════════════════════════════════════════════ */

export type AITaskKind = "hint";

export interface AIHintRequest {
  task: "hint";
  level: HintLevel;
  context: AIContext;
  /** Ce que l'élève a écrit ou dit avoir tenté — facultatif, et c'est ce qui rend l'aide adaptative plutôt que générique. */
  studentSaid?: string;
}

export type AIRequest = AIHintRequest;

/* ══════════════════════════════════════════════════════════════════
   LES RÉPONSES
   ══════════════════════════════════════════════════════════════════ */

export type AISourceUsed = "énoncé" | "corrigé" | "indices du professeur" | "connaissance générale";
export type AIConfidence = "élevée" | "moyenne" | "faible";

/**
 * Réponse d'un palier d'indice.
 *
 * `insufficientData` et `confidence` ne sont pas décoratifs : sans corrigé et
 * sans énoncé exploitable, un modèle produit volontiers un indice plausible et
 * faux. Il doit alors pouvoir le DIRE, et l'interface l'affiche tel quel —
 * c'est la même discipline que `Trend.confidence` côté analytique.
 */
export interface AIHintResponse {
  level: HintLevel;
  /** La question socratique — ce que l'élève doit se demander AVANT de lire l'indice. */
  question: string;
  /** L'aide proprement dite, bornée par `HINT_LEVEL_RULES[level]`. */
  hint: string;
  /** Sur quoi le modèle dit s'être appuyé. */
  usedSource: AISourceUsed;
  confidence: AIConfidence;
  /** `true` quand les données fournies ne permettent pas d'aider sûrement — l'interface le montre au lieu de le masquer. */
  insufficientData: boolean;
}

export type AIResponse = AIHintResponse;

/* ══════════════════════════════════════════════════════════════════
   LES ERREURS — une taxonomie, pas un booléen
   ══════════════════════════════════════════════════════════════════ */

export type AIErrorCode =
  /** Aucune clé côté serveur : le Copilot n'est tout simplement pas configuré. */
  | "not-configured"
  /** Le réseau n'a pas répondu, ou le délai est dépassé. */
  | "network"
  /** Le fournisseur a répondu une erreur (quota, authentification, surcharge). */
  | "provider"
  /** La réponse est arrivée mais ne respecte pas le schéma — traitée comme une absence de réponse. */
  | "invalid-response"
  /** La requête elle-même est refusée (contexte trop gros, tâche inconnue). */
  | "bad-request";

export interface AIFailure {
  code: AIErrorCode;
  /** Phrase affichable telle quelle, en français, sans jargon technique. */
  message: string;
}
