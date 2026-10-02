import { isCleanSuccess, type BlockAnalysis, type ExerciseAttempt } from "@/lib/attempts";
import type { Exercise } from "@/lib/exercises";
import { createReviewItem, REVIEW_ANSWER_MAX, REVIEW_TEXT_MAX } from "@/lib/review-items";
import type { ReviewItem } from "@/lib/storage";

/**
 * VÉRIFIER LE TRANSFERT — « ai-je compris la méthode, ou appris la
 * correction par cœur ? »
 *
 * Réussir sans aide, quelques jours plus tard, l'exercice qu'on avait raté
 * prouve qu'on sait le REFAIRE. Pas qu'on sait le TRANSPOSER : on peut avoir
 * retenu la correction. D'où une seconde vérification, sur un énoncé
 * DIFFÉRENT qui demande la même méthode.
 *
 * RÈGLES :
 *   1. Un exercice raté puis réussi sans aide (statut « vérifié »,
 *      lib/exercises.ts) appelle un exercice de transfert,
 *      `TRANSFER_DELAY_DAYS` jours après la réussite.
 *   2. Un essai de transfert est une tentative ordinaire sur un AUTRE
 *      exercice, marquée `transferOf` = l'exercice d'origine.
 *   3. Transfert réussi sans aide ⇒ méthode ACQUISE. Raté ⇒ un nouveau
 *      transfert, aux délais des nouvelles tentatives (Réglages).
 *   4. Un exercice de transfert raté n'est pas reproposé tel quel dans
 *      « À refaire » : c'est la méthode qu'on vérifie, avec un autre énoncé.
 *
 * Aucune donnée nouvelle : tout est dérivé des tentatives (collection
 * `attempts`). La fiche de méthode, elle, va dans le carnet « À revoir »
 * existant (cartouche de méthode).
 *
 * Fonctions pures.
 */

export const TRANSFER_DELAY_DAYS = 7;
export const TRANSFER_KEY_PREFIX = "transfert:";

export type TransferStatus = "à-faire" | "programmé" | "acquis";

export interface TransferCheck {
  /** L'exercice d'origine. */
  exercise: Exercise;
  status: TransferStatus;
  /** Jour où le transfert est attendu (à-faire, programmé). */
  dueDay: string | null;
  /** Essais de transfert, du plus ancien au plus récent. */
  attempts: ExerciseAttempt[];
  /** L'analyse du blocage la plus récente de l'exercice, s'il y en a une — la méthode à transférer. */
  analysis: BlockAnalysis | null;
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + days, 12).toLocaleDateString("en-CA");
}

export function isTransferKey(key: string): boolean {
  return key.startsWith(TRANSFER_KEY_PREFIX);
}

export function transferChecks(exercises: Exercise[], attempts: ExerciseAttempt[], retryDelaysDays: number[], today: string): TransferCheck[] {
  const delays = retryDelaysDays.length > 0 ? retryDelaysDays : [2, 5, 12];
  const out: TransferCheck[] = [];
  for (const exercise of exercises) {
    if (exercise.status !== "vérifié" || !exercise.verifiedOn || isTransferKey(exercise.key)) continue;
    const own = attempts.filter((attempt) => attempt.transferOf === exercise.key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const analysis =
      [...attempts]
        .filter((attempt) => attempt.exerciseKey === exercise.key && attempt.analysis)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .pop()?.analysis ?? null;
    const last = own[own.length - 1];
    if (last && isCleanSuccess(last)) {
      out.push({ exercise, status: "acquis", dueDay: null, attempts: own, analysis });
      continue;
    }
    let streak = 0;
    for (let index = own.length - 1; index >= 0 && !isCleanSuccess(own[index]); index -= 1) streak += 1;
    const dueDay = last ? addDays(last.day, delays[Math.min(streak, delays.length) - 1]) : addDays(exercise.verifiedOn, TRANSFER_DELAY_DAYS);
    out.push({ exercise, status: dueDay <= today ? "à-faire" : "programmé", dueDay, attempts: own, analysis });
  }
  return out.sort((a, b) => (a.dueDay ?? "9").localeCompare(b.dueDay ?? "9"));
}

/** L'essai de transfert, sur un énoncé différent : une tentative ordinaire, marquée `transferOf`. */
export function createTransferAttempt(
  origin: Pick<Exercise, "key" | "subject" | "chapterId">,
  input: { label: string; result: ExerciseAttempt["result"]; help: ExerciseAttempt["help"]; minutes: number | null; cause: ExerciseAttempt["cause"]; level?: ExerciseAttempt["level"] | null },
  now: Date
): ExerciseAttempt | null {
  const label = input.label.trim();
  if (!origin.subject || !label) return null;
  const at = now.toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tr-${now.getTime()}`,
    exerciseKey: transferExerciseKey(origin.key, label),
    label: label.slice(0, 160),
    subject: origin.subject,
    chapterId: origin.chapterId,
    origin: "exercice",
    day: now.toLocaleDateString("en-CA"),
    createdAt: at,
    updatedAt: at,
    result: input.result,
    help: input.help,
    minutes: input.minutes !== null && Number.isFinite(input.minutes) && input.minutes > 0 ? Math.round(input.minutes) : null,
    plannedMinutes: null,
    cause: input.result === "réussi" ? null : input.cause,
    lackOfTime: false,
    gradeId: null,
    note: null,
    transferOf: origin.key,
    ...(input.level ? { level: input.level } : {}),
  };
}

/** Clé de l'exercice de transfert : propre à l'énoncé saisi, rattachée à l'exercice d'origine. */
export function transferExerciseKey(originKey: string, label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${TRANSFER_KEY_PREFIX}${originKey}:${slug || "exercice"}`;
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * La fiche de méthode tirée d'une analyse : au recto, ce qu'il faut
 * RECONNAÎTRE ; au verso, le réflexe, et le piège où l'on a déraillé.
 * `null` sans matière à fiche, ou si une fiche ouverte porte déjà ce recto.
 */
export function methodCardFrom(analysis: BlockAnalysis, subject: ExerciseAttempt["subject"], existing: ReviewItem[], now: Date): ReviewItem | null {
  const cue = analysis.cue.trim();
  const tool = analysis.tool.trim();
  if (!cue && !tool) return null;
  const text = clip(cue ? `Quand je vois : ${cue}` : `Méthode : ${tool}`, REVIEW_TEXT_MAX);
  if (existing.some((item) => item.doneAt === null && item.text === text)) return null;
  const answer = clip(
    [tool ? `→ ${tool}` : null, analysis.derailedAt.trim() ? `Piège : ${analysis.derailedAt.trim()}` : null, analysis.missed.trim() ? `À comprendre : ${analysis.missed.trim()}` : null].filter(Boolean).join("\n"),
    REVIEW_ANSWER_MAX
  );
  return createReviewItem({ subject, text, kind: "méthode", ...(answer ? { answer } : {}) }, now);
}
