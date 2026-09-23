import { describe, expect, it } from "vitest";
import { buildSubjectHub, hubSubjects } from "@/lib/hub";
import { normalizePreferences, type Grade, type WorkItem } from "@/lib/storage";
import { subjects as allSubjects } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/*
 * Les tests qui portaient sur l'ancienne banque d'exercices (maîtrise par
 * chapitre, hub concours, « non mesuré » faute de fiche engagée) sont partis
 * avec elle. Tout ce qui porte sur le temps, les échéances et les notes est
 * conservé tel quel ; seules les signatures ont perdu `exercises`/`chapters`.
 */

/** Mardi 15 septembre 2026, midi. */
const NOW = new Date("2026-09-15T12:00:00");
const prefs = normalizePreferences({ contestDate: "2027-05-04" });
/** Préférences sans AUCUN budget par matière — pour isoler `hubSubjects` des autres signaux. */
const noTargets = normalizePreferences({
  weeklySubjectTargets: Object.fromEntries(allSubjects.map((subject) => [subject, 0])),
});

function session(startedAt: string, minutes: number, subject: Subject = "Mathématiques"): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject,
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: crypto.randomUUID(),
    title: "DS de maths",
    kind: "ds",
    subject: "Mathématiques",
    estimatedMinutes: 120,
    dueDate: "2026-09-18",
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-10T08:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...overrides,
  };
}

/** Pas de `as Grade` : le cast masquait l'absence de `createdAt`, que `sortedByDate` lit. */
function grade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    title: "DS 1",
    kind: "ds",
    score: 14,
    maxScore: 20,
    date: "2026-09-10",
    createdAt: "2026-09-10T18:00:00.000Z",
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════
   LES CHIFFRES VIENNENT DES MOTEURS EXISTANTS
   ══════════════════════════════════════════════════════════════════ */

describe("hub d'une matière — composition, pas recalcul", () => {
  const sessions = [
    session("2026-09-14T10:00:00", 60),
    session("2026-09-01T10:00:00", 30),
    session("2026-09-13T10:00:00", 45, "Physique"),
  ];

  it("ne compte que les séances de la matière demandée", () => {
    const model = buildSubjectHub("Mathématiques", sessions, [], [], prefs, NOW);
    expect(model.workload.recentMinutes).toBe(60);
    expect(model.workload.windowMinutes).toBe(90);
  });

  it("la part de la matière est `null` quand rien n'a été travaillé — jamais 0 %", () => {
    const model = buildSubjectHub("Chimie", [], [], [], prefs, NOW);
    expect(model.workload.sharePercent).toBeNull();
  });

  it("la part est calculée sur le temps total réel", () => {
    const model = buildSubjectHub("Mathématiques", sessions, [], [], prefs, NOW);
    expect(model.workload.sharePercent).toBe(67); // 90 sur 135
  });

  it("ne retient que les échéances de la matière", () => {
    const items = [workItem(), workItem({ title: "DM de physique", subject: "Physique" })];
    const model = buildSubjectHub("Mathématiques", sessions, items, [], prefs, NOW);
    expect(model.deadlines).toHaveLength(1);
    expect(model.deadlines[0].item.title).toBe("DS de maths");
  });

  it("ne retient que les notes de la matière", () => {
    const grades = [grade(), grade({ subject: "Physique", score: 8 })];
    const model = buildSubjectHub("Mathématiques", sessions, [], grades, prefs, NOW);
    expect(model.grades.count).toBe(1);
  });

  it("le budget de la semaine est celui de lib/subject-targets.ts, pour cette matière", () => {
    const model = buildSubjectHub("Mathématiques", sessions, [], [], prefs, NOW);
    expect(model.target?.subject).toBe("Mathématiques");
    expect(model.target?.doneMinutes).toBe(60);
  });

  it("aucun budget fixé : `null`, jamais une ligne « 0 / 0 »", () => {
    expect(buildSubjectHub("Mathématiques", sessions, [], [], noTargets, NOW).target).toBeNull();
  });

  it("une matière sans rien est signalée comme vide plutôt que remplie de zéros", () => {
    expect(buildSubjectHub("Anglais", [], [], [], prefs, NOW).empty).toBe(true);
  });

  it("aucune tendance n'est affirmée sur une matière sans historique", () => {
    const model = buildSubjectHub("Mathématiques", [session("2026-09-14T10:00:00", 60)], [], [], prefs, NOW);
    expect(model.workload.trend.direction).toBe("insuffisant");
  });
});

