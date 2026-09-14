import { describe, expect, it } from "vitest";
import {
  cancelTask,
  completeTask,
  createTask,
  dueInfo,
  effortMinutes,
  filterTasks,
  isMissedSlot,
  isOpen,
  isOverdue,
  nextSlot,
  postponeTask,
  remainingMinutes,
  reopenTask,
  scheduleAt,
  scheduleTask,
  scheduledMinutes,
  scheduledMinutesOnDay,
  sortByDue,
  sortSlots,
  unscheduleTask,
} from "@/lib/domain/tasks";
import { dayKey } from "@/lib/domain/date";
import { at, makeEntry, makeTask, NOW, slot } from "./fixtures";

describe("création", () => {
  it("prend l'estimation par défaut de la catégorie quand aucune n'est donnée", () => {
    expect(createTask({ title: "DM de physique", category: "exo-dm" }, NOW).estimatedMinutes).toBe(120);
  });

  it("nettoie le titre et ignore les champs vides", () => {
    const task = createTask({ title: "  Revoir le cours  ", notes: "   ", source: "" }, NOW);
    expect(task.title).toBe("Revoir le cours");
    expect(task.notes).toBeUndefined();
    expect(task.source).toBeUndefined();
  });

  it("naît ouverte, sans créneau et sans report", () => {
    const task = createTask({ title: "TD 3" }, NOW);
    expect(isOpen(task)).toBe(true);
    expect(task.slots).toEqual([]);
    expect(task.postponedCount).toBe(0);
  });
});

describe("transitions", () => {
  it("terminer pose completedAt et ferme la tâche", () => {
    const done = completeTask(makeTask(), NOW);
    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(NOW.toISOString());
    expect(isOpen(done)).toBe(false);
  });

  it("rouvrir efface completedAt", () => {
    const task = reopenTask(completeTask(makeTask(), NOW), NOW);
    expect(task.status).toBe("todo");
    expect(task.completedAt).toBeUndefined();
  });

  it("abandonner libère les créneaux : une tâche abandonnée ne doit plus peser sur le planning", () => {
    const task = cancelTask(scheduleTask(makeTask(), [slot(1, "18:00", 60)]), NOW);
    expect(task.status).toBe("cancelled");
    expect(task.slots).toEqual([]);
  });
});

describe("créneaux", () => {
  it("trie et fusionne les créneaux qui se chevauchent au lieu de compter deux fois les mêmes minutes", () => {
    const merged = sortSlots([slot(0, "20:00", 60), slot(0, "18:00", 60), slot(0, "18:30", 60)]);
    expect(merged).toHaveLength(2);
    expect(scheduledMinutes({ ...makeTask(), slots: merged })).toBe(150);
  });

  it("compte les minutes posées jour par jour", () => {
    const task = scheduleTask(makeTask(), [slot(0, "18:00", 90), slot(1, "18:00", 60)], NOW);
    expect(scheduledMinutesOnDay(task, dayKey(NOW))).toBe(90);
    expect(scheduledMinutes(task)).toBe(150);
  });

  it("le prochain créneau ignore ceux déjà passés", () => {
    const task = scheduleTask(makeTask(), [slot(-1, "18:00", 60), slot(2, "18:00", 60)], NOW);
    expect(nextSlot(task, NOW)?.start).toBe(at(2, "18:00"));
  });

  it("déplanifier vide tous les créneaux", () => {
    expect(unscheduleTask(scheduleAt(makeTask(), at(1, "18:00"), 60), NOW).slots).toEqual([]);
  });
});

describe("report", () => {
  it("déplace le créneau SANS toucher à l'échéance, et compte le report", () => {
    const task = scheduleAt(makeTask({ dueAt: at(3, "23:59") }), at(0, "18:00"), 60);
    const postponed = postponeTask(task, [slot(1, "18:00", 60)], NOW);
    expect(postponed.dueAt).toBe(at(3, "23:59"));
    expect(postponed.slots[0].start).toBe(at(1, "18:00"));
    expect(postponed.postponedCount).toBe(1);
    expect(postponed.lastPostponedAt).toBe(NOW.toISOString());
  });

  it("une tâche en cours reportée redevient à faire", () => {
    const task = { ...makeTask(), status: "doing" as const };
    expect(postponeTask(task, [slot(1, "18:00", 60)], NOW).status).toBe("todo");
  });
});

