import { describe, expect, it } from "vitest";
import { buildContestHub, buildSubjectHub, hubSubjects, CONTEST_CONSOLIDATE_LIMIT } from "@/lib/hub";
import { normalizePreferences, type Chapter, type Grade, type WorkItem } from "@/lib/storage";
import { subjects as allSubjects } from "@/lib/study";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/** Mardi 15 septembre 2026, midi. */
const NOW = new Date("2026-09-15T12:00:00");
const prefs = normalizePreferences({ contestDate: "2027-05-04" });

const chapters: Chapter[] = [
  { id: "ch-maths-1", subject: "Mathématiques", label: "Suites numériques" },
  { id: "ch-maths-2", subject: "Mathématiques", label: "Réduction" },
  { id: "ch-phys-1", subject: "Physique", label: "Oscillateurs" },
];

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    title: "Fiche secrète",
    statement: "Énoncé confidentiel de la fiche.",
    chapter_id: "ch-maths-1",
    source: "TD8",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    epreuve: null,
    filieres: [],
    exercise_number: null,
    provenance: "personnel",
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "exercice",
    difficulty: 3,
    mastery: 40,
    status: "en cours",
    estimated_minutes: null,
    attempts: 1,
    note: null,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: "2026-09-14T10:00:00.000Z",
    ...overrides,
  } as Exercise;
}

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
  } as WorkSession;
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
  } as WorkItem;
}

function grade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    title: "DS 1",
    kind: "ds",
    score: 14,
    maxScore: 20,
    date: "2026-09-10",
    ...overrides,
  } as Grade;
}

/* ══════════════════════════════════════════════════════════════════
   LA PROPRIÉTÉ CENTRALE : un hub ne contient aucun exercice
   ══════════════════════════════════════════════════════════════════ */

describe("un hub est un espace de SUIVI, pas une banque", () => {
  const exercises = [
    exercise({ title: "Fiche secrète A", mastery: 25 }),
    exercise({ title: "Fiche secrète B", chapter_id: "ch-maths-2", status: "maîtrisé", mastery: 100 }),
    exercise({ title: "Fiche secrète C", subject: "Physique", chapter_id: "ch-phys-1" }),
  ];
  const sessions = [session("2026-09-14T10:00:00", 60), session("2026-09-13T10:00:00", 45, "Physique")];

  it("le hub d'une matière ne transporte AUCUN titre de fiche", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    expect(JSON.stringify(model)).not.toContain("Fiche secrète");
  });

  it("ni aucun identifiant d'exercice, ni aucun énoncé", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    const serialized = JSON.stringify(model);
    for (const item of exercises) expect(serialized).not.toContain(item.id);
    expect(serialized).not.toContain("Énoncé confidentiel");
  });

  it("le hub concours non plus", () => {
    const model = buildContestHub(exercises, sessions, chapters, [], [], prefs, NOW);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("Fiche secrète");
    for (const item of exercises) expect(serialized).not.toContain(item.id);
  });

  it("« à travailler ensuite » désigne un CHAPITRE, jamais une fiche", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    expect(model.nextChapter?.chapter.label).toBe("Suites numériques");
    expect(model.nextChapter).not.toHaveProperty("exerciseId");
  });
});

/* ══════════════════════════════════════════════════════════════════
   LES CHIFFRES VIENNENT DES MOTEURS EXISTANTS
   ══════════════════════════════════════════════════════════════════ */

describe("hub d'une matière — composition, pas recalcul", () => {
  const exercises = [
    exercise({ mastery: 25, status: "en cours" }),
    exercise({ chapter_id: "ch-maths-2", mastery: 100, status: "maîtrisé" }),
    exercise({ subject: "Physique", chapter_id: "ch-phys-1" }),
  ];
  const sessions = [
    session("2026-09-14T10:00:00", 60),
    session("2026-09-01T10:00:00", 30),
    session("2026-09-13T10:00:00", 45, "Physique"),
  ];

  it("ne compte que les séances de la matière demandée", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    expect(model.workload.recentMinutes).toBe(60);
    expect(model.workload.windowMinutes).toBe(90);
  });

  it("la part de la matière est `null` quand rien n'a été travaillé — jamais 0 %", () => {
    const model = buildSubjectHub("Chimie", exercises, [], chapters, [], [], prefs, NOW);
    expect(model.workload.sharePercent).toBeNull();
  });

  it("la part est calculée sur le temps total réel", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    expect(model.workload.sharePercent).toBe(67); // 90 sur 135
  });

  it("sépare les chapitres commencés des chapitres jamais ouverts", () => {
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], [], prefs, NOW);
    const labels = [...model.chapters.fragile, ...model.chapters.solid, ...model.chapters.untouched].map(
      (row) => row.chapter.label
    );
    // Les chapitres de Physique n'apparaissent pas dans le hub de Mathématiques.
    expect(labels).not.toContain("Oscillateurs");
    expect(labels.sort()).toEqual(["Réduction", "Suites numériques"]);
  });

  it("ne retient que les échéances de la matière", () => {
    const items = [workItem(), workItem({ title: "DM de physique", subject: "Physique" })];
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, items, [], prefs, NOW);
    expect(model.deadlines).toHaveLength(1);
    expect(model.deadlines[0].item.title).toBe("DS de maths");
  });

  it("ne retient que les notes de la matière", () => {
    const grades = [grade(), grade({ subject: "Physique", score: 8 })];
    const model = buildSubjectHub("Mathématiques", exercises, sessions, chapters, [], grades, prefs, NOW);
    expect(model.grades.count).toBe(1);
  });

  it("une matière sans rien est signalée comme vide plutôt que remplie de zéros", () => {
    expect(buildSubjectHub("Anglais", [], [], [], [], [], prefs, NOW).empty).toBe(true);
  });

  it("aucune tendance n'est affirmée sur une matière sans historique", () => {
    const model = buildSubjectHub("Mathématiques", exercises, [session("2026-09-14T10:00:00", 60)], chapters, [], [], prefs, NOW);
    expect(model.workload.trend.direction).toBe("insuffisant");
  });
});

