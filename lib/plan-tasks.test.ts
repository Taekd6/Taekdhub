import { describe, expect, it } from "vitest";
import type { Deadline, ProgramSession } from "@/lib/holiday-program";
import type { WorkItem } from "@/lib/storage";
import { EMPTY_PLAN, addTask, buildDay, normalizePlan, openCount, removeTask, shiftDay, toggleDone, weekDays, weekStart } from "@/lib/plan-tasks";

const session = (over: Partial<ProgramSession>): ProgramSession => ({
  id: "2026-10-23-matin",
  date: "2026-10-23",
  start: "09:30",
  end: "11:30",
  kind: "matin",
  title: "Réduction",
  subject: "Mathématiques",
  chapter: "",
  steps: [{ label: "Exercices", minutes: 95, detail: "" }],
  fiche: null,
  note: "",
  version: 1,
  ...over,
});

const deadline: Deadline = {
  id: "2026-10-23-dm",
  date: "2026-10-23",
  start: null,
  end: null,
  kind: "devoir",
  title: "DM à rendre",
  subject: "Physique",
  place: "",
  note: "Trois séances prévues.",
  alarmDays: [],
  version: 1,
};

const work = (over: Partial<WorkItem>): WorkItem => ({ id: "w1", title: "Fiches", subject: null, dueDate: "2026-10-23", dueTime: null, status: "à faire", ...over }) as WorkItem;

describe("planning à cocher", () => {
  it("réunit programme, échéances, travaux datés et tâches perso, triés par heure", () => {
    const state = addTask(EMPTY_PLAN, "2026-10-23", "Ranger mes fiches", "t1");
    const day = buildDay("2026-10-23", state, {
      program: [session({}), session({ id: "2026-10-23-soir", start: "20:00", end: "20:30", title: "Vocabulaire" })],
      deadlines: [deadline],
      workItems: [work({ dueTime: "14:00" })],
    });
    expect(day.items.map((item) => item.title)).toEqual(["Réduction", "Fiches", "Vocabulaire", "DM à rendre", "Ranger mes fiches"]);
    expect(day.items[0]).toMatchObject({ kind: "seance", time: "09:30–11:30", href: "/seance/2026-10-23-matin", detail: "Exercices 95 min" });
  });

  it("ignore les autres jours et les travaux abandonnés", () => {
    const day = buildDay("2026-10-24", EMPTY_PLAN, { program: [session({})], deadlines: [deadline], workItems: [work({ dueDate: "2026-10-24", status: "abandonné" })] });
    expect(day.items).toEqual([]);
  });

  it("un jour de repos donne une phrase, sans case", () => {
    const day = buildDay("2026-10-25", EMPTY_PLAN, { program: [session({ date: "2026-10-25", kind: "repos", start: null, end: null, title: "Repos complet", note: "Rien aujourd'hui." })], deadlines: [] });
    expect(day).toMatchObject({ items: [], rest: "Rien aujourd'hui." });
  });

  it("cocher puis décocher, et le décompte suit", () => {
    const sources = { program: [session({})], deadlines: [] };
    const checked = toggleDone(EMPTY_PLAN, "s:2026-10-23-matin");
    expect(openCount(buildDay("2026-10-23", checked, sources))).toBe(0);
    expect(buildDay("2026-10-23", checked, sources).items[0].done).toBe(true);
    expect(openCount(buildDay("2026-10-23", toggleDone(checked, "s:2026-10-23-matin"), sources))).toBe(1);
  });

  it("un travail déjà terminé ailleurs apparaît coché", () => {
    const day = buildDay("2026-10-23", EMPTY_PLAN, { program: [], deadlines: [], workItems: [work({ status: "terminé" })] });
    expect(day.items[0].done).toBe(true);
  });

  it("supprimer une tâche perso retire aussi sa coche ; une tâche vide est refusée", () => {
    let state = addTask(EMPTY_PLAN, "2026-10-23", "  ", "t0");
    expect(state).toBe(EMPTY_PLAN);
    state = toggleDone(addTask(EMPTY_PLAN, "2026-10-23", "À faire", "t1"), "t:t1");
    state = removeTask(state, "t1");
    expect(state).toEqual({ done: {}, tasks: [] });
  });

  it("relit un état abîmé sans lever", () => {
    expect(normalizePlan(null)).toEqual(EMPTY_PLAN);
    expect(normalizePlan({ done: { a: true, b: 1 }, tasks: [{ id: "x", date: "2026-10-23", title: " ok " }, { id: 3 }, { id: "y", date: "demain", title: "z" }] })).toEqual({
      done: { a: true },
      tasks: [{ id: "x", date: "2026-10-23", title: "ok" }],
    });
  });

  it("semaine du lundi au dimanche", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekDays("2026-10-19")).toHaveLength(7);
    expect(weekDays("2026-10-19")[6]).toBe("2026-10-25");
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
  });
});
