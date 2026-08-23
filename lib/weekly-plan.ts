import { dayKey, subjects, totalSeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { weekDayRefs, weeklyTimeBySubject } from "@/lib/week";
import type { WeeklyPlan, WeeklyPlanDay } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Plan de travail hebdomadaire (Sprint Study OS Phase 4 — "planification
 * hebdomadaire") — module purement fonctionnel, comme `lib/chapters.ts` et
 * `lib/work-queue.ts` : le type `WeeklyPlan` et sa persistance vivent dans
 * `lib/storage.ts`, ce fichier ne fait que le manipuler et le comparer au
 * temps réellement travaillé (`WorkSession`, jamais modifié ni recalculé
 * ici — voir la doc de `WeeklyPlanDay` dans lib/storage.ts).
 *
 * Volontairement SANS créneau horaire : une intention "Lundi Maths 1h30",
 * jamais "Lundi 08:30-10:00 Maths" — voir le refus explicite du calendrier
 * horaire dans le brief de cette phase.
 */

export function emptyWeeklyPlan(): WeeklyPlan {
  return Array.from({ length: 7 }, (_, day) => ({ day, subjectMinutes: {} }));
}

function dayEntry(plan: WeeklyPlan, day: number): WeeklyPlanDay {
  return plan.find((entry) => entry.day === day) ?? { day, subjectMinutes: {} };
}

/** Minutes planifiées, toutes matières confondues, pour un jour donné (0 = lundi … 6 = dimanche). */
export function plannedMinutesForDay(plan: WeeklyPlan, day: number): number {
  const entry = dayEntry(plan, day);
  return subjects.reduce((sum, subject) => sum + (entry.subjectMinutes[subject] ?? 0), 0);
}

/** Minutes planifiées PAR MATIÈRE pour un jour donné — même source que `plannedMinutesForDay` (qui, lui, ne garde que la somme), pour Day Flow (lib/day-flow.ts), seul consommateur qui a besoin du détail par matière d'une seule journée plutôt que du cumul de la semaine (`plannedMinutesSoFarBySubject`). */
export function subjectMinutesForDay(plan: WeeklyPlan, day: number): Partial<Record<Subject, number>> {
  const entry = dayEntry(plan, day);
  const result: Partial<Record<Subject, number>> = {};
  for (const subject of subjects) {
    const minutes = entry.subjectMinutes[subject];
    if (minutes) result[subject] = minutes;
  }
  return result;
}

/**
 * Met à jour une seule cellule (jour × matière) du plan — pure, utilisée par
 * l'éditeur de réglages. `minutes <= 0` retire la clé plutôt que de la garder
 * à 0 (même convention que `setDailySubjectGoal`/`setSubjectDeadline` dans
 * `components/preferences-form.tsx`).
 */
export function setDayCellMinutes(plan: WeeklyPlan, day: number, subject: Subject, minutes: number): WeeklyPlan {
  const next = plan.some((entry) => entry.day === day) ? plan : [...plan, { day, subjectMinutes: {} }];
  return next
    .map((entry) => {
      if (entry.day !== day) return entry;
      const subjectMinutes = { ...entry.subjectMinutes };
      if (minutes > 0) subjectMinutes[subject] = Math.round(minutes);
      else delete subjectMinutes[subject];
      return { ...entry, subjectMinutes };
    })
    .sort((a, b) => a.day - b.day);
}

/** Vrai dès qu'au moins une minute est planifiée quelque part — sert à garder la planification entièrement facultative (aucune carte/section affichée tant que rien n'est configuré). */
export function hasAnyPlannedMinutes(plan: WeeklyPlan): boolean {
  return plan.some((entry) => Object.values(entry.subjectMinutes).some((minutes) => (minutes ?? 0) > 0));
}

export interface WeeklyPlanRow {
  dayKey: string;
  label: string;
  day: number;
  plannedMinutes: number;
  workedMinutes: number;
  isToday: boolean;
  isFuture: boolean;
  /**
   * "atteint" : réalisé ≥ prévu. "en cours" : prévu > 0, pas encore atteint,
   * jour passé ou aujourd'hui — jamais un jugement négatif définitif tant que
   * le jour n'est pas terminé. "sans plan" : rien de prévu ce jour-là (état
   * neutre, pas un manquement). "à venir" : jour futur, jamais évalué (voir
   * le brief : "ne pas afficher de jugement négatif sur les jours futurs").
   */
  state: "atteint" | "en cours" | "sans plan" | "à venir";
}

/**
 * "Ma semaine" (Dashboard) — prévu vs réalisé, jour par jour. Réutilise
 * `weekDayRefs` (lib/week.ts, même brique que `computeWeeklyDayBars`) pour le
 * découpage en 7 jours : aucune deuxième définition de "quel jour est
 * aujourd'hui/futur". Le réalisé est calculé directement sur `sessions`,
 * jamais dérivé de `computeWeeklyDayBars` (qui compare à un objectif
 * quotidien FLAT, pas au plan potentiellement différent par jour).
 */
export function computeWeeklyPlanRows(plan: WeeklyPlan, sessions: WorkSession[], now: Date = new Date()): WeeklyPlanRow[] {
  return weekDayRefs(now).map((ref) => {
    const plannedMinutes = plannedMinutesForDay(plan, ref.index);
    const workedMinutes = secondsToWholeMinutes(totalSeconds(sessions.filter((session) => dayKey(session.started_at) === ref.dayKey)));
    let state: WeeklyPlanRow["state"];
    if (ref.isFuture) state = "à venir";
    else if (plannedMinutes === 0) state = "sans plan";
    else if (workedMinutes >= plannedMinutes) state = "atteint";
    else state = "en cours";
    return { dayKey: ref.dayKey, label: ref.label, day: ref.index, plannedMinutes, workedMinutes, isToday: ref.isToday, isFuture: ref.isFuture, state };
  });
}

/**
 * Minutes prévues, par matière, cumulées de lundi jusqu'à AUJOURD'HUI INCLUS
 * (le jour courant compte comme "déjà dû" — cohérent avec une consultation en
 * milieu de journée, voir `planGapMinutesBySubject` qui compare ce total au
 * temps réellement travaillé). Alimente le signal de priorité de
 * `lib/plan.ts#subjectWeight` et `lib/recommendation.ts`.
 */
export function plannedMinutesSoFarBySubject(plan: WeeklyPlan, now: Date = new Date()): Partial<Record<Subject, number>> {
  const todayIndex = weekDayRefs(now).find((ref) => ref.isToday)?.index ?? 6;
  const result: Partial<Record<Subject, number>> = {};
  for (let day = 0; day <= todayIndex; day++) {
    const entry = dayEntry(plan, day);
    for (const subject of subjects) {
      const minutes = entry.subjectMinutes[subject];
      if (minutes) result[subject] = (result[subject] ?? 0) + minutes;
    }
  }
  return result;
}

/**
 * Retard (minutes) par matière par rapport à ce que le plan prévoyait à ce
 * stade de la semaine — 0 si rien de prévu pour cette matière, ou si le
 * travail réel a déjà rattrapé/dépassé la prévision (jamais un "avance"
 * négatif : ce signal n'existe que pour signaler un retard, pas pour
 * récompenser une avance). Consommé par `lib/plan.ts`/`lib/recommendation.ts`,
 * chacun appliquant sa propre échelle de bonus à ce nombre brut — voir leur
 * doc respective pour éviter de compter ce retard deux fois de la même façon.
 */
export function planGapMinutesBySubject(plan: WeeklyPlan, sessions: WorkSession[], now: Date = new Date()): Partial<Record<Subject, number>> {
  const planned = plannedMinutesSoFarBySubject(plan, now);
  const worked = weeklyTimeBySubject(sessions, now);
  const result: Partial<Record<Subject, number>> = {};
  for (const subject of subjects) {
    const plannedMinutes = planned[subject] ?? 0;
    if (plannedMinutes <= 0) continue;
    const workedMinutes = secondsToWholeMinutes(worked.find((entry) => entry.subject === subject)?.seconds ?? 0);
    const gap = plannedMinutes - workedMinutes;
    if (gap > 0) result[subject] = gap;
  }
  return result;
}
