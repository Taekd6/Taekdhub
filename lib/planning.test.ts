import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, MIN_SLOT_MINUTES, PLANNING_HORIZON_DAYS, postponeWorkItem } from "@/lib/planning";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date("2026-09-14T08:00:00"); // lundi

/** 60 min planifiables en semaine, 120 le week-end, marge nulle — des chiffres qu'on peut recompter de tête. */
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

/** Minutes planifiées pour un travail donné, tous jours confondus. */
function plannedFor(plan: ReturnType<typeof buildWeeklyPlan>, id: string): number {
  return plan.days.flatMap((day) => day.slots).filter((slot) => slot.workItemId === id).reduce((total, slot) => total + slot.minutes, 0);
}

/** Les jours (dates) où un travail apparaît. */
function daysFor(plan: ReturnType<typeof buildWeeklyPlan>, id: string): string[] {
  return plan.days.filter((day) => day.slots.some((slot) => slot.workItemId === id)).map((day) => day.date);
}

describe("SCÉNARIO 1 — DM dans 5 jours, 2 h restantes, 1 h disponible par jour → casable", () => {
  it("les 2 h sont entièrement placées avant l'échéance", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 120 })], [], prefs(), NOW);
    expect(plannedFor(plan, "w-1")).toBe(120);
    expect(plan.unplaceable).toEqual([]);
  });

  it("et elles sont ÉTALÉES, pas entassées la veille", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 120 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1").length).toBeGreaterThan(1);
    for (const day of plan.days) {
      for (const slot of day.slots) expect(slot.minutes).toBeLessThanOrEqual(60);
    }
  });
});

describe("SCÉNARIO 2 — DM demain, 3 h restantes, 1 h par jour → le problème est dit, pas masqué", () => {
  it("ce qui ne rentre pas ressort dans `unplaceable`, avec le chiffre manquant", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15", estimatedMinutes: 180 })], [], prefs(), NOW);
    expect(plan.unplaceable).toHaveLength(1);
    expect(plan.unplaceable[0].missingMinutes).toBe(60); // 180 − (60 aujourd'hui + 60 demain)
    expect(plan.unplaceable[0].reason).toContain("1 h");
  });

  it("rien n'est replacé APRÈS l'échéance — ce serait décaler la date en douce", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15", estimatedMinutes: 180 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1")).toEqual(["2026-09-14", "2026-09-15"]);
  });

  it("mais ce qui rentre est quand même planifié : on ne renonce pas à tout", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15", estimatedMinutes: 180 })], [], prefs(), NOW);
    expect(plannedFor(plan, "w-1")).toBe(120);
  });
});

describe("SCÉNARIO 3 — un DS lundi et un DM jeudi : les deux sont servis dans le bon ordre", () => {
  const items = [
    item({ id: "ds", title: "DS physique", kind: "ds", subject: "Physique", dueDate: "2026-09-21", estimatedMinutes: 180 }),
    item({ id: "dm", title: "DM maths", dueDate: "2026-09-17", estimatedMinutes: 120 }),
  ];

  it("le DM, plus proche, est servi en premier le premier jour", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plan.days[0].slots[0].workItemId).toBe("dm");
  });

  it("les deux tiennent entièrement et rien n'est déclaré infaisable", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plannedFor(plan, "dm")).toBe(120);
    expect(plannedFor(plan, "ds")).toBe(180);
    expect(plan.unplaceable).toEqual([]);
  });

  it("le DS n'attend pas le dernier moment : il commence avant son échéance", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(daysFor(plan, "ds").length).toBeGreaterThan(1);
  });
});

describe("SCÉNARIO 4 — travail partiellement réalisé : seul le RESTE est planifié", () => {
  it("un DM de 2 h dont 1 h 30 est faite ne replanifie que 30 min", () => {
    const plan = buildWeeklyPlan([item({ estimatedMinutes: 120 })], [session("w-1", 90, "2026-09-13T09:00:00")], prefs(), NOW);
    expect(plannedFor(plan, "w-1")).toBe(30);
  });

  it("un travail dont tout le temps estimé est fait ne prend plus aucune place", () => {
    const plan = buildWeeklyPlan([item({ estimatedMinutes: 120 })], [session("w-1", 120, "2026-09-13T09:00:00")], prefs(), NOW);
    expect(plannedFor(plan, "w-1")).toBe(0);
    expect(plan.unplaceable).toEqual([]);
  });
});

