import { describe, expect, it } from "vitest";
import { BRIEFING_SECTION_MAX, buildBriefing, greetingFor, shouldShowBriefing, type BriefingInput } from "@/lib/briefing";
import { createChapter } from "@/lib/chapter-memory";
import { createErrorEntry } from "@/lib/error-log";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, type NextMoveRecord, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/** Jeudi 24 septembre 2026, 18 h — heure locale. */
const NOW = new Date(2026, 8, 24, 18, 0);
const NO_EVENING = [{}, {}, {}, {}, {}, {}, {}];
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: NO_EVENING, weeklySubjectTargets: NO_TARGETS, displayName: "Taekd", ...overrides });
}

function input(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: NOW, ...overrides };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "w-1",
    title: "DM 4",
    kind: "dm",
    subject: "Mathématiques",
    estimatedMinutes: 90,
    dueDate: "2026-09-30",
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-15T08:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...overrides,
  };
}

const postponement = (at: string) => ({ at, fromDate: at.slice(0, 10), toDate: at.slice(0, 10) });

function ignored(subject: Subject, count: number): NextMoveRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `h-${subject}-${index}`,
    key: `bloc:${subject}`,
    kind: "bloc" as const,
    subject,
    title: subject,
    minutes: 30,
    reasons: [],
    proposedAt: new Date(NOW.getTime() - (index + 1) * 20 * 3_600_000).toISOString(),
    status: (index === 0 ? "écarté" : "proposé") as NextMoveRecord["status"],
    startedAt: null,
    resolvedAt: null,
    outcomeMinutes: null,
  }));
}

describe("quand afficher le point", () => {
  it("à la première ouverture, puis chaque nouveau jour", () => {
    expect(shouldShowBriefing(prefs(), null, NOW)).toBe(true);
    expect(shouldShowBriefing(prefs(), new Date(2026, 8, 23, 22).toISOString(), NOW)).toBe(true);
  });

  it("pas à chaque retour sur l'accueil dans la même séance, mais après une longue absence", () => {
    expect(shouldShowBriefing(prefs(), new Date(2026, 8, 24, 16, 30).toISOString(), NOW)).toBe(false);
    expect(shouldShowBriefing(prefs(), new Date(2026, 8, 24, 13, 0).toISOString(), NOW)).toBe(true);
  });

  it("jamais quand l'élève l'a désactivé", () => {
    expect(shouldShowBriefing(prefs({ briefingOnOpen: false }), null, NOW)).toBe(false);
  });

  it("une date illisible vaut « jamais vu »", () => {
    expect(shouldShowBriefing(prefs(), "pas une date", NOW)).toBe(true);
  });
});

describe("salutation", () => {
  it("suit l'heure, avec le prénom s'il existe", () => {
    expect(greetingFor(new Date(2026, 8, 24, 8), "Taekd")).toBe("Bonjour Taekd");
    expect(greetingFor(new Date(2026, 8, 24, 14), "")).toBe("Bon après-midi");
    expect(greetingFor(new Date(2026, 8, 24, 21), "Taekd")).toBe("Bonsoir Taekd");
  });
});

describe("rien à dire", () => {
  it("un nouvel inscrit n'a pas de point imposé", () => {
    const briefing = buildBriefing(input());
    expect(briefing.hasContent).toBe(false);
    expect(briefing.summary).toBe("Rien d'urgent, rien de repoussé.");
  });
});

describe("ce qui presse", () => {
  it("retard d'abord, puis ce qui ne tient plus, puis demain", () => {
    const briefing = buildBriefing(
      input({
        workItems: [
          workItem({ id: "demain", title: "TD 3", kind: "exercices", dueDate: "2026-09-25", estimatedMinutes: 30 }),
          workItem({ id: "retard", title: "DM 3", dueDate: "2026-09-22" }),
          workItem({ id: "énorme", title: "Projet", kind: "autre", dueDate: "2026-09-26", estimatedMinutes: 3000 }),
        ],
      })
    );
    expect(briefing.urgent.map((item) => item.id)).toEqual(["retard:retard", "infaisable:énorme", "bientôt:demain"]);
    expect(briefing.urgent[0].title).toBe("En retard : DM 3");
    expect(briefing.urgent[0].detail).toMatch(/Prévu pour mardi/);
    expect(briefing.summary).toMatch(/^3 choses pressantes/);
  });

  it("un DS dans 3 jours est signalé, pas un DM dans 3 jours", () => {
    const briefing = buildBriefing(
      input({ workItems: [workItem({ id: "ds", title: "DS 2", kind: "ds", subject: "Physique", dueDate: "2026-09-27" }), workItem({ id: "dm", dueDate: "2026-09-27", estimatedMinutes: 30 })] })
    );
    expect(briefing.urgent.map((item) => item.id)).toEqual(["évaluation:ds"]);
    expect(briefing.urgent[0].title).toBe("DS 2 dans 3 j");
  });

  it("un travail déjà fait en temps n'est pas urgent", () => {
    const briefing = buildBriefing(input({ workItems: [workItem({ dueDate: "2026-09-25", status: "terminé" })] }));
    expect(briefing.urgent).toEqual([]);
  });
});

