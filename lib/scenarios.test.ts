import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import { buildBriefing } from "@/lib/briefing";
import { declaredCapacityMinutes } from "@/lib/capacity";
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
 * la correction n'appartient pas à ce lot (budget du jour unique, valeurs par
 * défaut). Le test RÉUSSIT tant que le défaut existe ; le jour où il est
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
const plannedFor = (plan: ReturnType<typeof buildWeeklyPlan>, id: string) =>
  plan.days.flatMap((day) => day.slots).filter((slot) => slot.workItemId === id).reduce((total, slot) => total + slot.minutes, 0);

/* ── 1. Lundi soir, 2 h de maths faites, préférences par défaut ─────── */

describe("SCÉNARIO — lundi 20 h, 2 h de maths faites, préférences par défaut", () => {
  const scenario = input({ sessions: [session("Mathématiques", 120, monday(17))] });

  it("constat : le minimum du soir de physique n'est pas atteint, et l'alerte le dit", () => {
    const physics = eveningPlan(DEFAULTS, scenario.sessions, scenario.now).entries.find((entry) => entry.subject === "Physique")!;
    expect(physics).toMatchObject({ doneMinutes: 0, met: false });
    expect(computeAlerts(scenario).some((alert) => alert.id.startsWith("soir"))).toBe(true);
  });

  // P0-2 — Next Move s'arrête à la capacité DÉCLARÉE (120 min) pendant qu'un minimum reste à faire.
  it.fails("Next Move ne dit pas « assez pour aujourd'hui » tant qu'un minimum du soir reste à faire", () => {
    expect(computeNextMove(scenario).status).not.toBe("repos");
  });

  // P0-2 — l'alerte réclame la physique pendant que Next Move conseille de s'arrêter.
  it.fails("l'alerte du soir et Next Move ne se contredisent pas", () => {
    const eveningAlert = computeAlerts(scenario).some((alert) => alert.id.startsWith("soir"));
    const rest = computeNextMove(scenario).status === "repos";
    expect(eveningAlert && rest).toBe(false);
  });

  // P0-2 — l'agenda réduit la physique de 50 à 20 min, puis affirme que rien n'a été compressé.
  it.fails("l'agenda ne prétend pas « rien n'a été compressé » quand il vient de réduire une tâche", () => {
    const agenda = buildDayAgenda(scenario);
    expect(agenda.kept.some((task) => task.reducedFrom !== null)).toBe(true);
    expect(agenda.summary).not.toContain("Rien n'a été compressé");
  });

  // P0-1 / P0-2 — objectif du jour (max(objectif, minimums) = 3 h 30) au-delà de la capacité déclarée (2 h).
  it.fails("l'objectif du jour ne dépasse pas la capacité déclarée du jour", () => {
    expect(computeDailyObjective(scenario.sessions, effectiveDailyGoal(DEFAULTS, scenario.now), scenario.now).goalMinutes).toBeLessThanOrEqual(
      declaredCapacityMinutes(DEFAULTS, scenario.now)
    );
  });
});

/* ── 2. Règle produit : le minimum du soir fait partie de la capacité ─ */

describe("RÈGLE — le minimum du soir tient dans la capacité du jour", () => {
  // P0-1 — décision prise : le minimum fait partie de la capacité. Les valeurs par défaut la violent
  // (3 h 30 de minimum pour 2 h déclarées, 4 soirs par semaine). Les défauts ne changent pas dans ce lot.
  it.fails("les préférences par défaut respectent la règle, jour par jour", () => {
    for (let day = 0; day < 7; day += 1) {
      const minimum = Object.values(DEFAULTS.eveningMinimums[day] ?? {}).reduce((sum: number, value) => sum + (value ?? 0), 0);
      expect(minimum).toBeLessThanOrEqual(DEFAULTS.capacityByWeekday[day]);
    }
  });
});

/* ── 3. Un DM avec échéance, préférences par défaut ─────────────────── */

describe("SCÉNARIO — lundi 17 h, DM de physique de 4 h à rendre vendredi", () => {
  const dm = workItem({ id: "dm-physique", title: "DM 3", subject: "Physique", estimatedMinutes: 240, dueDate: "2026-09-18" });

  it("constat : le planning le place entièrement avant l'échéance, dont une part aujourd'hui", () => {
    const plan = buildWeeklyPlan([dm], [], DEFAULTS, monday(17));
    expect(unplaceableOf(plan, dm.id)).toBeNull();
    expect(plannedFor(plan, dm.id)).toBe(240);
    expect(plan.days[0].slots.some((slot) => slot.workItemId === dm.id)).toBe(true);
  });

  it("témoin : sans minimum du soir, l'agenda garde bien la part du jour du DM", () => {
    const agenda = buildDayAgenda(input({ workItems: [dm], preferences: neutral({ capacityByWeekday: [120, 120, 120, 120, 120, 240, 180] }), now: monday(17) }));
    expect(agenda.kept.some((task) => task.key === `échéance:${dm.id}`)).toBe(true);
  });

  // P0-3 — le planning ignore les minimums ; l'agenda les sert d'abord et repousse le DM, chaque jour.
  it.fails("la part du jour réservée par le planning n'est pas repoussée à demain par l'agenda", () => {
    const agenda = buildDayAgenda(input({ workItems: [dm], now: monday(17) }));
    expect(agenda.postponed.some((task) => task.key === `échéance:${dm.id}`)).toBe(false);
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
