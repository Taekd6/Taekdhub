import { describe, expect, it } from "vitest";
import { createChapter, setArchived } from "@/lib/chapter-memory";
import type { ExerciseAttempt } from "@/lib/attempts";
import { computeNextMove, rankCandidates, type NextMoveInput } from "@/lib/next-move/engine";
import { markStarted, recordProposal, resolveOutcomes } from "@/lib/next-move/history";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { agendaTasks } from "@/lib/day-agenda";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";

/** Jeudi 24 septembre 2026, 10 h — la matinée : pas d'heure tardive, pas de minimum du soir. */
const NOW = new Date(2026, 8, 24, 10, 0);
const NO_EVENING = [{}, {}, {}, {}, {}, {}, {}];
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

const DERIV = "m1-derivabilite";
const SUITES = "m1-reels-suites";

function prefs(seen: string[] = []): Preferences {
  return normalizePreferences({ eveningMinimums: NO_EVENING, weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [120, 120, 120, 120, 120, 240, 180], programmeSeen: seen });
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: NOW, availableMinutes: null, ...overrides };
}

const jamais = (ranked: ReturnType<typeof rankCandidates>) => ranked.filter((candidate) => candidate.key.startsWith("jamais:"));

function memoryOf(id: string, learnedAt = "2026-09-20") {
  const programme = PROGRAMME_BY_ID.get(id)!;
  return createChapter({ subject: programme.subject, title: programme.title, learnedAt }, new Date(`${learnedAt}T12:00:00`), `mem-${id}`);
}

function attempt(chapterId: string): ExerciseAttempt {
  return {
    id: "a-1", exerciseKey: "ds:1:1", label: "DS 1 — Q1", subject: "Mathématiques", chapterId, origin: "ds", day: "2026-09-23",
    createdAt: new Date(2026, 8, 23, 18).toISOString(), updatedAt: new Date(2026, 8, 23, 18).toISOString(),
    result: "réussi", help: "sans", minutes: 20, plannedMinutes: 20, cause: null, lackOfTime: false, gradeId: null, note: null,
  };
}

function ds(daysLeft: number): WorkItem {
  const due = new Date(2026, 8, 24 + daysLeft);
  return {
    id: "ds-1", title: "DS 3", kind: "ds", subject: "Mathématiques", estimatedMinutes: 240,
    dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
    dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [],
  };
}

