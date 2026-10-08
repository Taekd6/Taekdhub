import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import { buildBriefing } from "@/lib/briefing";
import { declaredCapacityMinutes, plannableMinutes } from "@/lib/capacity";
import { addLockCards, courseLocks, dueLockCards, lockSessionHref } from "@/lib/course-lock";
import { computeDailyObjective } from "@/lib/daily-objective";
import { buildDayAgenda } from "@/lib/day-agenda";
import { computeFeasibility } from "@/lib/deadlines";
import { effectiveDailyGoal, eveningPlan } from "@/lib/evening-minimums";
import { computeNextMove, rankCandidates, type MoveCandidate, type NextMoveInput } from "@/lib/next-move/engine";
import { recordProposal, resolveOutcomes } from "@/lib/next-move/history";
import { buildWeeklyPlan, postponeWorkItem, PLANNING_HORIZON_DAYS } from "@/lib/planning";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, type NextMoveRecord, type Preferences, type WorkItem } from "@/lib/storage";
import { computeSubjectTargets } from "@/lib/subject-targets";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SCÉNARIOS D'ÉLÈVE — de bout en bout, au niveau des bibliothèques.
 *
 * Chaque bloc rejoue une situation réelle et regarde ce que disent ENSEMBLE
 * les modules qui alimentent l'accueil : Next Move, « Le reste de ta
 * journée » (agenda), les alertes, l'objectif du jour, le planning des
 * échéances, Le point. Les tests par module vérifient chaque calcul ; ceux-ci
 * vérifient que l'élève ne reçoit pas deux consignes contradictoires.
 *
 * `it.fails` : le comportement ACTUEL contredit le comportement visé, et
 * la correction n'appartient pas encore au lot en cours (budget du jour
 * unique : P0-2 ; planning et minimum du soir : P0-3). Le test RÉUSSIT tant que le défaut existe ; le jour où il est
 * corrigé, il échoue, et il suffit de remplacer `it.fails` par `it`.
 */

/* ── Fabriques ───────────────────────────────────────────────────── */

/** Lundi 14 septembre 2026, heure locale. */
const monday = (hour: number, minute = 0) => new Date(2026, 8, 14, hour, minute);
const NO_EVENING: Preferences["eveningMinimums"] = [{}, {}, {}, {}, {}, {}, {}];
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

/** Préférences par défaut : celles d'un élève qui n'a rien réglé (ou qui a gardé les valeurs de départ). */
const DEFAULTS = normalizePreferences({});

/** Préférences neutres, pour isoler un mécanisme : aucun minimum, aucun budget, capacité et marge explicites. */
function neutral(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: NO_EVENING, weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [60, 60, 60, 60, 60, 60, 60], planningMarginPercent: 0, ...overrides });
}

let seq = 0;
function session(subject: Subject, minutes: number, start: Date, workItemId: string | null = null): WorkSession {
  seq += 1;
  return { id: `s${seq}`, subject, exercise_id: null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(), duration_seconds: minutes * 60, note: null, created_at: start.toISOString(), result: null, hints_used: null, work_item_id: workItemId };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  seq += 1;
  return { id: `w${seq}`, title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: "2026-09-18", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-10T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: DEFAULTS, history: [], now: monday(20), availableMinutes: null, ...overrides };
}

const unplaceableOf = (plan: ReturnType<typeof buildWeeklyPlan>, id: string) => plan.unplaceable.find((entry) => entry.item.id === id) ?? null;

/* ── 1. Lundi soir, toute la capacité passée en maths, préférences par défaut ── */

/*
 * Avant P0-1, il suffisait de 2 h de maths : les anciens défauts (3 h 30 de
 * minimum pour 2 h déclarées) rendaient la contradiction systématique. Avec
 * des défauts cohérents, elle demande que l'élève passe TOUTE sa capacité
 * déclarée (3 h 10) dans une seule matière — situation toujours réelle, et
 * toujours contradictoire tant que le budget du jour n'est pas unique (P0-2).
 */