describe("SCÉNARIO 5 — report : le planning est RECALCULÉ, pas décalé en bloc", () => {
  it("reporter écrit « pas avant », et surtout ne touche jamais l'échéance", () => {
    const outcome = postponeWorkItem([item({ dueDate: "2026-09-19" })], [], prefs(), "w-1", "demain", NOW);
    expect(outcome.workItems[0].notBeforeDate).toBe("2026-09-15");
    expect(outcome.workItems[0].dueDate).toBe("2026-09-19");
  });

  it("le travail disparaît d'aujourd'hui et se redistribue sur les jours suivants", () => {
    const after = postponeWorkItem([item({ dueDate: "2026-09-19" })], [], prefs(), "w-1", "demain", NOW).workItems;
    const plan = buildWeeklyPlan(after, [], prefs(), NOW);
    expect(daysFor(plan, "w-1")).not.toContain("2026-09-14");
    expect(plannedFor(plan, "w-1")).toBe(120);
  });

  it("le report est enregistré — le bilan hebdomadaire doit pouvoir le compter", () => {
    const outcome = postponeWorkItem([item()], [], prefs(), "w-1", "demain", NOW);
    expect(outcome.workItems[0].postponements).toHaveLength(1);
    expect(outcome.workItems[0].postponements[0]).toMatchObject({ fromDate: "2026-09-14", toDate: "2026-09-15" });
  });

  it("c'est le temps RESTANT qui repart, pas la durée initiale", () => {
    const sessions = [session("w-1", 90, "2026-09-13T09:00:00")];
    const after = postponeWorkItem([item({ dueDate: "2026-09-19", estimatedMinutes: 120 })], sessions, prefs(), "w-1", "demain", NOW).workItems;
    expect(plannedFor(buildWeeklyPlan(after, sessions, prefs(), NOW), "w-1")).toBe(30);
  });

  it("un report qui casse l'échéance le DIT, et reporte quand même", () => {
    const outcome = postponeWorkItem([item({ dueDate: "2026-09-15", estimatedMinutes: 110 })], [], prefs(), "w-1", "demain", NOW);
    expect(outcome.breaksDeadline).toBe(true);
    expect(outcome.warning).toContain("ne trouvent pas de place avant l'échéance");
    expect(outcome.workItems[0].notBeforeDate).toBe("2026-09-15");
  });

  it("« prochain jour disponible » saute les journées déclarées à zéro", () => {
    const p = prefs({ capacityByWeekday: [60, 0, 0, 60, 60, 120, 120] });
    const outcome = postponeWorkItem([item()], [], p, "w-1", "prochain-jour-disponible", NOW);
    expect(outcome.toDate).toBe("2026-09-17");
  });
});

describe("SCÉNARIO 7 — aucune échéance : le moteur continue de fonctionner normalement", () => {
  it("un travail sans date est quand même planifié, mais après tout ce qui est daté", () => {
    const items = [
      item({ id: "libre", title: "Réviser les intégrales", kind: "chapitre", dueDate: null, estimatedMinutes: 60 }),
      item({ id: "dm", dueDate: "2026-09-15", estimatedMinutes: 60 }),
    ];
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plan.days[0].slots[0].workItemId).toBe("dm");
    expect(plannedFor(plan, "libre")).toBe(60);
  });

  it("aucun travail du tout ne produit ni plan ni erreur", () => {
    const plan = buildWeeklyPlan([], [], prefs(), NOW);
    expect(plan.days).toHaveLength(PLANNING_HORIZON_DAYS);
    expect(plan.days.every((day) => day.slots.length === 0)).toBe(true);
    expect(plan.unplaceable).toEqual([]);
  });
});

describe("SCÉNARIO 9 — une journée déjà pleine ne reçoit rien de plus, en silence", () => {
  it("le temps déjà travaillé aujourd'hui ferme la journée au planificateur", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 120 })], [session("w-2", 60)], prefs(), NOW);
    expect(daysFor(plan, "w-1")).not.toContain("2026-09-14");
  });

  it("aucun créneau ne dépasse jamais la capacité PLANIFIABLE du jour", () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      item({ id: `w-${index}`, title: `Travail ${index}`, dueDate: "2026-09-18", estimatedMinutes: 90 })
    );
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    for (const day of plan.days) {
      expect(day.load.plannedMinutes).toBeLessThanOrEqual(day.load.capacityMinutes);
    }
  });

  it("la marge n'est jamais planifiée : avec 20 % de marge, une journée de 120 min n'en reçoit que 96", () => {
    const withMargin = prefs({ capacityByWeekday: [120, 120, 120, 120, 120, 120, 120], planningMarginPercent: 20 });
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-14", estimatedMinutes: 300 })], [], withMargin, NOW);
    expect(plan.days[0].load.plannedMinutes).toBe(96);
    expect(plan.days[0].load.status).toBe("chargé");
  });
});

describe("SCÉNARIO 10 — l'infaisable est expliqué, jamais simplement affiché", () => {
  it("la raison cite le temps manquant", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15", estimatedMinutes: 300 })], [], prefs(), NOW);
    expect(plan.unplaceable[0].reason).toMatch(/\d/);
    expect(plan.unplaceable[0].reason).not.toContain("impossible");
  });

  it("la priorité correspondante porte la raison chiffrée, pas un mot d'alarme", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15", estimatedMinutes: 300 })], [], prefs(), NOW);
    const priority = plan.priorities.find((entry) => entry.item.id === "w-1")!;
    expect(priority.feasibility.level).toBe("non casable");
    expect(priority.feasibility.reason).toContain("disponibles avant l'échéance");
  });
});

