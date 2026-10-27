import { beforeAll, describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar";
import type { WorkItem } from "@/lib/storage";
import { buildWeek, currentOrNext, eveningList, hourRange, layoutLanes, mondayOf, nextExam, weekLoad, localDay } from "@/lib/week-agenda";

beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});

function ev(id: string, title: string, start: string, end: string, patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id, feedId: "edt", title, start, end, allDay: false, location: null, kind: "cours", subject: null, ...patch };
}

function task(id: string, patch: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    title: `Tâche ${id}`,
    kind: "exercices",
    subject: "Mathématiques",
    estimatedMinutes: 60,
    dueDate: null,
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-10-20T10:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...patch,
  };
}

const NOW = new Date("2026-10-27T18:40:00+01:00"); // mardi soir

describe("semaine", () => {
  it("commence le lundi", () => {
    expect(localDay(mondayOf(NOW))).toBe("2026-10-26");
    expect(localDay(mondayOf(new Date("2026-11-01T12:00:00+01:00")))).toBe("2026-10-26");
  });

  it("range cours et tâches dans le bon jour, à l'heure locale", () => {
    const week = buildWeek(mondayOf(NOW), [ev("m", "Mathématiques", "2026-10-27T09:00:00.000Z", "2026-10-27T11:00:00.000Z"), { ...ev("t", "Toussaint", "2026-11-01", "2026-11-02"), allDay: true }], [
      task("soir", { plan: { day: "2026-10-27", time: "20:00", place: null } }),
      task("sansheure", { dueDate: "2026-10-28" }),
      task("retiree", { dueDate: "2026-10-28", status: "abandonné" }),
      task("hors", { dueDate: "2026-11-10" }),
    ]);
    const tuesday = week[1];
    expect(tuesday.day).toBe("2026-10-27");
    expect(tuesday.blocks.map((b) => [b.title, b.startMin, b.endMin])).toEqual([
      ["Mathématiques", 600, 720],
      ["Tâche soir", 1200, 1260],
    ]);
    expect(week[2].untimed.map((t) => t.id)).toEqual(["sansheure"]);
    expect(week[6].allDay.map((a) => a.title)).toEqual(["Toussaint"]);
    expect(week[5].allDay).toEqual([]);
  });

  it("place côte à côte les blocs qui se chevauchent", () => {
    const placed = layoutLanes([
      { id: "a", title: "Maths", day: "d", startMin: 1140, endMin: 1200, kind: "cours", subject: null, location: null },
      { id: "b", title: "Physique", day: "d", startMin: 1140, endMin: 1200, kind: "cours", subject: null, location: null },
      { id: "c", title: "Seul", day: "d", startMin: 1260, endMin: 1320, kind: "cours", subject: null, location: null },
    ]);
    const lane = Object.fromEntries(placed.map((b) => [b.id, [b.lane, b.lanes]]));
    expect(lane).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it("élargit la plage horaire si un bloc déborde", () => {
    const week = buildWeek(mondayOf(NOW), [ev("x", "Physique", "2026-10-26T20:00:00.000Z", "2026-10-26T22:00:00.000Z")], []);
    expect(hourRange(week)).toEqual({ from: 420, to: 1380 });
  });
});

describe("ce soir", () => {
  it("garde le planifié aujourd'hui, le dû aujourd'hui ou demain, et le coché aujourd'hui", () => {
    const list = eveningList(
      [
        task("plan", { plan: { day: "2026-10-27", time: "21:00", place: null } }),
        task("demain", { dueDate: "2026-10-28" }),
        task("jeudi", { dueDate: "2026-10-29" }),
        task("planifieAilleurs", { dueDate: "2026-10-28", plan: { day: "2026-10-30", time: null, place: null } }),
        task("fait", { dueDate: "2026-10-27", dueTime: "19:00", status: "terminé", completedAt: "2026-10-27T18:10:00.000Z" }),
        task("faitHier", { dueDate: "2026-10-27", status: "terminé", completedAt: "2026-10-26T18:10:00.000Z" }),
      ],
      NOW,
    );
    expect(list.map((e) => [e.item.id, e.reason, e.done])).toEqual([
      ["fait", "aujourdhui", true],
      ["plan", "plan", false],
      ["demain", "demain", false],
    ]);
  });
});

describe("widgets", () => {
  const events = [
    ev("td", "Td physique", "2026-10-27T15:00:00.000Z", "2026-10-27T17:00:00.000Z"),
    ev("soir", "Maths", "2026-10-27T18:00:00.000Z", "2026-10-27T19:00:00.000Z"),
    ev("prep", "Préparation au DS", "2026-10-31T12:00:00.000Z", "2026-10-31T16:00:00.000Z", { kind: "ds" }),
    ev("ds", "DS", "2026-11-02T12:15:00.000Z", "2026-11-02T16:00:00.000Z", { kind: "ds" }),
  ];

  it("cours en cours, puis à venir", () => {
    expect(currentOrNext(events, NOW)).toMatchObject({ status: "à venir", event: { id: "soir" } });
    expect(currentOrNext(events, new Date("2026-10-27T16:30:00+01:00"))).toMatchObject({ status: "en cours", event: { id: "td" } });
    expect(currentOrNext(events, new Date("2026-10-27T23:00:00+01:00"))).toBeNull();
  });

  it("prochain DS : ignore la « préparation », compare agenda et échéances", () => {
    expect(nextExam(events, [], NOW)).toMatchObject({ title: "DS", day: "2026-11-02", days: 6, time: "13h15" });
    const exam = nextExam(events, [task("dsphy", { kind: "ds", title: "DS physique", dueDate: "2026-10-30" })], NOW);
    expect(exam).toMatchObject({ title: "DS physique", days: 3, source: "tache" });
  });

  it("charge de la semaine", () => {
    const load = weekLoad(buildWeek(mondayOf(NOW), events, [task("a", { dueDate: "2026-10-27" })]));
    expect(load[1]).toMatchObject({ classMinutes: 120, taskCount: 1, doneCount: 0, hasExam: false });
    // La « préparation au DS » du samedi n'est pas une épreuve ; le DS est lundi prochain.
    expect(load.some((day) => day.hasExam)).toBe(false);
  });
});

describe("cocher / décocher", () => {
  it("pose updatedAt dans les deux sens, et completedAt seulement à la coche", async () => {
    const { toggleWorkItemDone } = await import("@/lib/work-items");
    const t1 = new Date("2026-10-27T19:00:00.000Z");
    const t2 = new Date("2026-10-27T19:05:00.000Z");
    const done = toggleWorkItemDone([task("a")], "a", t1);
    expect(done[0]).toMatchObject({ status: "terminé", completedAt: t1.toISOString(), updatedAt: t1.toISOString() });
    const reopened = toggleWorkItemDone(done, "a", t2);
    expect(reopened[0]).toMatchObject({ status: "à faire", completedAt: null, updatedAt: t2.toISOString() });
    expect(toggleWorkItemDone([task("x", { status: "abandonné" })], "x", t1)[0].status).toBe("abandonné");
  });
});
