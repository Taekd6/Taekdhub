import { effectiveSchedule } from "@/lib/spaced-repetition";
import { dayKey } from "@/lib/study";
import type { MoveCandidate } from "@/lib/next-move/engine";
import type { ChapterMemory, NextMoveRecord, ReviewItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * HISTORIQUE NEXT MOVE — ce qui a été proposé, et ce qu'il en est advenu.
 *
 * Trois règles, toutes dans le sens de la modestie :
 *
 *  1. UNE LIGNE PAR PROPOSITION MONTRÉE, pas par rendu : la même
 *     recommandation revue dans l'heure n'en crée pas une deuxième
 *     (`PROPOSAL_DEDUP_HOURS`).
 *  2. L'ISSUE SE CONSTATE, elle ne se devine pas. « Fait » n'est écrit que
 *     sur un clic explicite ou sur une trace réelle : une séance dans la
 *     matière après le démarrage, une carte notée, un rappel de chapitre
 *     enregistré. Sans trace, la ligne reste « commencé ».
 *  3. AUCUNE CAUSALITÉ. Les statistiques (`summarizeHistory`) comptent —
 *     suivies, écartées, matières repoussées — et se taisent sous un
 *     minimum d'échantillons. Elles ne disent jamais « cette action fait
 *     progresser ».
 *
 * Fonctions pures.
 */

/** Au-delà, les plus anciennes lignes sont élaguées : l'historique sert à la tendance récente, pas à l'archive. */
export const HISTORY_MAX = 400;
/** Même proposition revue dans ce délai : pas de nouvelle ligne. */
export const PROPOSAL_DEDUP_HOURS = 3;
/** Fenêtre pendant laquelle une trace (séance, révision) est rattachée à un démarrage. */
export const OUTCOME_WINDOW_HOURS = 6;
/** Part de la durée proposée qu'il faut avoir réellement faite pour parler de « fait ». */
export const OUTCOME_DONE_RATIO = 0.5;
/** Sous ce nombre de propositions sur la période, aucune statistique n'est affichée. */
export const HISTORY_MIN_SAMPLES = 8;
/** Une matière n'est dite « souvent repoussée » qu'à partir de ce compte. */
export const POSTPONED_MIN = 3;

const HOUR = 3_600_000;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `nm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function prune(history: NextMoveRecord[]): NextMoveRecord[] {
  return history.length > HISTORY_MAX ? history.slice(history.length - HISTORY_MAX) : history;
}

/** Dernière ligne portant cette clé, ou `null`. */
export function latestFor(history: NextMoveRecord[], key: string): NextMoveRecord | null {
  for (let index = history.length - 1; index >= 0; index -= 1) if (history[index].key === key) return history[index];
  return null;
}

/**
 * Enregistre qu'une recommandation a été MONTRÉE. Renvoie la même liste
 * (même référence) quand rien ne change — l'appelant peut ainsi éviter une
 * écriture inutile.
 */
export function recordProposal(history: NextMoveRecord[], candidate: MoveCandidate, minutes: number, reasons: string[], now: Date, id: string = newId()): NextMoveRecord[] {
  const last = latestFor(history, candidate.key);
  if (last && last.status !== "écarté" && now.getTime() - new Date(last.proposedAt).getTime() < PROPOSAL_DEDUP_HOURS * HOUR) return history;
  const record: NextMoveRecord = {
    id,
    key: candidate.key,
    kind: candidate.kind,
    subject: candidate.subject,
    title: candidate.title,
    minutes,
    reasons: reasons.slice(0, 4),
    proposedAt: now.toISOString(),
    status: "proposé",
    startedAt: null,
    resolvedAt: null,
    outcomeMinutes: null,
  };
  return prune([...history, record]);
}

function update(history: NextMoveRecord[], key: string, patch: (record: NextMoveRecord) => NextMoveRecord): NextMoveRecord[] {
  const last = latestFor(history, key);
  if (!last) return history;
  return history.map((record) => (record === last ? patch(record) : record));
}

/** « Commencer » — la proposition est créée si elle n'avait pas encore été enregistrée. */
export function markStarted(history: NextMoveRecord[], candidate: MoveCandidate, minutes: number, reasons: string[], now: Date): NextMoveRecord[] {
  const withProposal = recordProposal(history, candidate, minutes, reasons, now);
  return update(withProposal, candidate.key, (record) => ({ ...record, status: "commencé", startedAt: now.toISOString(), minutes }));
}

/** « Pas maintenant ». */
export function markSkipped(history: NextMoveRecord[], candidate: MoveCandidate, minutes: number, reasons: string[], now: Date): NextMoveRecord[] {
  const withProposal = recordProposal(history, candidate, minutes, reasons, now);
  return update(withProposal, candidate.key, (record) => ({ ...record, status: "écarté", resolvedAt: now.toISOString() }));
}

/** « C'est fait » — déclaré par l'élève. */
export function markDone(history: NextMoveRecord[], key: string, now: Date): NextMoveRecord[] {
  return update(history, key, (record) => ({ ...record, status: "fait", resolvedAt: now.toISOString() }));
}

/** La recommandation commencée la plus récente, encore dans sa fenêtre — pour l'afficher au chrono. */
export function activeMove(history: NextMoveRecord[], now: Date): NextMoveRecord | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const record = history[index];
    if (record.status !== "commencé" || !record.startedAt) continue;
    if (now.getTime() - new Date(record.startedAt).getTime() <= OUTCOME_WINDOW_HOURS * HOUR) return record;
    return null;
  }
  return null;
}

interface OutcomeSources {
  sessions: WorkSession[];
  reviewItems: ReviewItem[];
  chapterMemory: ChapterMemory[];
}

/** Minutes faites dans la matière entre le démarrage et la fin de la fenêtre. */
function minutesAfter(sessions: WorkSession[], subject: Subject | null, from: number, to: number): number {
  let seconds = 0;
  for (const session of sessions) {
    if (subject && session.subject !== subject) continue;
    const start = new Date(session.started_at).getTime();
    // Une séance démarrée juste AVANT le clic (chrono lancé puis carte relue) compte aussi.
    if (start < from - 10 * 60_000 || start > to) continue;
    seconds += session.duration_seconds;
  }
  return Math.round(seconds / 60);
}

/**
 * Constate l'issue des recommandations commencées, d'après les traces
 * réelles. Ne touche qu'aux lignes « commencé » ; renvoie la même référence
 * quand rien ne change.
 *
 *   échéance / bloc / erreurs / rappel : du temps dans la matière (et pour
 *     un rappel, le rappel noté dans Mémoire suffit aussi) ;
 *   cartes : au moins une carte de la matière notée depuis le démarrage.
 */
export function resolveOutcomes(history: NextMoveRecord[], sources: OutcomeSources, now: Date): NextMoveRecord[] {
  let changed = false;
  const next = history.map((record) => {
    if (record.status !== "commencé" || !record.startedAt) return record;
    const from = new Date(record.startedAt).getTime();
    const to = Math.min(now.getTime(), from + OUTCOME_WINDOW_HOURS * HOUR);
    const minutes = minutesAfter(sources.sessions, record.subject, from, to);
    const startDay = dayKey(record.startedAt);

    let done = record.minutes > 0 && minutes >= record.minutes * OUTCOME_DONE_RATIO;
    if (!done && record.kind === "cartes") {
      done = sources.reviewItems.some((item) => {
        if (record.subject && item.subject !== record.subject) return false;
        const last = effectiveSchedule(item).lastReviewedAt;
        return last !== null && new Date(last).getTime() >= from;
      });
    }
    if (!done && record.kind === "rappel") {
      const chapterId = record.key.slice("rappel:".length);
      done = sources.chapterMemory.some((chapter) => chapter.id === chapterId && chapter.reviews.some((review) => review.day >= startDay));
    }

    if (!done && minutes === (record.outcomeMinutes ?? 0)) return record;
    changed = true;
    return done
      ? { ...record, status: "fait" as const, resolvedAt: now.toISOString(), outcomeMinutes: minutes }
      : { ...record, outcomeMinutes: minutes };
  });
  return changed ? next : history;
}

export interface HistorySummary {
  /** Propositions sur la période. */
  proposed: number;
  started: number;
  done: number;
  skipped: number;
  /** Part des propositions commencées ou faites — `null` sous `HISTORY_MIN_SAMPLES`. */
  followRate: number | null;
  /** La matière la plus souvent écartée ou laissée sans suite — `null` sous `POSTPONED_MIN`. */
  mostPostponed: { subject: Subject; count: number } | null;
  /** Vrai quand il y a assez de lignes pour dire quelque chose. */
  sufficient: boolean;
}

/** Comptes sur les `days` derniers jours — jamais d'interprétation causale. */
export function summarizeHistory(history: NextMoveRecord[], now: Date, days = 14): HistorySummary {
  const since = now.getTime() - days * 24 * HOUR;
  // Une proposition encore fraîche n'a pas eu le temps d'être suivie : elle n'entre pas dans les comptes.
  const settledBefore = now.getTime() - PROPOSAL_DEDUP_HOURS * HOUR;
  const scope = history.filter((record) => {
    const at = new Date(record.proposedAt).getTime();
    return at >= since && (record.status !== "proposé" || at <= settledBefore);
  });
  const started = scope.filter((record) => record.status === "commencé").length;
  const done = scope.filter((record) => record.status === "fait").length;
  const skipped = scope.filter((record) => record.status === "écarté").length;
  const sufficient = scope.length >= HISTORY_MIN_SAMPLES;

  const postponed = new Map<Subject, number>();
  for (const record of scope) {
    if (!record.subject || (record.status !== "écarté" && record.status !== "proposé")) continue;
    postponed.set(record.subject, (postponed.get(record.subject) ?? 0) + 1);
  }
  const top = [...postponed.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return {
    proposed: scope.length,
    started,
    done,
    skipped,
    followRate: sufficient ? Math.round(((started + done) / scope.length) * 100) : null,
    mostPostponed: sufficient && top && top[1] >= POSTPONED_MIN ? { subject: top[0], count: top[1] } : null,
    sufficient,
  };
}
