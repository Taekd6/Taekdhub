import { describe, expect, it } from "vitest";
import { computeAdaptations, planWork, splitIntoChunks, suggestPostponeOptions, suggestPostponement } from "@/lib/domain/scheduling";
import { dayKey } from "@/lib/domain/date";
import { scheduleTask } from "@/lib/domain/tasks";
import { computeDayLoad, computeFeasibility, computeWorkload } from "@/lib/domain/workload";
import { at, makeEntry, makeState, makeTask, NOW, slot } from "./fixtures";

const today = dayKey(NOW);
const tomorrow = dayKey(new Date(at(1)));

describe("découpage", () => {
  it("laisse une tâche courte d'un seul bloc", () => {
    expect(splitIntoChunks(45)).toEqual([45]);
  });

  it("découpe une longue tâche en séances de taille raisonnable", () => {
    expect(splitIntoChunks(180)).toEqual([90, 90]);
    expect(splitIntoChunks(150)).toEqual([90, 60]);
  });

  it("ne laisse jamais une miette de moins de 20 minutes derrière", () => {
    for (const total of [95, 100, 105, 185, 200, 275]) {
      expect(splitIntoChunks(total).every((chunk) => chunk >= 20)).toBe(true);
      expect(splitIntoChunks(total).reduce((sum, chunk) => sum + chunk, 0)).toBe(total);
    }
  });
});

describe("planification", () => {
  it("pose une tâche au plus tôt dans les créneaux disponibles", () => {
    const state = makeState({ tasks: [makeTask({ title: "TD", estimatedMinutes: 60, dueAt: at(3) })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.assignments).toHaveLength(1);
    expect(dayKey(plan.assignments[0].slots[0].start)).toBe(today);
  });

  it("ne pose JAMAIS de travail après son échéance", () => {
    const state = makeState({ tasks: [makeTask({ title: "DM", estimatedMinutes: 300, dueAt: at(1, "23:59") })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    for (const slotted of plan.assignments.flatMap((assignment) => assignment.slots)) {
      expect(dayKey(slotted.start) <= tomorrow).toBe(true);
    }
  });

  it("répartit une tâche longue sur plusieurs jours plutôt que de forcer une soirée", () => {
    // 5 h de DM pour vendredi, alors que lundi n'offre que 4 h.
    const state = makeState({ tasks: [makeTask({ title: "DM", estimatedMinutes: 300, dueAt: at(4, "23:59") })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    const days = new Set(plan.assignments[0].slots.map((item) => dayKey(item.start)));
    expect(days.size).toBeGreaterThan(1);
    expect(plan.assignments[0].rationale).toContain("Répartie");
  });

  it("ne dépasse jamais la capacité d'une journée", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "A", estimatedMinutes: 180, dueAt: at(2) }),
        makeTask({ title: "B", estimatedMinutes: 180, dueAt: at(2) }),
        makeTask({ title: "C", estimatedMinutes: 180, dueAt: at(2) }),
      ],
    });
    const plan = planWork(state, { now: NOW, days: 7 });
    const planned = makeState({
      ...state,
      tasks: state.tasks.map((task) => {
        const assignment = plan.assignments.find((item) => item.taskId === task.id);
        return assignment ? scheduleTask(task, assignment.slots) : task;
      }),
    });
    for (const day of [today, tomorrow]) {
      const load = computeDayLoad(planned, day);
      expect(load.plannedMinutes).toBeLessThanOrEqual(load.capacityMinutes);
    }
  });

  it("dit ce qui NE RENTRE PAS au lieu de le tasser dans la dernière soirée", () => {
    const state = makeState({ tasks: [makeTask({ title: "impossible", estimatedMinutes: 600, dueAt: at(0, "23:59") })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.assignments[0]?.missingMinutes ?? 0).toBeGreaterThan(0);
    expect(plan.assignments[0].rationale).toContain("sans place");
  });

  it("traite les échéances proches avant le travail de fond", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "fond", estimatedMinutes: 240 }),
        makeTask({ title: "TD pour demain", estimatedMinutes: 60, dueAt: at(1) }),
      ],
    });
    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.assignments[0].taskId).toBe(state.tasks[1].id);
  });

  /**
   * Une ÉVALUATION est un événement imposé, pas du travail à répartir : sa
   * durée est celle de l'épreuve. La planifier réservait quatre heures de
   * soirée intitulées « DS de maths » et gonflait la charge d'autant, alors
   * que le DS a lieu en classe (défaut vu en test navigateur).
   */
  it("ne planifie JAMAIS une évaluation, et ne la compte pas comme travail à caser", () => {
    const ds = makeTask({ title: "DS de maths", category: "eval-ds", estimatedMinutes: 240, dueAt: at(4, "08:00") });
    const prep = makeTask({ title: "Préparer le DS", category: "org-preparation", estimatedMinutes: 90, dueAt: at(3) });
    const state = makeState({ tasks: [ds, prep] });

    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.assignments.map((item) => item.taskId)).toEqual([prep.id]);
    expect(plan.unplaced).toEqual([]);

    const window = computeWorkload(state, NOW, 7, NOW);
    expect(window.unscheduledCount).toBe(1);
    expect(window.unscheduledMinutes).toBe(90);
    expect(computeFeasibility(state, NOW, 7, NOW).requiredMinutes).toBe(90);
  });

  it("ne touche pas aux tâches déjà planifiées", () => {
    const fixed = scheduleTask(makeTask({ title: "déjà posée" }), [slot(0, "18:00", 60)]);
    const state = makeState({ tasks: [fixed, makeTask({ title: "à poser", estimatedMinutes: 60 })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.assignments.map((item) => item.taskId)).toEqual([state.tasks[1].id]);
  });

  it("ne planifie que le travail RESTANT", () => {
    const task = makeTask({ title: "entamée", estimatedMinutes: 120, dueAt: at(2) });
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(90, { taskId: task.id })] });
    expect(planWork(state, { now: NOW, days: 7 }).assignments[0].minutes).toBe(30);
  });
});

