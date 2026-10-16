import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog, type AnnaleLog } from "@/lib/annales";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ExerciseAttempt } from "@/lib/attempts";
import { createSheet, EMPTY_DRAFT, sheetHref, sheetKey, trainingHref, type SheetDraft } from "@/lib/exercise-sheets";
import { proposeFollowUp, smallStepFor, type FollowUp, type FollowUpInput } from "@/lib/follow-up";
import type { NextMoveInput } from "@/lib/next-move/engine";
import { createReviewItem } from "@/lib/review-items";
import { buildRevisionProgram } from "@/lib/revision-program";
import { normalizePreferences, type NextMoveRecord, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Jeudi 24 septembre 2026. */
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

function attempt(key: string, day: string, extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return { id: `t${seq}`, exerciseKey: key, label: `Exercice ${key}`, subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day, createdAt: `${day}T18:00:00.000Z`, updatedAt: `${day}T18:00:00.000Z`, result: "réussi", help: "sans", minutes: 30, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null, level: "classique", ...extra };
}

const draft = (overrides: Partial<SheetDraft> = {}): SheetDraft => ({
  ...EMPTY_DRAFT,
  subject: "Mathématiques",
  chapterId: "m2-reduction",
  competence: "Diagonaliser via un polynôme annulateur",
  level: "classique",
  origin: "ia",
  statement: "ÉNONCÉ-SECRET Montrer que A est diagonalisable.",
  hints: ["INDICE-SECRET polynôme annulateur"],
  correction: "CORRECTION-SECRÈTE X(X-1)(X+1).",
  ...overrides,
});

const sheetClassique = createSheet(draft({ notion: "polynôme annulateur" }), at(9, 0, 20), "fc")!;
const sheetDifficile = createSheet(draft({ level: "difficile", competence: "Réduction d'un endomorphisme à paramètre" }), at(9, 0, 21), "fd")!;
const sheetDirect = createSheet(draft({ level: "direct", competence: "Calculer un polynôme caractéristique" }), at(9, 0, 22), "fa")!;
const sheetExterne = createSheet(draft({ level: "classique", origin: "externe", sourceName: "Mines 2023 MP1", sourceUrl: "https://example.org/mines.pdf", competence: "Réduction : problème complet" }), at(9, 0, 19), "fe")!;

function nextMove(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [session("Mathématiques", 40, at(14, 0))], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: at(15), availableMinutes: null, ...overrides };
}

function followUp(overrides: Partial<FollowUpInput> = {}, move: Partial<NextMoveInput> = {}): FollowUp {
  return proposeFollowUp({ nextMove: nextMove(move), session: { subject: "Mathématiques", minutes: 40 }, attempts: [], move: null, sheets: [], selfReport: null, ...overrides });
}

const sentinels = ["ÉNONCÉ-SECRET", "INDICE-SECRET", "CORRECTION-SECRÈTE"];

