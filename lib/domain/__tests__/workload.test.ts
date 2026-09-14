import { describe, expect, it } from "vitest";
import { computeDayLoad, computeFeasibility, computeWorkload } from "@/lib/domain/workload";
import { dayKey } from "@/lib/domain/date";
import { scheduleTask } from "@/lib/domain/tasks";
import { at, makeEntry, makeState, makeTask, NOW, slot } from "./fixtures";

const today = dayKey(NOW);

describe("charge d'une journée", () => {
  it("une journée sans rien de posé est vide, pas « ok »", () => {
    const load = computeDayLoad(makeState(), today);
    expect(load.status).toBe("empty");
    expect(load.capacityMinutes).toBe(240);
    expect(load.freeMinutes).toBe(240);
  });

  it("additionne les créneaux posés ce jour-là", () => {
    const state = makeState({
      tasks: [scheduleTask(makeTask(), [slot(0, "18:00", 60)]), scheduleTask(makeTask(), [slot(0, "19:30", 90)])],
    });
    const load = computeDayLoad(state, today);
    expect(load.plannedMinutes).toBe(150);
    expect(load.taskCount).toBe(2);
    expect(load.status).toBe("ok");
  });

  it("une tâche répartie ne pèse sur un jour QUE pour le créneau posé ce jour-là", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask({ estimatedMinutes: 180 }), [slot(0, "18:00", 90), slot(1, "18:00", 90)])] });
    expect(computeDayLoad(state, today).plannedMinutes).toBe(90);
    expect(computeDayLoad(state, dayKey(new Date(at(1)))).plannedMinutes).toBe(90);
  });

  it("signale une journée TENDUE avant qu'elle ne déborde", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask(), [slot(0, "18:00", 230)])] });
    expect(computeDayLoad(state, today).status).toBe("tight");
  });

  it("signale un dépassement, avec le nombre de minutes en trop", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask(), [slot(0, "18:00", 300)])] });
    const load = computeDayLoad(state, today);
    expect(load.status).toBe("over");
    expect(load.overflowMinutes).toBe(60);
    expect(load.freeMinutes).toBe(0);
  });

  it("du travail posé un jour sans aucune disponibilité est un dépassement", () => {
    const state = makeState({
      availability: { weekly: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, exceptions: [] },
      tasks: [scheduleTask(makeTask(), [slot(0, "18:00", 60)])],
    });
    expect(computeDayLoad(state, today).status).toBe("over");
  });

  it("ne compte pas les tâches terminées ou abandonnées", () => {
    const done = { ...scheduleTask(makeTask(), [slot(0, "18:00", 60)]), status: "done" as const };
    expect(computeDayLoad(makeState({ tasks: [done] }), today).plannedMinutes).toBe(0);
  });

  it("compte les échéances du jour comme repères, pas comme charge", () => {
    const state = makeState({ tasks: [makeTask({ dueAt: at(0, "23:59") })] });
    const load = computeDayLoad(state, today);
    expect(load.dueCount).toBe(1);
    expect(load.plannedMinutes).toBe(0);
  });
});

describe("fenêtre de charge", () => {
  it("recense le travail ouvert qui n'est posé nulle part", () => {
    const state = makeState({ tasks: [makeTask({ estimatedMinutes: 90, dueAt: at(2) }), makeTask({ estimatedMinutes: 60, dueAt: at(3) })] });
    const window = computeWorkload(state, NOW, 7, NOW);
    expect(window.unscheduledCount).toBe(2);
    expect(window.unscheduledMinutes).toBe(150);
  });

  it("déduit du travail restant le temps déjà passé", () => {
    const task = makeTask({ estimatedMinutes: 120, dueAt: at(2) });
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(45, { taskId: task.id })] });
    expect(computeWorkload(state, NOW, 7, NOW).unscheduledMinutes).toBe(75);
  });

  it("ignore une tâche non posée dont l'échéance est hors fenêtre", () => {
    const state = makeState({ tasks: [makeTask({ estimatedMinutes: 90, dueAt: at(30) })] });
    expect(computeWorkload(state, NOW, 7, NOW).unscheduledCount).toBe(0);
  });

  it("compte les tâches en retard", () => {
    const state = makeState({ tasks: [makeTask({ estimatedMinutes: 60, dueAt: at(-2) })] });
    const window = computeWorkload(state, NOW, 7, NOW);
    expect(window.overdueCount).toBe(1);
    expect(window.overdueMinutes).toBe(60);
  });
});

describe("verdict de faisabilité", () => {
  it("dit oui quand tout le travail de la semaine tient dans la capacité", () => {
    const state = makeState({ tasks: [makeTask({ estimatedMinutes: 120, dueAt: at(3) })] });
    const verdict = computeFeasibility(state, NOW, 7, NOW);
    expect(verdict.feasible).toBe(true);
    expect(verdict.deficitMinutes).toBe(0);
  });

  it("dit non, et chiffre exactement ce qui manque", () => {
    // Capacité de la semaine par défaut : 31 h. On demande 40 h.
    const state = makeState({
      tasks: [makeTask({ estimatedMinutes: 20 * 60, dueAt: at(3) }), makeTask({ estimatedMinutes: 20 * 60, dueAt: at(5) })],
    });
    const verdict = computeFeasibility(state, NOW, 7, NOW);
    expect(verdict.feasible).toBe(false);
    expect(verdict.requiredMinutes).toBe(2400);
    expect(verdict.availableMinutes).toBe(31 * 60);
    expect(verdict.deficitMinutes).toBe(2400 - 31 * 60);
  });

  it("liste les jours en dépassement", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask(), [slot(1, "18:00", 400)])] });
    expect(computeFeasibility(state, NOW, 7, NOW).overloadedDays).toEqual([dayKey(new Date(at(1)))]);
  });
});