describe("SCÉNARIO — lundi 21 h, 3 h 10 de maths faites, préférences par défaut", () => {
  const scenario = input({ sessions: [session("Mathématiques", 190, monday(17))], now: monday(21) });

  it("constat : le minimum du soir de physique n'est pas atteint, et l'alerte le dit", () => {
    const physics = eveningPlan(DEFAULTS, scenario.sessions, scenario.now).entries.find((entry) => entry.subject === "Physique")!;
    expect(physics).toMatchObject({ doneMinutes: 0, met: false });
    expect(computeAlerts(scenario).some((alert) => alert.id.startsWith("soir"))).toBe(true);
  });

  // P0-2 — Next Move s'arrêtait à la capacité DÉCLARÉE (190 min) pendant qu'un minimum restait à faire.
  it("Next Move ne dit pas « assez pour aujourd'hui » tant qu'un minimum du soir reste à faire", () => {
    expect(computeNextMove(scenario).status).not.toBe("repos");
  });

  it("…et propose précisément ce minimum : la physique", () => {
    expect(computeNextMove(scenario).primary).toMatchObject({ kind: "bloc", subject: "Physique" });
  });

  it("témoin : capacité atteinte ET minimums faits, « assez pour aujourd'hui » revient", () => {
    // Une carte à revoir : sans aucune proposition, le moteur répondrait « vide », pas « repos ».
    const card = createReviewItem({ subject: "Anglais", text: "to wield", kind: "à apprendre" }, new Date(2026, 8, 10))!;
    const done = input({ sessions: [session("Mathématiques", 190, monday(16)), session("Physique", 60, monday(19, 30))], reviewItems: [card], now: monday(21) });
    expect(eveningPlan(DEFAULTS, done.sessions, done.now).allMet).toBe(true);
    expect(computeNextMove(done).status).toBe("repos");
  });

  // P0-2 — l'alerte réclamait la physique pendant que Next Move conseillait de s'arrêter.
  it("l'alerte du soir et Next Move ne se contredisent pas", () => {
    const eveningAlert = computeAlerts(scenario).some((alert) => alert.id.startsWith("soir"));
    const rest = computeNextMove(scenario).status === "repos";
    expect(eveningAlert && rest).toBe(false);
  });

  // P0-2 — l'agenda réduisait la physique de 50 à 20 min, puis affirmait que rien n'avait été compressé.
  it("l'agenda ne prétend pas « rien n'a été compressé » quand il vient de réduire une tâche", () => {
    const agenda = buildDayAgenda(scenario);
    expect(agenda.kept.some((task) => task.reducedFrom !== null)).toBe(true);
    expect(agenda.summary).not.toContain("Rien n'a été compressé");
    // Le dépassement reste dit, avec son chiffre, et l'arbitrage reste à l'élève.
    expect(agenda.summary).toContain("dépasse ton temps restant de 20 min");
  });

  // Corrigé par P0-1 : l'objectif du jour (max(objectif, minimums) = 2 h 30) tient dans la capacité déclarée (3 h 10).
  it("l'objectif du jour ne dépasse pas la capacité déclarée du jour", () => {
    expect(computeDailyObjective(scenario.sessions, effectiveDailyGoal(DEFAULTS, scenario.now), scenario.now).goalMinutes).toBeLessThanOrEqual(
      declaredCapacityMinutes(DEFAULTS, scenario.now)
    );
  });
});

/* ── 2. Règle produit : le minimum du soir fait partie de la capacité ─ */

describe("RÈGLE — le minimum du soir tient dans la capacité du jour", () => {
  // Corrigé par P0-1 — le détail (capacité PLANIFIABLE, saisie refusée, ancien réglage signalé) est dans lib/evening-minimum-rule.test.ts.
  it("les préférences par défaut respectent la règle, jour par jour", () => {
    for (let day = 0; day < 7; day += 1) {
      const minimum = Object.values(DEFAULTS.eveningMinimums[day] ?? {}).reduce((sum: number, value) => sum + (value ?? 0), 0);
      expect(minimum).toBeLessThanOrEqual(plannableMinutes(DEFAULTS, new Date(2026, 8, 14 + day)));
    }
  });
});