describe("suite de séance — selon le résultat noté", () => {
  it("réussi sans aide : un exercice (fiche de l'élève), avec la raison, et UNE seule alternative", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique, sheetDifficile] });
    expect(result.topic).toMatchObject({ chapterId: "m2-reduction", basis: "d'après l'exercice que tu viens de noter" });
    expect(result.primary).toMatchObject({ kind: "exercice" });
    expect(result.primary!.exercise).toMatchObject({ source: "fiche", origin: "ia", chapterId: "m2-reduction" });
    expect(result.primary!.why.length).toBeGreaterThan(10);
    expect(result.alternative).not.toBeNull();
    expect(result.alternative!.start.href).not.toBe(result.primary!.start.href);
    expect(result.summary).toContain("réussi sans aide");
  });

  it("deux classiques réussis sans aide : on monte au difficile, et la fiche difficile est celle proposée", () => {
    const attempts = [attempt("annale:a|m2-reduction", "2026-09-20"), attempt("annale:b|m2-reduction", "2026-09-22")];
    const result = followUp({ attempts: [attempts[1]], sheets: [sheetClassique, sheetDifficile] }, { attempts });
    expect(result.primary!.exercise).toMatchObject({ source: "fiche", level: "difficile" });
    expect(result.primary!.start.href).toBe(sheetHref("fd"));
    expect(result.primary!.why).toMatch(/difficile/);
  });

  it("réussi avec aide, ou partiel : un AUTRE exercice du même niveau, et la notion en alternative", () => {
    for (const extra of [{ help: "indices" as const }, { result: "partiel" as const }]) {
      const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24", extra)], sheets: [sheetClassique] });
      expect(result.primary!.kind).toBe("exercice");
      expect(result.primary!.why).toMatch(/seul|autre/i);
      expect(result.alternative!.kind).toBe("reprise");
    }
  });

  it("échec par manque de cours : on reprend la notion d'abord, l'exercice facile en alternative — sans culpabiliser", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24", { result: "échec", cause: "cours" })], sheets: [sheetDirect] });
    expect(result.primary).toMatchObject({ kind: "reprise" });
    expect(result.primary!.why).toMatch(/cours/);
    expect(result.alternative).toMatchObject({ kind: "exercice" });
    expect(result.summary).toContain("raté");
    expect(JSON.stringify(result)).not.toMatch(/échou|faute|honte|paresse|retard/i);
  });

  it("échec ailleurs : un exercice UN CRAN plus facile ; au niveau direct, la notion d'abord", () => {
    const failed = attempt("annale:x|m2-reduction", "2026-09-24", { result: "échec", cause: "méthode", level: "classique" });
    const easier = followUp({ attempts: [failed], sheets: [sheetDirect, sheetClassique] });
    expect(easier.primary!.exercise).toMatchObject({ source: "fiche", level: "direct" });
    expect(easier.primary!.start.href).toBe(sheetHref("fa"));
    const direct = followUp({ attempts: [attempt("annale:y|m2-reduction", "2026-09-24", { result: "échec", cause: "calcul", level: "direct" })], sheets: [sheetDirect] });
    expect(direct.primary!.kind).toBe("reprise");
  });

  it("« j'ai bloqué » sans exercice noté : on reprend la notion plus doucement, avec la première étape plus petite à portée", () => {
    const result = followUp({ selfReport: "bloque", move: { key: "rappel:mem-1", kind: "rappel" } }, { chapterMemory: [] });
    // Sans chapitre connu, la suite vient du programme — et le dit.
    expect(result.notes.join(" ")).toMatch(/Rien n'indique/);
    const known = followUp({ selfReport: "bloque", move: { key: "exercice:m2-reduction", kind: "refaire" } });
    expect(known.primary!.kind).toBe("reprise");
    expect(known.primary!.why).toMatch(/bloqué/);
    expect(known.summary).toContain("bloqué");
    expect(known.primary!.small.minutes).toBeLessThanOrEqual(10);
  });
});

describe("suite de séance — l'exercice proposé", () => {
  it("la fiche d'une ressource externe garde sa source et son lien, et l'origine est dite", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetExterne] });
    expect(result.primary!.exercise).toMatchObject({ source: "fiche", origin: "externe", sourceName: "Mines 2023 MP1", url: "https://example.org/mines.pdf", competence: "Réduction : problème complet" });
    expect(result.primary!.exercise!.note).toContain("Ressource externe");
  });

  it("une fiche jamais tentée passe avant une fiche déjà tentée sans réussite", () => {
    const tried = attempt(sheetKey("fc"), "2026-09-22", { result: "échec" });
    const result = followUp(
      { attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique, sheetExterne] },
      { attempts: [tried] }
    );
    expect(result.primary!.start.href).toBe(sheetHref("fe"));
  });

  it("sans fiche ni annale : un original à générer par IA, avec la demande prête — et AUCUN lien inventé", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [] });
    const provision = result.primary!.exercise!;
    expect(provision).toMatchObject({ source: "a-generer", origin: "ia", sourceName: null, url: null });
    expect(provision.request).toContain("Propose-moi UN exercice");
    expect(provision.request).toContain("Ne donne PAS la correction");
    expect(result.primary!.start.href).toBe(trainingHref({ chapterId: "m2-reduction", level: provision.level }));
    expect(JSON.stringify(result)).not.toMatch(/https?:\/\//);
  });

  it("une annale déjà tentée à refaire est proposée avant d'en demander un nouveau, sans lien inventé", () => {
    const annale: AnnaleLog = normalizeAnnaleLog({ id: "an1", created_at: "2026-09-10T15:00:00Z", matiere: "maths", chapitre: "Réduction des endomorphismes", source: "Mines 2023 MP1", resultat: "échec", indices: 3 })!;
    const result = proposeFollowUp({
      nextMove: nextMove({ annales: [annale] }),
      session: { subject: "Mathématiques", minutes: 40 },
      attempts: [attempt("fiche:z", "2026-09-24")],
      move: null,
      sheets: [],
    });
    expect(result.primary!.exercise).toMatchObject({ source: "annale", url: null });
    expect(result.primary!.start.href).toMatch(/^\/annales\?refaire=/);
  });

  it("n'expose JAMAIS l'énoncé, les indices ni la correction d'une fiche", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique, sheetDifficile, sheetExterne, sheetDirect] });
    const json = JSON.stringify(result);
    for (const secret of sentinels) expect(json).not.toContain(secret);
  });
});