describe("matières suivies", () => {
  it("ne retient que celles qui ont une fiche ou une séance", () => {
    const result = hubSubjects([exercise()], [session("2026-09-14T10:00:00", 30, "Physique")], allSubjects);
    expect(result).toEqual(["Mathématiques", "Physique"]);
  });

  it("une fiche archivée seule ne crée pas de hub", () => {
    expect(hubSubjects([exercise({ archived: true })], [], allSubjects)).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   HUB CONCOURS
   ══════════════════════════════════════════════════════════════════ */

describe("hub concours — « suis-je prêt ? », pas « que contient ma bibliothèque ? »", () => {
  const exercises = [exercise({ mastery: 25 }), exercise({ subject: "Physique", chapter_id: "ch-phys-1" })];
  const sessions = [session("2026-09-14T10:00:00", 60), session("2026-09-13T10:00:00", 45, "Physique")];

  it("compte les jours jusqu'à la date DÉCLARÉE", () => {
    const model = buildContestHub(exercises, sessions, chapters, [], [], prefs, NOW);
    expect(model.daysUntil).toBe(231);
    expect(model.contestDate).toBe("2027-05-04");
  });

  it("sans date renseignée, il ne devine rien", () => {
    const model = buildContestHub(exercises, sessions, chapters, [], [], normalizePreferences({}), NOW);
    expect(model.daysUntil).toBeNull();
    expect(model.contestDate).toBeNull();
  });

  it("ne retient que les ÉPREUVES parmi les échéances", () => {
    const items = [
      workItem({ title: "DS de maths", kind: "ds" }),
      workItem({ title: "Concours blanc", kind: "concours" }),
      workItem({ title: "DM hebdo", kind: "dm" }),
      workItem({ title: "Révision", kind: "chapitre" }),
    ];
    const titles = buildContestHub(exercises, sessions, chapters, items, [], prefs, NOW).deadlines.map((p) => p.item.title);
    expect(titles.sort()).toEqual(["Concours blanc", "DS de maths"]);
  });

  it("ne mélange pas les interros et les DM dans la moyenne d'épreuve", () => {
    const grades = [grade({ kind: "ds", score: 14 }), grade({ kind: "interro", score: 4 }), grade({ kind: "dm", score: 18 })];
    const model = buildContestHub(exercises, sessions, chapters, [], grades, prefs, NOW);
    expect(model.grades.count).toBe(1);
    expect(model.grades.average).toBe(14);
  });

  it("borne la liste des chapitres à consolider", () => {
    // `Mastery` est une échelle fermée (0/25/50/75/100) : on fait varier le
    // taux du chapitre en alternant les paliers, pas en inventant des valeurs.
    const masteries = [0, 25, 50, 75] as const;
    const many = Array.from({ length: 20 }, (_, index) =>
      exercise({ chapter_id: `ch-${index}`, mastery: masteries[index % masteries.length] })
    );
    const manyChapters: Chapter[] = many.map((_, index) => ({
      id: `ch-${index}`,
      subject: "Mathématiques",
      label: `Chapitre ${index}`,
    }));
    const model = buildContestHub(many, sessions, manyChapters, [], [], prefs, NOW);
    expect(model.toConsolidate.length).toBeLessThanOrEqual(CONTEST_CONSOLIDATE_LIMIT);
  });

  it("classe les chapitres les plus faibles en premier", () => {
    const model = buildContestHub(exercises, sessions, chapters, [], [], prefs, NOW);
    const rates = model.toConsolidate.map((entry) => entry.row.rate);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });
});
