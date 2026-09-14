import { isOpen } from "@/lib/domain/tasks";
import { daysBetween } from "@/lib/domain/date";
import type { AppState, Goal, Task } from "@/lib/domain/types";

/**
 * OBJECTIFS — « objectif → tâches → progression ».
 *
 * Un objectif ne se mesure pas tout seul : il est la SOMME de tâches réelles.
 * C'est ce qui empêche l'écueil habituel (« Maîtriser l'algèbre » coché à
 * 60 % parce qu'on l'a décidé) — le pourcentage vient uniquement des tâches
 * rattachées et du temps réellement enregistré.
 */

export interface GoalProgress {
  goal: Goal;
  tasks: Task[];
  totalTasks: number;
  doneTasks: number;
  openTasks: number;
  /** Minutes réellement travaillées sur les tâches de l'objectif (et sur l'objectif directement, via les entrées libres de même matière : non, jamais — voir plus bas). */
  workedMinutes: number;
  /** Minutes restantes estimées sur les tâches ouvertes. */
  remainingMinutes: number;
  /** 0-100. Par tâches, ou par temps si l'objectif porte un `targetMinutes`. */
  percent: number;
  /** Jours avant l'échéance de l'objectif — négatif si dépassée. */
  daysLeft?: number;
  /** `true` quand l'objectif a une date, du travail restant, et plus assez de jours ouvrés pour l'absorber. */
  atRisk: boolean;
}

/**
 * Le temps d'un objectif ne compte QUE les entrées rattachées à ses tâches.
 * Compter aussi le temps libre de la même matière gonflerait la progression
 * avec du travail qui n'a rien à voir — et un objectif dont le pourcentage
 * monte tout seul ne veut plus rien dire.
 */
export function computeGoalProgress(state: AppState, goal: Goal, now: Date = new Date()): GoalProgress {
  const tasks = state.tasks.filter((task) => task.goalId === goal.id);
  const ids = new Set(tasks.map((task) => task.id));
  const workedMinutes = state.timeEntries.reduce(
    (total, entry) => (entry.taskId && ids.has(entry.taskId) ? total + entry.minutes : total),
    0
  );

  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const openTasks = tasks.filter(isOpen).length;
  const remainingMinutes = tasks
    .filter(isOpen)
    .reduce((total, task) => total + Math.max(0, (task.estimatedMinutes ?? 30)), 0);

  const percent = goal.targetMinutes
    ? Math.min(100, Math.round((workedMinutes / goal.targetMinutes) * 100))
    : tasks.length > 0
      ? Math.round((doneTasks / tasks.length) * 100)
      : 0;

  const daysLeft = goal.targetDate ? daysBetween(now, goal.targetDate) : undefined;
  const atRisk =
    goal.status === "active" &&
    daysLeft !== undefined &&
    daysLeft >= 0 &&
    remainingMinutes > 0 &&
    // Approximation assumée et explicable : on suppose qu'on ne consacre pas
    // plus de 2 h par jour à un seul objectif. Au-delà, il est en danger.
    remainingMinutes > (daysLeft + 1) * 120;

  return { goal, tasks, totalTasks: tasks.length, doneTasks, openTasks, workedMinutes, remainingMinutes, percent, daysLeft, atRisk };
}

export function computeAllGoalProgress(state: AppState, now: Date = new Date()): GoalProgress[] {
  return state.goals
    .filter((goal) => goal.status !== "archived")
    .map((goal) => computeGoalProgress(state, goal, now))
    .sort((a, b) => {
      if (a.goal.status !== b.goal.status) return a.goal.status === "active" ? -1 : 1;
      if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
      const aDate = a.goal.targetDate ? new Date(a.goal.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.goal.targetDate ? new Date(b.goal.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
}
