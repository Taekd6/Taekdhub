import { describe, expect, it } from "vitest";
import {
  computeGoalReadiness,
  computeGoalsDailyPlan,
  computeUpcomingGoalSessions,
  describeGoalScope,
  explainGoalPlan,
  goalUrgencyWeight,
  scopeToGoal,
  serializeGoalsDailyPlan,
} from "@/lib/goals";
import type { Goal } from "@/lib/storage";
import type { Exercise, Mastery, Subject } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`,
    subject: "Mathématiques",
    title: `Exercice ${counter}`,
    statement: "",
    chapter_id: null,
    source: "Test",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    mastery: 0 as Mastery,
    status: "à faire",
    estimated_minutes: 15,
    attempts: 0,
    note: null,
    created_at: now,
    updated_at: now,
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

let goalCounter = 0;
function makeGoal(overrides: Partial<Goal> = {}): Goal {
  goalCounter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `goal-${goalCounter}`,
    title: `Objectif ${goalCounter}`,
    subjects: ["Mathématiques"],
    chapterIds: [],
    targetDate: null,
    priority: 2,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("scopeToGoal", () => {
  it("ne retient que les matières ciblées, jamais les autres", () => {
    const goal = makeGoal({ subjects: ["Physique"] });
    const maths = makeExercise({ subject: "Mathématiques" });
    const physique = makeExercise({ subject: "Physique" });
    expect(scopeToGoal(goal, [maths, physique])).toEqual([physique]);
  });

  it("exclut les exercices archivés, même dans le périmètre", () => {
    const goal = makeGoal({ subjects: ["Mathématiques"] });
    const archived = makeExercise({ subject: "Mathématiques", archived: true });
    expect(scopeToGoal(goal, [archived])).toEqual([]);
  });

  it("chapterIds vide = tout le périmètre de la/les matière(s), sans restriction supplémentaire", () => {
    const goal = makeGoal({ subjects: ["Mathématiques"], chapterIds: [] });
    const a = makeExercise({ chapter_id: "c1" });
    const b = makeExercise({ chapter_id: "c2" });
    const c = makeExercise({ chapter_id: null });
    expect(scopeToGoal(goal, [a, b, c])).toEqual([a, b, c]);
  });

  it("chapterIds non vide restreint strictement à ces chapitres", () => {
    const goal = makeGoal({ subjects: ["Mathématiques"], chapterIds: ["c1"] });
    const inScope = makeExercise({ chapter_id: "c1" });
    const outOfScope = makeExercise({ chapter_id: "c2" });
    const noChapter = makeExercise({ chapter_id: null });
    expect(scopeToGoal(goal, [inScope, outOfScope, noChapter])).toEqual([inScope]);
  });

  it("un chapitre ciblé supprimé/invalide depuis la création de l'objectif ne casse rien : périmètre simplement vide", () => {
    const goal = makeGoal({ subjects: ["Mathématiques"], chapterIds: ["chapitre-disparu"] });
    expect(scopeToGoal(goal, [makeExercise({ chapter_id: "c1" })])).toEqual([]);
  });
});

describe("computeGoalReadiness — verdict qualitatif, jamais un chiffre inventé", () => {
  it("périmètre vide (chapitre ciblé entièrement archivé) → 'pas commencé', jamais une erreur", () => {
    const goal = makeGoal({ chapterIds: ["chap-archive"] });
    const readiness = computeGoalReadiness(goal, [makeExercise({ chapter_id: "chap-archive", archived: true })], [], 60, NOW);
    expect(readiness.hasScope).toBe(false);
    expect(readiness.level).toBe("pas commencé");
    expect(readiness.flaggedCount).toBe(0);
  });

  it("tout maîtrisé, plus rien signalé → 'prêt'", () => {
    const goal = makeGoal();
    const exercises = [makeExercise({ status: "maîtrisé", mastery: 100 as Mastery, attempts: 3, last_worked_at: "2026-08-01T00:00:00.000Z" })];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.level).toBe("prêt");
    expect(readiness.flaggedCount).toBe(0);
  });

  it("objectif tout juste créé, jamais touché → 'pas commencé', même avec une échéance proche (pas 'en retard' par défaut)", () => {
    const goal = makeGoal({ targetDate: "2026-08-22T00:00:00.000Z" }); // 2 jours
    const exercises = [makeExercise(), makeExercise()];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.level).toBe("pas commencé");
  });

  it("échéance dépassée avec du travail restant → 'en retard'", () => {
    const goal = makeGoal({ targetDate: "2026-08-10T00:00:00.000Z" }); // déjà passé
    const exercises = [makeExercise({ attempts: 1, status: "en cours" })];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.daysRemaining).toBeLessThanOrEqual(0);
    expect(readiness.level).toBe("en retard");
  });

  it("rythme requis très supérieur au budget quotidien habituel → 'en retard'", () => {
    const goal = makeGoal({ targetDate: "2026-08-21T00:00:00.000Z" }); // demain
    // 20 exercices non travaillés de 30 min chacun = 600 min à faire en 1 jour, budget habituel 30 min.
    const exercises = Array.from({ length: 20 }, () => makeExercise({ estimated_minutes: 30, status: "en cours", attempts: 1 }));
    const readiness = computeGoalReadiness(goal, exercises, [], 30, NOW);
    expect(readiness.level).toBe("en retard");
  });

  it("échéance proche mais rythme requis tenable → 'bien engagé', pas 'en retard'", () => {
    const goal = makeGoal({ targetDate: "2026-09-05T00:00:00.000Z" }); // ~16 jours
    const exercises = [makeExercise({ estimated_minutes: 20, status: "en cours", attempts: 1 })];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.level).toBe("bien engagé");
  });

  it("sans échéance, couverture faible mais engagé → 'à consolider'", () => {
    const goal = makeGoal({ targetDate: null });
    const exercises = [makeExercise({ status: "en cours", attempts: 1, mastery: 25 as Mastery })];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.level).toBe("à consolider");
  });

  it("sans échéance, couverture haute → 'bien engagé'", () => {
    const goal = makeGoal({ targetDate: null });
    const exercises = [
      makeExercise({ status: "maîtrisé", mastery: 100 as Mastery, last_worked_at: "2026-01-01T00:00:00.000Z" }),
      makeExercise({ status: "en cours", attempts: 1, mastery: 75 as Mastery }),
    ];
    const readiness = computeGoalReadiness(goal, exercises, [], 60, NOW);
    expect(readiness.coveragePercent).toBeGreaterThanOrEqual(50);
    expect(readiness.level).toBe("bien engagé");
  });
});

describe("goalUrgencyWeight — Cas 1 & 2 du chantier", () => {
  it("un objectif déjà 'prêt' (rien signalé) a un poids nul — ne consomme aucun budget", () => {
    const goal = makeGoal();
    const readiness = computeGoalReadiness(goal, [makeExercise({ status: "maîtrisé", mastery: 100 as Mastery, attempts: 3, last_worked_at: "2026-08-01T00:00:00.000Z" })], [], 60, NOW);
    expect(goalUrgencyWeight(readiness)).toBe(0);
  });

  it("Cas 1 — objectif dans 3 jours + chapitre faible : poids élevé, nettement au-dessus d'un objectif sans échéance sinon identique", () => {
    const soon = makeGoal({ targetDate: "2026-08-23T00:00:00.000Z" }); // 3 jours
    const noDeadline = makeGoal({ targetDate: null });
    const exercises = [makeExercise({ status: "en cours", attempts: 1 })];
    const soonReadiness = computeGoalReadiness(soon, exercises, [], 60, NOW);
    const noDeadlineReadiness = computeGoalReadiness(noDeadline, exercises, [], 60, NOW);
    expect(goalUrgencyWeight(soonReadiness)).toBeGreaterThan(goalUrgencyWeight(noDeadlineReadiness));
  });

  it("Cas 2 — objectif dans 30 jours ne doit pas être sur-priorisé par rapport à un objectif dans 14 jours (même plafond d'urgence)", () => {
    const in14 = makeGoal({ targetDate: "2026-09-03T00:00:00.000Z" }); // 14 jours
    const in30 = makeGoal({ targetDate: "2026-09-19T00:00:00.000Z" }); // 30 jours
    const exercises = [makeExercise({ status: "en cours", attempts: 1 })];
    const readiness14 = computeGoalReadiness(in14, exercises, [], 60, NOW);
    const readiness30 = computeGoalReadiness(in30, exercises, [], 60, NOW);
    expect(goalUrgencyWeight(readiness30)).toBe(goalUrgencyWeight(readiness14));
  });

  it("une priorité manuelle plus haute augmente le poids, à signaux réels identiques par ailleurs", () => {
    const low = makeGoal({ priority: 1 });
    const high = makeGoal({ priority: 3 });
    const exercises = [makeExercise({ status: "en cours", attempts: 1 })];
    const lowReadiness = computeGoalReadiness(low, exercises, [], 60, NOW);
    const highReadiness = computeGoalReadiness(high, exercises, [], 60, NOW);
    expect(goalUrgencyWeight(highReadiness)).toBeGreaterThan(goalUrgencyWeight(lowReadiness));
  });
});

describe("computeGoalsDailyPlan — Cas 5 du chantier : plusieurs objectifs, répartition cohérente", () => {
  it("aucun objectif actif : plan vide, pas d'erreur", () => {
    expect(computeGoalsDailyPlan([], [makeExercise()], [], [], 60, 60, NOW)).toEqual([]);
  });

  it("un budget nul ne produit aucun bloc", () => {
    const goal = makeGoal();
    expect(computeGoalsDailyPlan([goal], [makeExercise({ status: "en cours", attempts: 1 })], [], [], 0, 60, NOW)).toEqual([]);
  });

  it("objectifs terminés/abandonnés ignorés — seuls les objectifs actifs reçoivent du budget", () => {
    const done = makeGoal({ status: "completed" });
    const abandoned = makeGoal({ status: "abandoned" });
    const exercises = [makeExercise({ status: "en cours", attempts: 1 })];
    expect(computeGoalsDailyPlan([done, abandoned], exercises, [], [], 60, 60, NOW)).toEqual([]);
  });

  it("un seul objectif actif reçoit tout le budget", () => {
    const goal = makeGoal({ subjects: ["Mathématiques"] });
    const exercises = [makeExercise({ status: "en cours", attempts: 1, estimated_minutes: 20 })];
    const result = computeGoalsDailyPlan([goal], exercises, [], [], 60, 60, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].goal.id).toBe(goal.id);
    expect(result[0].plan.blocks.length).toBeGreaterThan(0);
  });

  it("deux objectifs sur des matières distinctes se répartissent le budget SANS jamais proposer le même exercice deux fois", () => {
    const maths = makeGoal({ subjects: ["Mathématiques"], targetDate: "2026-08-22T00:00:00.000Z" }); // urgent
    const physique = makeGoal({ subjects: ["Physique"], targetDate: null }); // moins urgent
    const exercises = [
      makeExercise({ subject: "Mathématiques", status: "en cours", attempts: 1, estimated_minutes: 15 }),
      makeExercise({ subject: "Mathématiques", status: "en cours", attempts: 1, estimated_minutes: 15 }),
      makeExercise({ subject: "Physique", status: "en cours", attempts: 1, estimated_minutes: 15 }),
    ];
    const result = computeGoalsDailyPlan([physique, maths], exercises, [], [], 60, 60, NOW);
    const allPickedIds = result.flatMap(({ plan }) => plan.blocks.flatMap((b) => b.picks.map((p) => p.exercise.id)));
    expect(new Set(allPickedIds).size).toBe(allPickedIds.length); // aucun doublon
    // L'objectif le plus urgent (échéance proche) doit être servi.
    expect(result.some(({ goal }) => goal.id === maths.id)).toBe(true);
  });

  it("un objectif sans aucun exercice disponible (périmètre vide) ne casse pas le calcul des autres", () => {
    const empty = makeGoal({ subjects: ["Anglais"] }); // banque de test n'a pas d'exercice en Anglais
    const maths = makeGoal({ subjects: ["Mathématiques"] });
    const exercises = [makeExercise({ subject: "Mathématiques", status: "en cours", attempts: 1 })];
    const result = computeGoalsDailyPlan([empty, maths], exercises, [], [], 60, 60, NOW);
    expect(result.every(({ goal }) => goal.id !== empty.id)).toBe(true);
    expect(result.some(({ goal }) => goal.id === maths.id)).toBe(true);
  });
});

describe("serializeGoalsDailyPlan — transfert vers /session (StoredPlan existant, aucune nouvelle mécanique)", () => {
  it("aplatit les objectifs en une liste d'exercices, avec le titre de l'objectif ajouté à la raison", () => {
    const goal = makeGoal({ title: "Préparer le DS de maths" });
    const exercises = [makeExercise({ status: "en cours", attempts: 1, estimated_minutes: 15 })];
    const goalPlans = computeGoalsDailyPlan([goal], exercises, [], [], 30, 30, NOW);
    const stored = serializeGoalsDailyPlan(goalPlans);
    expect(stored.items.length).toBeGreaterThan(0);
    expect(stored.items[0].reasons.some((r) => r.includes("Préparer le DS de maths"))).toBe(true);
    expect(stored.source).toBe("plan-du-jour");
  });
});

describe("computeUpcomingGoalSessions — aperçu honnête, jamais daté", () => {
  it("s'arrête dès que le périmètre est épuisé, sans forcer le nombre demandé", () => {
    const goal = makeGoal();
    const exercises = [makeExercise({ estimated_minutes: 15 })]; // un seul exercice disponible
    const plans = computeUpcomingGoalSessions(goal, exercises, [], [], 30, 5, NOW);
    expect(plans.length).toBeLessThan(5);
    expect(plans.length).toBeGreaterThan(0);
  });

  it("ne propose jamais deux fois le même exercice d'une séance projetée à l'autre", () => {
    const goal = makeGoal();
    const exercises = Array.from({ length: 6 }, () => makeExercise({ estimated_minutes: 15 }));
    const plans = computeUpcomingGoalSessions(goal, exercises, [], [], 15, 3, NOW);
    const allIds = plans.flatMap((plan) => plan.blocks.flatMap((b) => b.picks.map((p) => p.exercise.id)));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("explainGoalPlan — phrase honnête, jamais une urgence inventée", () => {
  it("sans échéance : cite l'objectif comme priorité active, sans fausse urgence temporelle", () => {
    const readiness = computeGoalReadiness(makeGoal({ title: "Maîtriser les probabilités", targetDate: null }), [makeExercise({ status: "en cours", attempts: 1 })], [], 60, NOW);
    expect(explainGoalPlan(readiness)).toContain("Maîtriser les probabilités");
    expect(explainGoalPlan(readiness)).not.toMatch(/\d+ jours? /);
  });

  it("avec échéance à venir : cite le nombre de jours réel", () => {
    const readiness = computeGoalReadiness(makeGoal({ title: "DS de maths", targetDate: "2026-08-29T00:00:00.000Z" }), [makeExercise({ status: "en cours", attempts: 1 })], [], 60, NOW);
    expect(explainGoalPlan(readiness)).toMatch(/\d+ jour/);
  });

  it("échéance dépassée : le dit explicitement, ne prétend jamais qu'il reste du temps", () => {
    const readiness = computeGoalReadiness(makeGoal({ title: "DS de maths", targetDate: "2026-08-01T00:00:00.000Z" }), [makeExercise({ status: "en cours", attempts: 1 })], [], 60, NOW);
    expect(explainGoalPlan(readiness)).toMatch(/dépassée/);
  });
});

describe("describeGoalScope", () => {
  it("les 7 matières présentes → \"Toutes matières\", jamais une énumération illisible", () => {
    const allSubjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];
    expect(describeGoalScope(makeGoal({ subjects: allSubjects }))).toBe("Toutes matières");
  });

  it("une sélection partielle est énumérée telle quelle", () => {
    expect(describeGoalScope(makeGoal({ subjects: ["Physique", "Chimie"] }))).toBe("Physique · Chimie");
  });
});