describe("chapitre vu en cours, jamais consolidé", () => {
  it("sans aucune déclaration : rien n'est inventé", () => {
    const plan = computeNextMove(input());
    expect(plan.status).toBe("vide");
    expect(jamais(plan.ranked)).toEqual([]);
  });

  it("un chapitre déclaré vu, sans trace : une proposition modeste et honnête sur ce qu'on ignore", () => {
    const plan = computeNextMove(input({ preferences: prefs([DERIV]) }));
    const candidate = jamais(plan.ranked)[0];
    expect(candidate.key).toBe(`jamais:${DERIV}`);
    expect(candidate.kind).toBe("rappel");
    expect(candidate.score).toBe(12);
    expect(candidate.href).toBe(`/memoire?ajouter=${DERIV}`);
    expect(candidate.terms.map((term) => term.id)).toEqual(["jamais-revu", "sans-mesure"]);
    // 12 < seuil « calme » : rien ne presse, la carte ne prétend pas le contraire.
    expect(plan.status).toBe("calme");
  });

  it("un identifiant inconnu (programme modifié) est ignoré", () => {
    expect(jamais(rankCandidates(input({ preferences: prefs(["xx-inexistant"]) })))).toEqual([]);
  });

  it("dès que le chapitre entre dans Mémoire, la proposition disparaît (et le rappel prend le relais)", () => {
    const ranked = rankCandidates(input({ preferences: prefs([DERIV]), chapterMemory: [memoryOf(DERIV)] }));
    expect(jamais(ranked)).toEqual([]);
  });

  it("un chapitre RANGÉ dans Mémoire n'est pas reproposé : c'est un choix de l'élève", () => {
    const shelved = setArchived(memoryOf(DERIV), true);
    expect(jamais(rankCandidates(input({ preferences: prefs([DERIV]), chapterMemory: [shelved] })))).toEqual([]);
  });

  it("un exercice noté sur le chapitre suffit à ne plus le dire « jamais revu »", () => {
    expect(jamais(rankCandidates(input({ preferences: prefs([DERIV]), attempts: [attempt(DERIV)] })))).toEqual([]);
  });

  it("un seul chapitre par matière : cocher une année entière ne noie pas le plan", () => {
    const all = [...PROGRAMME_BY_ID.values()].filter((chapter) => chapter.subject === "Mathématiques" && chapter.year === 1).map((chapter) => chapter.id);
    expect(all.length).toBeGreaterThan(5);
    const found = jamais(rankCandidates(input({ preferences: prefs(all) })));
    expect(found).toHaveLength(1);
    // Dans l'ordre où le programme est appris.
    expect(found[0].key).toBe(`jamais:${all[0]}`);
  });

  it("une épreuve proche dans la matière le fait monter ; sans échéance, il reste modeste", () => {
    const calm = jamais(rankCandidates(input({ preferences: prefs([SUITES]) })))[0];
    const withExam = jamais(rankCandidates(input({ preferences: prefs([SUITES]), workItems: [ds(3)] })))[0];
    expect(withExam.score).toBeGreaterThan(calm.score);
    expect(withExam.terms.map((term) => term.id)).toContain("évaluation-proche");
    // Une échéance qui n'existe pas n'ajoute rien.
    expect(calm.terms.map((term) => term.id)).not.toContain("évaluation-proche");
  });

  it("le plan est stable : mêmes données, même résultat, et le recalcul ne modifie pas l'entrée", () => {
    const data = input({ preferences: prefs([DERIV, SUITES]), workItems: [ds(5)] });
    const snapshot = JSON.stringify(data);
    const first = JSON.stringify(computeNextMove(data));
    const second = JSON.stringify(computeNextMove(input({ preferences: prefs([DERIV, SUITES]), workItems: [ds(5)] })));
    expect(second).toBe(first);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it("l'agenda du jour le range en « secondaire » — « important » seulement avec une épreuve proche", () => {
    const tier = (data: NextMoveInput) => agendaTasks(data).find((task) => task.key === `jamais:${SUITES}`)?.tier;
    expect(tier(input({ preferences: prefs([SUITES]) }))).toBe("secondaire");
    expect(tier(input({ preferences: prefs([SUITES]), workItems: [ds(3)] }))).toBe("important");
  });
});

describe("boucle de l'action : proposé → fait → plus proposé", () => {
  const data = input({ preferences: prefs([DERIV]) });
  const candidate = jamais(rankCandidates(data))[0];

  it("un double montage ne crée pas deux lignes d'historique", () => {
    const once = recordProposal([], candidate, 25, ["x"], NOW);
    expect(recordProposal(once, candidate, 25, ["x"], NOW)).toBe(once);
  });

  it("le temps passé dans la matière compte, comme pour tout rappel (même règle que `rappel:`)", () => {
    const history = markStarted([], candidate, 25, ["x"], NOW);
    const later = new Date(NOW.getTime() + 3_600_000);
    const long = { id: "s", subject: "Mathématiques" as const, exercise_id: null, started_at: NOW.toISOString(), ended_at: null, duration_seconds: 3600, note: null, created_at: NOW.toISOString(), result: null, hints_used: null, work_item_id: null };
    const afterWork = resolveOutcomes(history, { sessions: [long], reviewItems: [], chapterMemory: [] }, later);
    expect(afterWork[0].status).toBe("fait");
  });

  it("l'ajout du chapitre à Mémoire après la proposition la marque faite, et le chapitre sort du plan", () => {
    const history = recordProposal([], candidate, 25, ["x"], NOW);
    const added = memoryOf(DERIV, "2026-09-24");
    const withMemory = { ...added, createdAt: new Date(NOW.getTime() + 600_000).toISOString() };
    const resolved = resolveOutcomes(history, { sessions: [], reviewItems: [], chapterMemory: [withMemory] }, new Date(NOW.getTime() + 3_600_000));
    expect(resolved[0].status).toBe("fait");
    expect(jamais(rankCandidates({ ...data, chapterMemory: [withMemory], history: resolved }))).toEqual([]);
  });

  it("un chapitre ajouté AVANT la proposition ne la valide pas", () => {
    const history = recordProposal([], candidate, 25, ["x"], NOW);
    const old = { ...memoryOf(DERIV), createdAt: new Date(NOW.getTime() - 86_400_000).toISOString() };
    const resolved = resolveOutcomes(history, { sessions: [], reviewItems: [], chapterMemory: [old] }, new Date(NOW.getTime() + 3_600_000));
    expect(resolved).toBe(history);
  });
});
