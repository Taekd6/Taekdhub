import { describe, expect, it } from "vitest";
import { createChapter, rateChapter } from "@/lib/chapter-memory";
import { createErrorEntry } from "@/lib/error-log";
import { createGrade } from "@/lib/grades";
import { createReviewItem } from "@/lib/review-items";
import { normalizeAnnaleLog } from "@/lib/annales";
import {
  CALM_THRESHOLD,
  autoMinutes,
  composeSession,
  computeNextMove,
  rankCandidates,
  topReasons,
  type MoveCandidate,
  type NextMoveInput,
} from "@/lib/next-move/engine";
import { normalizePreferences, type ChapterMemory, type DailyCheckin, type ErrorEntry, type ErrorType, type Grade, type NextMoveRecord, type Preferences, type ReviewItem, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Jeudi 24 septembre 2026, 19 h 12 — heure LOCALE, comme toute l'application. */
const NOW = new Date(2026, 8, 24, 19, 12);
const TODAY = "2026-09-24";

const NO_EVENING = [{}, {}, {}, {}, {}, {}, {}];
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

/** Préférences NEUTRES : ni minimum du soir, ni budget hebdo — chaque test ajoute ce qu'il vérifie. */
function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: NO_EVENING, weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [120, 120, 120, 120, 120, 240, 180], ...overrides });
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return {
    sessions: [],
    workItems: [],
    grades: [],
    reviewItems: [],
    errors: [],
    checkins: [],
    chapterMemory: [],
    preferences: prefs(),
    history: [],
    now: NOW,
    availableMinutes: null,
    ...overrides,
  };
}