describe("report intelligent", () => {
  it("propose un jour qui a RÉELLEMENT la place, pas simplement demain", () => {
    // Demain (mardi) : 3 h, déjà entièrement prises. Mercredi : 5 h libres.
    const busy = scheduleTask(makeTask({ title: "déjà prévu" }), [slot(1, "18:00", 180)]);
    const task = makeTask({ title: "à reporter", estimatedMinutes: 120, dueAt: at(5) });
    const state = makeState({ tasks: [busy, task] });
    const suggestion = suggestPostponement(state, task, NOW);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.day).not.toBe(tomorrow);
  });

  it("avertit quand la journée retenue n'a plus aucune marge", () => {
    const state = makeState({
      availability: { weekly: { 0: [], 1: [{ start: "18:00", end: "20:00" }], 2: [], 3: [], 4: [], 5: [], 6: [] }, exceptions: [] },
    });
    const task = makeTask({ title: "2 h pile", estimatedMinutes: 120 });
    const suggestion = suggestPostponement(makeState({ ...state, tasks: [task] }), task, NOW);
    expect(suggestion!.warning).toContain("pleine");
  });

  it("dit franchement quand plus rien ne tient avant l'échéance", () => {
    const state = makeState({
      availability: { weekly: { 0: [{ start: "18:00", end: "19:00" }], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, exceptions: [] },
    });
    const task = makeTask({ title: "trop gros", estimatedMinutes: 300, dueAt: at(1, "23:59") });
    const suggestion = suggestPostponement(makeState({ ...state, tasks: [task] }), task, NOW);
    expect(suggestion?.warning).toMatch(/avant l'échéance|pleins/);
  });
});

describe("adaptation au réel", () => {
  it("repère les créneaux passés dont la tâche n'est pas faite, et propose une nouvelle place", () => {
    const missed = scheduleTask(makeTask({ title: "pas faite hier", estimatedMinutes: 60 }), [slot(-1, "18:00", 60)]);
    const kept = scheduleTask(makeTask({ title: "à venir" }), [slot(2, "18:00", 60)]);
    const adaptations = computeAdaptations(makeState({ tasks: [missed, kept] }), NOW);
    expect(adaptations.map((item) => item.task.title)).toEqual(["pas faite hier"]);
    expect(adaptations[0].suggestion).not.toBeNull();
  });

  it("compare ce qui était prévu à ce qui a été réellement fait", () => {
    const task = scheduleTask(makeTask({ title: "partiellement faite", estimatedMinutes: 120 }), [slot(-1, "18:00", 120)]);
    const state = makeState({ tasks: [task], timeEntries: [makeEntry(45, { taskId: task.id, startedAt: at(-1, "18:00") })] });
    const [adaptation] = computeAdaptations(state, NOW);
    expect(adaptation.plannedMinutes).toBe(120);
    expect(adaptation.doneMinutes).toBe(45);
  });
});

describe("tâches en retard", () => {
  /**
   * Régression trouvée en test navigateur : une tâche dont l'échéance est
   * passée ressortait « impossible à planifier », parce que la fenêtre
   * utilisable était bornée à une date déjà révolue. C'est exactement la
   * tâche qui a le plus besoin d'un créneau.
   */
  it("planifie une tâche en retard au plus tôt, au lieu de la déclarer impossible", () => {
    const state = makeState({ tasks: [makeTask({ title: "TD en retard", estimatedMinutes: 60, dueAt: at(-2) })] });
    const plan = planWork(state, { now: NOW, days: 7 });
    expect(plan.unplaced).toEqual([]);
    expect(plan.assignments).toHaveLength(1);
    expect(dayKey(plan.assignments[0].slots[0].start)).toBe(today);
  });

  it("propose aussi un report pour une tâche en retard", () => {
    const task = makeTask({ title: "en retard", estimatedMinutes: 60, dueAt: at(-3) });
    const suggestion = suggestPostponement(makeState({ tasks: [task] }), task, NOW);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.warning).toBeUndefined();
  });
});

