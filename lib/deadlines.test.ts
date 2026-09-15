import { describe, expect, it } from "vitest";
import { computeFeasibility, computeWorkItemPriority, explainPriority, sortByPriority } from "@/lib/deadlines";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date("2026-09-14T08:00:00"); // lundi

/** 60 min planifiables en semaine, 120 le week-end — des chiffres ronds, pour que chaque test se relise à la main. */
function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({
    capacityByWeekday: [60, 60, 60, 60, 60, 120, 120],
    planningMarginPercent: 0,
    ...overrides,
  });
}

function item(overrides: Partial<WorkItem> = {}): WorkItem {
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

function session(workItemId: string | null, minutes: number, startedAt = "2026-09-14T09:00:00"): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: workItemId,
  };
}

describe("RETARD ≠ IMPOSSIBLE — la distinction que tout ce module protège", () => {
  /**
   * Le cahier des charges en fait une règle absolue, et c'est aussi ce qui
   * sépare un outil crédible d'un outil qui crie au loup : « proche » ne
   * veut pas dire « infaisable », et « en retard » ne veut pas dire
   * « perdu ».
   */
  it("une échéance imminente n'est PAS infaisable si le temps y est", () => {
    // Demain, 45 min à faire, 60 min planifiables aujourd'hui + 60 demain.
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-15", estimatedMinutes: 45 }), [], prefs(), NOW);
    expect(feasibility.level).toBe("casable");
  });

  it("une échéance lointaine PEUT être infaisable", () => {
    // Dans 3 jours : 60 × 4 = 240 min planifiables, pour 400 min de travail.
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-17", estimatedMinutes: 400 }), [], prefs(), NOW);
    expect(feasibility.level).toBe("non casable");
    expect(feasibility.shortfallMinutes).toBe(160);
  });

  it("un travail en retard n'est jamais étiqueté « non casable » — son échéance est passée, ce n'est plus la même question", () => {
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-12" }), [], prefs(), NOW);
    expect(feasibility.level).toBe("échéance dépassée");
  });
});

describe("faisabilité — le verdict cite toujours ses deux nombres", () => {
  it("l'infaisabilité se formule exactement comme le cahier des charges l'exige", () => {
    // 2 h restantes, 1 h disponible (échéance aujourd'hui, marge nulle).
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-14", estimatedMinutes: 120 }), [], prefs(), NOW);
    expect(feasibility.reason).toBe("Il reste 2 h de travail pour 1 h disponibles avant l'échéance.");
  });

  it("le temps déjà passé aujourd'hui est retiré du disponible", () => {
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-14", estimatedMinutes: 60 }), [session("w-2", 30)], prefs(), NOW);
    expect(feasibility.availableMinutes).toBe(30);
    expect(feasibility.level).toBe("non casable");
  });

  it("seul le temps RESTANT est projeté, pas la durée initiale", () => {
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-14", estimatedMinutes: 120 }), [session("w-1", 90)], prefs(), NOW);
    // 30 min restantes contre 60 − 90 déjà travaillées… soit 0 disponible.
    expect(feasibility.remainingMinutes).toBe(30);
  });

  it("« juste » signale la marge presque nulle sans crier à l'impossible", () => {
    // 3 jours (lundi→mercredi) = 180 min ; 170 min à faire = 94 % du disponible.
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-16", estimatedMinutes: 170 }), [], prefs(), NOW);
    expect(feasibility.level).toBe("juste");
  });

  it("sans échéance, aucune projection n'est faite ni suggérée", () => {
    const feasibility = computeFeasibility(item({ dueDate: null }), [], prefs(), NOW);
    expect(feasibility.level).toBe("sans échéance");
    expect(feasibility.availableMinutes).toBe(0);
  });

  it("un travail dont le temps estimé est fait est casable, quelle que soit la date", () => {
    const feasibility = computeFeasibility(item({ dueDate: "2026-09-15", estimatedMinutes: 60 }), [session("w-1", 60)], prefs(), NOW);
    expect(feasibility.level).toBe("casable");
    expect(feasibility.remainingMinutes).toBe(0);
  });
});

