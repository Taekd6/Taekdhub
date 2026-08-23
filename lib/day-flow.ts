import { subjectMinutesForDay } from "@/lib/weekly-plan";
import { subjects, todaySecondsBySubject } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { weekDayRefs } from "@/lib/week";
import type { WeeklyPlan } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Day Flow (Sprint Adaptive Day) — lecture de l'état réel de la journée par
 * rapport au plan hebdomadaire (lib/weekly-plan.ts), matière par matière,
 * pour AUJOURD'HUI uniquement. Complète `computeWeeklyPlanRows` (qui compare
 * prévu/réalisé au grain du JOUR, sur les 7 jours) sans le dupliquer : même
 * règle "réalisé ≥ prévu" (voir sa doc), simplement appliquée par matière sur
 * la seule journée en cours.
 *
 * Aucune nouvelle donnée : compose `weeklyPlan` et `sessions`, déjà
 * persistés. Aucune décision de priorité ici — ce module ne fait
 * QU'OBSERVER l'état, jamais choisir quoi faire (voir lib/next-action.ts,
 * seule source pour "quoi faire maintenant").
 *
 * Distinct de `Preferences.dailySubjectGoals` (carte "Objectif du jour") :
 * deux intentions différentes qui peuvent coexister sans contradiction tant
 * que chacune garde son propre vocabulaire ("programme du jour" ici, jamais
 * "objectif") — voir lib/daily-goals.ts.
 */

export type DayFlowStatus = "terminé" | "en cours" | "à venir";

export interface DayFlowBlock {
  subject: Subject;
  plannedMinutes: number;
  workedMinutes: number;
  status: DayFlowStatus;
}

export interface DayFlow {
  /** Une entrée par matière ayant des minutes prévues aujourd'hui — jamais les 7 matières forcées à l'affichage (même convention que `DailyObjectiveBreakdown.bySubject`). */
  blocks: DayFlowBlock[];
  /** `true` seulement s'il existe au moins un bloc ET que tous sont "terminé" — un jour sans aucun programme n'est jamais "terminé", juste sans avis. */
  allDone: boolean;
}

/** `null` : aucun programme pour aujourd'hui dans le plan hebdomadaire — Day Flow n'a simplement rien à montrer (même repli que "Ma semaine", voir hasAnyPlannedMinutes). */
export function computeDayFlow(plan: WeeklyPlan, sessions: WorkSession[], now: Date = new Date()): DayFlow {
  const todayIndex = weekDayRefs(now).find((ref) => ref.isToday)?.index ?? 6;
  const planned = subjectMinutesForDay(plan, todayIndex);
  const worked = todaySecondsBySubject(sessions, now);

  const blocks: DayFlowBlock[] = subjects
    .filter((subject) => (planned[subject] ?? 0) > 0)
    .map((subject) => {
      const plannedMinutes = planned[subject]!;
      const workedMinutes = secondsToWholeMinutes(worked[subject] ?? 0);
      const status: DayFlowStatus = workedMinutes >= plannedMinutes ? "terminé" : workedMinutes > 0 ? "en cours" : "à venir";
      return { subject, plannedMinutes, workedMinutes, status };
    });

  return { blocks, allDone: blocks.length > 0 && blocks.every((block) => block.status === "terminé") };
}