/* ── 3. Un DM avec échéance, préférences par défaut ─────────────────── */

/*
 * Préférences par défaut : 152 min planifiables du lundi au vendredi, dont
 * 150 de minimum (90 maths + 60 physique) les lundi, mercredi, jeudi et
 * vendredi ; le mardi est libre. Règle (décision produit) : une séance sur
 * un DM de PHYSIQUE compte pour le minimum de physique — le planning peut
 * donc lui donner la réserve de physique, jamais celle de maths.
 */
describe("SCÉNARIO — lundi 17 h, gros DM de physique (10 h) à rendre vendredi", () => {
  const dm = workItem({ id: "dm-physique", title: "DM 3", subject: "Physique", estimatedMinutes: 600, dueDate: "2026-09-18" });

  it("le planning ne lui donne que ce que le minimum de maths laisse : 62 min les soirs de minimum, 152 le mardi", () => {
    const plan = buildWeeklyPlan([dm], [], DEFAULTS, monday(17));
    expect(plan.days.slice(0, 5).map((day) => day.load.plannedMinutes)).toEqual([62, 152, 62, 62, 62]);
  });

  it("la charge affichée compte la réserve de maths restante : chaque soir de minimum est plein, pas « libre »", () => {
    const monday0 = buildWeeklyPlan([dm], [], DEFAULTS, monday(17)).days[0].load;
    expect(monday0).toMatchObject({ plannedMinutes: 62, reservedMinutes: 90, committedMinutes: 152, capacityMinutes: 152 });
  });

  it("ce qui ne tient pas est dit, avec les chiffres — et la faisabilité dit exactement la même chose", () => {
    const plan = buildWeeklyPlan([dm], [], DEFAULTS, monday(17));
    expect(unplaceableOf(plan, dm.id)).toMatchObject({ cause: "capacité-insuffisante", missingMinutes: 200 });
    expect(unplaceableOf(plan, dm.id)!.reason).toContain("6 h 40 disponibles");
    expect(computeFeasibility(dm, [], DEFAULTS, monday(17))).toMatchObject({ level: "non casable", availableMinutes: 400, shortfallMinutes: 200 });
  });

  it("témoin : sans minimum du soir, l'agenda garde bien la part du jour du DM", () => {
    const agenda = buildDayAgenda(input({ workItems: [dm], preferences: neutral({ capacityByWeekday: [120, 120, 120, 120, 120, 240, 180] }), now: monday(17) }));
    expect(agenda.kept.some((task) => task.key === `échéance:${dm.id}`)).toBe(true);
  });

  // P0-3 — le planning ignorait le minimum du soir : 120 min réservées au DM aujourd'hui, plus 150 min de
  // minimum, pour 152 min planifiables. Le temps du DM de physique compte pour le minimum de physique :
  // seule la part du minimum que les créneaux de la même matière ne couvrent pas s'ajoute.
  it("la part du jour réservée par le planning et le minimum du soir tiennent ensemble dans la capacité planifiable", () => {
    const today = buildWeeklyPlan([dm], [], DEFAULTS, monday(17)).days[0];
    const planned = new Map<string, number>();
    for (const slot of today.slots) planned.set(slot.subject ?? "", (planned.get(slot.subject ?? "") ?? 0) + slot.minutes);
    const uncovered = eveningPlan(DEFAULTS, [], monday(17)).entries.reduce((sum, entry) => sum + Math.max(0, entry.minMinutes - entry.doneMinutes - (planned.get(entry.subject) ?? 0)), 0);
    expect(today.load.plannedMinutes + uncovered).toBeLessThanOrEqual(today.load.capacityMinutes);
  });

  it("l'agenda du jour garde la part du DM au lieu de la repousser", () => {
    const agenda = buildDayAgenda(input({ workItems: [dm], now: monday(17) }));
    expect(agenda.postponed.some((task) => task.key === `échéance:${dm.id}`)).toBe(false);
  });
});

