import { capacityMinutes, rangesForDay } from "@/lib/domain/availability";
import { categoryLabel } from "@/lib/domain/categories";
import { dayKey, dayKeyRange, daysBetween, startOfWeek } from "@/lib/domain/date";
import { computeAllGoalProgress } from "@/lib/domain/goals";
import { computeHabits, describeEstimationBias } from "@/lib/domain/habits";
import { computeNextAction, rankOpenTasks } from "@/lib/domain/priority";
import { computeWeeklyReview } from "@/lib/domain/review";
import { actualMinutesByTask, isOpen, isOverdue, remainingMinutes } from "@/lib/domain/tasks";
import { computeFeasibility, computeWorkload } from "@/lib/domain/workload";
import type { AppState } from "@/lib/domain/types";

/**
 * ============================================================================
 * INTERFACE AGENT — donner à une IA des DONNÉES, pas de la prose.
 * ============================================================================
 *
 * Le piège de « brancher une IA » sur un outil d'organisation est connu : on
 * lui envoie une description en langage naturel, elle répond une description
 * en langage naturel, et rien n'est vérifiable. Ici, un agent reçoit un
 * INSTANTANÉ STRUCTURÉ : les mêmes chiffres que ceux affichés à l'écran,
 * produits par les mêmes moteurs (`domain/*`), avec leurs unités et leurs
 * définitions.
 *
 * Trois propriétés tenues volontairement :
 *
 *   1. AUCUN CALCUL PROPRE À L'AGENT. Charge, retard, faisabilité, bilan :
 *      tout vient de `domain/`. Une IA qui recalculerait la charge à sa façon
 *      donnerait un chiffre différent de l'écran — et l'élève ne saurait plus
 *      lequel croire.
 *   2. AUCUNE DONNÉE SUPERFLUE. Les descriptions longues, les notes
 *      personnelles et les liens ne partent pas : ils n'aident pas à
 *      raisonner sur un planning, et ce sont les champs les plus intimes.
 *   3. AUTO-DESCRIPTIF. `schema` explique chaque unité et chaque convention
 *      dans le document lui-même : l'agent n'a pas à deviner si `minutes`
 *      veut dire « estimées » ou « restantes ».
 */

export const SNAPSHOT_VERSION = 1;

export interface AgentSnapshot {
  schema: Record<string, string>;
  meta: {
    version: number;
    generatedAt: string;
    today: string;
    weekStart: string;
    timezoneOffsetMinutes: number;
  };
  subjects: { id: string; label: string }[];
  capacity: {
    todayMinutes: number;
    next7DaysMinutes: number;
    weeklyPattern: { date: string; minutes: number; ranges: string[] }[];
  };
  workload: {
    days: { date: string; capacityMinutes: number; plannedMinutes: number; status: string; taskCount: number; dueCount: number }[];
    unscheduledMinutes: number;
    unscheduledCount: number;
    overdueCount: number;
    overdueMinutes: number;
    feasible: boolean;
    deficitMinutes: number;
  };
  nextAction: { taskId?: string; title: string; rationale: string; minutes?: number } | null;
  tasks: AgentTask[];
  goals: { id: string; title: string; status: string; percent: number; targetDate?: string; atRisk: boolean; openTasks: number }[];
  week: {
    plannedMinutes: number;
    workedMinutes: number;
    completionRate: number;
    tasksCompleted: number;
    tasksPostponed: number;
    deadlinesMet: number;
    deadlinesMissed: number;
    bySubject: { subject: string; minutes: number }[];
    insights: string[];
  };
  previousWeek: {
    plannedMinutes: number;
    workedMinutes: number;
    completionRate: number;
    deadlinesMissed: number;
  };
  habits: {
    estimationRatio: number | null;
    estimationNote: string | null;
    mostPostponed: { title: string; count: number }[];
    workedMinutesByWeekday: number[];
    weeksObserved: number;
  };
}

