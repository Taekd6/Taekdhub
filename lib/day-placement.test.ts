import { describe, expect, it } from "vitest";
import { buildDayAgenda, type DayAgenda } from "@/lib/day-agenda";
import { placeDay, type DayPlacement } from "@/lib/day-placement";
import { diagnosticContextOf, computeNextMove, type NextMoveInput } from "@/lib/next-move/engine";
import { clockToMinutes, starterWindows, type PerformanceWindow } from "@/lib/performance-windows";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";

/**
 * PLACEMENT DANS LA JOURNÉE — sur de vrais plans du jour (`buildDayAgenda`),
 * pas sur des tâches fabriquées : ce qui est vérifié, c'est ce que l'élève
 * verrait.
 *
 * Jeudi 24 septembre 2026. Capacité 240 min, marge 0 % : les durées se lisent
 * sans arrondi.
 */

const at = (hour: number, minute = 0) => new Date(2026, 8, 24, hour, minute);
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], planningMarginPercent: 0, ...overrides });
}

let seq = 0;
function workItem(overrides: Partial<WorkItem>): WorkItem {
  seq += 1;
  return { id: `w${seq}`, title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 90, dueDate: "2026-09-30", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-10T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: at(8), availableMinutes: null, ...overrides };
}

/**
 * Une journée qui mélange les trois niveaux :
 *   DM de maths pour demain (indispensable, exigeant) ;
 *   DS de physique dans 6 jours (important, exigeant) ;
 *   feuille d'exercices de chimie dans 11 jours (secondaire, intermédiaire) ;
 *   fiches de maths dues (indispensable, léger).
 */
/** Les mêmes travaux (mêmes identifiants) à chaque appel : deux plans comparés doivent partir des mêmes données. */
const MIXED_ITEMS: WorkItem[] = [
  workItem({ id: "dm4", title: "DM 4", kind: "dm", subject: "Mathématiques", dueDate: "2026-09-25", estimatedMinutes: 90 }),
  workItem({ id: "ds3", title: "DS 3", kind: "ds", subject: "Physique", dueDate: "2026-09-30", estimatedMinutes: 90 }),
  workItem({ id: "chimie", title: "Feuille de chimie", kind: "exercices", subject: "Chimie", dueDate: "2026-10-05", estimatedMinutes: 60 }),
];
const MIXED_CARDS = [createReviewItem({ subject: "Mathématiques", text: "Formule de Taylor-Lagrange", kind: "à revoir" }, new Date(2026, 8, 10))!];

function mixedDay(now = at(8), preferences = prefs()): NextMoveInput {
  return input({ now, preferences, workItems: MIXED_ITEMS, reviewItems: MIXED_CARDS });
}

function ctxOf(source: NextMoveInput) {
  return { workItems: source.workItems, chapterMemory: source.chapterMemory, exercises: diagnosticContextOf(source).exercises, now: source.now };
}

function place(source: NextMoveInput, windows: PerformanceWindow[] | null, agenda: DayAgenda = buildDayAgenda(source)): DayPlacement {
  return placeDay(agenda, windows, ctxOf(source));
}

const levelOf = (placement: DayPlacement, titlePart: string) => placement.ordered.find((entry) => entry.task.title.includes(titlePart))!;
const keys = (placement: DayPlacement) => placement.ordered.map((entry) => entry.task.key);

describe("préconditions — le plan du jour de référence mélange bien les niveaux", () => {
  const agenda = buildDayAgenda(mixedDay());
  const placement = placeDay(agenda, starterWindows(), ctxOf(mixedDay()));

  it("contient une tâche indispensable exigeante, une importante exigeante et une indispensable légère", () => {
    const dm = levelOf(placement, "DM 4");
    expect(dm.task.tier).toBe("indispensable");
    expect(dm.load.level).toBe("elevee");
    expect(levelOf(placement, "DS 3").load.level).toBe("elevee");
    expect(placement.ordered.some((entry) => entry.load.level === "legere" && entry.task.tier === "indispensable")).toBe(true);
  });
});