describe("PLANNING ET MINIMUM DU SOIR (P0-3)", () => {
  it("un travail d'une AUTRE matière n'entame jamais le minimum du soir : il passe au jour sans minimum", () => {
    // Lundi 8 h, français pour mercredi : lundi et mercredi n'ont que 2 min hors minimum, mardi est libre.
    const essay = workItem({ id: "fr", title: "Dissertation", subject: "Français", estimatedMinutes: 60, dueDate: "2026-09-16" });
    const plan = buildWeeklyPlan([essay], [], DEFAULTS, monday(8));
    expect(plan.days.slice(0, 3).map((day) => day.load.plannedMinutes)).toEqual([0, 60, 0]);
    expect(plan.days.slice(0, 3).map((day) => day.load.reservedMinutes)).toEqual([150, 0, 150]);
    expect(unplaceableOf(plan, "fr")).toBeNull();
  });

  it("le DM de physique remplit le minimum de physique, et laisse la part libre aux autres matières", () => {
    // Lundi : 120 min planifiables, dont 60 réservées au minimum de physique, 60 libres.
    const prefs = neutral({ capacityByWeekday: [120, 120, 120, 120, 120, 120, 120], eveningMinimums: [{ Physique: 60 }, {}, {}, {}, {}, {}, {}] });
    const physics = workItem({ id: "phy", subject: "Physique", estimatedMinutes: 60, dueDate: "2026-09-14", important: true });
    const french = workItem({ id: "fr", subject: "Français", estimatedMinutes: 60, dueDate: "2026-09-14" });
    const plan = buildWeeklyPlan([physics, french], [], prefs, monday(8));
    expect(plan.days[0].slots.map((slot) => [slot.workItemId, slot.minutes])).toEqual([
      ["phy", 60],
      ["fr", 60],
    ]);
    expect(plan.unplaceable).toEqual([]);
  });

  it("le temps déjà fait aujourd'hui dans une matière réduit d'autant ce qui lui reste réservé", () => {
    // 60 min de maths faites : il reste 30 min de maths et 60 de physique à réserver, sur 92 min encore planifiables.
    const essay = workItem({ id: "fr", subject: "Français", estimatedMinutes: 30, dueDate: "2026-09-14" });
    const plan = buildWeeklyPlan([essay], [session("Mathématiques", 60, monday(14))], DEFAULTS, monday(17));
    expect(plan.days[0].load.plannedMinutes).toBe(0);
    expect(unplaceableOf(plan, "fr")).toMatchObject({ missingMinutes: 30 });
    expect(computeFeasibility(essay, [session("Mathématiques", 60, monday(14))], DEFAULTS, monday(17)).availableMinutes).toBe(2);
  });

  it("réglage incohérent (minimum > capacité) : rien ne dépasse la capacité planifiable, rien n'est inventé", () => {
    const incoherent = neutral({ capacityByWeekday: [60, 60, 60, 60, 60, 60, 60], eveningMinimums: [{ Mathématiques: 90, Physique: 60 }, {}, {}, {}, {}, {}, {}] });
    const dm = workItem({ id: "p", subject: "Physique", estimatedMinutes: 60, dueDate: "2026-09-15" });
    const plan = buildWeeklyPlan([dm], [], incoherent, monday(8));
    for (const day of plan.days) expect(day.load.plannedMinutes).toBeLessThanOrEqual(day.load.capacityMinutes);
    // Lundi est entièrement pris par le minimum de maths : le DM passe mardi, en entier, et tient.
    expect(plan.days[0].slots).toEqual([]);
    expect(plan.days[1].slots).toMatchObject([{ workItemId: "p", minutes: 60 }]);
    expect(unplaceableOf(plan, "p")).toBeNull();
  });

  it("sans minimum du soir, rien ne change (non-régression)", () => {
    const dm = workItem({ estimatedMinutes: 120, dueDate: "2026-09-17" });
    expect(buildWeeklyPlan([dm], [], neutral(), monday(8)).days.slice(0, 4).map((day) => day.load.plannedMinutes)).toEqual([30, 30, 30, 30]);
  });
});

