import { describe, expect, it } from "vitest";
import { addDays, groupTodo, shortDay } from "@/lib/todo-view";
import { createWorkItem, completeWorkItem } from "@/lib/work-items";
import type { WorkItem } from "@/lib/storage";

const NOW = new Date("2026-10-24T10:00:00");
const TODAY = "2026-10-24";
const item = (title: string, dueDate: string | null, dueTime: string | null = null): WorkItem =>
  createWorkItem({ title, kind: "autre", subject: null, estimatedMinutes: 30, dueDate, dueTime }, NOW);

describe("addDays", () => {
  it("passe les fins de mois et d'année", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31");
  });
});

describe("groupTodo", () => {
  it("range par échéance dans l'ordre du calendrier et saute les groupes vides", () => {
    const groups = groupTodo(
      [item("sans", null), item("loin", "2026-12-01"), item("sem", "2026-10-28"), item("demain", "2026-10-25"), item("auj", TODAY), item("retard", "2026-10-20")],
      TODAY
    );
    expect(groups.map((group) => [group.id, group.items.map((entry) => entry.title)])).toEqual([
      ["retard", ["retard"]],
      ["aujourdhui", ["auj"]],
      ["demain", ["demain"]],
      ["semaine", ["sem"]],
      ["plus-tard", ["loin"]],
      ["sans-date", ["sans"]],
    ]);
  });

  it("met dans « Cette semaine » jusqu'à J+7 inclus, « Plus tard » ensuite", () => {
    const groups = groupTodo([item("j7", "2026-10-31"), item("j8", "2026-11-01")], TODAY);
    expect(groups.map((group) => group.id)).toEqual(["semaine", "plus-tard"]);
  });

  it("trie par date puis heure dans un groupe", () => {
    const [group] = groupTodo([item("b", TODAY, "16:00"), item("a", TODAY, "08:00"), item("c", TODAY)], TODAY);
    expect(group.items.map((entry) => entry.title)).toEqual(["a", "b", "c"]);
  });

  it("ne montre ni les travaux terminés ni les abandonnés", () => {
    const [first] = [item("fini", TODAY)];
    expect(groupTodo(completeWorkItem([first], first.id, NOW), TODAY)).toEqual([]);
    expect(groupTodo([{ ...first, status: "abandonné" }], TODAY)).toEqual([]);
  });

  it("renvoie une liste vide sans travail", () => {
    expect(groupTodo([], TODAY)).toEqual([]);
  });
});

describe("shortDay", () => {
  it("écrit le jour en français", () => {
    expect(shortDay("2026-10-24")).toMatch(/sam\.? 24 oct/);
  });
  it("rend tel quel un jour illisible", () => {
    expect(shortDay("bientôt")).toBe("bientôt");
  });
});