describe("suite de séance — temps, programme et notes", () => {
  it("le temps proposé tient dans le temps restant", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetDifficile, sheetClassique] }, { now: at(22, 30), attempts: [attempt("annale:a|m2-reduction", "2026-09-20"), attempt("annale:b|m2-reduction", "2026-09-22")] });
    expect(result.primary!.minutes).toBeLessThanOrEqual(30);
    expect(result.primary!.minutes).toBeGreaterThanOrEqual(5);
  });

  it("plus de temps aujourd'hui : « assez pour aujourd'hui », aucune tâche imposée", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique] }, { now: at(22, 58) });
    expect(result.primary).toBeNull();
    expect(result.rest!.message).toMatch(/assez/);
  });

  it("sans chapitre connu, la suite vient du programme du jour, et on le dit", () => {
    const dm: WorkItem = { id: "w1", title: "DM 5", kind: "dm", subject: "Physique", estimatedMinutes: 90, dueDate: "2026-09-25", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [] } as WorkItem;
    const result = followUp({}, { workItems: [dm] });
    expect(result.topic).toBeNull();
    expect(result.primary).toMatchObject({ kind: "programme", title: "DM 5" });
    expect(result.notes.join(" ")).toMatch(/Rien n'indique/);
  });

  it("l'indispensable qui reste est rappelé (au plus deux), sans demander de décider", () => {
    const dm: WorkItem = { id: "w2", title: "DM 6", kind: "dm", subject: "Physique", estimatedMinutes: 90, dueDate: "2026-09-25", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [] } as WorkItem;
    const cards = [0, 1, 2].map((index) => createReviewItem({ subject: "Physique", text: `Carte ${index}`, kind: "à revoir" }, at(9, 0, 20))!);
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique] }, { workItems: [dm], reviewItems: cards });
    expect(result.reminders.length).toBeGreaterThan(0);
    expect(result.reminders.length).toBeLessThanOrEqual(2);
    expect(result.reminders.map((reminder) => reminder.title)).toContain("DM 6");
  });

  it("la recommandation Anki qui vient d'être faite n'est pas reproposée ; on dit de mettre le relevé à jour", () => {
    const snapshot: AnkiSnapshot = { id: "anki:2026-09-24", day: "2026-09-24", takenAt: at(8).toISOString(), source: "ankiconnect", decks: [{ name: "MP::Maths::Réduction", total: 100, due: 30, reviewed30: 60, failed30: 5, mature: 50, lapsing: 1 }], reviewsByDay: [], manual: null };
    const result = followUp({ move: { key: "anki:dues", kind: "anki" } }, { ankiSnapshots: [snapshot] });
    expect(result.reminders.map((reminder) => reminder.title).join(" ")).not.toMatch(/Anki/);
    expect(result.notes.join(" ")).toMatch(/relevé/);
  });

  it("l'autre idée est précise : jamais un « bloc de travail » générique", () => {
    // Pas d'échéance ni de carte : le programme ne contient que le bloc de la semaine, qui ne dit pas quoi faire.
    const result = followUp({ move: { key: "rappel:mem-1", kind: "rappel" }, sheets: [sheetClassique] }, {
      chapterMemory: [{ id: "mem-1", subject: "Mathématiques", title: "Réduction des endomorphismes", learnedAt: "2026-09-04", card: { stability: 3, difficulty: 5, state: "review", reps: 3, lapses: 0, lastReview: "2026-09-14", due: "2026-09-17", scheduledDays: 3 }, reviews: [], archived: false, createdAt: "2026-09-04T10:00:00.000Z" } as never],
      preferences: prefs({ weeklySubjectTargets: { ...NO_TARGETS, Mathématiques: 600 } }),
    });
    expect(result.primary).not.toBeNull();
    if (result.alternative) expect(result.alternative.title).not.toMatch(/^(Mathématiques|Physique|Chimie)$/);
  });

  it("dit d'où vient le chapitre retenu, et signale le manque de données sur ce chapitre", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique] });
    expect(result.notes.join(" ")).toContain("Chapitre retenu d'après l'exercice que tu viens de noter");
    expect(result.notes.join(" ")).toMatch(/Peu de données/);
  });
});

