import { describe, expect, it } from "vitest";
import { createChapter, rateChapter, retrievabilityToday } from "@/lib/chapter-memory";
import {
  EXAM_SCOPE_MAX,
  buildExamPrep,
  buildPrepPlan,
  chapterReadiness,
  examScopeIndex,
  isExamItem,
  scopeIds,
  upcomingExams,
  withScope,
} from "@/lib/exam-prep";
import { normalizeWorkItem, type ChapterMemory, type ErrorEntry, type WorkItem } from "@/lib/storage";
import { mergeList } from "@/lib/sync/collections";
import type { Subject } from "@/lib/supabase/types";

// Heure LOCALE : `buildExamPrep` lit le jour local, comme l'application.
const NOW = new Date(2026, 8, 24, 10, 0, 0);
const TODAY = "2026-09-24";

function chapter(id: string, learnedAt: string, subject: Subject = "Mathématiques"): ChapterMemory {
  return createChapter({ subject, title: `Chapitre ${id}`, learnedAt }, NOW, id);
}

function exam(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "ds4",
    title: "DS 4",
    kind: "ds",
    subject: "Mathématiques",
    estimatedMinutes: 240,
    dueDate: "2026-09-29",
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-20T08:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...overrides,
  };
}

function error(overrides: Partial<ErrorEntry> = {}): ErrorEntry {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    date: "2026-09-20",
    source: "colle",
    type: "méthode",
    description: "Oubli",
    fix: null,
    chapterId: null,
    exerciseId: null,
    reviewItemId: null,
    createdAt: "2026-09-20T18:00:00.000Z",
    ...overrides,
  };
}

describe("withScope / scopeIds — le programme d'une épreuve", () => {
  it("dédoublonne, horodate ; vidé, il laisse une trace datée", () => {
    const scoped = withScope(exam(), ["a", "b", "a", ""], NOW);
    expect(scopeIds(scoped)).toEqual(["a", "b"]);
    expect(scoped.scope?.updatedAt).toBe(NOW.toISOString());
    const later = new Date(NOW.getTime() + 60_000);
    const cleared = withScope(scoped, [], later);
    expect(cleared.scope).toEqual({ chapterIds: [], updatedAt: later.toISOString() });
    expect(scopeIds(cleared)).toEqual([]);
    // Jamais de programme : aucun champ ajouté.
    expect("scope" in withScope(exam(), [], NOW)).toBe(false);
  });

  it("un programme vidé sur un appareil ne revient pas à la synchronisation", () => {
    const before = withScope(exam(), ["a"], new Date("2026-09-24T08:00:00.000Z"));
    const cleared = normalizeWorkItem(JSON.parse(JSON.stringify(withScope(before, [], new Date("2026-09-24T09:00:00.000Z")))));
    expect(cleared.scope?.chapterIds).toEqual([]);
    const merged = mergeList("workItems", [before], [cleared]) as WorkItem[];
    expect(scopeIds(merged[0])).toEqual([]);
  });

  it("est borné", () => {
    const ids = Array.from({ length: EXAM_SCOPE_MAX + 5 }, (_, i) => `c${i}`);
    expect(scopeIds(withScope(exam(), ids, NOW))).toHaveLength(EXAM_SCOPE_MAX);
  });

  it("survit à la normalisation, et un travail sans programme garde sa forme", () => {
    const scoped = withScope(exam(), ["a"], NOW);
    expect(normalizeWorkItem(JSON.parse(JSON.stringify(scoped))).scope).toEqual({ chapterIds: ["a"], updatedAt: NOW.toISOString() });
    expect("scope" in normalizeWorkItem(exam())).toBe(false);
    expect("scope" in normalizeWorkItem({ ...exam(), scope: { chapterIds: [1, null] } })).toBe(false);
    expect("scope" in normalizeWorkItem({ ...exam(), scope: "n'importe quoi" })).toBe(false);
  });

  it("à la synchronisation, le programme modifié le plus récemment l'emporte", () => {
    const local = withScope(exam(), ["a"], new Date("2026-09-24T08:00:00.000Z"));
    const remote = withScope(exam(), ["a", "b"], new Date("2026-09-24T09:00:00.000Z"));
    const merged = mergeList("workItems", [local], [remote]) as WorkItem[];
    expect(scopeIds(merged[0])).toEqual(["a", "b"]);
  });
});

describe("upcomingExams", () => {
  it("garde les DS et concours actifs, datés dans l'horizon, le plus proche d'abord", () => {
    const items = [
      exam({ id: "far", dueDate: "2026-11-30" }),
      exam({ id: "past", dueDate: "2026-09-20" }),
      exam({ id: "dm", kind: "dm" }),
      exam({ id: "done", status: "terminé" }),
      exam({ id: "cb", kind: "concours", dueDate: "2026-09-26", subject: "Physique" }),
      exam({ id: "ds", dueDate: "2026-09-29" }),
      exam({ id: "undated", dueDate: null }),
    ];
    expect(upcomingExams(items, TODAY).map((item) => item.id)).toEqual(["cb", "ds"]);
    expect(upcomingExams(items, TODAY, { subject: "Physique" }).map((item) => item.id)).toEqual(["cb"]);
    expect(isExamItem(exam({ kind: "dm" }))).toBe(false);
  });
});