/* ── 4. Nouvel élève, arrivé en milieu de semaine ───────────────────── */

describe("SCÉNARIO — nouvel élève, première ouverture un mercredi midi", () => {
  const wednesday = new Date(2026, 8, 16, 12, 0);

  it("sans aucune donnée ni réglage, Next Move l'invite honnêtement au lieu d'inventer une urgence", () => {
    expect(computeNextMove(input({ preferences: neutral(), now: wednesday })).status).toBe("vide");
  });

  // Budgets hebdo : avec zéro séance enregistrée, rien ne permet de juger un rythme.
  it.fails("sans aucune séance enregistrée, aucune matière n'est « en retard » sur la semaine", () => {
    const targets = computeSubjectTargets([], DEFAULTS.weeklySubjectTargets, wednesday, DEFAULTS.capacityByWeekday);
    expect(targets.filter((target) => target.pace === "en retard")).toEqual([]);
  });
});

/* ── 5. Planning : impossibilités, et leur vrai motif ───────────────── */

describe("PLANNING — chaque impossibilité dit son vrai motif (P1-3)", () => {
  const NOW = monday(8);

  it("capacité nulle partout : « aucune capacité », jamais « journées déjà pleines »", () => {
    const dm = workItem({ dueDate: "2026-09-17" });
    const blocked = unplaceableOf(buildWeeklyPlan([dm], [], neutral({ capacityByWeekday: [0, 0, 0, 0, 0, 0, 0] }), NOW), dm.id)!;
    expect(blocked.cause).toBe("aucune-capacité");
    expect(blocked.reason).not.toContain("pleines");
    expect(blocked.missingMinutes).toBe(120);
  });

  it("capacité insuffisante, même seul : le motif cite les deux nombres", () => {
    // DM pour mercredi, 5 h restantes, 1 h par jour : 3 h disponibles (lundi → mercredi).
    const dm = workItem({ estimatedMinutes: 300, dueDate: "2026-09-16" });
    const blocked = unplaceableOf(buildWeeklyPlan([dm], [], neutral(), NOW), dm.id)!;
    expect(blocked.cause).toBe("capacité-insuffisante");
    expect(blocked.missingMinutes).toBe(120);
    expect(blocked.reason).toContain("5 h");
    expect(blocked.reason).toContain("3 h");
    expect(blocked.reason).not.toContain("pleines");
  });

  it("journées prises par un autre travail : « déjà pleines », et seulement dans ce cas", () => {
    const first = workItem({ id: "a", title: "TP", estimatedMinutes: 180, dueDate: "2026-09-16", important: true });
    const second = workItem({ id: "b", title: "DM", estimatedMinutes: 60, dueDate: "2026-09-16" });
    const plan = buildWeeklyPlan([first, second], [], neutral(), NOW);
    expect(unplaceableOf(plan, "a")).toBeNull();
    expect(unplaceableOf(plan, "b")).toMatchObject({ cause: "journées-pleines", missingMinutes: 60 });
  });

  it("plusieurs échéances le même jour : servies par priorité, jamais au-delà de la capacité ni après l'échéance", () => {
    const items = [
      workItem({ id: "x", title: "DM maths", estimatedMinutes: 60, dueDate: "2026-09-17" }),
      workItem({ id: "y", title: "DM physique", subject: "Physique", estimatedMinutes: 60, dueDate: "2026-09-17", important: true }),
      workItem({ id: "z", title: "TD info", subject: "Informatique TC", estimatedMinutes: 90, dueDate: "2026-09-17" }),
    ];
    const plan = buildWeeklyPlan(items, [], neutral(), NOW);
    // 4 jours × 60 min = 240 min pour 210 min de travail : tout tient.
    expect(plan.unplaceable).toEqual([]);
    for (const day of plan.days) expect(day.load.plannedMinutes).toBeLessThanOrEqual(60);
    expect(plan.days.filter((day) => day.date > "2026-09-17").every((day) => day.slots.length === 0)).toBe(true);
    // L'important passe devant : il commence le premier jour.
    expect(plan.days[0].slots[0].workItemId).toBe("y");
  });

  it("plusieurs échéances le même jour qui ne tiennent pas ensemble : le manque tombe sur le moins prioritaire", () => {
    const items = [
      workItem({ id: "x", estimatedMinutes: 120, dueDate: "2026-09-15", important: true }),
      workItem({ id: "y", subject: "Physique", estimatedMinutes: 60, dueDate: "2026-09-15" }),
    ];
    const plan = buildWeeklyPlan(items, [], neutral(), NOW);
    expect(unplaceableOf(plan, "x")).toBeNull();
    expect(unplaceableOf(plan, "y")).toMatchObject({ cause: "journées-pleines", missingMinutes: 60 });
  });

  it("travail sans échéance reporté au-delà de l'horizon : le planning n'invente aucune impossibilité", () => {
    const revision = workItem({ dueDate: null, notBeforeDate: "2026-10-30" });
    expect(unplaceableOf(buildWeeklyPlan([revision], [], neutral(), NOW), revision.id)).toBeNull();
  });

  it("travail EN RETARD reporté au-delà de l'horizon : pas de « avant l'échéance » — le retard est déjà dit ailleurs", () => {
    const late = workItem({ dueDate: "2026-09-10", notBeforeDate: "2026-10-30" });
    expect(unplaceableOf(buildWeeklyPlan([late], [], neutral(), NOW), late.id)).toBeNull();
  });

  it("travail reporté APRÈS son échéance : le motif le dit", () => {
    const dm = workItem({ dueDate: "2026-09-16", notBeforeDate: "2026-09-17" });
    const blocked = unplaceableOf(buildWeeklyPlan([dm], [], neutral(), NOW), dm.id)!;
    expect(blocked.cause).toBe("reporté-après-échéance");
    expect(blocked.missingMinutes).toBe(120);
  });

  it("échéance au-delà de l'horizon : toujours rien d'affirmé (non-régression)", () => {
    const far = workItem({ estimatedMinutes: 2000, dueDate: "2026-10-24" });
    expect(unplaceableOf(buildWeeklyPlan([far], [], neutral(), NOW), far.id)).toBeNull();
  });

  it("« prochain jour disponible » sans aucune capacité sur l'horizon : le report le dit, au lieu de se taire", () => {
    const dm = workItem({ dueDate: null });
    const outcome = postponeWorkItem([dm], [], neutral({ capacityByWeekday: [0, 0, 0, 0, 0, 0, 0] }), dm.id, "prochain-jour-disponible", NOW);
    expect(outcome.warning).not.toBeNull();
    expect(outcome.warning).toContain(`${PLANNING_HORIZON_DAYS}`);
  });
});

