import { describe, expect, it } from "vitest";
import { formatIntention, intentionsForToday, setWorkItemPlan } from "@/lib/intentions";
import { normalizeWorkItem, type WorkItem } from "@/lib/storage";

const now = new Date(2026, 8, 25, 9, 0);

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return normalizeWorkItem({ id: crypto.randomUUID(), title: "DM 4", kind: "dm", status: "à faire", estimatedMinutes: 120, createdAt: "2026-09-20T10:00:00.000Z", ...overrides });
}

describe("plans « si… alors… »", () => {
  it("relit les plans du jour, par heure, puis les plans ratés", () => {
    const late = item({ title: "Tard", plan: { day: "2026-09-25", time: "18:00", place: null } });
    const early = item({ title: "Tôt", plan: { day: "2026-09-25", time: "08:30", place: "CDI" } });
    const missed = item({ title: "Raté", plan: { day: "2026-09-23", time: null, place: null } });
    const future = item({ title: "Demain", plan: { day: "2026-09-26", time: null, place: null } });
    const done = item({ title: "Fini", status: "terminé", plan: { day: "2026-09-25", time: null, place: null } });
    const out = intentionsForToday([late, missed, future, done, early], now);
    expect(out.map((entry) => entry.item.title)).toEqual(["Tôt", "Tard", "Raté"]);
    expect(out[2].missed).toBe(true);
  });

  it("formule la phrase à relire", () => {
    expect(formatIntention({ day: "2026-09-25", time: "10:00", place: "à la maison" }, "DM 4", now)).toBe(
      "Si c'est aujourd'hui à 10 h, à la maison, alors : DM 4."
    );
    expect(formatIntention({ day: "2026-09-26", time: "18:30", place: null }, "TD4", now)).toBe("Si c'est samedi 26 septembre à 18 h 30, alors : TD4.");
  });

  it("pose et retire un plan", () => {
    const a = item();
    const planned = setWorkItemPlan([a], a.id, { day: "2026-09-26", time: null, place: null });
    expect(planned[0].plan?.day).toBe("2026-09-26");
    expect(setWorkItemPlan(planned, a.id, null)[0].plan).toBeNull();
  });

  it("un plan illisible est écarté à la normalisation, un ancien travail n'en a pas", () => {
    expect(item({ plan: { day: "hier", time: null, place: null } as never }).plan).toBeNull();
    expect(item().plan).toBeNull();
    expect(item({ plan: { day: "2026-09-26", time: "25:00", place: "  " } }).plan).toEqual({ day: "2026-09-26", time: null, place: null });
  });
});