describe("priorité — un score, mais toujours explicable", () => {
  it("chaque raison correspond à un terme réellement ajouté au score", () => {
    const priority = computeWorkItemPriority(item({ dueDate: "2026-09-15", important: true }), [], prefs(), NOW);
    expect(priority.reasons).toContain("Échéance demain");
    expect(priority.reasons).toContain("Marqué important");
  });

  it("le retard domine tout le reste", () => {
    const late = computeWorkItemPriority(item({ id: "a", dueDate: "2026-09-11" }), [], prefs(), NOW);
    const today = computeWorkItemPriority(item({ id: "b", dueDate: "2026-09-14", estimatedMinutes: 30 }), [], prefs(), NOW);
    expect(late.score).toBeGreaterThan(today.score);
    expect(late.level).toBe("élevée");
  });

  it("un travail sans échéance reste de priorité basse, sans pour autant disparaître", () => {
    const priority = computeWorkItemPriority(item({ dueDate: null, estimatedMinutes: 30 }), [], prefs(), NOW);
    expect(priority.level).toBe("basse");
    expect(priority.reasons).toContain("Sans échéance");
  });

  it("SCÉNARIO 3 — un DS lundi prochain et un DM jeudi sont ordonnés par leur date", () => {
    const dm = computeWorkItemPriority(item({ id: "dm", title: "DM maths", dueDate: "2026-09-17", estimatedMinutes: 120 }), [], prefs(), NOW);
    const ds = computeWorkItemPriority(item({ id: "ds", title: "DS physique", kind: "ds", dueDate: "2026-09-21", estimatedMinutes: 180 }), [], prefs(), NOW);
    expect(sortByPriority([ds, dm]).map((p) => p.item.id)).toEqual(["dm", "ds"]);
  });

  it("SCÉNARIO 6 — deux échéances le même jour sont départagées, jamais laissées à l'ordre du fichier", () => {
    const ordinary = computeWorkItemPriority(item({ id: "a", title: "A", dueDate: "2026-09-16", estimatedMinutes: 30 }), [], prefs(), NOW);
    const flagged = computeWorkItemPriority(item({ id: "b", title: "B", dueDate: "2026-09-16", estimatedMinutes: 30, important: true }), [], prefs(), NOW);
    expect(sortByPriority([ordinary, flagged]).map((p) => p.item.id)).toEqual(["b", "a"]);
  });

  it("le tri est STABLE : deux travaux rigoureusement identiques gardent le même ordre d'un appel à l'autre", () => {
    const a = computeWorkItemPriority(item({ id: "a", title: "Alpha", dueDate: "2026-09-16", estimatedMinutes: 30 }), [], prefs(), NOW);
    const b = computeWorkItemPriority(item({ id: "b", title: "Beta", dueDate: "2026-09-16", estimatedMinutes: 30 }), [], prefs(), NOW);
    expect(sortByPriority([b, a]).map((p) => p.item.id)).toEqual(["a", "b"]);
    expect(sortByPriority([a, b]).map((p) => p.item.id)).toEqual(["a", "b"]);
  });
});

describe("explication — jamais une phrase sans donnée derrière", () => {
  it("un retard est annoncé avec le temps qu'il reste", () => {
    const priority = computeWorkItemPriority(item({ dueDate: "2026-09-13", estimatedMinutes: 90 }), [], prefs(), NOW);
    expect(explainPriority(priority)).toBe("En retard d'un jour, 1 h 30 restent à faire.");
  });

  it("une infaisabilité est annoncée avec ses deux nombres, pas avec le mot « impossible »", () => {
    const priority = computeWorkItemPriority(item({ dueDate: "2026-09-14", estimatedMinutes: 120 }), [], prefs(), NOW);
    expect(explainPriority(priority)).toContain("pour 1 h disponibles");
    expect(explainPriority(priority)).not.toContain("impossible");
  });

  it("une échéance confortable est annoncée comme telle, sans alarmisme", () => {
    const priority = computeWorkItemPriority(item({ dueDate: "2026-09-20", estimatedMinutes: 60 }), [], prefs(), NOW);
    expect(explainPriority(priority)).toContain("la charge tient dans ton rythme");
  });
});