let seq = 0;
function session(subject: Subject, minutes: number, startedAt: Date, workItemId: string | null = null): WorkSession {
  seq += 1;
  return {
    id: `s-${seq}`,
    subject,
    exercise_id: null,
    started_at: startedAt.toISOString(),
    ended_at: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: workItemId,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "w-1",
    title: "DM 4",
    kind: "dm",
    subject: "Mathématiques",
    estimatedMinutes: 120,
    dueDate: "2026-09-30",
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

function chapter(subject: Subject, title: string, learnedAt: string, id = title): ChapterMemory {
  return createChapter({ subject, title, learnedAt }, new Date(`${learnedAt}T12:00:00`), id);
}

function error(subject: Subject, type: ErrorType, date: string, fix?: string): ErrorEntry {
  return createErrorEntry({ subject, type, date, source: "exercice", description: `Erreur ${type} ${date}`, fix }, NOW)!;
}

function cards(subject: Subject, count: number): ReviewItem[] {
  return Array.from({ length: count }, (_, index) => {
    const item = createReviewItem({ subject, text: `Carte ${index}`, kind: "à apprendre" }, new Date(2026, 8, 20))!;
    return { ...item, id: `${subject}-${index}` };
  });
}

function grade(subject: Subject, score: number, date: string, predictedScore?: number): Grade {
  return createGrade({ subject, title: `DS ${date}`, kind: "ds", date, score, maxScore: 20, predictedScore }, NOW)!;
}

function keys(candidates: MoveCandidate[]): string[] {
  return candidates.map((candidate) => candidate.key);
}

function termIds(candidate: MoveCandidate): string[] {
  return candidate.terms.map((term) => term.id);
}

describe("absence de données", () => {
  it("un nouvel inscrit sans objectif ni saisie : statut « vide », aucune recommandation inventée", () => {
    const plan = computeNextMove(input());
    expect(plan.status).toBe("vide");
    expect(plan.primary).toBeNull();
    expect(plan.steps).toEqual([]);
    expect(plan.ranked).toEqual([]);
  });

  it("un nouvel inscrit avec les réglages par défaut : le minimum du soir suffit à proposer un vrai bloc", () => {
    // Préférences par défaut de l'application : 2 h de maths et 1 h 30 de physique le jeudi soir.
    const plan = computeNextMove(input({ preferences: normalizePreferences({}) }));
    expect(plan.status).toBe("ok");
    expect(plan.primary?.kind).toBe("bloc");
    expect(plan.primary?.subject).toBe("Mathématiques");
    expect(topReasons(plan.primary!)[0]).toMatch(/Minimum du soir : encore 2 h en mathématiques/);
  });
});

describe("urgence des échéances", () => {
  it("un DM pour demain passe devant un chapitre modérément menacé", () => {
    const dm = workItem({ dueDate: "2026-09-25" });
    const memory = [chapter("Physique", "Électrostatique", "2026-09-17")];
    const ranked = rankCandidates(input({ workItems: [dm], chapterMemory: memory }));
    expect(ranked[0].key).toBe("échéance:w-1");
    expect(ranked[0].terms[0].reason).toMatch(/Échéance demain/);
  });

  it("une échéance lointaine et non importante n'est pas candidate — le planning s'en occupe", () => {
    const far = workItem({ dueDate: "2026-11-30" });
    expect(rankCandidates(input({ workItems: [far] }))).toEqual([]);
  });

  it("un travail reporté (« pas avant ») n'est pas proposé avant son jour", () => {
    const postponed = workItem({ dueDate: "2026-09-26", notBeforeDate: "2026-09-25" });
    expect(rankCandidates(input({ workItems: [postponed] }))).toEqual([]);
  });

  it("un travail terminé en temps (plus rien à faire) n'est pas candidat", () => {
    const dm = workItem({ dueDate: "2026-09-25", estimatedMinutes: 60 });
    const done = session("Mathématiques", 60, new Date(2026, 8, 23, 18), "w-1");
    expect(rankCandidates(input({ workItems: [dm], sessions: [done] }))).toEqual([]);
  });

  it("un plan « si… alors… » du jour ajoute sa raison", () => {
    const dm = workItem({ dueDate: "2026-09-29", plan: { day: TODAY, time: "18:30", place: null } });
    const [first] = rankCandidates(input({ workItems: [dm] }));
    expect(termIds(first)).toContain("plan-du-jour");
    expect(topReasons(first)).toContain("Tu avais prévu de t'y mettre aujourd'hui à 18 h 30");
  });

  it("« Commencer » mène au chrono, rattaché au travail", () => {
    const [first] = rankCandidates(input({ workItems: [workItem({ dueDate: "2026-09-25" })] }));
    expect(first.href).toBe("/timer?travail=w-1");
  });
});

describe("risque d'oubli", () => {
  it("un chapitre sous le seuil devient un rappel actif, le plus menacé d'abord", () => {
    const old = chapter("Physique", "Électrostatique", "2026-08-20");
    const recent = chapter("Mathématiques", "Séries", "2026-09-18");
    const ranked = rankCandidates(input({ chapterMemory: [recent, old] }));
    expect(keys(ranked)).toEqual(["rappel:Électrostatique", "rappel:Séries"]);
    expect(ranked[0].action).toBe("rappel actif");
    expect(ranked[0].terms.find((term) => term.id === "oubli")!.points).toBeGreaterThan(ranked[1].terms.find((term) => term.id === "oubli")!.points);
  });

  it("dit depuis quand le dernier rappel a eu lieu", () => {
    const reviewed = rateChapter(chapter("Physique", "Électrostatique", "2026-08-20"), "again", "2026-09-01");
    const [first] = rankCandidates(input({ chapterMemory: [reviewed] }));
    expect(first.terms.map((term) => term.reason)).toContain("Dernier rappel il y a 23\u00a0j");
  });

  it("un chapitre travaillé cette semaine sans rappel depuis : on vérifie ce qui en reste, et le chrono s'ouvre sur lui", () => {
    const elec = chapter("Physique", "Électrostatique", "2026-08-25", "elec");
    const worked = { ...session("Physique", 45, new Date(2026, 8, 22, 18)), chapter_id: "elec" };
    const [first] = rankCandidates(input({ chapterMemory: [elec], sessions: [worked] }));
    expect(first.terms.find((term) => term.id === "travaillé-sans-rappel")).toMatchObject({ points: 5, reason: "Travaillé 45 min dessus cette semaine, sans rappel depuis" });
    expect(first.href).toBe("/timer?matiere=Physique&chapitre=elec");
  });

  it("un chapitre révisé ce matin n'est pas menacé : aucun rappel proposé", () => {
    const fresh = rateChapter(chapter("Physique", "Électrostatique", "2026-09-10"), "good", TODAY);
    expect(rankCandidates(input({ chapterMemory: [fresh] }))).toEqual([]);
  });

  it("un chapitre rangé n'est jamais proposé", () => {
    const archived = { ...chapter("Physique", "Électrostatique", "2026-08-01"), archived: true };
    expect(rankCandidates(input({ chapterMemory: [archived] }))).toEqual([]);
  });

  it("au plus deux chapitres par matière, pour ne pas se répéter", () => {
    const many = ["A", "B", "C", "D"].map((title) => chapter("Physique", title, "2026-08-15"));
    expect(rankCandidates(input({ chapterMemory: many })).filter((candidate) => candidate.kind === "rappel")).toHaveLength(2);
  });
});

describe("programme d'une épreuve proche (lib/exam-prep.ts)", () => {
  // Appris le 21 : R ≈ 88 % aujourd'hui (pas encore « menacé »), mais sous
  // 90 % — et bien plus bas — le jour du DS.
  const series = () => chapter("Mathématiques", "Séries", "2026-09-21", "series");
  const ds = (scope: string[], dueDate = "2026-09-28") =>
    workItem({ id: "ds", kind: "ds", title: "DS 4", dueDate, estimatedMinutes: 30, ...(scope.length ? { scope: { chapterIds: scope, updatedAt: "2026-09-24T08:00:00.000Z" } } : {}) });

  it("un chapitre au programme devient un rappel même s'il n'est pas encore menacé, avec sa raison chiffrée", () => {
    const withoutScope = rankCandidates(input({ chapterMemory: [series()], workItems: [ds([])] }));
    expect(withoutScope.some((candidate) => candidate.kind === "rappel")).toBe(false);

    const ranked = rankCandidates(input({ chapterMemory: [series()], workItems: [ds(["series"])] }));
    const recall = ranked.find((candidate) => candidate.key === "rappel:series")!;
    const term = recall.terms.find((entry) => entry.id === "au-programme")!;
    expect(term.points).toBeGreaterThan(0);
    expect(term.reason).toMatch(/^Au programme du DS « DS 4 » dans 4 j : \d+ % le jour J sans rappel, \d+ % avec un rappel aujourd'hui$/);
    expect(recall.terms.some((entry) => entry.id === "oubli")).toBe(false);
    // Le score reste la somme exacte des termes affichés.
    expect(recall.score).toBe(recall.terms.reduce((sum, entry) => sum + entry.points, 0));
  });

  it("un chapitre au programme déjà révisé aujourd'hui n'est pas reproposé", () => {
    const reviewed = rateChapter(series(), "good", TODAY);
    const ranked = rankCandidates(input({ chapterMemory: [reviewed], workItems: [ds(["series"])] }));
    expect(ranked.some((candidate) => candidate.key === "rappel:series")).toBe(false);
  });

  it("une épreuve au-delà d'une semaine ne pèse pas encore", () => {
    const ranked = rankCandidates(input({ chapterMemory: [series()], workItems: [ds(["series"], "2026-10-15")] }));
    expect(ranked.some((candidate) => candidate.key === "rappel:series")).toBe(false);
  });
});

describe("erreurs", () => {
  it("une seule erreur ne déclenche pas de reprise", () => {
    expect(rankCandidates(input({ errors: [error("Physique", "méthode", "2026-09-22")] }))).toEqual([]);
  });

  it("plusieurs erreurs de méthode récentes : reprise ciblée de cette méthode", () => {
    const errors = [error("Physique", "méthode", "2026-09-20"), error("Physique", "méthode", "2026-09-23"), error("Physique", "calcul", "2026-09-21")];
    const [first] = rankCandidates(input({ errors }));
    expect(first.kind).toBe("erreurs");
    expect(first.title).toBe("Erreurs de méthode");
    expect(termIds(first)).toEqual(expect.arrayContaining(["erreurs-récentes", "erreurs-de-fond", "erreurs-sans-correction", "erreur-fraîche"]));
    expect(first.resource?.href).toBe("/erreurs?subject=Physique");
  });

  it("une erreur notée aujourd'hui fait passer la consolidation devant des erreurs anciennes d'une autre matière", () => {
    const errors = [
      error("Mathématiques", "calcul", "2026-09-12", "vérifier le signe"),
      error("Mathématiques", "calcul", "2026-09-13", "vérifier le signe"),
      error("Chimie", "cours", TODAY),
      error("Chimie", "cours", "2026-09-22"),
    ];
    expect(rankCandidates(input({ errors }))[0].key).toBe("erreurs:Chimie:cours");
  });

  it("les erreurs hors fenêtre de 14 jours sont ignorées", () => {
    const errors = [error("Physique", "méthode", "2026-09-01"), error("Physique", "méthode", "2026-09-02")];
    expect(rankCandidates(input({ errors }))).toEqual([]);
  });
});

describe("objectifs", () => {
  it("un objectif hebdomadaire en retard produit un bloc de la matière", () => {
    // Jeudi soir, 4 h d'anglais visées, rien de fait : largement en retard.
    const ranked = rankCandidates(input({ preferences: prefs({ weeklySubjectTargets: { ...NO_TARGETS, Anglais: 240 } }) }));
    expect(ranked[0].key).toBe("bloc:Anglais");
    expect(topReasons(ranked[0])[0]).toMatch(/Objectif de la semaine en retard/);
  });

  it("le minimum du soir atteint ne produit plus rien", () => {
    const preferences = prefs({ eveningMinimums: [{}, {}, {}, { Mathématiques: 60 }, {}, {}, {}] });
    const done = session("Mathématiques", 60, new Date(2026, 8, 24, 14));
    expect(rankCandidates(input({ preferences, sessions: [done] }))).toEqual([]);
  });

  it("une action de la matière du minimum du soir reçoit « compte pour ton minimum du soir »", () => {
    const preferences = prefs({ eveningMinimums: [{}, {}, {}, { Physique: 90 }, {}, {}, {}] });
    const memory = [chapter("Physique", "Électrostatique", "2026-08-20")];
    const recall = rankCandidates(input({ preferences, chapterMemory: memory })).find((candidate) => candidate.kind === "rappel")!;
    expect(termIds(recall)).toContain("compte-pour-le-soir");
  });
});

describe("DS proche", () => {
  it("un DS de physique demain fait passer la préparation de physique devant une matière équivalente", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25", "phys"), chapter("Mathématiques", "Séries", "2026-08-25", "math")];
    const withoutExam = rankCandidates(input({ chapterMemory: memory }));
    // Sans DS : à égalité parfaite, l'ordre des matières départage (maths d'abord).
    expect(withoutExam[0].key).toBe("rappel:math");

    const ds = workItem({ id: "ds-phys", title: "DS 2", kind: "ds", subject: "Physique", dueDate: "2026-09-25", estimatedMinutes: 30 });
    const withExam = rankCandidates(input({ chapterMemory: memory, workItems: [ds] }));
    const physRecall = withExam.find((candidate) => candidate.key === "rappel:phys")!;
    const mathRecall = withExam.find((candidate) => candidate.key === "rappel:math")!;
    expect(physRecall.score).toBeGreaterThan(mathRecall.score);
    expect(physRecall.terms.find((term) => term.id === "évaluation-proche")).toMatchObject({ points: 25, reason: "DS « DS 2 » demain" });
  });

  it("un DS dans plus d'une semaine ne modifie rien", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25")];
    const ds = workItem({ kind: "ds", subject: "Physique", dueDate: "2026-10-09" });
    const recall = rankCandidates(input({ chapterMemory: memory, workItems: [ds] })).find((candidate) => candidate.kind === "rappel")!;
    expect(termIds(recall)).not.toContain("évaluation-proche");
  });
});

describe("notes et calibration", () => {
  it("des notes en baisse ajoutent une raison chiffrée à la matière", () => {
    const grades = [grade("Physique", 15, "2026-09-01"), grade("Physique", 11, "2026-09-15")];
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25")];
    const recall = rankCandidates(input({ grades, chapterMemory: memory }))[0];
    expect(recall.terms.find((term) => term.id === "notes-baisse")?.reason).toBe("Notes en baisse en physique (15 → 11)");
  });

  it("une surestimation répétée pousse vers le rappel actif", () => {
    const grades = [grade("Chimie", 10, "2026-09-01", 14), grade("Chimie", 9, "2026-09-08", 13), grade("Chimie", 11, "2026-09-15", 14)];
    const memory = [chapter("Chimie", "Oxydoréduction", "2026-08-25")];
    const recall = rankCandidates(input({ grades, chapterMemory: memory }))[0];
    expect(termIds(recall)).toContain("calibration");
  });
});

describe("travail récent", () => {
  it("après 3 h de maths, un bloc de maths passe derrière une action équivalente d'une autre matière", () => {
    const preferences = prefs({ eveningMinimums: [{}, {}, {}, { Mathématiques: 240, Physique: 240 }, {}, {}, {}] });
    const sessions = [session("Mathématiques", 170, new Date(2026, 8, 24, 16, 15))];
    const ranked = rankCandidates(input({ preferences, sessions }));
    const math = ranked.find((candidate) => candidate.key === "bloc:Mathématiques")!;
    expect(ranked[0].key).toBe("bloc:Physique");
    expect(math.terms.find((term) => term.id === "déjà-beaucoup")?.reason).toMatch(/Tu viens de faire 2 h 50 de mathématiques/);
  });

  it("une urgence forte l'emporte malgré le travail récent dans la matière", () => {
    const sessions = [session("Mathématiques", 180, new Date(2026, 8, 24, 16, 0))];
    const dm = workItem({ dueDate: TODAY, estimatedMinutes: 240 });
    const memory = [chapter("Physique", "Électrostatique", "2026-09-18")];
    const ranked = rankCandidates(input({ sessions, workItems: [dm], chapterMemory: memory }));
    expect(ranked[0].key).toBe("échéance:w-1");
  });

  it("seule la part de séance tombée dans les 3 dernières heures compte", () => {
    const preferences = prefs({ eveningMinimums: [{}, {}, {}, { Mathématiques: 300 }, {}, {}, {}] });
    // 12 h → 15 h 30 : seules les 18 dernières minutes sont dans la fenêtre (16 h 12 → 19 h 12).
    const sessions = [session("Mathématiques", 210, new Date(2026, 8, 24, 12, 0))];
    const math = rankCandidates(input({ preferences, sessions })).find((candidate) => candidate.key === "bloc:Mathématiques")!;
    expect(termIds(math)).not.toContain("déjà-beaucoup");
    expect(termIds(math)).not.toContain("déjà-un-peu");
  });
});

describe("énergie et heure", () => {
  const checkin = (energy: number, sleepHours = 7.5): DailyCheckin => ({ date: "2026-09-23", sleepHours, energy, stress: 3, note: null, updatedAt: "2026-09-23T21:00:00.000Z" });

  it("une énergie basse favorise le format court et pénalise le long bloc", () => {
    const dm = workItem({ dueDate: "2026-09-28" });
    const memory = [chapter("Physique", "Électrostatique", "2026-09-10")];
    const ranked = rankCandidates(input({ workItems: [dm], chapterMemory: memory, checkins: [checkin(2)] }));
    expect(termIds(ranked.find((candidate) => candidate.kind === "échéance")!)).toContain("fatigue-long");
    expect(termIds(ranked.find((candidate) => candidate.kind === "rappel")!)).toContain("fatigue-court");
  });

  it("tard le soir, la durée par défaut est plus courte", () => {
    expect(autoMinutes(new Date(2026, 8, 24, 19))).toBe(45);
    expect(autoMinutes(new Date(2026, 8, 24, 22, 30))).toBe(30);
  });
});

describe("historique", () => {
  const base = { id: "h", kind: "rappel" as const, subject: "Physique" as const, title: "Électrostatique", minutes: 25, reasons: [], startedAt: null, outcomeMinutes: null };

  it("ce qui vient d'être fait n'est pas reproposé", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25"), chapter("Mathématiques", "Séries", "2026-09-15")];
    const history: NextMoveRecord[] = [
      { ...base, key: "rappel:Électrostatique", proposedAt: "2026-09-24T15:00:00.000Z", status: "fait", resolvedAt: "2026-09-24T15:40:00.000Z" },
    ];
    const ranked = rankCandidates(input({ chapterMemory: memory, history }));
    expect(ranked[0].key).toBe("rappel:Séries");
    expect(termIds(ranked[1])).toContain("déjà-fait");
  });

  it("une proposition ignorée trois fois perd quelques points, sans disparaître", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25")];
    const history: NextMoveRecord[] = [0, 1, 2].map((index) => ({
      ...base,
      id: `h${index}`,
      key: "rappel:Électrostatique",
      proposedAt: new Date(NOW.getTime() - (index + 1) * 10 * 3_600_000).toISOString(),
      status: "proposé" as const,
      resolvedAt: null,
    }));
    const [first] = rankCandidates(input({ chapterMemory: memory, history }));
    expect(first.terms.find((term) => term.id === "ignoré")).toMatchObject({ points: -8, reason: "Proposé 3 fois sans suite : on varie" });
  });
});