describe("matières suivies", () => {
  it("retient celles qui ont une séance, une note ou un travail ouvert", () => {
    const result = hubSubjects(
      [session("2026-09-14T10:00:00", 30, "Physique")],
      [workItem({ subject: "Chimie" })],
      [grade({ subject: "Anglais" })],
      noTargets,
      allSubjects
    );
    expect(result).toEqual(["Physique", "Chimie", "Anglais"]);
  });

  it("un budget hebdomadaire fixé suffit à suivre une matière", () => {
    const withTarget = normalizePreferences({ ...noTargets, weeklySubjectTargets: { ...noTargets.weeklySubjectTargets, Français: 240 } });
    expect(hubSubjects([], [], [], withTarget, allSubjects)).toEqual(["Français"]);
  });

  it("un travail terminé ou abandonné seul ne crée pas de hub", () => {
    const items = [workItem({ status: "terminé" }), workItem({ status: "abandonné", subject: "Physique" })];
    expect(hubSubjects([], items, [], noTargets, allSubjects)).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   UNE DONNÉE INCONNUE RESTE INCONNUE
   ══════════════════════════════════════════════════════════════════ */

describe("une donnée inconnue reste inconnue", () => {
  it("la part d'une matière est `null` et non 0 % quand rien n'a été travaillé", () => {
    expect(buildSubjectHub("Chimie", [], [], [], prefs, NOW).workload.sharePercent).toBeNull();
  });

  it("aucune moyenne n'est inventée sans note", () => {
    const model = buildSubjectHub("Mathématiques", [], [], [], prefs, NOW);
    expect(model.grades.average).toBeNull();
    expect(model.gradesByKind).toEqual([]);
  });

  it("aucune tendance n'est affirmée sans historique", () => {
    expect(buildSubjectHub("Mathématiques", [], [], [], prefs, NOW).workload.trend.direction).toBe("insuffisant");
  });

  it("aucune échéance inventée quand il n'y en a pas", () => {
    const model = buildSubjectHub("Mathématiques", [], [], [], prefs, NOW);
    expect(model.deadlines).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   NOTES — séparées par nature
   ══════════════════════════════════════════════════════════════════ */

describe("les notes ne sont pas agrégées à travers des natures différentes", () => {
  it("un DM à 18 et un DS à 8 ne produisent pas une moyenne unique à 13", () => {
    const list = [grade({ kind: "dm", score: 18 }), grade({ kind: "ds", score: 8 })];
    const model = buildSubjectHub("Mathématiques", [], [], list, prefs, NOW);
    expect(model.gradesByKind).toHaveLength(2);
    const ds = model.gradesByKind.find((entry) => entry.kind === "ds");
    const dm = model.gradesByKind.find((entry) => entry.kind === "dm");
    expect(ds?.stats.average).toBe(8);
    expect(dm?.stats.average).toBe(18);
  });

  it("les natures sortent dans l'ordre du modèle, pas dans l'ordre de saisie", () => {
    const list = [grade({ kind: "interro", score: 12 }), grade({ kind: "ds", score: 14 })];
    const model = buildSubjectHub("Mathématiques", [], [], list, prefs, NOW);
    expect(model.gradesByKind.map((entry) => entry.kind)).toEqual(["ds", "interro"]);
  });

  it("une seule nature donne une seule ligne", () => {
    const list = [grade({ kind: "ds", score: 14 }), grade({ kind: "ds", score: 10 })];
    const model = buildSubjectHub("Mathématiques", [], [], list, prefs, NOW);
    expect(model.gradesByKind).toHaveLength(1);
    expect(model.gradesByKind[0].stats.count).toBe(2);
  });
});
