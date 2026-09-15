import { describe, expect, it } from "vitest";
import { computeWeeklyReview } from "@/lib/domain/review";
import { computeHabits, computeEstimationAccuracy, describeEstimationBias, estimationAdvice, stalledTasks } from "@/lib/domain/habits";
import { computeAllGoalProgress, computeGoalProgress } from "@/lib/domain/goals";
import { completeTask, scheduleTask } from "@/lib/domain/tasks";
import { at, makeEntry, makeState, makeTask, NOW, slot } from "./fixtures";
import type { Goal } from "@/lib/domain/types";

describe("bilan hebdomadaire", () => {
  it("compare le temps prévu au temps réellement travaillé", () => {
    const task = scheduleTask(makeTask({ title: "TD", estimatedMinutes: 120 }), [slot(0, "18:00", 120)]);
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(90, { taskId: task.id })] });
    const review = computeWeeklyReview(state, NOW, NOW);
    expect(review.plannedMinutes).toBe(120);
    expect(review.workedMinutes).toBe(90);
    expect(review.completionRate).toBe(75);
  });

  it("compte les échéances tenues et manquées", () => {
    // Bilan consulté le JEUDI d'une semaine commencée le lundi : c'est le seul
    // moment où les trois états coexistent réellement.
    const thursday = new Date(at(3, "20:00"));
    const met = completeTask(makeTask({ title: "rendu", dueAt: at(0, "23:59") }), NOW);
    const missed = makeTask({ title: "pas rendu", dueAt: at(1, "23:59") });
    const atRisk = makeTask({ title: "encore ouvert", dueAt: at(5) });
    const review = computeWeeklyReview(makeState({ tasks: [met, missed, atRisk] }), NOW, thursday);
    expect(review.deadlinesMet).toBe(1);
    expect(review.deadlinesMissed).toBe(1);
    expect(review.deadlinesAtRisk).toBe(1);
  });

  it("ventile le temps par matière", () => {
    const state = makeState({
      timeEntries: [makeEntry(120, { subjectId: "maths" }), makeEntry(60, { subjectId: "physique" }), makeEntry(30, { subjectId: "maths" })],
    });
    expect(computeWeeklyReview(state, NOW, NOW).bySubject[0]).toEqual({ subjectId: "maths", minutes: 150 });
  });

  it("ventile le temps par famille de tâche", () => {
    const cours = makeTask({ title: "apprendre", category: "cours-apprendre" });
    const exo = makeTask({ title: "TD", category: "exo-td" });
    const state = makeState({
      tasks: [cours, exo],
      timeEntries: [makeEntry(30, { taskId: cours.id }), makeEntry(120, { taskId: exo.id })],
    });
    const review = computeWeeklyReview(state, NOW, NOW);
    expect(review.byFamily[0]).toMatchObject({ family: "exercices", minutes: 120 });
  });

  it("chiffre chaque constat qu'il énonce", () => {
    const task = scheduleTask(makeTask({ estimatedMinutes: 240 }), [slot(0, "18:00", 240)]);
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(60, { taskId: task.id })] });
    const review = computeWeeklyReview(state, NOW, NOW);
    expect(review.insights[0]).toMatch(/\d+ %/);
  });

  it("propose de planifier moins quand le taux de réalisation est bas", () => {
    const task = scheduleTask(makeTask({ estimatedMinutes: 300 }), [slot(0, "18:00", 240)]);
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(60, { taskId: task.id })] });
    expect(computeWeeklyReview(state, NOW, NOW).suggestions.join(" ")).toMatch(/Planifie/);
  });

  it("signale un jour dont le planning dépasse la capacité", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask(), [slot(0, "18:00", 400)])] });
    const review = computeWeeklyReview(state, NOW, NOW);
    expect(review.insights.join(" ")).toMatch(/dépassait ta capacité/);
    expect(review.suggestions.join(" ")).toMatch(/Allège le lundi/);
  });

  it("signale les matières où rien n'a été travaillé alors qu'il reste du travail", () => {
    const state = makeState({
      tasks: [makeTask({ title: "TD de physique", subjectId: "physique" })],
      timeEntries: [makeEntry(60, { subjectId: "maths" })],
    });
    expect(computeWeeklyReview(state, NOW, NOW).insights.join(" ")).toContain("Physique");
  });

  it("n'attribue jamais à la semaine du travail d'une autre semaine", () => {
    const state = makeState({ timeEntries: [makeEntry(120, { startedAt: at(-9) })] });
    expect(computeWeeklyReview(state, NOW, NOW).workedMinutes).toBe(0);
  });
});