describe("temps disponible", () => {
  const scenario = () =>
    input({
      chapterMemory: [chapter("Physique", "Électrostatique", "2026-08-25")],
      errors: [error("Physique", "méthode", "2026-09-22"), error("Physique", "méthode", "2026-09-23")],
      reviewItems: cards("Mathématiques", 6),
    });

  it("30 minutes : la session tient dans 30 minutes, et commence par le plus prioritaire", () => {
    const plan = computeNextMove({ ...scenario(), availableMinutes: 30 });
    expect(plan.auto).toBe(false);
    expect(plan.totalMinutes).toBeLessThanOrEqual(30);
    expect(plan.steps[0].candidate?.key).toBe(plan.ranked[0].key);
  });

  it("1 heure : plusieurs actions s'enchaînent, sans dépasser l'heure", () => {
    const plan = computeNextMove({ ...scenario(), availableMinutes: 60 });
    const moves = plan.steps.filter((step) => step.type === "move");
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(plan.totalMinutes).toBeLessThanOrEqual(60);
    expect(new Set(moves.map((step) => step.candidate!.key)).size).toBe(moves.length);
  });

  it("2 heures : une pause s'intercale après ≈ 50 min d'affilée", () => {
    const rich = { ...scenario(), workItems: [workItem({ dueDate: "2026-09-26" })], availableMinutes: 120 };
    const plan = computeNextMove(rich);
    expect(plan.steps.some((step) => step.type === "pause")).toBe(true);
    expect(plan.steps[plan.steps.length - 1].type).toBe("move");
    expect(plan.totalMinutes).toBeLessThanOrEqual(120);
  });

  it("la durée d'un pas ne dépasse jamais le maximum de sa tâche (6 cartes = 12 min)", () => {
    const plan = computeNextMove(input({ reviewItems: cards("Mathématiques", 6), availableMinutes: 120 }));
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].minutes).toBe(12);
    expect(plan.totalMinutes).toBe(12);
  });

  it("sans durée choisie, le moteur compose pour une séance ordinaire", () => {
    const plan = computeNextMove(scenario());
    expect(plan.auto).toBe(true);
    expect(plan.availableMinutes).toBe(45);
  });
});