describe("chapterReadiness — aujourd'hui, le jour J, et si je révise maintenant", () => {
  it("la chance baisse d'ici le jour J, et un rappel aujourd'hui la relève", () => {
    const entry = chapterReadiness(chapter("int", "2026-08-20"), TODAY, "2026-09-29", []);
    expect(entry.onExam).toBeLessThan(entry.today);
    expect(entry.ifReviewedToday).toBeGreaterThan(entry.onExam);
    expect(entry.level).toBe("fragile");
    expect(entry.reviewedToday).toBe(false);
  });

  it("un chapitre déjà révisé aujourd'hui n'affiche aucun gain fictif", () => {
    const reviewed = rateChapter(chapter("int", "2026-09-10"), "good", TODAY);
    const entry = chapterReadiness(reviewed, TODAY, "2026-09-29", []);
    expect(entry.reviewedToday).toBe(true);
    expect(entry.ifReviewedToday).toBe(entry.onExam);
  });

  it("un chapitre très stable est « solide »", () => {
    let solid = chapter("solid", "2026-06-01");
    for (const day of ["2026-06-03", "2026-06-10", "2026-06-30", "2026-08-01", "2026-09-20"]) solid = rateChapter(solid, "easy", day);
    expect(chapterReadiness(solid, TODAY, "2026-09-29", []).level).toBe("solide");
  });
});

describe("buildPrepPlan", () => {
  const today = TODAY;
  const entries = ["a", "b", "c", "d", "e"].map((id) => chapterReadiness(chapter(id, "2026-09-01"), today, "2026-09-29", []));

  it("répartit les chapitres à consolider avant le jour J, jamais le jour même, et garde la veille pour les erreurs", () => {
    const plan = buildPrepPlan(entries, today, "2026-09-29", true);
    const recalls = plan.filter((step) => step.kind === "rappel");
    expect(recalls.flatMap((step) => step.chapters.map((c) => c.id)).sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(recalls.every((step) => step.day < "2026-09-29")).toBe(true);
    expect(recalls[0].day).toBe(today);
    expect(plan.at(-1)).toMatchObject({ kind: "erreurs", day: "2026-09-28" });
  });

  it("peu de jours : les jours se chargent plutôt que d'oublier un chapitre", () => {
    const plan = buildPrepPlan(entries, today, "2026-09-26", false);
    expect(plan).toHaveLength(2);
    expect(plan.flatMap((step) => step.chapters)).toHaveLength(5);
  });

  it("épreuve aujourd'hui : pas de plan", () => {
    expect(buildPrepPlan(entries, today, today, true)).toEqual([]);
  });
});

describe("buildExamPrep", () => {
  const chapters = [chapter("int", "2026-09-10"), chapter("ser", "2026-09-20"), chapter("phys", "2026-09-10", "Physique"), { ...chapter("old", "2026-09-01"), archived: true }];

  it("lit le programme, ignore les chapitres rangés ou supprimés, et compte ce qui reste à faire", () => {
    const item = withScope(exam(), ["ser", "int", "old", "deleted"], NOW);
    const prep = buildExamPrep(item, {
      chapterMemory: chapters,
      errors: [error(), error({ fix: "La bonne idée" }), error({ subject: "Physique" }), error({ date: "2026-06-01" })],
      reviewItems: [],
      sessions: [],
    }, NOW)!;
    expect(prep.daysLeft).toBe(5);
    expect(prep.chapters.map((entry) => entry.chapter.id)).toEqual(["int", "ser"]); // le plus menacé d'abord
    expect(prep.missing).toBe(2);
    expect(prep.unfixedErrors).toHaveLength(1);
    expect(prep.recentErrors).toBe(2);
    expect(prep.expectedOnExam).toBeCloseTo((prep.chapters[0].onExam + prep.chapters[1].onExam) / 2, 10);
    expect(prep.expectedToday).toBeCloseTo((retrievabilityToday(chapters[0], TODAY) + retrievabilityToday(chapters[1], TODAY)) / 2, 10);
    expect(prep.plan.some((step) => step.kind === "erreurs")).toBe(true);
  });

  it("sans programme : aucune moyenne inventée", () => {
    const prep = buildExamPrep(exam(), { chapterMemory: chapters, errors: [], reviewItems: [], sessions: [] }, NOW)!;
    expect(prep.chapters).toEqual([]);
    expect(prep.expectedOnExam).toBeNull();
    expect(prep.plan).toEqual([]);
  });

  it("sans date : rien à calculer", () => {
    expect(buildExamPrep(exam({ dueDate: null }), { chapterMemory: [], errors: [], reviewItems: [], sessions: [] }, NOW)).toBeNull();
  });
});

describe("examScopeIndex", () => {
  it("rattache chaque chapitre à l'épreuve la plus proche qui le contient", () => {
    const near = withScope(exam({ id: "near", dueDate: "2026-09-26" }), ["a"], NOW);
    const far = withScope(exam({ id: "far", dueDate: "2026-09-30" }), ["a", "b"], NOW);
    const index = examScopeIndex([far, near], TODAY, 7);
    expect(index.get("a")).toMatchObject({ days: 2, item: { id: "near" } });
    expect(index.get("b")).toMatchObject({ days: 6, item: { id: "far" } });
    expect(examScopeIndex([far], TODAY, 3).size).toBe(0);
  });
});