describe("ce que tu repousses", () => {
  it("un travail reporté deux fois est nommé, avec le compte", () => {
    const briefing = buildBriefing(input({ workItems: [workItem({ postponements: [postponement("2026-09-20T10:00:00.000Z"), postponement("2026-09-22T10:00:00.000Z")] })] }));
    expect(briefing.postponed[0]).toMatchObject({ id: "reporté:w-1", tone: "repoussé", title: "DM 4 reporté 2 fois" });
  });

  it("un plan « si… alors… » passé sans être fait", () => {
    const briefing = buildBriefing(input({ workItems: [workItem({ plan: { day: "2026-09-22", time: "18:00", place: null } })] }));
    expect(briefing.postponed.map((item) => item.id)).toContain("plan-manqué:w-1");
  });

  it("une matière proposée plusieurs fois par Next Move sans suite", () => {
    const briefing = buildBriefing(input({ history: ignored("Chimie", 3) }));
    expect(briefing.postponed[0]).toMatchObject({ id: "matière-repoussée:Chimie", title: "Chimie : souvent remis à plus tard" });
    expect(buildBriefing(input({ history: ignored("Chimie", 2) })).postponed).toEqual([]);
  });

  it("des cartes en retard de plusieurs jours s'accumulent", () => {
    const old = Array.from({ length: 6 }, (_, index) => ({ ...createReviewItem({ subject: "Anglais", text: `mot ${index}`, kind: "à apprendre" }, new Date(2026, 8, 10))!, id: `c${index}` }));
    const briefing = buildBriefing(input({ reviewItems: old }));
    expect(briefing.postponed[0]).toMatchObject({ id: "cartes-en-retard", title: "6 cartes en retard de révision" });
  });

  it("un objectif de la semaine qui décroche", () => {
    const briefing = buildBriefing(input({ preferences: prefs({ weeklySubjectTargets: { ...NO_TARGETS, Anglais: 300 } }) }));
    expect(briefing.postponed.map((item) => item.id)).toContain("semaine:Anglais");
  });

  it("à surveiller : un chapitre qui s'efface, des erreurs sans correction", () => {
    const errors = ["2026-09-15", "2026-09-16", "2026-09-17"].map((date) => createErrorEntry({ subject: "Physique", type: "calcul", date, source: "DS", description: `erreur ${date}` }, NOW)!);
    const briefing = buildBriefing(input({ chapterMemory: [createChapter({ subject: "Physique", title: "Optique", learnedAt: "2026-07-01" }, NOW, "opt")], errors }));
    expect(briefing.postponed.map((item) => [item.id, item.tone])).toEqual([
      ["s-efface:opt", "attention"],
      ["erreurs-sans-correction", "attention"],
    ]);
    // Ce qui est « à surveiller » ne compte pas comme repoussé dans le résumé.
    expect(briefing.summary).toBe("Rien d'urgent, rien de repoussé.");
  });

  it("jamais plus de trois lignes par section, les reports en premier", () => {
    const many = ["a", "b", "c", "d"].map((id) => workItem({ id, title: `DM ${id}`, postponements: [postponement("2026-09-20T10:00:00.000Z"), postponement("2026-09-21T10:00:00.000Z")] }));
    const briefing = buildBriefing(input({ workItems: many, history: ignored("Chimie", 4) }));
    expect(briefing.postponed).toHaveLength(BRIEFING_SECTION_MAX);
    expect(briefing.postponed.every((item) => item.id.startsWith("reporté:"))).toBe(true);
  });

  it("un travail déjà urgent n'est pas répété dans « repoussé »", () => {
    const briefing = buildBriefing(input({ workItems: [workItem({ dueDate: "2026-09-25", postponements: [postponement("2026-09-20T10:00:00.000Z"), postponement("2026-09-21T10:00:00.000Z")] })] }));
    expect(briefing.urgent.map((item) => item.id)).toEqual(["bientôt:w-1"]);
    expect(briefing.postponed).toEqual([]);
  });
});

describe("aujourd'hui", () => {
  it("le minimum du soir restant, les plans du jour, les cartes du jour", () => {
    const preferences = prefs({ eveningMinimums: [{}, {}, {}, { Mathématiques: 120, Physique: 90 }, {}, {}, {}] });
    const plan = workItem({ plan: { day: "2026-09-24", time: "20:30", place: "à l'internat" } });
    const cards = [createReviewItem({ subject: "Chimie", text: "pKa", kind: "à apprendre" }, new Date(2026, 8, 22))!];
    const briefing = buildBriefing(input({ preferences, workItems: [plan], reviewItems: cards }));
    expect(briefing.today.map((item) => item.title)).toEqual(["Ce soir : mathématiques 2 h, physique 1 h 30", "20 h 30 : DM 4", "1 carte à réviser"]);
    expect(briefing.today[1].detail).toBe("Ton plan, à l'internat");
  });

  it("le prochain mouvement est celui de Next Move", () => {
    const briefing = buildBriefing(input({ preferences: prefs({ eveningMinimums: [{}, {}, {}, { Physique: 60 }, {}, {}, {}] }) }));
    expect(briefing.move.primary?.key).toBe("bloc:Physique");
    expect(briefing.hasContent).toBe(true);
  });
});

describe("pas de doublon", () => {
  it("des cartes en retard ne sont pas répétées dans « Aujourd'hui »", () => {
    const old = Array.from({ length: 6 }, (_, index) => ({ ...createReviewItem({ subject: "Anglais", text: `mot ${index}`, kind: "à apprendre" }, new Date(2026, 8, 10))!, id: `c${index}` }));
    const briefing = buildBriefing(input({ reviewItems: old }));
    expect(briefing.postponed.map((item) => item.id)).toContain("cartes-en-retard");
    expect(briefing.today.map((item) => item.id)).not.toContain("cartes-du-jour");
  });
});