describe("recommandation impossible", () => {
  it("aucune tâche ne tient dans le temps demandé : statut « trop-court », pas de pas inventé", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-08-25")];
    const plan = computeNextMove(input({ chapterMemory: memory, availableMinutes: 5 }));
    expect(plan.status).toBe("trop-court");
    expect(plan.primary).toBeNull();
    expect(plan.ranked).toHaveLength(1);
  });

  it("0 minute : rien n'est composé", () => {
    expect(composeSession(rankCandidates(input({ reviewItems: cards("Physique", 3) })), 0)).toEqual([]);
  });

  it("tout a déjà été fait : statut « calme », la carte ne fabrique pas d'urgence", () => {
    const memory = [chapter("Physique", "Électrostatique", "2026-09-19")];
    const history: NextMoveRecord[] = [
      { id: "h", key: "rappel:Électrostatique", kind: "rappel", subject: "Physique", title: "", minutes: 25, reasons: [], proposedAt: "2026-09-24T14:00:00.000Z", status: "fait", startedAt: "2026-09-24T14:00:00.000Z", resolvedAt: "2026-09-24T14:30:00.000Z", outcomeMinutes: 25 },
    ];
    const plan = computeNextMove(input({ chapterMemory: memory, history }));
    expect(plan.primary?.score).toBeLessThan(CALM_THRESHOLD);
    expect(plan.status).toBe("calme");
  });
});

