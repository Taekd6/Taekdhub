import { describe, expect, it } from "vitest";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildDayAgenda } from "@/lib/day-agenda";
import { createChapter, rateChapter } from "@/lib/chapter-memory";
import { computeNextMove, rankCandidates, type NextMoveInput } from "@/lib/next-move/engine";
import { createReviewItem } from "@/lib/review-items";
import { buildRevisionProgram, MIN_RECALLS, STALE_WORK_DAYS, type RevisionProgram } from "@/lib/revision-program";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Jeudi 24 septembre 2026, 15 h. */
const at = (hour: number, minute = 0, dayOfMonth = 24) => new Date(2026, 8, dayOfMonth, hour, minute);
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], planningMarginPercent: 0, ...overrides });
}

let seq = 0;
function session(subject: Subject, minutes: number, start: Date): WorkSession {
  seq += 1;
  return { id: `s${seq}`, subject, exercise_id: null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(), duration_seconds: minutes * 60, note: null, created_at: start.toISOString(), result: null, hints_used: null, work_item_id: null };
}

function workItem(overrides: Partial<WorkItem>): WorkItem {
  seq += 1;
  return { id: `w${seq}`, title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: "2026-09-30", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

function attempt(key: string, day: string, extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return { id: `t${seq}`, exerciseKey: key, label: `Exercice ${key}`, subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day, createdAt: `${day}T18:00:00.000Z`, updatedAt: `${day}T18:00:00.000Z`, result: "échec", help: "sans", minutes: 30, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null, ...extra };
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [session("Physique", 30, at(10))], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: at(15), availableMinutes: null, ...overrides };
}

const dueCards = [0, 1, 2].map((index) => ({ ...createReviewItem({ subject: "Physique", text: `Carte ${index}`, kind: "à revoir" }, at(9, 0, 20))! }));

/** Un chapitre appris tôt puis rappelé trois fois, loin dans le passé : menacé aujourd'hui, avec assez de rappels pour que l'estimation tienne. */
function seasonedChapter() {
  let chapter = createChapter({ subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-07-01" }, at(9), "mem-1");
  for (const day of ["2026-07-03", "2026-07-10", "2026-07-25"]) chapter = rateChapter(chapter, "hard", day);
  return chapter;
}
const youngChapter = createChapter({ subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-09-10" }, at(9), "mem-2");

const dm = workItem({ title: "DM 5", dueDate: "2026-09-25", estimatedMinutes: 90, subject: "Physique" });
const annaleAttempt = attempt("annale:mines 2023|m2-reduction", "2026-09-20");
const oldChapter = seasonedChapter();
// Mêmes objets à chaque appel : les identifiants (donc les clés de tâche) ne changent pas d'un calcul à l'autre.
const full = (): NextMoveInput => input({ workItems: [dm], reviewItems: dueCards, attempts: [annaleAttempt], chapterMemory: [oldChapter] });

function program(overrides: Partial<NextMoveInput> = {}, context = {}): RevisionProgram {
  return buildRevisionProgram({ ...full(), ...overrides }, context);
}

describe("programme de révision — chaque élément répond aux cinq questions", () => {
  const result = program();

  it("il y a un programme, avec le temps restant et une synthèse", () => {
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.empty).toBe(false);
    expect(result.budget.minutes).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("quoi, pourquoi, pourquoi maintenant, combien, par où commencer : jamais vide", () => {
    for (const item of result.items) {
      expect(item.title.length, item.key).toBeGreaterThan(0);
      expect(item.action.length, item.key).toBeGreaterThan(0);
      expect(item.why.length, item.key).toBeGreaterThan(0);
      expect(item.whyNow.length, item.key).toBeGreaterThan(0);
      expect(item.minutes, item.key).toBeGreaterThan(0);
      expect(item.start.href, item.key).toMatch(/^\//);
      expect(item.start.label.length, item.key).toBeGreaterThan(0);
      expect(item.reliability.reasons.length, item.key).toBeGreaterThan(0);
    }
  });

  it("reprend exactement l'arbitrage du plan du jour : mêmes tâches, mêmes durées, rien d'inventé ni de retiré", () => {
    const agenda = buildDayAgenda(full());
    expect(result.items.map((item) => [item.key, item.minutes])).toEqual(agenda.kept.map((task) => [task.key, task.minutes]));
    expect(result.used).toBe(agenda.used);
    expect(result.overflow).toBe(agenda.overflow);
    expect(result.postponed.map((task) => task.key)).toEqual(agenda.postponed.map((task) => task.key));
  });

  it("le « pourquoi » d'un élément vient du moteur (problème, raisons chiffrées, critère de fin)", () => {
    const candidates = new Map(rankCandidates(full()).map((candidate) => [candidate.key, candidate]));
    for (const item of result.items.filter((entry) => entry.candidate)) {
      const candidate = candidates.get(item.key)!;
      expect(item.why).toBe(candidate.problem);
      expect(item.doneWhen).toBe(candidate.doneWhen);
      expect(item.instruction).toBe(candidate.instruction);
      expect(item.whyNow.some((reason) => candidate.terms.some((term) => term.reason === reason))).toBe(true);
    }
  });

  it("l'ordre est celui du plan : l'indispensable d'abord", () => {
    expect(result.items[0].tier).toBe("indispensable");
    const order = ["indispensable", "important", "secondaire"];
    const tiers = result.items.map((item) => order.indexOf(item.tier));
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it("ne dépend pas du moteur Next Move modifié : sa proposition n°1 reste présente dans le programme", () => {
    const primary = computeNextMove({ ...full() }).primary;
    expect(primary).not.toBeNull();
    expect(result.items.map((item) => item.key)).toContain(primary!.key);
  });
});

const CRUSHING = workItem({ title: "DM demain", dueDate: "2026-09-25", estimatedMinutes: 300, subject: "Physique" });
const UNDATED = workItem({ title: "Sans date", dueDate: null, estimatedMinutes: 60, important: true });

describe("programme de révision — sans replanification manuelle", () => {
  it("quand le temps manque, ce qui ne tient pas est déplacé à demain automatiquement, avec sa raison", () => {
    const tight = program({}, { override: { minutes: 20, at: at(15).toISOString() } });
    expect(tight.budget.overridden).toBe(true);
    expect(tight.postponed.length).toBeGreaterThan(0);
    for (const task of tight.postponed) {
      expect(task.reason.length).toBeGreaterThan(0);
      expect(task.to).toMatch(/^demain/);
    }
    // Chaque tâche du plan complet est soit gardée, soit déplacée : aucune ne disparaît.
    const wide = program();
    const accounted = new Set([...tight.items.map((item) => item.key), ...tight.postponed.map((task) => task.key)]);
    for (const item of wide.items) expect(accounted.has(item.key), item.key).toBe(true);
  });

  it("l'indispensable qui dépasse le temps restant est dit, jamais caché", () => {
    const crushed = program({ workItems: [CRUSHING], now: at(21) });
    expect(crushed.overflow).toBeGreaterThan(0);
    expect(crushed.summary).toContain("dépasse ton temps restant");
  });
});

describe("programme de révision — fiabilité", () => {
  const items = (result: RevisionProgram) => new Map(result.items.map((item) => [item.key, item]));

  it("une échéance datée et des cartes dues sont fiables, et le disent", () => {
    const map = items(program());
    const deadline = result_find(map, "échéance:");
    expect(deadline.reliability.level).toBe("fiable");
    expect(deadline.reliability.reasons[0]).toMatch(/datée/);
    expect(map.get("cartes:Physique")!.reliability.level).toBe("fiable");
  });

  it(`un rappel dont la mémoire repose sur moins de ${MIN_RECALLS} rappels est « à confirmer », et dit pourquoi`, () => {
    const result = program({ chapterMemory: [youngChapter], now: at(15, 0, 30) });
    const recall = result.items.find((item) => item.key === "rappel:mem-2");
    expect(recall).toBeDefined();
    expect(recall!.reliability.level).toBe("a-confirmer");
    expect(recall!.reliability.reasons[0]).toMatch(/rappel/);
  });

  it("un rappel appuyé sur assez de rappels est fiable", () => {
    const result = program({ chapterMemory: [oldChapter], now: at(15, 0, 30) });
    const recall = result.items.find((item) => item.key === "rappel:mem-1");
    expect(recall).toBeDefined();
    expect(recall!.reliability).toMatchObject({ level: "fiable" });
  });

  it("une échéance sans date est « à confirmer »", () => {
    const result = program({ workItems: [UNDATED] });
    const undated = result.items.find((item) => item.title === "Sans date");
    expect(undated).toBeDefined();
    expect(undated!.reliability.level).toBe("a-confirmer");
  });
});

function result_find(map: Map<string, RevisionProgram["items"][number]>, prefix: string) {
  const found = [...map.entries()].find(([key]) => key.startsWith(prefix));
  expect(found, prefix).toBeDefined();
  return found![1];
}

describe("programme de révision — notes sur les données", () => {
  it("rien à signaler : aucune note, programme fiable", () => {
    const result = program();
    expect(result.notes.filter((note) => note.level === "alerte")).toEqual([]);
    expect(result.overall).toBe("fiable");
  });

  it(`aucune séance depuis ${STALE_WORK_DAYS} jours : alerte, et le programme n'est plus présenté comme fiable`, () => {
    const result = program({ sessions: [session("Physique", 30, at(10, 0, 24 - STALE_WORK_DAYS))] });
    const note = result.notes.find((entry) => entry.id === "seances-anciennes");
    expect(note).toMatchObject({ level: "alerte" });
    expect(note!.text).toContain(`${STALE_WORK_DAYS} jours`);
    expect(result.overall).toBe("a-confirmer");
    // Deux jours seulement : pas d'alerte.
    expect(program({ sessions: [session("Physique", 30, at(10, 0, 22))] }).notes.map((entry) => entry.id)).not.toContain("seances-anciennes");
  });

  it("synchronisation en échec ou annales illisibles : alertes ; compte invité : rien (les annales vivent sur le compte)", () => {
    expect(program({}, { sync: { status: "erreur", lastSyncedAt: null } }).notes.map((note) => note.id)).toContain("synchro-incomplete");
    expect(program({}, { sync: { status: "en-attente", lastSyncedAt: null } }).notes.map((note) => note.id)).toContain("synchro-incomplete");
    expect(program({}, { sync: { status: "à-jour", lastSyncedAt: null } }).notes.map((note) => note.id)).not.toContain("synchro-incomplete");
    expect(program({}, { annalesStatus: "erreur" }).notes.map((note) => note.id)).toContain("annales-illisibles");
    expect(program({}, { annalesStatus: "invité" }).notes.map((note) => note.id)).not.toContain("annales-illisibles");
  });

  it("mémoire vide : une information, pas une alerte", () => {
    const note = program({ chapterMemory: [] }).notes.find((entry) => entry.id === "memoire-vide");
    expect(note).toMatchObject({ level: "info" });
  });

  it("aucune donnée du tout : programme vide et « données insuffisantes », rien d'inventé", () => {
    const blank = buildRevisionProgram({ sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: at(15), availableMinutes: null });
    expect(blank.empty).toBe(true);
    expect(blank.overall).toBe("insuffisant");
    expect(blank.items).toEqual([]);
  });
});

describe("programme de révision — le chemin jusqu'à l'exercice", () => {
  it("une fiche à refaire rouvre SA fiche (l'énoncé d'abord), pas le carnet générique", () => {
    const result = program({ attempts: [attempt("fiche:abc", "2026-09-20")], chapterMemory: [], reviewItems: [], workItems: [] });
    const item = result.items.find((entry) => entry.key === "refaire:fiche:abc");
    expect(item).toBeDefined();
    expect(item!.start).toEqual({ href: "/entrainement?fiche=abc", label: "Refaire l'exercice" });
    expect(item!.exercise).not.toBeNull();
  });

  it("une annale à refaire garde son chemin d'origine", () => {
    const result = program({ attempts: [attempt("annale:mines 2023|m2-reduction", "2026-09-20")], chapterMemory: [], reviewItems: [], workItems: [] });
    const item = result.items.find((entry) => entry.key.startsWith("refaire:annale"));
    expect(item!.start.href).toMatch(/^\/annales\?refaire=/);
    expect(item!.start.label).toBe("Refaire sans aide");
  });

  it("un exercice ciblé du diagnostic mène à l'entraînement du chapitre, au niveau visé, avec la demande pour Claude", () => {
    // Un exercice raté trois fois puis réussi sans aide : plus rien à REFAIRE, mais 1 réussite sur 4 tentatives —
    // le constat « application » du chapitre porte alors seul l'action, sous forme d'un exercice ciblé.
    const attempts = [
      attempt("fiche:z", "2026-09-08", { level: "classique" }),
      attempt("fiche:z", "2026-09-11", { level: "classique" }),
      attempt("fiche:z", "2026-09-14", { level: "classique" }),
      attempt("fiche:z", "2026-09-17", { level: "classique", result: "réussi" }),
    ];
    const result = program({ attempts, chapterMemory: [], reviewItems: [], workItems: [], now: at(15) });
    const targeted = result.items.find((entry) => entry.key.startsWith("exercice:"));
    expect(targeted).toBeDefined();
    expect(targeted!.start.href).toMatch(/^\/entrainement\?chapitre=m2-reduction&niveau=(direct|classique|difficile)$/);
    expect(targeted!.exercise?.request).toContain("Propose-moi UN exercice");
    expect(targeted!.start.label).toBe("Choisir un exercice");
  });
});