export interface AgentTask {
  id: string;
  title: string;
  subject?: string;
  category: string;
  status: string;
  priority: number;
  estimatedMinutes: number;
  remainingMinutes: number;
  workedMinutes: number;
  dueAt?: string;
  daysUntilDue?: number;
  overdue: boolean;
  scheduled: { start: string; minutes: number }[];
  postponedCount: number;
  goalId?: string;
  /** Rang dans la priorisation de TaekdHub (1 = à faire maintenant) — présent seulement pour les tâches ouvertes. */
  rank?: number;
  /** Raisons produites par le moteur de priorisation, telles qu'affichées à l'élève. */
  reasons?: string[];
}

const SCHEMA: Record<string, string> = {
  "unités.durées": "Toutes les durées sont en MINUTES entières.",
  "unités.dates": "Dates ISO 8601. Les jours sont en heure locale, format YYYY-MM-DD.",
  "tasks.estimatedMinutes": "Charge estimée par l'élève (ou défaut de la catégorie).",
  "tasks.remainingMinutes": "Travail restant = estimation moins temps déjà passé. 0 si la tâche est terminée.",
  "tasks.dueAt": "Échéance : la tâche doit être FAITE avant cette date. Distinct de `scheduled`.",
  "tasks.scheduled": "Créneaux réellement posés dans le calendrier. Une tâche peut être répartie sur plusieurs séances.",
  "tasks.overdue": "Vrai si l'échéance est dépassée OU si tous les créneaux posés sont dans un jour révolu.",
  "workload.days.status": "empty | ok | tight (au-delà de 90 % de la capacité) | over (dépassement).",
  "workload.feasible": "Vrai si tout le travail à échéance dans les 7 jours tient dans la capacité déclarée.",
  "capacity": "Temps que l'élève a DÉCLARÉ pouvoir travailler. Ce n'est pas du temps libre théorique.",
  "habits.estimationRatio": "Temps réel / temps estimé sur les tâches terminées. 1,3 = sous-estimation de 30 %. null = pas assez de mesures (5 minimum).",
  "principe": "TaekdHub n'héberge aucun contenu pédagogique : les tâches renvoient à des ressources externes (TD, livres, annales).",
};