describe("habitudes", () => {
  function withCompleted(count: number, estimated: number, actual: number) {
    const tasks = Array.from({ length: count }, (_, index) =>
      completeTask(makeTask({ title: `T${index}`, subjectId: "physique", estimatedMinutes: estimated }), NOW)
    );
    return makeState({ tasks, timeEntries: tasks.map((task) => makeEntry(actual, { taskId: task.id })) });
  }

  it("ne conclut RIEN sous cinq mesures", () => {
    expect(computeHabits(withCompleted(3, 60, 90)).globalRatio).toBeNull();
    expect(computeEstimationAccuracy(withCompleted(3, 60, 90))[0].ratio).toBeNull();
  });

  it("mesure la sous-estimation une fois l'échantillon suffisant", () => {
    const report = computeHabits(withCompleted(6, 60, 90));
    expect(report.globalRatio).toBe(1.5);
    expect(describeEstimationBias(report)).toContain("sous-estimes");
  });

  it("ignore les tâches terminées sans temps saisi, qui n'apprennent rien", () => {
    const state = makeState({ tasks: [completeTask(makeTask({ estimatedMinutes: 60 }), NOW)] });
    expect(computeEstimationAccuracy(state)).toEqual([]);
  });

  it("classe les tâches les plus reportées", () => {
    const state = makeState({
      tasks: [
        { ...makeTask({ title: "souvent" }), postponedCount: 4 },
        { ...makeTask({ title: "parfois" }), postponedCount: 1 },
      ],
    });
    expect(computeHabits(state).mostPostponed[0]).toMatchObject({ title: "souvent", count: 4 });
  });

  it("montre quelles familles de tâches sont reportées", () => {
    const state = makeState({
      tasks: [
        { ...makeTask({ title: "cours", category: "cours-apprendre" }), postponedCount: 3 },
        { ...makeTask({ title: "td", category: "exo-td" }), postponedCount: 1 },
      ],
    });
    expect(computeHabits(state).postponedFamilies[0]).toEqual({ family: "cours", count: 3 });
  });

  it("répartit le temps travaillé par jour de semaine", () => {
    const state = makeState({ timeEntries: [makeEntry(60, { startedAt: at(0) }), makeEntry(30, { startedAt: at(2) })] });
    const report = computeHabits(state);
    expect(report.byWeekday[0].minutes).toBe(60);
    expect(report.byWeekday[2].minutes).toBe(30);
  });

  it("remonte les tâches oubliées au fond du tiroir", () => {
    const old = { ...makeTask({ title: "oubliée" }), updatedAt: at(-30) };
    expect(stalledTasks(makeState({ tasks: [old, makeTask({ title: "récente" })] }), NOW).map((task) => task.title)).toEqual(["oubliée"]);
  });
});

describe("objectifs", () => {
  const goal: Goal = {
    id: "g1",
    title: "Être à jour en physique",
    status: "active",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };

  it("mesure la progression par tâches terminées", () => {
    const state = makeState({
      goals: [goal],
      tasks: [completeTask(makeTask({ goalId: "g1" }), NOW), makeTask({ goalId: "g1" }), makeTask({ goalId: "g1" })],
    });
    expect(computeGoalProgress(state, goal, NOW).percent).toBe(33);
  });

  it("mesure la progression par temps quand un objectif de temps est fixé", () => {
    const task = makeTask({ goalId: "g1" });
    const state = makeState({
      goals: [{ ...goal, targetMinutes: 300 }],
      tasks: [task],
      timeEntries: [makeEntry(150, { taskId: task.id })],
    });
    expect(computeGoalProgress(state, { ...goal, targetMinutes: 300 }, NOW).percent).toBe(50);
  });

  it("ne compte JAMAIS le temps d'une autre tâche de la même matière", () => {
    const linked = makeTask({ goalId: "g1", subjectId: "physique" });
    const unrelated = makeTask({ subjectId: "physique" });
    const state = makeState({
      goals: [goal],
      tasks: [linked, unrelated],
      timeEntries: [makeEntry(60, { taskId: unrelated.id, subjectId: "physique" })],
    });
    expect(computeGoalProgress(state, goal, NOW).workedMinutes).toBe(0);
  });

  it("signale un objectif en danger : trop de travail pour les jours restants", () => {
    const state = makeState({
      goals: [{ ...goal, targetDate: at(1) }],
      tasks: [makeTask({ goalId: "g1", estimatedMinutes: 600 })],
    });
    expect(computeAllGoalProgress(state, NOW)[0].atRisk).toBe(true);
  });
});

describe("conseil d'estimation", () => {
  function completedTasks(count: number, estimated: number, actual: number, subjectId = "physique") {
    const tasks = Array.from({ length: count }, (_, index) =>
      completeTask(makeTask({ title: `T${index}`, subjectId, estimatedMinutes: estimated }), NOW)
    );
    return makeState({ tasks, timeEntries: tasks.map((task) => makeEntry(actual, { taskId: task.id })) });
  }

  it("ne conseille RIEN tant qu'il n'y a pas assez de mesures", () => {
    const accuracy = computeEstimationAccuracy(completedTasks(3, 60, 90));
    expect(estimationAdvice(accuracy, "physique", 45)).toBeNull();
  });

  it("ne conseille rien pour un écart négligeable", () => {
    const accuracy = computeEstimationAccuracy(completedTasks(6, 60, 65));
    expect(estimationAdvice(accuracy, "physique", 45)).toBeNull();
  });

  it("conseille une durée plus longue quand l'élève sous-estime", () => {
    const accuracy = computeEstimationAccuracy(completedTasks(6, 60, 90));
    const advice = estimationAdvice(accuracy, "physique", 45);
    expect(advice).not.toBeNull();
    expect(advice!.suggestedMinutes).toBe(70); // 45 × 1,5 arrondi à 5 min
    expect(advice!.underestimating).toBe(true);
    expect(advice!.samples).toBe(6);
  });

  it("reste borné même avec un historique extrême", () => {
    const accuracy = computeEstimationAccuracy(completedTasks(6, 10, 300));
    expect(estimationAdvice(accuracy, "physique", 60)!.suggestedMinutes).toBe(95); // 60 × 1,6 plafonné
  });

  it("ne conseille que sur la matière mesurée", () => {
    const accuracy = computeEstimationAccuracy(completedTasks(6, 60, 90, "physique"));
    expect(estimationAdvice(accuracy, "maths", 45)).toBeNull();
  });
});