describe("égalités et stabilité", () => {
  it("à score égal, l'ordre est déterministe : genre, puis ordre des matières", () => {
    const reviewItems = [...cards("Anglais", 3), ...cards("Chimie", 3)];
    const once = keys(rankCandidates(input({ reviewItems })));
    const again = keys(rankCandidates(input({ reviewItems: [...reviewItems].reverse() })));
    expect(once).toEqual(["cartes:Chimie", "cartes:Anglais"]);
    expect(again).toEqual(once);
  });

  it("l'alternative est prise dans une autre matière quand c'est possible", () => {
    const plan = computeNextMove(
      input({
        chapterMemory: [chapter("Physique", "Électrostatique", "2026-08-20"), chapter("Physique", "Optique", "2026-08-21")],
        reviewItems: cards("Anglais", 2),
        availableMinutes: 30,
      })
    );
    expect(plan.primary?.subject).toBe("Physique");
    expect(plan.alternative?.subject).toBe("Anglais");
  });
});

describe("explicabilité", () => {
  it("le score est exactement la somme des termes affichables", () => {
    const ranked = rankCandidates(
      input({
        workItems: [workItem({ dueDate: "2026-09-25", important: true })],
        chapterMemory: [chapter("Physique", "Électrostatique", "2026-08-20")],
        errors: [error("Physique", "méthode", TODAY), error("Physique", "cours", "2026-09-20")],
        reviewItems: cards("Chimie", 4),
      })
    );
    for (const candidate of ranked) {
      expect(candidate.score).toBe(candidate.terms.reduce((total, term) => total + term.points, 0));
      for (const term of candidate.terms) expect(term.reason.length).toBeGreaterThan(0);
    }
  });

  it("les raisons montrées sont les plus lourdes, positives d'abord", () => {
    const [first] = rankCandidates(input({ errors: [error("Physique", "méthode", TODAY), error("Physique", "méthode", "2026-09-22")] }));
    const reasons = topReasons(first, 2);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toMatch(/2 erreurs notées en physique/);
  });
});