/* ── 6. Report : la faisabilité et le planning disent la même chose ─── */

describe("REPORT — la faisabilité tient compte du « pas avant » (P1-2)", () => {
  const NOW = monday(8);

  it("un DM reporté au jour de son échéance n'a plus que ce jour-là : faisabilité et planning s'accordent", () => {
    // 2 h restantes, 1 h par jour, échéance jeudi, reporté à jeudi : 1 h disponible.
    const dm = workItem({ dueDate: "2026-09-17", notBeforeDate: "2026-09-17" });
    const feasibility = computeFeasibility(dm, [], neutral(), NOW);
    expect(feasibility).toMatchObject({ level: "non casable", availableMinutes: 60, shortfallMinutes: 60 });
    expect(unplaceableOf(buildWeeklyPlan([dm], [], neutral(), NOW), dm.id)?.missingMinutes).toBe(60);
  });

  it("reporté après l'échéance : plus aucune minute disponible", () => {
    const dm = workItem({ dueDate: "2026-09-16", notBeforeDate: "2026-09-17" });
    expect(computeFeasibility(dm, [], neutral(), NOW)).toMatchObject({ level: "non casable", availableMinutes: 0 });
  });

  it("un « pas avant » déjà passé ne change rien (non-régression)", () => {
    const dm = workItem({ dueDate: "2026-09-17", notBeforeDate: "2026-09-10" });
    expect(computeFeasibility(dm, [], neutral(), NOW)).toMatchObject({ level: "casable", availableMinutes: 240 });
  });

  it("tâche reportée trois fois : l'échéance ne bouge jamais, et chaque verdict concorde avec le planning", () => {
    let items = [workItem({ id: "dm", dueDate: "2026-09-18", estimatedMinutes: 180 })];
    const days = [monday(8), new Date(2026, 8, 15, 8), new Date(2026, 8, 16, 8)];
    const outcomes = days.map((now) => {
      const outcome = postponeWorkItem(items, [], neutral(), "dm", "demain", now);
      items = outcome.workItems;
      return { now, outcome };
    });
    expect(items[0].dueDate).toBe("2026-09-18");
    expect(items[0].postponements).toHaveLength(3);
    expect(items[0].notBeforeDate).toBe("2026-09-17");
    for (const { now, outcome } of outcomes) {
      const feasible = computeFeasibility(outcome.workItems[0], [], neutral(), now).level !== "non casable";
      expect(feasible).toBe(!outcome.breaksDeadline);
    }
    // Le troisième report laisse jeudi et vendredi (2 h) pour 3 h : il casse l'échéance, et le dit.
    expect(outcomes[2].outcome.breaksDeadline).toBe(true);
    expect(outcomes[2].outcome.warning).toContain("1 h");
  });
});

