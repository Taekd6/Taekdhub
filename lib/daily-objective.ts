import { todaySeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * Objectif du jour — « combien ai-je travaillé aujourd'hui, face à ce que je
 * m'étais fixé ? ».
 *
 * Vivait dans lib/next-action.ts, au milieu du moteur qui choisissait des
 * exercices dans l'ancienne banque intégrée. La banque a été retirée (l'élève
 * travaille sur ses propres feuilles) et ce moteur avec elle ; seul ce calcul
 * lui survit, parce qu'il ne dépend que des séances : c'est l'anneau
 * « Ma journée » de l'accueil.
 */
export interface DailyObjective {
  goalMinutes: number;
  workedMinutes: number;
  /** Toujours ≥ 0 — jamais négatif même si l'objectif est dépassé. */
  remainingMinutes: number;
  /** 0-100, plafonné. */
  percent: number;
  met: boolean;
}

/** Progression de l'objectif du jour — source unique pour l'accueil (et pour tout écran qui voudrait la montrer, voir lib/coherence.test.ts). */
export function computeDailyObjective(sessions: WorkSession[], goalMinutes: number, now: Date = new Date()): DailyObjective {
  const workedMinutes = secondsToWholeMinutes(todaySeconds(sessions, now));
  const remainingMinutes = Math.max(0, goalMinutes - workedMinutes);
  return {
    goalMinutes,
    workedMinutes,
    remainingMinutes,
    percent: goalMinutes > 0 ? Math.min(100, Math.round((workedMinutes / goalMinutes) * 100)) : 0,
    met: goalMinutes > 0 && remainingMinutes === 0,
  };
}

/**
 * Phrase d'état de « Ma journée », en une ligne — dérivée de
 * `computeDailyObjective`, jamais recalculée séparément.
 */
export function computeStatusLine(objective: DailyObjective): string {
  if (objective.met) return "Objectif du jour atteint. Belle séance.";
  if (objective.workedMinutes === 0) return "Tu n'as encore rien travaillé aujourd'hui.";
  return `${objective.workedMinutes} min travaillées aujourd'hui · encore ${objective.remainingMinutes} min pour ton objectif.`;
}