describe("« Pas maintenant » est respecté pendant un jour", () => {
  function skippedRecord(key: string, at: Date): NextMoveRecord {
    return { id: `h-${key}`, key, kind: "échéance", subject: "Mathématiques", title: "DM 4", minutes: 45, reasons: [], proposedAt: at.toISOString(), status: "écarté", startedAt: null, resolvedAt: at.toISOString(), outcomeMinutes: null };
  }
  const urgent = workItem({ id: "urgent", title: "DM urgent", dueDate: "2026-09-24", important: true });
  const other = workItem({ id: "other", title: "DM 5", subject: "Physique", dueDate: "2026-09-27" });

  it("une échéance écartée ne revient pas en tête, même très urgente", () => {
    const before = computeNextMove(input({ workItems: [urgent, other] }));
    expect(before.primary?.key).toBe("échéance:urgent");
    const history = [skippedRecord("échéance:urgent", new Date(2026, 8, 24, 18, 0))];
    const after = computeNextMove(input({ workItems: [urgent, other], history }));
    expect(after.primary?.key).toBe("échéance:other");
    expect(after.alternative?.key).not.toBe("échéance:urgent");
    // Toujours visible dans le détail.
    expect(after.ranked.some((candidate) => candidate.key === "échéance:urgent")).toBe(true);
  });

  it("au-delà de 24 h, elle revient", () => {
    const history = [skippedRecord("échéance:urgent", new Date(2026, 8, 23, 18, 0))];
    expect(computeNextMove(input({ workItems: [urgent, other], history })).primary?.key).toBe("échéance:urgent");
  });

  it("tout écarté : on retombe sur le classement complet plutôt que de ne rien dire", () => {
    const at = new Date(2026, 8, 24, 18, 0);
    const history = [skippedRecord("échéance:urgent", at), skippedRecord("échéance:other", at)];
    const plan = computeNextMove(input({ workItems: [urgent, other], history }));
    expect(plan.primary).not.toBeNull();
  });
});