/* ── 7. Historique Next Move : suivi par un autre chemin (P1-1) ─────── */

describe("HISTORIQUE — une proposition suivie sans passer par « Commencer » n'est pas « ignorée »", () => {
  const NOW = new Date(2026, 8, 16, 18, 0); // mercredi 18 h
  const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
  const prefs = neutral({ eveningMinimums: [{}, {}, { Chimie: 60 }, {}, {}, {}, {}], capacityByWeekday: [240, 240, 240, 240, 240, 240, 240] });

  function chemistryBlock(): MoveCandidate {
    const block = rankCandidates(input({ preferences: prefs, now: NOW })).find((candidate) => candidate.key === "bloc:Chimie");
    if (!block) throw new Error("le bloc de chimie devrait exister (minimum du soir)");
    return block;
  }

  /** Trois propositions, à 12 h d'intervalle, dans la fenêtre des 72 h. */
  function proposals(): NextMoveRecord[] {
    let history: NextMoveRecord[] = [];
    for (const [index, hours] of [48, 36, 24].entries()) history = recordProposal(history, chemistryBlock(), 40, ["Minimum du soir"], hoursAgo(hours), `p${index}`);
    return history;
  }

  /** Après chaque proposition, 45 min de chimie au chrono — sans avoir touché « Commencer ». */
  const followed = [48, 36, 24].map((hours) => session("Chimie", 45, hoursAgo(hours - 0.5)));
  const sources = { sessions: followed, reviewItems: [], chapterMemory: [] };

  it("témoin : sans aucune trace, trois propositions restent « proposé », et le moteur varie", () => {
    const history = proposals();
    expect(resolveOutcomes(history, { sessions: [], reviewItems: [], chapterMemory: [] }, NOW)).toBe(history);
    const block = rankCandidates(input({ preferences: prefs, now: NOW, history })).find((candidate) => candidate.key === "bloc:Chimie")!;
    expect(block.terms.map((term) => term.id)).toContain("ignoré");
  });

  it("avec la trace des séances : chaque proposition devient « fait »", () => {
    const resolved = resolveOutcomes(proposals(), sources, NOW);
    expect(resolved.map((record) => record.status)).toEqual(["fait", "fait", "fait"]);
    expect(resolved.every((record) => record.startedAt === null && (record.outcomeMinutes ?? 0) >= 45)).toBe(true);
  });

  it("le moteur ne la pénalise plus comme « ignorée »", () => {
    const history = resolveOutcomes(proposals(), sources, NOW);
    const block = rankCandidates(input({ preferences: prefs, now: NOW, history, sessions: followed })).find((candidate) => candidate.key === "bloc:Chimie")!;
    expect(block.terms.map((term) => term.id)).not.toContain("ignoré");
  });

  it("Le point ne dit plus « souvent remis à plus tard » — même si l'accueil n'a pas encore constaté l'issue", () => {
    const briefing = buildBriefing({ ...input({ preferences: prefs, now: NOW, sessions: followed }), history: proposals() });
    expect(briefing.postponed.map((item) => item.id)).not.toContain("matière-repoussée:Chimie");
  });

  it("une séance dans une AUTRE matière ne suffit pas (non-régression de la règle « l'issue se constate »)", () => {
    const elsewhere = [48, 36, 24].map((hours) => session("Physique", 45, hoursAgo(hours - 0.5)));
    const resolved = resolveOutcomes(proposals(), { sessions: elsewhere, reviewItems: [], chapterMemory: [] }, NOW);
    expect(resolved.map((record) => record.status)).toEqual(["proposé", "proposé", "proposé"]);
  });
});