describe("étalement — un planning humainement crédible", () => {
  /**
   * Le défaut le plus visible de la première version : « au plus tôt » pris au
   * pied de la lettre. Un DM de 3 h à rendre dans trois jours occupait la
   * soirée entière du jour même. Personne ne travaille comme ça, et un
   * planning qu'on sait faux ne se suit pas.
   */
  it("étale une tâche longue sur des jours différents plutôt que de remplir ce soir", () => {
    const state = makeState({ tasks: [makeTask({ title: "DM", estimatedMinutes: 180, dueAt: at(3, "23:59") })] });
    const [assignment] = planWork(state, { now: NOW, days: 7 }).assignments;
    const days = new Set(assignment.slots.map((item) => dayKey(item.start)));
    expect(days.size).toBe(assignment.slots.length);
    expect(assignment.slots.length).toBeGreaterThan(1);
  });

  it("annonce les séances dans l'ordre chronologique", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "A", estimatedMinutes: 200, dueAt: at(3) }),
        makeTask({ title: "B", estimatedMinutes: 200, dueAt: at(3) }),
        makeTask({ title: "C", estimatedMinutes: 150, dueAt: at(3) }),
      ],
    });
    for (const assignment of planWork(state, { now: NOW, days: 7 }).assignments) {
      const starts = assignment.slots.map((item) => new Date(item.start).getTime());
      expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    }
  });

  /**
   * Une journée remplie à 100 % n'a aucune marge : le premier imprévu la fait
   * déborder. Le planificateur s'en tient donc au seuil « tendu » que
   * l'application affiche déjà, tant qu'une échéance ne l'oblige pas à aller
   * au-delà.
   */
  it("laisse une marge sur chaque journée tant qu'une échéance ne l'interdit pas", () => {
    const state = makeState({
      tasks: Array.from({ length: 5 }, (_, index) =>
        makeTask({ title: `T${index}`, estimatedMinutes: 120, dueAt: at(6, "23:59") })
      ),
    });
    const plan = planWork(state, { now: NOW, days: 7 });
    const planned = makeState({
      ...state,
      tasks: state.tasks.map((task) => {
        const assignment = plan.assignments.find((item) => item.taskId === task.id);
        return assignment ? scheduleTask(task, assignment.slots) : task;
      }),
    });
    const monday = computeDayLoad(planned, today);
    expect(monday.plannedMinutes).toBeLessThanOrEqual(Math.round(monday.capacityMinutes * 0.9));
  });

  it("dépasse la marge quand l'échéance l'exige vraiment", () => {
    // 4 h à rendre demain, 4 h disponibles aujourd'hui : la marge doit céder.
    const state = makeState({ tasks: [makeTask({ title: "urgent", estimatedMinutes: 240, dueAt: at(0, "23:59") })] });
    const [assignment] = planWork(state, { now: NOW, days: 7 }).assignments;
    expect(assignment.minutes).toBe(240);
    expect(assignment.slots.every((slot) => dayKey(slot.start) === today)).toBe(true);
  });

  it("replanifie une tâche dont tous les créneaux sont passés — c'est le matin d'après qu'on en a besoin", () => {
    const missed = scheduleTask(makeTask({ title: "pas faite hier", estimatedMinutes: 90, dueAt: at(2) }), [slot(-1, "18:00", 90)]);
    const plan = planWork(makeState({ tasks: [missed] }), { now: NOW, days: 7 });
    expect(plan.assignments.map((item) => item.taskId)).toEqual([missed.id]);
    expect(dayKey(plan.assignments[0].slots[0].start)).toBe(today);
  });

  it("écrit les durées en clair, jamais « 240 min »", () => {
    const state = makeState({ tasks: [makeTask({ title: "énorme", estimatedMinutes: 600, dueAt: at(1, "23:59") })] });
    const [assignment] = planWork(state, { now: NOW, days: 7 }).assignments;
    expect(assignment.rationale).toMatch(/\d+ h/);
    expect(assignment.rationale).not.toMatch(/\d{3,} min/);
  });
});