describe("charge et travail restant", () => {
  it("une tâche sans estimation retombe sur le défaut de sa catégorie, jamais sur zéro", () => {
    const task = { ...makeTask({ category: "exo-td" }), estimatedMinutes: undefined };
    expect(effortMinutes(task)).toBe(60);
  });

  it("le travail restant déduit le temps déjà passé", () => {
    const task = makeTask({ estimatedMinutes: 180 });
    const entries = [makeEntry(60, { taskId: task.id }), makeEntry(30, { taskId: task.id })];
    expect(remainingMinutes(task, entries)).toBe(90);
  });

  it("ne descend jamais à zéro tant que la tâche est ouverte", () => {
    const task = makeTask({ estimatedMinutes: 60 });
    expect(remainingMinutes(task, [makeEntry(200, { taskId: task.id })])).toBe(15);
  });

  it("vaut zéro dès que la tâche est terminée", () => {
    const task = completeTask(makeTask({ estimatedMinutes: 60 }), NOW);
    expect(remainingMinutes(task, [])).toBe(0);
  });
});

describe("échéance et retard", () => {
  it("classe l'échéance en jours calendaires", () => {
    expect(dueInfo(makeTask({ dueAt: at(0, "23:00") }), NOW).state).toBe("today");
    expect(dueInfo(makeTask({ dueAt: at(1, "08:00") }), NOW).state).toBe("tomorrow");
    expect(dueInfo(makeTask({ dueAt: at(4) }), NOW).state).toBe("soon");
    expect(dueInfo(makeTask({ dueAt: at(20) }), NOW).state).toBe("later");
    expect(dueInfo(makeTask({ dueAt: at(-2) }), NOW).state).toBe("overdue");
  });

  it("une échéance demain matin reste « demain » même vue tard le soir", () => {
    const lateEvening = new Date(NOW);
    lateEvening.setHours(23, 30, 0, 0);
    expect(dueInfo(makeTask({ dueAt: at(1, "08:00") }), lateEvening).state).toBe("tomorrow");
  });

  it("est en retard si l'échéance est passée", () => {
    expect(isOverdue(makeTask({ dueAt: at(-1) }), NOW)).toBe(true);
  });

  it("est en retard si TOUS les créneaux posés sont dans un jour révolu", () => {
    const task = scheduleTask(makeTask(), [slot(-2, "18:00", 60)], NOW);
    expect(isMissedSlot(task, NOW)).toBe(true);
    expect(isOverdue(task, NOW)).toBe(true);
  });

  it("n'est PAS en retard tant qu'un créneau reste à venir", () => {
    const task = scheduleTask(makeTask(), [slot(-1, "18:00", 60), slot(1, "18:00", 60)], NOW);
    expect(isMissedSlot(task, NOW)).toBe(false);
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("une tâche terminée n'est jamais en retard", () => {
    expect(isOverdue(completeTask(makeTask({ dueAt: at(-5) }), NOW), NOW)).toBe(false);
  });
});

describe("filtres et tris", () => {
  const open = makeTask({ title: "TD 4 de maths", subjectId: "maths" });
  const done = completeTask(makeTask({ title: "DM de physique", subjectId: "physique" }), NOW);
  const scheduled = scheduleAt(makeTask({ title: "Khôlle", subjectId: "maths" }), at(1, "18:00"), 60);
  const tasks = [open, done, scheduled];

  it("filtre sur les tâches ouvertes", () => {
    expect(filterTasks(tasks, { status: "open" }, NOW).map((task) => task.title)).toEqual(["TD 4 de maths", "Khôlle"]);
  });

  it("filtre par matière et par recherche textuelle", () => {
    expect(filterTasks(tasks, { subjectId: "maths" }, NOW)).toHaveLength(2);
    expect(filterTasks(tasks, { search: "physique" }, NOW)).toHaveLength(1);
  });

  it("isole les tâches sans créneau", () => {
    expect(filterTasks(tasks, { status: "open", unscheduledOnly: true }, NOW).map((task) => task.title)).toEqual(["TD 4 de maths"]);
  });

  it("trie par échéance, les tâches sans date en dernier", () => {
    const sorted = sortByDue([
      makeTask({ title: "sans date" }),
      makeTask({ title: "dans 3 jours", dueAt: at(3) }),
      makeTask({ title: "demain", dueAt: at(1) }),
    ]);
    expect(sorted.map((task) => task.title)).toEqual(["demain", "dans 3 jours", "sans date"]);
  });
});
