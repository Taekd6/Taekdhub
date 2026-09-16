import { MAX_CONTEXT_CHARS, MAX_STUDENT_TEXT_CHARS } from "@/lib/ai/context";
import { HINT_LEVELS, type AIHintRequest, type HintLevel } from "@/lib/ai/types";

/**
 * VALIDATION DE LA REQUÊTE, côté serveur.
 *
 * Le contexte est construit dans le navigateur (lib/ai/context.ts), donc il
 * arrive ici comme une entrée NON FIABLE — au même titre qu'un fichier de
 * sauvegarde importé. Un client modifié, un bug, un onglet resté ouvert sur
 * une ancienne version : la route ne doit rien supposer.
 *
 * Deux dangers distincts, et deux réponses :
 *   — une requête MALFORMÉE, qu'on refuse sans appeler le fournisseur ;
 *   — une requête ÉNORME, qu'on refuse pour la même raison, mais celle-là
 *     coûterait de l'argent réel. La borne de taille est ici, pas seulement
 *     côté client, sinon elle ne protège rien.
 *
 * Fonction pure : testable sans serveur.
 */

export type GuardResult = { ok: true; request: AIHintRequest } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function guardHintRequest(raw: unknown): GuardResult {
  if (!isRecord(raw)) return { ok: false, message: "Requête illisible." };
  if (raw.task !== "hint") return { ok: false, message: "Tâche inconnue." };

  const level = raw.level;
  if (typeof level !== "number" || !(HINT_LEVELS as readonly number[]).includes(level)) {
    return { ok: false, message: "Palier d'indice invalide." };
  }

  const context = raw.context;
  if (!isRecord(context)) return { ok: false, message: "Contexte manquant." };

  const exercise = context.exercise;
  const learner = context.learner;
  if (!isRecord(exercise) || !isRecord(learner)) return { ok: false, message: "Contexte incomplet." };

  // Forme MINIMALE — on vérifie ce dont le prompt a besoin pour ne pas
  // produire de phrases trouées, pas chaque champ du modèle. Le reste est
  // toléré : un client plus ancien reste compatible.
  if (typeof exercise.title !== "string" || typeof exercise.subject !== "string") {
    return { ok: false, message: "Exercice incomplet." };
  }
  if (typeof exercise.statement !== "string") return { ok: false, message: "Énoncé manquant." };
  if (!isStringArray(exercise.hints)) return { ok: false, message: "Indices illisibles." };
  if (exercise.correction !== null && typeof exercise.correction !== "string") {
    return { ok: false, message: "Corrigé illisible." };
  }

  if (raw.studentSaid !== undefined) {
    if (typeof raw.studentSaid !== "string") return { ok: false, message: "Saisie illisible." };
    if (raw.studentSaid.length > MAX_STUDENT_TEXT_CHARS * 2) return { ok: false, message: "Saisie trop longue." };
  }

  // La borne de COÛT, appliquée sur ce qui est réellement arrivé.
  if (JSON.stringify(context).length > MAX_CONTEXT_CHARS) {
    return { ok: false, message: "Contexte trop volumineux pour être envoyé au Copilot." };
  }

  return { ok: true, request: raw as unknown as AIHintRequest };
}

/** Exporté pour les tests : le palier est un entier de 1 à 6, jamais autre chose. */
export function isHintLevel(value: unknown): value is HintLevel {
  return typeof value === "number" && (HINT_LEVELS as readonly number[]).includes(value);
}