/* ── 8. Verrou de cours : le filtre survit jusqu'à la séance (P1-8) ─── */

describe("VERROU DE COURS — « Cours d'abord : chapitre » ouvre les fiches de CE chapitre", () => {
  const created = new Date(2026, 8, 14, 18, 0);
  const NOW = new Date(2026, 8, 15, 18, 0);
  const lockCards = addLockCards([], [
    { matiere: "maths", chapitre: "Réduction", recto: "Critère de diagonalisabilité ?", verso: "π scindé à racines simples" },
    { matiere: "maths", chapitre: "Réduction", recto: "Lemme des noyaux ?", verso: "P = P₁P₂ premiers entre eux" },
  ], created);
  const ordinary = createReviewItem({ subject: "Mathématiques", text: "Formule de Taylor-Lagrange", kind: "à revoir" }, created)!;
  const items = [...(lockCards.ok ? lockCards.items : []), ordinary];

  it("les fiches du verrou et une carte ordinaire de la même matière sont dues", () => {
    expect(items.filter((item) => item.subject === "Mathématiques")).toHaveLength(3);
  });

  it("la séance filtrée par verrou ne contient que les fiches du chapitre", () => {
    const lock = courseLocks(items, NOW)[0];
    expect(dueLockCards(items, NOW, lock.key).map((item) => item.text)).toEqual(["Critère de diagonalisabilité ?", "Lemme des noyaux ?"]);
  });

  it("Next Move et l'alerte mènent à cette séance filtrée", () => {
    const lock = courseLocks(items, NOW)[0];
    const href = lockSessionHref(lock);
    expect(href).toContain(`verrou=${encodeURIComponent(lock.key)}`);
    const candidate = rankCandidates(input({ reviewItems: items, now: NOW, preferences: neutral() })).find((entry) => entry.key === `verrou:${lock.key}`)!;
    expect(candidate.href).toBe(href);
    expect(computeAlerts({ sessions: [], workItems: [], reviewItems: items, preferences: neutral(), now: NOW }).find((alert) => alert.id.startsWith("verrou:"))?.href).toBe(href);
  });
});
