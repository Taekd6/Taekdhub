import { dayKey } from "@/lib/study";
import { startOfWeek } from "@/lib/week";
import type { DayPlanRecord } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * PRÉVU vs RÉALISÉ — « est-ce que je réalise ce que je planifie ? ».
 *
 * Le PRÉVU vient des `DayPlanRecord` (lib/storage.ts), enregistrés la veille
 * du jour concerné. Le RÉALISÉ se somme depuis les séances. Un jour sans
 * enregistrement de plan n'entre PAS dans la comparaison : il est compté à
 * part (`daysWithoutRecord`) et l'interface dit sur combien de jours le
 * pourcentage porte, plutôt que de combler le trou par zéro — ce qui ferait
 * chuter le taux à chaque jour où l'application n'a pas été ouverte.
 *
 * TON DU RÉSULTAT — c'est une contrainte de conception, pas une préférence
 * de rédaction : ce pourcentage mesure la JUSTESSE D'UNE PRÉVISION, pas la
 * valeur de quelqu'un. « 88 % du travail prévu a été réalisé » est un fait
 * sur un planning ; « tu n'as fait que 88 % » est un jugement, et il rendrait
 * l'écran désagréable à ouvrir le dimanche soir — donc inutile. Les
 * formulations produites ici s'en tiennent au premier registre, et un
 * dépassement (plus de 100 %) est traité comme un écart de prévision, pas
 * comme un exploit.
 *
 * Fonctions pures.
 */

export interface PlanVsActualDay {
  /** "AAAA-MM-JJ". */
  key: string;
  start: Date;
  /** `null` quand aucune intention n'avait été enregistrée pour ce jour. */
  plannedMinutes: number | null;
  actualMinutes: number;
}

export interface PlanningAccuracy {
  days: PlanVsActualDay[];
  /** Total prévu sur les seuls jours RÉELLEMENT enregistrés. */
  plannedMinutes: number;
  /** Total réalisé sur ces mêmes jours — la comparaison porte sur le même périmètre. */
  actualMinutes: number;
  /** `null` tant qu'aucun jour n'est comparable, ou si rien n'était prévu. */
  completionPercent: number | null;
  /** Jours de la période effectivement comparables : une intention enregistrée ET NON NULLE. */
  daysCompared: number;
  /** Jours de la période sans intention enregistrée — dits, jamais comptés comme zéro. */
  daysWithoutRecord: number;
  /**
   * Jours où une intention a bien été enregistrée, mais À ZÉRO minute.
   *
   * Comptés à part, et surtout EXCLUS du taux : un jour sans rien de prévu
   * n'a pas de taux de réalisation. Les inclure mettait leurs minutes
   * travaillées au numérateur avec zéro au dénominateur — six jours à
   * 0 prévu suivis d'un jour à 60 min prévues et 1 h faite chaque jour
   * donnaient « 700 % du temps prévu a été réalisé sur 7 jours ».
   */
  daysWithoutPlan: number;
}

/** Au moins trois jours comparables pour qu'un pourcentage de réalisation veuille dire quelque chose. */
export const PLANNING_SOLID_DAYS = 3;

/**
 * Compare intention et réalisation sur les `days` derniers jours, le jour en
 * cours inclus.
 *
 * Le jour en cours est inclus volontairement — c'est celui qu'on regarde le
 * plus — mais son écart est structurellement défavorable tant que la journée
 * n'est pas finie. Les appelants qui veulent un bilan de semaine doivent
 * donc s'arrêter à hier ; `computeWeekPlanVsActual` le fait.
 */
export function computePlanningAccuracy(
  dayPlans: DayPlanRecord[],
  sessions: WorkSession[],
  days: number,
  now: Date = new Date()
): PlanningAccuracy {
  const plannedByDay = new Map(dayPlans.map((record) => [record.date, record.plannedMinutes]));
  const minutesByDay = new Map<string, number>();
  for (const session of sessions) {
    const key = dayKey(session.started_at);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.duration_seconds / 60);
  }

  const list: PlanVsActualDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    list.push({
      key,
      start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      plannedMinutes: plannedByDay.has(key) ? (plannedByDay.get(key) as number) : null,
      actualMinutes: Math.round(minutesByDay.get(key) ?? 0),
    });
  }

  // Une intention À ZÉRO est une intention enregistrée, mais ce n'est pas une
  // prévision comparable — voir `daysWithoutPlan`.
  const comparable = list.filter((day) => day.plannedMinutes !== null && day.plannedMinutes > 0);
  const planned = comparable.reduce((sum, day) => sum + (day.plannedMinutes ?? 0), 0);
  const actual = comparable.reduce((sum, day) => sum + day.actualMinutes, 0);

  return {
    days: list,
    plannedMinutes: planned,
    actualMinutes: actual,
    completionPercent: planned > 0 ? Math.round((actual / planned) * 100) : null,
    daysCompared: comparable.length,
    daysWithoutRecord: list.filter((day) => day.plannedMinutes === null).length,
    daysWithoutPlan: list.filter((day) => day.plannedMinutes === 0).length,
  };
}

/** Bilan de la semaine en cours arrêté à HIER — une journée en cours n'est pas un écart de planification. */
export function computeWeekPlanVsActual(dayPlans: DayPlanRecord[], sessions: WorkSession[], now: Date = new Date()): PlanningAccuracy {
  const daysSinceMonday = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - startOfWeek(now).getTime()) / 86400000);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  // Le lundi, il n'y a aucun jour écoulé de la semaine : la comparaison est vide, et c'est la bonne réponse.
  return computePlanningAccuracy(dayPlans, sessions, Math.max(0, daysSinceMonday), yesterday);
}

/**
 * La phrase du bilan — factuelle, jamais un jugement.
 *
 * `null` quand la comparaison porte sur trop peu de jours : mieux vaut ne
 * rien dire qu'annoncer « 40 % réalisé » sur une seule journée observée.
 */
export function describePlanningAccuracy(accuracy: PlanningAccuracy): string | null {
  if (accuracy.daysCompared < PLANNING_SOLID_DAYS || accuracy.completionPercent === null) return null;
  const { completionPercent: percent, daysCompared } = accuracy;
  if (percent > 110) {
    return `${percent} % du temps prévu a été réalisé sur ${daysCompared} jours — tu fais plus que ce que tu planifies.`;
  }
  return `${percent} % du temps prévu a été réalisé sur ${daysCompared} jours.`;
}
