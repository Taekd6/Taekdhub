import { describe, expect, it } from "vitest";
import {
  abandonWorkItem,
  activeWorkItems,
  completeWorkItem,
  createWorkItem,
  daysUntilDue,
  doneMinutes,
  isOverdue,
  progressPercent,
  remainingMinutes,
  servesBankExercises,
  updateWorkItem,
} from "@/lib/work-items";
import type { WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/** Lundi 14 septembre 2026, 8 h — repère unique de tout le chantier « planning ». */
const NOW = new Date("2026-09-14T08:00:00");

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "w-1",
    title: "DM de maths",
    kind: "dm",
    subject: "Mathématiques",
    estimatedMinutes: 120,
    dueDate: "2026-09-17",
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-14T08:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-09-14T09:00:00.000Z",
    ended_at: "2026-09-14T09:30:00.000Z",
    duration_seconds: 1800,
    note: null,
    created_at: "2026-09-14T09:00:00.000Z",
    result: null,
    hints_used: null,
    work_item_id: null,
    ...overrides,
  };
}

describe("temps fait — sommé depuis les séances, jamais stocké", () => {
  /**
   * Même règle que `Exercise` depuis le Sprint 2.6 : une durée cumulée
   * stockée finit toujours par diverger de la somme des séances. Ces tests
   * verrouillent le fait que `WorkItem` n'en porte aucune.
   */
  it("ne compte que les séances rattachées à CE travail", () => {
    const item = makeItem();
    const sessions = [
      makeSession({ work_item_id: "w-1", duration_seconds: 1800 }),
      makeSession({ work_item_id: "w-2", duration_seconds: 3600 }),
      makeSession({ work_item_id: null, duration_seconds: 3600 }),
    ];
    expect(doneMinutes(item, sessions)).toBe(30);
  });

  it("le reste à faire se déduit du temps réellement passé", () => {
    const item = makeItem({ estimatedMinutes: 120 });
    expect(remainingMinutes(item, [makeSession({ work_item_id: "w-1", duration_seconds: 2700 })])).toBe(75);
  });

  it("dépasser l'estimation ne crée jamais de reste négatif", () => {
    const item = makeItem({ estimatedMinutes: 30 });
    expect(remainingMinutes(item, [makeSession({ work_item_id: "w-1", duration_seconds: 7200 })])).toBe(0);
  });

  it("l'avancement est plafonné à 100 %", () => {
    const item = makeItem({ estimatedMinutes: 30 });
    expect(progressPercent(item, [makeSession({ work_item_id: "w-1", duration_seconds: 7200 })])).toBe(100);
  });
});

describe("échéance — des JOURS, pas des instants", () => {
  it("une échéance le jour même vaut 0, pas -1, même en fin de journée", () => {
    const item = makeItem({ dueDate: "2026-09-14" });
    expect(daysUntilDue(item, new Date("2026-09-14T23:30:00"))).toBe(0);
  });

  it("demain vaut 1, hier vaut -1", () => {
    expect(daysUntilDue(makeItem({ dueDate: "2026-09-15" }), NOW)).toBe(1);
    expect(daysUntilDue(makeItem({ dueDate: "2026-09-13" }), NOW)).toBe(-1);
  });

  it("aucune date : aucun nombre inventé", () => {
    expect(daysUntilDue(makeItem({ dueDate: null }), NOW)).toBeNull();
  });
});

describe("retard — un fait sur le passé, jamais une prédiction", () => {
  it("un travail dont l'échéance est passée et qui n'est pas fini est en retard", () => {
    expect(isOverdue(makeItem({ dueDate: "2026-09-12" }), [], NOW)).toBe(true);
  });

  it("une échéance encore à venir n'est jamais un retard, même à quelques heures", () => {
    expect(isOverdue(makeItem({ dueDate: "2026-09-14" }), [], NOW)).toBe(false);
  });

  it("un travail dont tout le temps estimé est fait n'est pas en retard", () => {
    const sessions = [makeSession({ work_item_id: "w-1", duration_seconds: 120 * 60 })];
    expect(isOverdue(makeItem({ dueDate: "2026-09-12" }), sessions, NOW)).toBe(false);
  });

  it("un travail terminé ou abandonné n'est jamais en retard", () => {
    expect(isOverdue(makeItem({ dueDate: "2026-09-12", status: "terminé" }), [], NOW)).toBe(false);
    expect(isOverdue(makeItem({ dueDate: "2026-09-12", status: "abandonné" }), [], NOW)).toBe(false);
  });
});

describe("cycle de vie", () => {
  it("terminer pose la date d'achèvement, rouvrir l'efface", () => {
    const items = [makeItem()];
    const done = completeWorkItem(items, "w-1", NOW);
    expect(done[0].status).toBe("terminé");
    expect(done[0].completedAt).toBe(NOW.toISOString());
    const reopened = updateWorkItem(done, "w-1", { status: "en cours" }, NOW);
    expect(reopened[0].completedAt).toBeNull();
  });

  it("supprimer, c'est abandonner — la ligne reste, l'invariant de fusion aussi", () => {
    const items = abandonWorkItem([makeItem()], "w-1");
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("abandonné");
    expect(activeWorkItems(items)).toEqual([]);
  });

  it("une mise à jour ne mute jamais la liste reçue", () => {
    const items = [makeItem()];
    updateWorkItem(items, "w-1", { title: "Autre" }, NOW);
    expect(items[0].title).toBe("DM de maths");
  });
});

describe("quel travail TaekdHub sait remplir tout seul", () => {
  /**
   * La frontière du chantier : le moteur de recommandation sait ce qu'est un
   * exercice et un chapitre. Il ne sait rien du DM que le professeur a donné
   * — TaekdHub en réserve le temps, sans prétendre en connaître le contenu.
   */
  it("exercices et chapitre passent par la banque", () => {
    expect(servesBankExercises(makeItem({ kind: "exercices" }))).toBe(true);
    expect(servesBankExercises(makeItem({ kind: "chapitre" }))).toBe(true);
  });

  it("DM, DS, concours et « autre » restent du travail que l'élève seul connaît", () => {
    for (const kind of ["dm", "ds", "concours", "autre"] as const) {
      expect(servesBankExercises(makeItem({ kind }))).toBe(false);
    }
  });
});

describe("création", () => {
  it("un travail neuf part à faire, sans report ni date d'achèvement", () => {
    const item = createWorkItem({ title: "  DM de maths  ", kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: "2026-09-17" }, NOW);
    expect(item.title).toBe("DM de maths");
    expect(item.status).toBe("à faire");
    expect(item.notBeforeDate).toBeNull();
    expect(item.completedAt).toBeNull();
    expect(item.postponements).toEqual([]);
  });

  it("une estimation nulle ou négative est ramenée à une minute, jamais à zéro", () => {
    expect(createWorkItem({ title: "x", kind: "autre", subject: null, estimatedMinutes: 0, dueDate: null }, NOW).estimatedMinutes).toBe(1);
  });
});