describe("placement — les tâches exigeantes dans une plage haute disponible", () => {
  const source = mixedDay();
  const placement = place(source, starterWindows());

  it("chaque tâche exigeante est suggérée dans une plage haute quand il y en a une qui peut l'accueillir", () => {
    const demanding = placement.ordered.filter((entry) => entry.load.level === "elevee");
    expect(demanding.length).toBeGreaterThanOrEqual(2);
    for (const entry of demanding) {
      expect(entry.placement?.window?.level).toBe("haute");
      expect(entry.placement?.fit).toBe("ideale");
    }
  });

  it("une tâche légère va dans la plage basse, et une intermédiaire dans la plage intermédiaire", () => {
    for (const entry of placement.ordered.filter((candidate) => candidate.load.level === "legere")) expect(entry.placement?.window?.level).toBe("basse");
    expect(levelOf(placement, "chimie").placement?.window?.level).toBe("moyenne");
  });

  it("l'ordre suit la journée : matin, puis après-midi, puis soir", () => {
    const order = placement.ordered.map((entry) => clockToMinutes(entry.placement!.window!.start)!);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("chaque suggestion porte son explication (niveau, plage, raisons)", () => {
    for (const entry of placement.ordered) {
      expect(entry.placement?.note).toMatch(/suggérée/);
      expect(entry.load.explanation.length).toBeGreaterThan(15);
    }
  });

  it("sans signalement quand tout est à sa place", () => {
    expect(placement.warnings).toEqual([]);
    expect(placement.summary).toBe("Chaque tâche a trouvé une plage adaptée.");
  });
});

describe("placement — rien n'est retiré, ajouté ni modifié", () => {
  it("les indispensables restent toutes dans le résultat, avec leurs minutes d'origine", () => {
    const source = mixedDay();
    const agenda = buildDayAgenda(source);
    const placement = place(source, starterWindows(), agenda);
    const essentials = agenda.kept.filter((task) => task.tier === "indispensable");
    expect(essentials.length).toBeGreaterThanOrEqual(2);
    for (const task of essentials) {
      const found = placement.ordered.find((entry) => entry.task.key === task.key);
      expect(found?.task).toBe(task);
      expect(found?.task.minutes).toBe(task.minutes);
    }
  });

  it("le résultat contient exactement les tâches gardées, une fois chacune", () => {
    const source = mixedDay();
    const agenda = buildDayAgenda(source);
    expect(keys(place(source, starterWindows(), agenda)).sort()).toEqual(agenda.kept.map((task) => task.key).sort());
  });

  it("le plan d'origine n'est pas modifié", () => {
    const source = mixedDay();
    const agenda = buildDayAgenda(source);
    const before = JSON.stringify(agenda);
    place(source, starterWindows(), agenda);
    expect(JSON.stringify(agenda)).toBe(before);
  });

  it("les plages n'ont AUCUNE influence sur le plan (tâches gardées, déplacées, budget) ni sur Next Move", () => {
    const plain = mixedDay();
    const configured = mixedDay(at(8), prefs({ performanceWindows: starterWindows() }));
    expect(buildDayAgenda(configured)).toEqual(buildDayAgenda(plain));
    expect(computeNextMove(configured)).toEqual(computeNextMove(plain));
  });

  it("une journée surchargée garde ses indispensables et dit le dépassement : le placement ne le masque pas", () => {
    const source = mixedDay(at(8), prefs({ capacityByWeekday: [60, 60, 60, 60, 60, 60, 60] }));
    const agenda = buildDayAgenda(source);
    const placement = place(source, starterWindows(), agenda);
    expect(agenda.overflow).toBeGreaterThan(0);
    expect(keys(placement).sort()).toEqual(agenda.kept.map((task) => task.key).sort());
    expect(agenda.summary).toMatch(/dépasse/);
  });
});

describe("placement — sans configuration, le comportement d'avant", () => {
  const source = mixedDay();
  const agenda = buildDayAgenda(source);

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["liste vide", []],
  ])("plages %s : même ordre, mêmes objets, aucune annotation", (_label, windows) => {
    const placement = placeDay(agenda, windows as PerformanceWindow[] | null, ctxOf(source));
    expect(placement.enabled).toBe(false);
    expect(placement.ordered.map((entry) => entry.task)).toEqual(agenda.kept);
    placement.ordered.forEach((entry, index) => {
      expect(entry.task).toBe(agenda.kept[index]);
      expect(entry.placement).toBeNull();
    });
    expect(placement.warnings).toEqual([]);
    expect(placement.summary).toBe("");
  });

  it("des préférences d'avant ce champ n'activent pas le placement", () => {
    expect(normalizePreferences({ capacityByWeekday: [240, 240, 240, 240, 240, 240, 240] }).performanceWindows).toBeNull();
  });

  it("plus aucune plage à venir aujourd'hui : l'ordre du plan est conservé, et chaque tâche est signalée", () => {
    const evening = mixedDay(at(22, 30));
    const eveningAgenda = buildDayAgenda(evening);
    const placement = place(evening, [{ id: "matin", start: "08:00", end: "12:00", level: "haute" }], eveningAgenda);
    expect(placement.enabled).toBe(true);
    expect(keys(placement)).toEqual(eveningAgenda.kept.map((task) => task.key));
    for (const entry of placement.ordered) expect(entry.placement).toMatchObject({ window: null, fit: "hors-plage" });
    expect(placement.warnings).toHaveLength(eveningAgenda.kept.length);
  });
});