describe("première étape plus petite", () => {
  const kinds = ["exercice", "reprise", "programme", "refaire", "rappel", "cartes", "anki", "erreurs", "échéance", "bloc"] as const;

  it("chaque genre a un début de 5 à 10 minutes où il n'y a rien à résoudre ni à réussir", () => {
    for (const kind of kinds) {
      const step = smallStepFor(kind, "Réduction des endomorphismes");
      expect(step.minutes, kind).toBeGreaterThanOrEqual(5);
      expect(step.minutes, kind).toBeLessThanOrEqual(10);
      expect(step.instruction.length, kind).toBeGreaterThan(20);
      expect(`${step.title} ${step.instruction}`, kind).not.toMatch(/échec|faute|\bnul\b|retard|honte|paresse/i);
    }
  });

  it("l'exercice n'y est pas à résoudre : on lit et on reformule", () => {
    expect(smallStepFor("exercice", null).instruction).toMatch(/pas à le résoudre/);
  });

  it("toute étape proposée porte sa version plus petite", () => {
    const result = followUp({ attempts: [attempt("annale:x|m2-reduction", "2026-09-24")], sheets: [sheetClassique] });
    for (const step of [result.primary, result.alternative]) if (step) expect(step.small.minutes).toBeLessThanOrEqual(10);
  });
});

describe("programme de révision — évitement et Anki", () => {
  const record = (id: string, key: string, status: NextMoveRecord["status"], hoursAgo: number): NextMoveRecord => {
    const proposedAt = new Date(at(15).getTime() - hoursAgo * 3_600_000).toISOString();
    return { id, key, kind: "cartes", subject: "Physique", title: "3 cartes à réviser", minutes: 5, reasons: [], proposedAt, status, startedAt: null, resolvedAt: status === "écarté" ? proposedAt : null, outcomeMinutes: null };
  };
  const cards = [0, 1, 2].map((index) => createReviewItem({ subject: "Physique", text: `Carte ${index}`, kind: "à revoir" }, at(9, 0, 20))!);

  it("une tâche proposée plusieurs fois sans suite reste au programme, avec une première étape plus petite", () => {
    const history = [record("h1", "cartes:Physique", "proposé", 50), record("h2", "cartes:Physique", "proposé", 30), record("h3", "cartes:Physique", "proposé", 10)];
    const program = buildRevisionProgram(nextMove({ reviewItems: cards, history }));
    const item = program.items.find((entry) => entry.key === "cartes:Physique");
    expect(item).toBeDefined();
    expect(item!.avoidance).not.toBeNull();
    expect(item!.avoidance!.note).toMatch(/ça arrive/);
    expect(item!.avoidance!.smallStep.minutes).toBeLessThanOrEqual(10);
    // Sans historique d'évitement : rien.
    expect(buildRevisionProgram(nextMove({ reviewItems: cards })).items.find((entry) => entry.key === "cartes:Physique")!.avoidance).toBeNull();
  });

  it("« Pas maintenant » : la tâche est reportée, jamais abandonnée, et offre une façon plus douce de la reprendre", () => {
    const failed = attempt("k1", "2026-09-20", { result: "échec" });
    const skippedRecord: NextMoveRecord = { ...record("h1", "refaire:k1", "écarté", 2), kind: "refaire", subject: "Mathématiques", title: "Exercice k1" };
    const program = buildRevisionProgram(nextMove({ attempts: [failed], history: [skippedRecord] }));
    const postponed = program.postponed.find((entry) => entry.key === "refaire:k1");
    expect(postponed).toBeDefined();
    expect(postponed!.skipped).toBe(true);
    expect(postponed!.smallStep!.minutes).toBeLessThanOrEqual(10);
    expect(postponed!.smallStep!.instruction).toMatch(/pas à le résoudre/);
    expect(postponed!.to).toMatch(/^demain/);
    expect(JSON.stringify(program.postponed)).not.toMatch(/abandonn/i);
    // Sans « Pas maintenant », la même tâche reste au programme.
    expect(buildRevisionProgram(nextMove({ attempts: [failed] })).items.map((entry) => entry.key)).toContain("refaire:k1");
  });

  it("un relevé Anki de plus de 6 h rend l'élément Anki « à confirmer » ; récent, il est fiable", () => {
    const snapshot = (takenAt: Date): AnkiSnapshot => ({ id: "anki:2026-09-24", day: "2026-09-24", takenAt: takenAt.toISOString(), source: "ankiconnect", decks: [{ name: "MP::Maths::Réduction", total: 100, due: 30, reviewed30: 60, failed30: 5, mature: 50, lapsing: 1 }], reviewsByDay: [], manual: null });
    const fresh = buildRevisionProgram(nextMove({ ankiSnapshots: [snapshot(at(14))] })).items.find((entry) => entry.key === "anki:dues");
    const old = buildRevisionProgram(nextMove({ ankiSnapshots: [snapshot(at(6))] })).items.find((entry) => entry.key === "anki:dues");
    expect(fresh!.reliability.level).toBe("fiable");
    expect(old!.reliability.level).toBe("a-confirmer");
    expect(old!.reliability.reasons[0]).toMatch(/tu as pu faire des cartes/);
  });
});
