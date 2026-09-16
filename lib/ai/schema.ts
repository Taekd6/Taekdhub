import { HINT_LEVELS, type AIConfidence, type AIHintResponse, type AISourceUsed, type HintLevel } from "@/lib/ai/types";

/**
 * SCHÉMA ET FRONTIÈRE DE CONFIANCE de la couche IA.
 *
 * Deux moitiés du même contrat, volontairement dans le même fichier pour
 * qu'elles ne puissent pas diverger :
 *
 *   — `HINT_RESPONSE_JSON_SCHEMA` contraint le modèle à l'émission
 *     (`output_config.format`, voir lib/ai/providers/anthropic.ts) ;
 *   — `parseHintResponse` revérifie à la réception, sans rien croire.
 *
 * La deuxième n'est PAS redondante. Une sortie structurée peut être tronquée
 * par `max_tokens`, un fournisseur peut être remplacé, une réponse peut
 * arriver d'un cache ou d'un proxy. C'est exactement le rapport
 * qu'entretiennent `validateBackupPayload` et `normalize*` avec un fichier de
 * sauvegarde (lib/storage.ts) : le schéma décrit l'intention, le validateur
 * est la frontière de trust. Rien d'autre que ces fonctions ne doit
 * transformer une réponse brute en objet typé.
 *
 * Aucune dépendance : pas de zod, pas de runtime de validation. Ce sont des
 * fonctions pures, donc testables avec la suite existante (qui n'a pas de DOM).
 */

/** Longueur au-delà de laquelle une réponse cesse d'être un indice et devient un cours — coupée, jamais rejetée. */
export const MAX_FIELD_LENGTH = 1200;

export const HINT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["level", "question", "hint", "usedSource", "confidence", "insufficientData"],
  properties: {
    level: { type: "integer", enum: [...HINT_LEVELS] },
    question: { type: "string", description: "La question que l'élève doit se poser, en français, à la deuxième personne." },
    hint: { type: "string", description: "L'aide au palier demandé, en français. Strictement bornée par la règle du palier." },
    usedSource: { type: "string", enum: ["énoncé", "corrigé", "indices du professeur", "connaissance générale"] },
    confidence: { type: "string", enum: ["élevée", "moyenne", "faible"] },
    insufficientData: { type: "boolean", description: "true si les données fournies ne permettent pas d'aider sûrement." },
  },
} as const;

const SOURCES: AISourceUsed[] = ["énoncé", "corrigé", "indices du professeur", "connaissance générale"];
const CONFIDENCES: AIConfidence[] = ["élevée", "moyenne", "faible"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Une chaîne NON VIDE, débarrassée de ses blancs et bornée — `null` sinon. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LENGTH ? `${trimmed.slice(0, MAX_FIELD_LENGTH)}…` : trimmed;
}

/**
 * Transforme une réponse brute en `AIHintResponse`, ou renvoie `null`.
 *
 * `null` est un résultat NORMAL, pas une exception : l'appelant affiche alors
 * exactement ce qu'il affiche en cas de panne réseau — le Copilot est
 * indisponible, l'exercice continue. Une réponse malformée ne doit jamais
 * atteindre le rendu, et ne doit jamais faire tomber l'application.
 *
 * `expectedLevel` est vérifié : un modèle qui répond au palier 6 quand on lui
 * demande le palier 2 vient de court-circuiter toute la pédagogie de
 * l'échelle. C'est un refus, pas un détail.
 */
export function parseHintResponse(raw: unknown, expectedLevel: HintLevel): AIHintResponse | null {
  if (!isRecord(raw)) return null;

  const level = raw.level;
  if (typeof level !== "number" || !(HINT_LEVELS as readonly number[]).includes(level)) return null;
  if (level !== expectedLevel) return null;

  const question = text(raw.question);
  const hint = text(raw.hint);
  if (!question || !hint) return null;

  const usedSource = SOURCES.includes(raw.usedSource as AISourceUsed) ? (raw.usedSource as AISourceUsed) : null;
  const confidence = CONFIDENCES.includes(raw.confidence as AIConfidence) ? (raw.confidence as AIConfidence) : null;
  if (!usedSource || !confidence) return null;

  if (typeof raw.insufficientData !== "boolean") return null;

  return { level: level as HintLevel, question, hint, usedSource, confidence, insufficientData: raw.insufficientData };
}

/**
 * Le JSON d'une réponse peut arriver sous forme de texte (selon le chemin
 * emprunté par le fournisseur). On tente l'analyse ici plutôt que chez
 * l'appelant, pour que `JSON.parse` ne lève nulle part ailleurs.
 */
export function parseHintPayload(payload: unknown, expectedLevel: HintLevel): AIHintResponse | null {
  if (typeof payload === "string") {
    try {
      return parseHintResponse(JSON.parse(payload), expectedLevel);
    } catch {
      return null;
    }
  }
  return parseHintResponse(payload, expectedLevel);
}