describe("règles générales du placement", () => {
  it("un travail en retard est replacé dès aujourd'hui — son échéance est passée, il n'y a plus de « avant »", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-11", estimatedMinutes: 60 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1")).toContain("2026-09-14");
    expect(plan.unplaceable).toEqual([]);
  });

  it("aucun créneau n'est plus petit que le minimum, sauf s'il ne reste vraiment que ça à faire", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-25", estimatedMinutes: 20 })], [], prefs(), NOW);
    const slots = plan.days.flatMap((day) => day.slots);
    expect(slots).toHaveLength(1);
    expect(slots[0].minutes).toBe(20);
  });

  it("un gros travail lointain n'est pas émietté en créneaux minuscules", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-27", estimatedMinutes: 90 })], [], prefs(), NOW);
    for (const slot of plan.days.flatMap((day) => day.slots)) {
      expect(slot.minutes).toBeGreaterThanOrEqual(MIN_SLOT_MINUTES);
    }
  });

  it("les travaux terminés ou abandonnés ne sont jamais planifiés", () => {
    const items = [item({ id: "a", status: "terminé" }), item({ id: "b", status: "abandonné" })];
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plan.days.every((day) => day.slots.length === 0)).toBe(true);
  });

  it("chaque créneau porte une justification issue de la priorité réelle", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-15" })], [], prefs(), NOW);
    expect(plan.days[0].slots[0].reason).toBe("À rendre demain.");
  });

  it("SCÉNARIO F — le samedi porte sa vraie capacité, et le planificateur s'en sert quand il en a besoin", () => {
    // Lundi→vendredi n'offrent que 5 × 60 = 300 min ; le samedi en ajoute 120.
    // Un travail de 400 min dû samedi ne tient QUE si le week-end compte double.
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 400 })], [], prefs(), NOW);
    const saturday = plan.days.find((day) => day.date === "2026-09-19")!;
    expect(saturday.load.capacityMinutes).toBe(120);
    expect(saturday.load.plannedMinutes).toBeGreaterThan(60);
    expect(plannedFor(plan, "w-1")).toBe(400);
    expect(plan.unplaceable).toEqual([]);
  });

  it("un étalement régulier ne gonfle pas artificiellement le week-end quand tout tient déjà", () => {
    // 300 min sur six jours : 50 par jour suffit, le samedi n'a aucune raison
    // d'en absorber davantage. Étaler, ce n'est pas remplir au maximum.
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 300 })], [], prefs(), NOW);
    expect(plannedFor(plan, "w-1")).toBe(300);
    for (const day of plan.days) {
      for (const slot of day.slots) expect(slot.minutes).toBeLessThanOrEqual(60);
    }
  });
});

describe("un travail surdimensionné n'affame pas ceux qui tiennent encore", () => {
  /**
   * RÉGRESSION OBSERVÉE EN PARCOURS RÉEL, pas une précaution théorique.
   *
   * Un « concours blanc » estimé à 10 h pour après-demain arrivait en tête
   * par son score d'urgence, absorbait toute la capacité de la semaine, et
   * rendait infaisable un DM qui tenait parfaitement avant lui. Une seule
   * saisie trop ambitieuse suffisait à détruire le planning entier.
   */
  const items = [
    item({ id: "dm", title: "DM de maths", dueDate: "2026-09-17", estimatedMinutes: 120 }),
    item({ id: "concours", title: "Concours blanc", kind: "concours", dueDate: "2026-09-16", estimatedMinutes: 600 }),
  ];

  it("le DM réalisable est entièrement placé, malgré un travail plus urgent et infaisable", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plannedFor(plan, "dm")).toBe(120);
    expect(plan.unplaceable.map((entry) => entry.item.id)).toEqual(["concours"]);
  });

  it("le travail infaisable n'est pas abandonné pour autant : il prend tout ce qui reste", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    expect(plannedFor(plan, "concours")).toBeGreaterThan(0);
  });

  it("et le manque annoncé correspond à ce qui n'a pas trouvé de place", () => {
    const plan = buildWeeklyPlan(items, [], prefs(), NOW);
    const blocked = plan.unplaceable[0];
    expect(blocked.missingMinutes).toBe(600 - plannedFor(plan, "concours"));
  });
});

describe("un travail en retard se rattrape, il ne se lisse pas", () => {
  /**
   * DÉFAUT OBSERVÉ À L'ÉCRAN. Un TP dû avant-hier était réparti en quinze
   * minutes par jour sur les quatorze jours de l'horizon : il apparaissait
   * dans CHAQUE journée du planning, sans jamais avancer. Un travail en
   * retard doit être servi au plus tôt.
   */
  it("un travail en retard est concentré sur les premiers jours, pas étalé sur l'horizon", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-12", estimatedMinutes: 90 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1")).toEqual(["2026-09-14", "2026-09-15"]);
  });

  it("un travail sans échéance ne saupoudre pas non plus toutes les journées", () => {
    const plan = buildWeeklyPlan([item({ dueDate: null, estimatedMinutes: 90 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1").length).toBeLessThanOrEqual(2);
  });

  it("alors qu'un travail à échéance future reste bien étalé", () => {
    const plan = buildWeeklyPlan([item({ dueDate: "2026-09-19", estimatedMinutes: 120 })], [], prefs(), NOW);
    expect(daysFor(plan, "w-1").length).toBeGreaterThan(2);
  });
});