describe("placement — quand l'idéal est impossible, on le dit", () => {
  it("plage haute trop courte : la tâche exigeante suivante est quand même gardée, placée ailleurs, et signalée", () => {
    const source = mixedDay();
    const windows: PerformanceWindow[] = [
      { id: "matin", start: "08:00", end: "09:30", level: "haute" }, // 90 min : une seule tâche exigeante de 90 min
      { id: "soir", start: "19:00", end: "22:00", level: "basse" },
    ];
    const placement = place(source, windows);
    const dm = levelOf(placement, "DM 4");
    const ds = levelOf(placement, "DS 3");
    expect(dm.task.minutes).toBe(90);
    // L'indispensable passe avant l'importante : elle prend la plage haute.
    expect(dm.placement?.window?.level).toBe("haute");
    expect(ds.placement?.window?.level).toBe("basse");
    expect(ds.placement?.fit).toBe("acceptable");
    const warning = placement.warnings.find((entry) => entry.key === ds.task.key);
    expect(warning?.message).toMatch(/aucune plage haute restante/);
    expect(warning?.essential).toBe(false);
    expect(placement.summary).toMatch(/sans plage idéale/);
  });

  it("aucune plage haute définie : la tâche exigeante est placée et signalée comme telle", () => {
    const source = mixedDay();
    const placement = place(source, [{ id: "soir", start: "19:00", end: "22:00", level: "basse" }]);
    const dm = levelOf(placement, "DM 4");
    expect(dm.placement?.window?.id).toBe("soir");
    expect(placement.warnings.find((entry) => entry.key === dm.task.key)?.message).toMatch(/aucune plage haute n'est définie/);
  });

  it("une tâche indispensable qui ne tient dans aucune plage reste dans la journée, hors plage, signalée comme indispensable", () => {
    const source = mixedDay();
    const agenda = buildDayAgenda(source);
    const placement = place(source, [{ id: "matin", start: "08:00", end: "08:30", level: "haute" }], agenda);
    const dm = levelOf(placement, "DM 4");
    expect(dm.task.tier).toBe("indispensable");
    expect(dm.placement).toMatchObject({ window: null, fit: "hors-plage" });
    const warning = placement.warnings.find((entry) => entry.key === dm.task.key);
    expect(warning?.essential).toBe(true);
    expect(warning?.message).toMatch(/Indispensable, elle reste dans ta journée/);
    // Les avertissements indispensables viennent en premier.
    expect(placement.warnings[0].essential).toBe(true);
    expect(keys(placement)).toHaveLength(agenda.kept.length);
  });

  it("les plages sont rognées à l'heure actuelle : à 11 h 30, le matin n'offre plus que 30 minutes", () => {
    const source = mixedDay(at(11, 30));
    const placement = place(source, starterWindows());
    const inMorning = placement.ordered.filter((entry) => entry.placement?.window?.id === "matin").reduce((sum, entry) => sum + entry.task.minutes, 0);
    expect(inMorning).toBeLessThanOrEqual(30);
  });
});

describe("placement — invariants sur toute la journée", () => {
  it.each([at(7), at(8), at(11, 30), at(13), at(15), at(18, 30), at(20), at(22, 30)])("à %s : rien de perdu, aucune plage dépassée", (now) => {
    const source = mixedDay(now);
    const agenda = buildDayAgenda(source);
    const windows = starterWindows();
    const placement = place(source, windows, agenda);
    expect(keys(placement).sort()).toEqual(agenda.kept.map((task) => task.key).sort());
    const minutesNow = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
    for (const window of windows) {
      const available = Math.max(0, Math.min(clockToMinutes(window.end)!, 23 * 60) - Math.max(clockToMinutes(window.start)!, minutesNow));
      const used = placement.ordered.filter((entry) => entry.placement?.window?.id === window.id).reduce((sum, entry) => sum + entry.task.minutes, 0);
      expect(used).toBeLessThanOrEqual(available);
    }
    // Chaque tâche non placée a un avertissement.
    for (const entry of placement.ordered.filter((candidate) => candidate.placement?.fit === "hors-plage")) {
      expect(placement.warnings.some((warning) => warning.key === entry.task.key)).toBe(true);
    }
  });
});

describe("placement — déterministe et idempotent", () => {
  const source = mixedDay();
  const agenda = buildDayAgenda(source);
  const summary = (placement: DayPlacement) => placement.ordered.map((entry) => [entry.task.key, entry.placement?.window?.id ?? null, entry.placement?.fit ?? null]);

  it("deux appels identiques donnent exactement le même résultat", () => {
    expect(place(source, starterWindows(), agenda)).toEqual(place(source, starterWindows(), agenda));
  });

  it("l'ordre d'entrée des tâches ne change rien", () => {
    const reversed: DayAgenda = { ...agenda, kept: [...agenda.kept].reverse() };
    expect(summary(place(source, starterWindows(), reversed))).toEqual(summary(place(source, starterWindows(), agenda)));
    expect(place(source, starterWindows(), reversed).warnings).toEqual(place(source, starterWindows(), agenda).warnings);
  });

  it("l'ordre des plages saisies ne change rien", () => {
    expect(summary(place(source, [...starterWindows()].reverse(), agenda))).toEqual(summary(place(source, starterWindows(), agenda)));
  });

  it("rejouer le placement sur son propre résultat ne le change pas", () => {
    const first = place(source, starterWindows(), agenda);
    const replayed: DayAgenda = { ...agenda, kept: first.ordered.map((entry) => entry.task) };
    expect(summary(place(source, starterWindows(), replayed))).toEqual(summary(first));
  });

  it("l'heure est un paramètre : même instant, même résultat, quel que soit le moment d'appel", () => {
    const first = place(source, starterWindows(), agenda);
    const later = new Date(source.now.getTime());
    expect(summary(placeDay(agenda, starterWindows(), { ...ctxOf(source), now: later }))).toEqual(summary(first));
  });
});
