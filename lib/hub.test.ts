import { describe, expect, it } from "vitest";
import { buildContestHub, buildSubjectHub, hubSubjects, CONTEST_CONSOLIDATE_LIMIT } from "@/lib/hub";
import { computeChaptersToConsolidate } from "@/lib/next-action";
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
    provenance: "originale",
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    mastery: 50,
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
  };
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

/* ══════════════════════════════════════════════════════════════════
   COHÉRENCE DASHBOARD ↔ HUB — une seule définition de « fragile »
   ══════════════════════════════════════════════════════════════════ */

describe("l'accueil et le hub disent la même chose du même chapitre", () => {
  const chapter: Chapter[] = [{ id: "ch-maths-1", subject: "Mathématiques", label: "Intégrales" }];

  function failed(exerciseId: string, date: string): WorkSession {
    return { ...session(date, 30), exercise_id: exerciseId, result: "échoué", hints_used: 0 } as WorkSession;
  }

  it("un chapitre à 75 % avec deux échecs récents n'est pas « acquis » d'un côté et « à consolider » de l'autre", () => {
    // Le cas exact qui se produisait : seuil 50 à l'accueil, seuil 70 dans le
    // hub, et aucun des deux ne regardait ce que regardait l'autre.
    const a = exercise({ id: "e1", mastery: 75 });
    const b = exercise({ id: "e2", mastery: 75 });
    const sessions = [failed("e1", "2026-09-13T10:00:00"), failed("e2", "2026-09-14T10:00:00")];

    const dash = computeChaptersToConsolidate([a, b], sessions, chapter, NOW);
    const hub = buildSubjectHub("Mathématiques", [a, b], sessions, chapter, [], [], prefs, NOW);

    const dashFlags = dash.some((entry) => entry.chapter.id === "ch-maths-1");
    const hubSaysSolid = hub.chapters.solid.some((row) => row.chapter.id === "ch-maths-1");
    expect(dashFlags && hubSaysSolid).toBe(false);
    // Et positivement : les deux le signalent.
    expect(dashFlags).toBe(true);
    expect(hub.chapters.fragile.some((row) => row.chapter.id === "ch-maths-1")).toBe(true);
  });

  it("un chapitre à maîtrise moyenne sans incident est traité pareil des deux côtés", () => {
    const a = exercise({ id: "e1", mastery: 50 });
    const dash = computeChaptersToConsolidate([a], [], chapter, NOW);
    const hub = buildSubjectHub("Mathématiques", [a], [], chapter, [], [], prefs, NOW);
    expect(dash.some((entry) => entry.chapter.id === "ch-maths-1")).toBe(
      hub.chapters.fragile.some((row) => row.chapter.id === "ch-maths-1")
    );
  });

  it("un chapitre réellement solide est « acquis » des deux côtés", () => {
    const a = exercise({ id: "e1", mastery: 100, status: "maîtrisé", last_worked_at: "2026-09-14T10:00:00.000Z" });
    const dash = computeChaptersToConsolidate([a], [], chapter, NOW);
    const hub = buildSubjectHub("Mathématiques", [a], [], chapter, [], [], prefs, NOW);
    expect(dash.some((entry) => entry.chapter.id === "ch-maths-1")).toBe(false);
    expect(hub.chapters.fragile).toHaveLength(0);
  });

  it("« à travailler ensuite » porte toujours au moins une RAISON lisible", () => {
    const a = exercise({ id: "e1", mastery: 25 });
    const hub = buildSubjectHub("Mathématiques", [a], [], chapter, [], [], prefs, NOW);
    expect(hub.nextChapter?.assessment.reasons.length).toBeGreaterThan(0);
    expect(hub.nextChapter?.assessment.reasons).toContain("Maîtrise encore faible");
  });

  it("les raisons du hub sont MOT POUR MOT celles de l'accueil", () => {
    const a = exercise({ id: "e1", mastery: 25 });
    const sessions = [failed("e1", "2026-09-14T10:00:00")];
    const dash = computeChaptersToConsolidate([a], sessions, chapter, NOW);
    const hub = buildSubjectHub("Mathématiques", [a], sessions, chapter, [], [], prefs, NOW);
    expect(hub.nextChapter?.assessment.reasons).toEqual(dash[0].reasons);
  });
});

/* ══════════════════════════════════════════════════════════════════
   ÉTATS VIDES — « non mesuré » n'est pas « zéro »
   ══════════════════════════════════════════════════════════════════ */