describe("annales — reprise ciblée", () => {
  function annale(chapitre: string, resultat: string, day: string, extra: Record<string, unknown> = {}) {
    seq += 1;
    return normalizeAnnaleLog({ id: `a-${seq}`, created_at: new Date(`${day}T15:00:00`).toISOString(), matiere: "maths", chapitre, resultat, indices: 0, ...extra })!;
  }

  it("propose de reprendre un chapitre dont la dernière annale est un échec", () => {
    const annales = [annale("Réduction", "échec", "2026-09-23", { indices: 2, source: "Mines 2023" })];
    const candidate = rankCandidates(input({ annales })).find((entry) => entry.key.startsWith("annale:"));
    expect(candidate).toBeDefined();
    expect(candidate!.kind).toBe("erreurs");
    expect(candidate!.subject).toBe("Mathématiques");
    expect(candidate!.terms.map((term) => term.id)).toEqual(expect.arrayContaining(["annales-ratées", "annales-indices", "annale-fraîche"]));
    expect(candidate!.instruction).toContain("Mines 2023");
    expect(candidate!.resource?.href).toBe("/annales");
  });

  it("se tait quand le dernier essai est réussi", () => {
    const annales = [annale("Réduction", "échec", "2026-09-20"), annale("Réduction", "réussi", "2026-09-22")];
    expect(rankCandidates(input({ annales })).some((entry) => entry.key.startsWith("annale:"))).toBe(false);
  });

  it("ouvre le chrono sur le chapitre de Mémoire correspondant", () => {
    const memory = chapter("Mathématiques", "Réduction des endomorphismes", "2026-09-01", "ch-red");
    const annales = [annale("réduction", "échec", "2026-09-23")];
    const candidate = rankCandidates(input({ annales, chapterMemory: [memory] })).find((entry) => entry.key.startsWith("annale:"));
    expect(candidate!.href).toContain("chapitre=ch-red");
  });

  it("le score est la somme des termes affichés", () => {
    const annales = [annale("Séries entières", "partiel", "2026-09-10"), annale("Séries entières", "partiel", "2026-09-15")];
    const candidate = rankCandidates(input({ annales })).find((entry) => entry.key.startsWith("annale:"))!;
    expect(candidate.score).toBe(candidate.terms.reduce((total, term) => total + term.points, 0));
  });
});
