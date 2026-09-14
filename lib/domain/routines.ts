import { atTime, dayKey, dayKeyRange, dateFromDayKey, weekdayOf } from "@/lib/domain/date";
import { createTask, type NewTaskInput } from "@/lib/domain/tasks";
import type { AppState, Routine, Task } from "@/lib/domain/types";

/**
 * ROUTINES — les tâches qui reviennent (bilan du dimanche, préparation de
 * khôlle, cahier de calcul).
 *
 * Une routine ne s'affiche JAMAIS « en tant que routine » : elle matérialise
 * de vraies `Task`, qui se reportent, se terminent et se comptent comme les
 * autres. Un objet fantôme présent dans la vue mais absent des données
 * fausserait toute mesure de charge — et c'est précisément la mesure de
 * charge qui fait l'intérêt de TaekdHub.
 *
 * Deux garde-fous contre l'« usine à notifications » :
 *   — l'horizon est court (`horizonDays`, 14 jours au plus) ;
 *   — la matérialisation est IDEMPOTENTE : une occurrence déjà créée (même
 *     routine, même jour) n'est jamais recréée, y compris si elle a été
 *     terminée, reportée ou supprimée par l'élève. Une routine ne harcèle
 *     pas.
 */

export const MAX_HORIZON_DAYS = 14;

export function occursOn(routine: Routine, day: Date | string): boolean {
  const date = typeof day === "string" ? dateFromDayKey(day) : day;
  if (routine.rule.kind === "weekly") return routine.rule.weekdays.includes(weekdayOf(date));
  const days = Math.max(1, Math.round(routine.rule.days));
  // Repère stable : le nombre de jours écoulés depuis la création de la
  // routine. Sans repère fixe, « tous les 3 jours » se décalerait à chaque
  // matérialisation.
  const anchor = dateFromDayKey(dayKey(routine.createdAt)).getTime();
  const diff = Math.round((dateFromDayKey(dayKey(date)).getTime() - anchor) / 86_400_000);
  return diff >= 0 && diff % days === 0;
}

/** Heure de départ par défaut d'une occurrence : aucune. La routine crée une tâche à faire ce jour-là, que la planification placera comme les autres. */
export function materializeRoutines(state: AppState, now: Date = new Date()): Task[] {
  const created: Task[] = [];

  for (const routine of state.routines) {
    if (!routine.active) continue;
    const horizon = Math.min(MAX_HORIZON_DAYS, Math.max(1, routine.horizonDays));
    const existing = new Set(
      state.tasks
        .filter((task) => task.routineId === routine.id && task.dueAt)
        .map((task) => dayKey(task.dueAt!))
    );

    for (const key of dayKeyRange(now, horizon)) {
      if (!occursOn(routine, key) || existing.has(key)) continue;
      const input: NewTaskInput = {
        title: routine.title,
        subjectId: routine.subjectId,
        category: routine.category,
        priority: routine.priority,
        estimatedMinutes: routine.estimatedMinutes,
        // L'échéance d'une occurrence est le JOUR, pas une heure : c'est ce qui
        // permet de la replacer librement dans la journée.
        dueAt: atTime(key, "23:59").toISOString(),
        dueDateOnly: true,
        notes: routine.notes,
        routineId: routine.id,
      };
      created.push(createTask(input, now));
      existing.add(key);
    }
  }

  return created;
}

/** Description lisible d'une règle — « Lun, Mer, Ven » ou « tous les 3 jours ». */
export function describeRule(routine: Routine): string {
  if (routine.rule.kind === "everyNDays") {
    const days = Math.max(1, Math.round(routine.rule.days));
    return days === 1 ? "Tous les jours" : `Tous les ${days} jours`;
  }
  const names = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const selected = [...routine.rule.weekdays].sort((a, b) => a - b).map((day) => names[day]);
  if (selected.length === 0) return "Aucun jour";
  if (selected.length === 7) return "Tous les jours";
  return selected.join(", ");
}