describe("une donnée inconnue reste inconnue", () => {
  it("une matière sans aucune fiche n'est pas « mesurée »", () => {
    const onlySessions = [session("2026-09-14T10:00:00", 60, "Physique")];
    const model = buildSubjectHub("Physique", [], onlySessions, [], [], [], prefs, NOW);
    expect(model.progress.total).toBe(0);
    // Le temps, lui, EST mesuré : c'est le seul chiffre légitime ici.
    expect(model.workload.recentMinutes).toBe(60);
  });

  it("la part d'une matière est `null` et non 0 % quand rien n'a été travaillé", () => {
    expect(buildSubjectHub("Chimie", [], [], [], [], [], prefs, NOW).workload.sharePercent).toBeNull();
  });

  it("aucune moyenne n'est inventée sans note", () => {
    const model = buildSubjectHub("Mathématiques", [exercise()], [], chapters, [], [], prefs, NOW);
    expect(model.grades.average).toBeNull();
    expect(model.gradesByKind).toEqual([]);
  });

  it("aucune tendance n'est affirmée sans historique", () => {
    expect(buildSubjectHub("Mathématiques", [], [], [], [], [], prefs, NOW).workload.trend.direction).toBe("insuffisant");
  });

  it("le hub concours marque une matière sans fiche comme non mesurée", () => {
    const model = buildContestHub([], [session("2026-09-14T10:00:00", 60, "Physique")], [], [], [], prefs, NOW);
    const line = model.subjects.find((entry) => entry.subject === "Physique");
    expect(line?.measured).toBe(false);
    expect(line?.windowMinutes).toBe(60);
  });

  it("aucune échéance inventée quand il n'y en a pas", () => {
    const model = buildSubjectHub("Mathématiques", [exercise()], [], chapters, [], [], prefs, NOW);
    expect(model.deadlines).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   NOTES — séparées par nature
   ══════════════════════════════════════════════════════════════════ */

describe("les notes ne sont pas agrégées à travers des natures différentes", () => {
  it("un DM à 18 et un DS à 8 ne produisent pas une moyenne unique à 13", () => {
    const list = [grade({ kind: "dm", score: 18 }), grade({ kind: "ds", score: 8 })];
    const model = buildSubjectHub("Mathématiques", [exercise()], [], chapters, [], list, prefs, NOW);
    expect(model.gradesByKind).toHaveLength(2);
    const ds = model.gradesByKind.find((entry) => entry.kind === "ds");
    const dm = model.gradesByKind.find((entry) => entry.kind === "dm");
    expect(ds?.stats.average).toBe(8);
    expect(dm?.stats.average).toBe(18);
  });

  it("les natures sortent dans l'ordre du modèle, pas dans l'ordre de saisie", () => {
    const list = [grade({ kind: "interro", score: 12 }), grade({ kind: "ds", score: 14 })];
    const model = buildSubjectHub("Mathématiques", [exercise()], [], chapters, [], list, prefs, NOW);
    expect(model.gradesByKind.map((entry) => entry.kind)).toEqual(["ds", "interro"]);
  });

  it("une seule nature donne une seule ligne", () => {
    const list = [grade({ kind: "ds", score: 14 }), grade({ kind: "ds", score: 10 })];
    const model = buildSubjectHub("Mathématiques", [exercise()], [], chapters, [], list, prefs, NOW);
    expect(model.gradesByKind).toHaveLength(1);
    expect(model.gradesByKind[0].stats.count).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════════
   « MESURÉ » ≠ « CONTIENT DES FICHES »
   ══════════════════════════════════════════════════════════════════ */

describe("une banque jamais ouverte n'est pas une maîtrise de 0 %", () => {
  const untouched = (id: string): Exercise =>
    exercise({ id, mastery: 0, status: "à faire", attempts: 0, last_worked_at: null });

  it("321 fiches jamais engagées ne rendent pas la matière « mesurée »", () => {
    const bank = Array.from({ length: 30 }, (_, index) => untouched(`e${index}`));
    const model = buildSubjectHub("Mathématiques", bank, [], chapters, [], [], prefs, NOW);
    expect(model.progress.total).toBeGreaterThan(0);
    expect(model.measured).toBe(false);
  });

  it("une SEULE fiche engagée suffit à rendre la matière mesurable", () => {
    const bank = [untouched("e1"), exercise({ id: "e2", attempts: 1 })];
    expect(buildSubjectHub("Mathématiques", bank, [], chapters, [], [], prefs, NOW).measured).toBe(true);
  });

  it("une fiche sortie de « à faire » compte aussi comme engagée", () => {
    const bank = [exercise({ id: "e1", attempts: 0, last_worked_at: null, status: "à revoir" })];
    expect(buildSubjectHub("Mathématiques", bank, [], chapters, [], [], prefs, NOW).measured).toBe(true);
  });

  it("le hub concours applique exactement la même règle", () => {
    const bank = Array.from({ length: 10 }, (_, index) => untouched(`e${index}`));
    const model = buildContestHub(bank, [], chapters, [], [], prefs, NOW);
    expect(model.subjects.find((line) => line.subject === "Mathématiques")?.measured).toBe(false);
  });

  it("une fiche ARCHIVÉE ne rend pas la matière mesurée", () => {
    const bank = [exercise({ id: "e1", attempts: 5, archived: true })];
    expect(buildSubjectHub("Mathématiques", bank, [], chapters, [], [], prefs, NOW).measured).toBe(false);
  });
});
