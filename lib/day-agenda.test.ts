import { describe, expect, it } from "vitest";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildDayAgenda, computeBudget, DAY_END_HOUR, type DayAgenda } from "@/lib/day-agenda";
import { diffVersions, parseLog, recordVersion, setOverride, toVersion } from "@/lib/day-agenda-log";
import { createErrorEntry } from "@/lib/error-log";
import type { NextMoveInput } from "@/lib/next-move/engine";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Jeudi 24 septembre 2026. */
const at = (hour: number, minute = 0) => new Date(2026, 8, 24, hour, minute);
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  // Jeudi : 240 min déclarées, marge 0 % — les calculs se lisent sans arrondi de marge.
  return normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], planningMarginPercent: 0, ...overrides });
}

let seq = 0;
function session(subject: Subject, minutes: number, start: Date, workItemId: string | null = null): WorkSession {
  seq += 1;
  return { id: `s${seq}`, subject, exercise_id: null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(), duration_seconds: minutes * 60, note: null, created_at: start.toISOString(), result: null, hints_used: null, work_item_id: workItemId };
}

function workItem(overrides: Partial<WorkItem>): WorkItem {
  seq += 1;
  return { id: `w${seq}`, title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: "2026-09-30", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

function retry(chapterId: string, subject: Subject, day: string, key: string): ExerciseAttempt {
  seq += 1;
  return { id: `t${seq}`, exerciseKey: key, label: `Exercice ${key}`, subject, chapterId, origin: "exercice", day, createdAt: `${day}T18:00:00.000Z`, updatedAt: `${day}T18:00:00.000Z`, result: "échec", help: "sans", minutes: 30, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null };
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: at(15), availableMinutes: null, ...overrides };
}

function all(agenda: DayAgenda) {
  return [...agenda.kept.map((task) => task.key), ...agenda.postponed.map((task) => task.key)].sort();
}

describe("temps restant", () => {
  it("capacité planifiable moins le travail fait, bornée par l'heure", () => {
    expect(computeBudget(input({ sessions: [session("Physique", 60, at(9))] }), null)).toMatchObject({ minutes: 180, overridden: false });
    // À 21 h 30 il ne reste que 90 min avant 23 h, quelle que soit la capacité.
    expect(computeBudget(input({ now: at(21, 30) }), null).minutes).toBe((DAY_END_HOUR - 21) * 60 - 30);
  });

  it("« il me reste 1 h » prime, et décroît avec le travail fait depuis", () => {
    const override = { minutes: 60, at: at(15).toISOString() };
    expect(computeBudget(input(), override)).toMatchObject({ minutes: 60, overridden: true });
    expect(computeBudget(input({ now: at(15, 40), sessions: [session("Physique", 25, at(15, 10))] }), override).minutes).toBe(35);
    // Une indication de la veille ne vaut plus.
    expect(computeBudget(input(), { minutes: 60, at: at(15).toISOString().replace("2026-09-24", "2026-09-23") }).overridden).toBe(false);
  });
});

describe("arbitrage", () => {
  const dmTomorrow = workItem({ title: "DM 5", dueDate: "2026-09-25", estimatedMinutes: 90, subject: "Physique" });
  const dsPrep = workItem({ title: "TD 3", dueDate: "2026-09-29", estimatedMinutes: 120, subject: "Chimie" });
  const errors = [
    createErrorEntry({ subject: "Anglais", type: "calcul", date: "2026-09-22", source: "DS", description: "a" }, at(9))!,
    createErrorEntry({ subject: "Anglais", type: "calcul", date: "2026-09-23", source: "DS", description: "b" }, at(9))!,
  ];
  const attempts = [retry("m2-reduction", "Mathématiques", "2026-09-20", "k1")];

  it("tout tient : tout est gardé dans l'ordre des paliers", () => {
    const agenda = buildDayAgenda(input({ workItems: [dmTomorrow], attempts }));
    expect(agenda.postponed).toEqual([]);
    expect(agenda.kept[0]).toMatchObject({ title: "DM 5", tier: "indispensable", tierReason: "À rendre demain — il reste 1 h 30", minutes: 90 });
    expect(agenda.kept.find((task) => task.key === "refaire:k1")!.tier).toBe("important");
    expect(agenda.summary).toContain("Tout tient");
  });

  it("en retard sur la journée : l'indispensable reste, le secondaire est déplacé avec sa raison, rien ne disparaît", () => {
    const sessions = [session("Physique", 180, at(11))];
    const full = input({ workItems: [dmTomorrow, dsPrep], attempts, errors });
    const before = buildDayAgenda(full);
    const after = buildDayAgenda({ ...full, sessions });
    expect(after.budget.minutes).toBe(60);
    expect(after.kept.map((task) => task.title)).toContain("DM 5");
    expect(after.postponed.length).toBeGreaterThan(0);
    for (const task of after.postponed) {
      expect(task.reason.length).toBeGreaterThan(0);
      expect(task.to).toMatch(/^demain/);
    }
    // Aucune tâche ne disparaît : gardées + déplacées = toutes.
    expect(all(after)).toEqual(all(before).filter((key) => all(after).includes(key)));
    expect(after.kept.reduce((sum, task) => sum + task.minutes, 0)).toBeLessThanOrEqual(after.budget.minutes + after.overflow);
  });

  it("l'indispensable qui ne tient pas n'est jamais compressé en silence : le dépassement est dit", () => {
    const urgent = workItem({ title: "DM pour demain", dueDate: "2026-09-25", estimatedMinutes: 300, subject: "Physique" });
    const agenda = buildDayAgenda(input({ workItems: [urgent], now: at(21) }));
    expect(agenda.budget.minutes).toBe(120);
    expect(agenda.kept[0].tier).toBe("indispensable");
    expect(agenda.overflow).toBeGreaterThan(0);
    expect(agenda.summary).toContain("dépasse ton temps restant");
  });

  it("un important réduit jusqu'à sa durée minimale, puis déplacé", () => {
    const override = { minutes: 20, at: at(15).toISOString() };
    const agenda = buildDayAgenda(input({ attempts: [retry("m2-reduction", "Mathématiques", "2026-09-20", "k1"), retry("p2-maxwell", "Physique", "2026-09-20", "k2")] }), override);
    const kept = agenda.kept.find((task) => task.key.startsWith("refaire:"))!;
    expect(kept.minutes).toBe(20);
    expect(kept.reducedFrom).toBe(30);
    const moved = agenda.postponed.find((task) => task.key.startsWith("refaire:"))!;
    expect(moved.reason).toBe("Plus de temps aujourd'hui");
  });

  it("« Pas maintenant » : déplacé, avec la raison", () => {
    const history = [{ id: "h", key: "refaire:k1", kind: "refaire" as const, subject: "Mathématiques" as Subject, title: "x", minutes: 30, reasons: [], proposedAt: at(14).toISOString(), status: "écarté" as const, startedAt: null, resolvedAt: at(14).toISOString(), outcomeMinutes: null }];
    const agenda = buildDayAgenda(input({ attempts, history }));
    expect(agenda.postponed.find((task) => task.key === "refaire:k1")!.reason).toContain("mis de côté");
  });
});

describe("trace : ce qui a changé et pourquoi", () => {
  const physics = workItem({ title: "TD Physique", dueDate: "2026-09-25", estimatedMinutes: 120, subject: "Physique" });
  const chem = workItem({ title: "TD Chimie", dueDate: "2026-09-29", estimatedMinutes: 120, subject: "Chimie" });

  it("2 h de physique prévues, 3 h passées : la suite est recalculée et la cause est chiffrée", () => {
    const morning = input({ workItems: [physics, chem], now: at(9) });
    const v1 = toVersion(buildDayAgenda(morning), morning.sessions, morning.now);
    const evening = { ...morning, now: at(12, 30), sessions: [session("Physique", 180, at(9), physics.id)] };
    const v2 = toVersion(buildDayAgenda(evening), evening.sessions, evening.now);
    const diff = diffVersions(v1, v2)!;
    expect(diff.causes.join(" ")).toMatch(/Physique : 3 h faites depuis 09:00 pour 2 h prévues/);
    expect(diff.changes.length).toBeGreaterThan(0);
  });

  it("du travail fait sans dépassement est dit comme cause du recalcul", () => {
    const morning = input({ workItems: [physics], now: at(9) });
    const v1 = toVersion(buildDayAgenda(morning), [], at(9));
    const later = { ...morning, now: at(10), sessions: [session("Physique", 45, at(9, 10), physics.id)] };
    const v2 = toVersion(buildDayAgenda(later), later.sessions, later.now);
    expect(diffVersions(v1, v2)!.causes).toContain("Travail fait depuis 09:00 : Physique 45 min");
  });

  it("une nouvelle urgence est nommée comme cause", () => {
    const base = input({ workItems: [chem], now: at(15) });
    const v1 = toVersion(buildDayAgenda(base), [], base.now);
    const urgent = workItem({ title: "DM surprise", dueDate: "2026-09-25", estimatedMinutes: 60, subject: "Physique" });
    const v2 = toVersion(buildDayAgenda({ ...base, workItems: [chem, urgent], now: at(15, 5) }), [], at(15, 5));
    expect(diffVersions(v1, v2)!.causes).toContain("Nouvelle urgence : « DM surprise »");
  });

  it("une baisse du temps restant indiquée par l'élève est une cause", () => {
    const base = input({ workItems: [physics, chem] });
    const v1 = toVersion(buildDayAgenda(base), [], base.now);
    const v2 = toVersion(buildDayAgenda(base, { minutes: 60, at: at(15).toISOString() }), [], at(15, 1));
    expect(diffVersions(v1, v2)!.causes.join(" ")).toContain("Temps restant ramené à 1 h");
  });

  it("une version identique n'est pas enregistrée ; la trace garde 7 jours ; l'indication se range avec le jour", () => {
    const base = input({ workItems: [chem] });
    const version = toVersion(buildDayAgenda(base), [], base.now);
    let log = recordVersion(parseLog(null), "2026-09-24", version);
    expect(recordVersion(log, "2026-09-24", { ...version, at: at(15, 1).toISOString() })).toBe(log);
    for (let day = 1; day <= 9; day += 1) log = recordVersion(log, `2026-09-0${day}`, version);
    expect(Object.keys(log.days)).toHaveLength(7);
    log = setOverride(log, "2026-09-24", { minutes: 45, at: at(15).toISOString() });
    expect(parseLog(JSON.stringify(log)).days["2026-09-24"].override).toEqual({ minutes: 45, at: at(15).toISOString() });
    expect(parseLog("{cassé")).toEqual({ days: {} });
  });
});
