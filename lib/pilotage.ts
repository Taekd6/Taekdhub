import type { SubjectTrajectoryStatus } from "@/lib/plan";
import type { Subject } from "@/lib/supabase/types";
import type { WeeklyPace } from "@/lib/week";

/**
 * Phrase de pilotage du Dashboard (Micro-sprint polish UX final) — une seule
 * phrase courte qui explique "où j'en suis cette semaine, pourquoi" à côté du
 * "quoi faire maintenant" déjà affiché par `computeNextAction`. N'introduit
 * AUCUN nouveau signal : compose uniquement des valeurs déjà calculées par
 * `computeWeeklyProjection`/`computeWeeklySummary`/`computeSubjectTrajectory`
 * (lib/plan.ts, lib/week.ts), passées ici en paramètres. Le moteur de
 * pondération (`subjectWeight`) reste l'unique source de vérité : cette
 * fonction ne fait qu'EXPLIQUER, jamais décider — même principe que
 * `computeSubjectTrajectory` (voir sa doc).
 */

export interface PilotageTrajectoryEntry {
  subject: Subject;
  status: SubjectTrajectoryStatus;
  deadlineDays: number | null;
}

export interface PilotagePhraseInput {
  /** `WeeklyProjection.met` — priorité absolue : un objectif déjà atteint rend tout autre signal sans objet. */
  weeklyGoalMet: boolean;
  /** `WeeklySummary.pace` — `null` tant qu'il est trop tôt dans la semaine pour juger (voir lib/week.ts#computeWeeklyPace). */
  weeklyPace: WeeklyPace | null;
  /** `WeeklyProjection.workedMinutes` — sert uniquement à distinguer "rien fait encore" quand `weeklyPace` est `null`. */
  workedMinutes: number;
  /** `computeSubjectTrajectory(weeklyProjection.bySubject, now)` — jamais recalculé ici. */
  trajectoryBySubject: PilotageTrajectoryEntry[];
}

function deadlinePhrase(deadlineDays: number): string {
  if (deadlineDays === 0) return "aujourd'hui";
  if (deadlineDays === 1) return "demain";
  return `dans ${deadlineDays} j`;
}

/**
 * `null` : rien d'assez significatif à dire (ex. tout début de semaine, déjà
 * un peu d'activité mais pas encore de rythme mesurable) — le Dashboard
 * n'affiche alors aucun bloc plutôt qu'une phrase creuse.
 */
export function computePilotagePhrase({ weeklyGoalMet, weeklyPace, workedMinutes, trajectoryBySubject }: PilotagePhraseInput): string | null {
  if (weeklyGoalMet) return "Objectif de la semaine atteint. Bien joué.";

  // La matière la plus urgente (déjà triée par poids décroissant via
  // `weeklyProjection.bySubject`, voir la doc de `computeSubjectTrajectory`)
  // prime sur le rythme global : savoir QUOI prioriser est plus actionnable
  // que "tu es en retard" tout court.
  const priority = trajectoryBySubject.find((entry) => entry.status === "prioritaire");
  if (priority) {
    return priority.deadlineDays !== null
      ? `Concentre-toi sur ${priority.subject} aujourd'hui : ton échéance approche (${deadlinePhrase(priority.deadlineDays)}) et ta trajectoire est en retard.`
      : `Concentre-toi sur ${priority.subject} aujourd'hui : ta trajectoire est en retard cette semaine.`;
  }

  if (weeklyPace === "à travailler") return "Tu es un peu en retard cette semaine sur ton objectif.";
  if (weeklyPace === "dans le rythme" || weeklyPace === "en avance") return "Tu es dans le rythme cette semaine. Continue comme ça.";

  if (workedMinutes === 0) return "Aucune activité cette semaine pour l'instant — lance ta première séance.";

  return null;
}