describe("choix du jour de report", () => {
  it("propose plusieurs jours qui ont réellement la place", () => {
    const options = suggestPostponeOptions(makeState({ tasks: [] }), makeTask({ title: "TD", estimatedMinutes: 60 }), NOW);
    expect(options.length).toBe(3);
    expect(new Set(options.map((option) => option.day)).size).toBe(3);
  });

  /**
   * Chaque option est une ALTERNATIVE, pas une étape : la deuxième doit
   * décrire le calendrier tel qu'il est, pas tel qu'il serait si l'on avait
   * appliqué la première.
   */
  it("calcule chaque option indépendamment des autres", () => {
    const task = makeTask({ title: "TD", estimatedMinutes: 60 });
    const options = suggestPostponeOptions(makeState({ tasks: [task] }), task, NOW);
    for (const option of options) {
      expect(timeOfFirstSlot(option)).toBe(firstAvailableTimeOn(option.day));
    }
  });

  it("saute les jours sans disponibilité", () => {
    const state = makeState({
      availability: { weekly: { 0: [{ start: "18:00", end: "20:00" }], 1: [], 2: [], 3: [{ start: "18:00", end: "20:00" }], 4: [], 5: [], 6: [] }, exceptions: [] },
    });
    const options = suggestPostponeOptions(state, makeTask({ title: "TD", estimatedMinutes: 60 }), NOW);
    expect(options.map((option) => option.day)).not.toContain(dayKey(new Date(at(1))));
  });

  it("avertit quand une option tombe après l'échéance", () => {
    const state = makeState({
      availability: { weekly: { 0: [], 1: [], 2: [{ start: "14:00", end: "19:00" }], 3: [{ start: "18:00", end: "22:00" }], 4: [{ start: "18:00", end: "20:00" }], 5: [], 6: [] }, exceptions: [] },
    });
    const task = makeTask({ title: "TD", estimatedMinutes: 60, dueAt: at(1, "23:59") });
    expect(suggestPostponeOptions(state, task, NOW)[0].warning).toBe("Après l'échéance");
  });
});

function timeOfFirstSlot(option: { slots: { start: string }[] }): string {
  return new Date(option.slots[0].start).toTimeString().slice(0, 5);
}

function firstAvailableTimeOn(day: string): string {
  const state = makeState();
  const ranges = state.availability.weekly[(new Date(`${day}T12:00:00`).getDay() + 6) % 7 as 0 | 1 | 2 | 3 | 4 | 5 | 6];
  return ranges[0].start;
}