export function buildSnapshot(state: AppState, now: Date = new Date()): AgentSnapshot {
  const subjectLabels = new Map(state.subjects.map((subject) => [subject.id, subject.label]));
  const workedByTask = actualMinutesByTask(state.timeEntries);
  const ranked = rankOpenTasks(state, now);
  const rankById = new Map(ranked.map((item, index) => [item.task.id, index + 1]));
  const reasonsById = new Map(ranked.map((item) => [item.task.id, item.reasons]));

  const workload = computeWorkload(state, now, 7, now);
  const feasibility = computeFeasibility(state, now, 7, now);
  const week = computeWeeklyReview(state, now, now);
  const previous = computeWeeklyReview(state, new Date(startOfWeek(now).getTime() - 86_400_000), now);
  const habits = computeHabits(state);
  const next = computeNextAction(state, { now });

  // Les tâches terminées il y a plus d'un mois n'aident pas à raisonner sur la
  // semaine qui vient : on garde l'ouvert, et le récemment terminé.
  const tasks = state.tasks
    .filter((task) => isOpen(task) || (task.completedAt && daysBetween(task.completedAt, now) <= 30))
    .map<AgentTask>((task) => ({
      id: task.id,
      title: task.title,
      subject: task.subjectId ? subjectLabels.get(task.subjectId) : undefined,
      category: categoryLabel(task.category),
      status: task.status,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes ?? 0,
      remainingMinutes: remainingMinutes(task, state.timeEntries),
      workedMinutes: workedByTask.get(task.id) ?? 0,
      dueAt: task.dueAt,
      daysUntilDue: task.dueAt ? daysBetween(now, task.dueAt) : undefined,
      overdue: isOverdue(task, now),
      scheduled: task.slots.map((slot) => ({
        start: slot.start,
        minutes: Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000),
      })),
      postponedCount: task.postponedCount,
      goalId: task.goalId,
      rank: rankById.get(task.id),
      reasons: reasonsById.get(task.id),
    }));

  return {
    schema: SCHEMA,
    meta: {
      version: SNAPSHOT_VERSION,
      generatedAt: now.toISOString(),
      today: dayKey(now),
      weekStart: dayKey(startOfWeek(now)),
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
    },
    subjects: state.subjects.filter((subject) => !subject.archived).map((subject) => ({ id: subject.id, label: subject.label })),
    capacity: {
      todayMinutes: capacityMinutes(state.availability, now),
      next7DaysMinutes: workload.totalCapacityMinutes,
      weeklyPattern: dayKeyRange(now, 7).map((key) => ({
        date: key,
        minutes: capacityMinutes(state.availability, key),
        ranges: rangesForDay(state.availability, key).map((range) => `${range.start}-${range.end}`),
      })),
    },
    workload: {
      days: workload.days.map((day) => ({
        date: day.date,
        capacityMinutes: day.capacityMinutes,
        plannedMinutes: day.plannedMinutes,
        status: day.status,
        taskCount: day.taskCount,
        dueCount: day.dueCount,
      })),
      unscheduledMinutes: workload.unscheduledMinutes,
      unscheduledCount: workload.unscheduledCount,
      overdueCount: workload.overdueCount,
      overdueMinutes: workload.overdueMinutes,
      feasible: feasibility.feasible,
      deficitMinutes: feasibility.deficitMinutes,
    },
    nextAction: next.scored
      ? { taskId: next.scored.task.id, title: next.title, rationale: next.rationale, minutes: next.scored.minutes }
      : { title: next.title, rationale: next.rationale },
    tasks,
    goals: computeAllGoalProgress(state, now).map((progress) => ({
      id: progress.goal.id,
      title: progress.goal.title,
      status: progress.goal.status,
      percent: progress.percent,
      targetDate: progress.goal.targetDate,
      atRisk: progress.atRisk,
      openTasks: progress.openTasks,
    })),
    week: {
      plannedMinutes: week.plannedMinutes,
      workedMinutes: week.workedMinutes,
      completionRate: week.completionRate,
      tasksCompleted: week.tasksCompleted,
      tasksPostponed: week.tasksPostponed,
      deadlinesMet: week.deadlinesMet,
      deadlinesMissed: week.deadlinesMissed,
      bySubject: week.bySubject.map((item) => ({
        subject: item.subjectId ? (subjectLabels.get(item.subjectId) ?? "Sans matière") : "Sans matière",
        minutes: item.minutes,
      })),
      insights: week.insights,
    },
    previousWeek: {
      plannedMinutes: previous.plannedMinutes,
      workedMinutes: previous.workedMinutes,
      completionRate: previous.completionRate,
      deadlinesMissed: previous.deadlinesMissed,
    },
    habits: {
      estimationRatio: habits.globalRatio,
      estimationNote: describeEstimationBias(habits),
      mostPostponed: habits.mostPostponed.map((item) => ({ title: item.title, count: item.count })),
      workedMinutesByWeekday: habits.byWeekday.map((item) => item.minutes),
      weeksObserved: habits.weeksObserved,
    },
  };
}

/** Les questions que l'élève pose réellement — proposées telles quelles dans l'interface. */
export const AGENT_QUESTIONS = [
  "Est-ce que mon organisation de cette semaine est bonne ?",
  "Est-ce que je suis en retard ?",
  "Qu'est-ce que je dois prioriser ?",
  "Est-ce que je peux me permettre une soirée plus légère ?",
  "Pourquoi je n'arrive pas à finir mes tâches ?",
  "Prépare-moi demain.",
  "Analyse ma semaine.",
] as const;
