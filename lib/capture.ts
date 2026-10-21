import { ATTEMPT_HELPS, ATTEMPT_RESULTS, normalizeAttempt, type AttemptHelp, type AttemptResult, type ExerciseAttempt } from "@/lib/attempts";
import { createQuickLogSession, QUICK_LOG_MAX_MINUTES, sanitizeMinutes, type QuickLogDay } from "@/lib/quick-log";
import { subjects, dayKey } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * CAPTURE RAPIDE — noter une séance ou un exercice depuis la montre.
 *
 * Un raccourci Apple (app Raccourcis, sur l'iPhone et l'Apple Watch) envoie
 * UNE requête courte à `POST /api/capture`. Ce module décide de ce qui est
 * acceptable et construit la donnée ; il est pur (ni réseau, ni base).
 *
 * ÉCRITURE SEULE ET LISTES FERMÉES. La requête ne peut que AJOUTER une séance
 * ou une tentative, jamais lire, modifier ni supprimer. Aucun texte libre :
 * la matière, le résultat et l'aide viennent de listes fermées, les durées
 * sont bornées. Un jeton qui fuirait permettrait d'ajouter des lignes
 * parasites, jamais de lire les données de l'élève ; et une ligne ajoutée à
 * tort se supprime dans l'application.
 *
 * IDEMPOTENCE. Un raccourci peut renvoyer la même requête (réseau coupé,
 * relance). Avec un `id` de requête, la même saisie n'est enregistrée
 * qu'une fois.
 */

export type CaptureInput =
  | { type: "seance"; subject: Subject; minutes: number; day: QuickLogDay; requestId: string | null }
  | { type: "exercice"; subject: Subject; result: AttemptResult; help: AttemptHelp; minutes: number | null; requestId: string | null };

export type CaptureParse = { ok: true; input: CaptureInput } | { ok: false; error: string };

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SESSION_ID_PREFIX = "capture-";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Le nom des champs est en français : c'est ce que l'élève écrit dans son raccourci. */
export function parseCapture(body: unknown): CaptureParse {
  if (!isRecord(body)) return { ok: false, error: "Requête illisible." };
  const subject = (subjects as string[]).includes(body.matiere as string) ? (body.matiere as Subject) : null;
  if (!subject) return { ok: false, error: `matiere inconnue. Valeurs : ${subjects.join(", ")}.` };

  let requestId: string | null = null;
  if (body.id !== undefined) {
    if (typeof body.id !== "string" || !REQUEST_ID.test(body.id)) return { ok: false, error: "id invalide (8 à 64 caractères : lettres, chiffres, - et _)." };
    requestId = body.id;
  }

  if (body.type === "seance") {
    const minutes = typeof body.minutes === "number" ? sanitizeMinutes(body.minutes) : null;
    if (minutes === null) return { ok: false, error: `minutes invalide (entier de 1 à ${QUICK_LOG_MAX_MINUTES}).` };
    const day = body.jour === undefined ? "aujourd'hui" : body.jour;
    if (day !== "aujourd'hui" && day !== "hier") return { ok: false, error: "jour : « aujourd'hui » ou « hier »." };
    return { ok: true, input: { type: "seance", subject, minutes, day, requestId } };
  }

  if (body.type === "exercice") {
    if (!(ATTEMPT_RESULTS as readonly unknown[]).includes(body.resultat)) return { ok: false, error: `resultat inconnu. Valeurs : ${ATTEMPT_RESULTS.join(", ")}.` };
    const help = body.aide === undefined ? "sans" : body.aide;
    if (!(ATTEMPT_HELPS as readonly unknown[]).includes(help)) return { ok: false, error: `aide inconnue. Valeurs : ${ATTEMPT_HELPS.join(", ")}.` };
    let minutes: number | null = null;
    if (body.minutes !== undefined) {
      minutes = typeof body.minutes === "number" ? sanitizeMinutes(body.minutes) : null;
      if (minutes === null) return { ok: false, error: `minutes invalide (entier de 1 à ${QUICK_LOG_MAX_MINUTES}).` };
    }
    return { ok: true, input: { type: "exercice", subject, result: body.resultat as AttemptResult, help: help as AttemptHelp, minutes, requestId } };
  }

  return { ok: false, error: "type : « seance » ou « exercice »." };
}

/** Le jour de l'élève (fuseau du processus) — la même notion que `dayKey` ailleurs. */
export function captureSession(input: Extract<CaptureInput, { type: "seance" }>, now: Date): WorkSession | null {
  const session = createQuickLogSession({ subject: input.subject, minutes: input.minutes, day: input.day }, now);
  if (!session) return null;
  return input.requestId ? { ...session, id: `${SESSION_ID_PREFIX}${input.requestId}` } : session;
}

export function captureAttempt(input: Extract<CaptureInput, { type: "exercice" }>, now: Date): ExerciseAttempt | null {
  const key = input.requestId ?? crypto.randomUUID();
  return normalizeAttempt({
    id: `capture-${key}`,
    exerciseKey: `capture:${key}`,
    label: "Exercice noté depuis la montre",
    subject: input.subject,
    origin: "exercice",
    day: dayKey(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    result: input.result,
    help: input.help,
    minutes: input.minutes,
  });
}

/**
 * Ajoute `item` à la liste brute de la collection, sauf si un élément de même
 * `id` s'y trouve déjà (relance du raccourci). Les éléments existants sont
 * conservés TELS QUELS : on n'en reformate aucun.
 */
export function appendOnce(current: unknown, item: { id: string }): { items: unknown[]; duplicate: boolean } {
  const list = Array.isArray(current) ? current : [];
  if (list.some((entry) => isRecord(entry) && entry.id === item.id)) return { items: list, duplicate: true };
  return { items: [...list, item], duplicate: false };
}
