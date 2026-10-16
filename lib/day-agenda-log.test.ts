import { describe, expect, it } from "vitest";
import { buildDayAgenda } from "@/lib/day-agenda";
import { describeSuggestion, diffVersions, emptyLog, parseLog, recordVersion, toVersion, type AgendaLog, type AgendaVersion } from "@/lib/day-agenda-log";
import { placeDay } from "@/lib/day-placement";
import { diagnosticContextOf, type NextMoveInput } from "@/lib/next-move/engine";
import { starterWindows, type PerformanceWindow } from "@/lib/performance-windows";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";

/**
 * JOURNAL DE L'AGENDA — les suggestions horaires y sont conservées, sans
 * rien changer au journal d'avant quand les plages sont désactivées.
 *
 * Ces tests décrivent une TRACE de ce qui a été suggéré : aucun d'eux ne
 * prétend qu'elle mesure des résultats.
 */

const at = (hour: number, minute = 0) => new Date(2026, 8, 24, hour, minute);
const DAY = "2026-09-24";
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], planningMarginPercent: 0, ...overrides });
}

function item(overrides: Partial<WorkItem>): WorkItem {
  return { id: "x", title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 90, dueDate: "2026-09-30", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-10T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

const ITEMS: WorkItem[] = [
  item({ id: "dm4", title: "DM 4", kind: "dm", subject: "Mathématiques", dueDate: "2026-09-25", estimatedMinutes: 90 }),
  item({ id: "ds3", title: "DS 3", kind: "ds", subject: "Physique", dueDate: "2026-09-30", estimatedMinutes: 90 }),
  item({ id: "chimie", title: "Feuille de chimie", kind: "exercices", subject: "Chimie", dueDate: "2026-10-05", estimatedMinutes: 60 }),
];
const CARDS = [createReviewItem({ subject: "Mathématiques", text: "Formule de Taylor-Lagrange", kind: "à revoir" }, new Date(2026, 8, 10))!];

function day(now = at(8), preferences = prefs()): NextMoveInput {
  return { sessions: [], workItems: ITEMS, grades: [], reviewItems: CARDS, errors: [], checkins: [], chapterMemory: [], preferences, history: [], now, availableMinutes: null };
}

function versionOf(source: NextMoveInput, windows: PerformanceWindow[] | null | "absent"): AgendaVersion {
  const agenda = buildDayAgenda(source);
  if (windows === "absent") return toVersion(agenda, source.sessions, source.now);
  const placement = placeDay(agenda, windows, { workItems: source.workItems, chapterMemory: source.chapterMemory, exercises: diagnosticContextOf(source).exercises, now: source.now });
  return toVersion(agenda, source.sessions, source.now, placement);
}

describe("journal — plages désactivées : le journal d'avant", () => {
  it.each([
    ["sans 4ᵉ paramètre", "absent" as const],
    ["plages null", null],
    ["plages vides", [] as PerformanceWindow[]],
  ])("%s : aucune clé `suggestion`, version identique", (_label, windows) => {
    const version = versionOf(day(), windows);
    for (const task of version.tasks) expect(task).not.toHaveProperty("suggestion");
    expect(version).toEqual(versionOf(day(), "absent"));
    expect(JSON.stringify(version)).not.toContain("suggestion");
  });

  it("un journal sans suggestion se comporte comme avant : même version ⇒ même référence, pas de nouvelle ligne", () => {
    const first = versionOf(day(at(8)), null);
    const log = recordVersion(emptyLog(), DAY, first);
    expect(recordVersion(log, DAY, { ...versionOf(day(at(8, 1)), null), at: at(8, 1).toISOString() })).toBe(log);
  });
});

describe("journal — plages activées : la suggestion est conservée", () => {
  const withWindows = versionOf(day(), starterWindows());

  it("chaque tâche gardée porte son exigence, son ajustement et sa plage avec ses heures", () => {
    const kept = withWindows.tasks.filter((task) => task.decision !== "déplacé");
    expect(kept.length).toBeGreaterThanOrEqual(3);
    for (const task of kept) {
      expect(task.suggestion).toBeDefined();
      expect(["elevee", "moyenne", "legere"]).toContain(task.suggestion!.load);
      expect(task.suggestion!.fit).toBe("ideale");
    }
    const dm = withWindows.tasks.find((task) => task.key === "échéance:dm4")!;
    expect(dm.suggestion).toEqual({ load: "elevee", fit: "ideale", window: { id: "matin", start: "08:00", end: "12:00", level: "haute" } });
  });

  it("le reste de la version est celui d'avant : les suggestions n'ajoutent que ce champ", () => {
    const strip = (version: AgendaVersion) => ({ ...version, tasks: version.tasks.map((task) => Object.fromEntries(Object.entries(task).filter(([name]) => name !== "suggestion"))) });
    expect(strip(withWindows)).toEqual(versionOf(day(), "absent"));
  });

  it("une tâche déplacée à demain ne porte pas de suggestion", () => {
    const crowded = versionOf(day(at(8), prefs({ capacityByWeekday: [45, 45, 45, 45, 45, 45, 45] })), starterWindows());
    const postponed = crowded.tasks.filter((task) => task.decision === "déplacé");
    expect(postponed.length).toBeGreaterThan(0);
    for (const task of postponed) expect(task).not.toHaveProperty("suggestion");
  });

  it("une tâche hors plage est conservée avec `window: null` et `fit: hors-plage`", () => {
    const version = versionOf(day(), [{ id: "matin", start: "08:00", end: "08:30", level: "haute" }]);
    const dm = version.tasks.find((task) => task.key === "échéance:dm4")!;
    expect(dm.suggestion).toEqual({ load: "elevee", fit: "hors-plage", window: null });
  });

  it("describeSuggestion donne une ligne lisible, et rien sans suggestion", () => {
    const dm = withWindows.tasks.find((task) => task.key === "échéance:dm4")!;
    expect(describeSuggestion(dm)).toBe("DM 4 · exigeante · Matin 08:00-12:00 (plage haute)");
    const outOfRange = versionOf(day(), [{ id: "matin", start: "08:00", end: "08:30", level: "haute" }]).tasks[0];
    expect(describeSuggestion(outOfRange)).toMatch(/hors plage$/);
    expect(describeSuggestion(versionOf(day(), "absent").tasks[0])).toBeNull();
  });
});

describe("journal — quand une version est créée (option A)", () => {
  it("un changement de suggestion SEUL crée une nouvelle version", () => {
    const first = versionOf(day(at(8)), starterWindows());
    const log = recordVersion(emptyLog(), DAY, first);
    const moved = starterWindows().map((window) => (window.id === "matin" ? { ...window, start: "09:00", end: "12:00" } : window));
    const second = versionOf(day(at(8, 5)), moved);
    // Même plan (mêmes tâches, mêmes minutes) : seule la plage affichée change.
    expect(second.tasks.map((task) => `${task.key}|${task.minutes}`)).toEqual(first.tasks.map((task) => `${task.key}|${task.minutes}`));
    const next = recordVersion(log, DAY, second);
    expect(next).not.toBe(log);
    expect(next.days[DAY].versions).toHaveLength(2);
  });

  it("la même suggestion, plus tard dans la journée, n'ajoute rien", () => {
    const first = versionOf(day(at(8)), starterWindows());
    const log = recordVersion(emptyLog(), DAY, first);
    expect(recordVersion(log, DAY, versionOf(day(at(8, 2)), starterWindows()))).toBe(log);
  });

  it("une suggestion qui se déplace quand l'heure avance est enregistrée : à 11 h 30 le matin n'offre plus que 30 min", () => {
    const morning = versionOf(day(at(8)), starterWindows());
    const late = versionOf(day(at(11, 30)), starterWindows());
    const log = recordVersion(recordVersion(emptyLog(), DAY, morning), DAY, late);
    expect(log.days[DAY].versions).toHaveLength(2);
    expect(log.days[DAY].versions[0].tasks.find((task) => task.key === "échéance:dm4")!.suggestion!.window!.id).toBe("matin");
    expect(log.days[DAY].versions[1].tasks.find((task) => task.key === "échéance:dm4")!.suggestion!.window?.id).not.toBe("matin");
  });

  it("passer de « sans plages » à « avec plages » ajoute une version, sans erreur", () => {
    const log = recordVersion(emptyLog(), DAY, versionOf(day(at(8)), null));
    const next = recordVersion(log, DAY, versionOf(day(at(8, 3)), starterWindows()));
    expect(next.days[DAY].versions).toHaveLength(2);
    expect(next.days[DAY].versions[0].tasks.every((task) => !task.suggestion)).toBe(true);
  });
});

describe("journal — lecture des anciennes entrées", () => {
  const legacy = versionOf(day(at(8)), "absent");
  const legacyLog: AgendaLog = { days: { [DAY]: { versions: [legacy], override: null } } };

  it("un journal d'avant ce champ se relit à l'identique", () => {
    expect(parseLog(JSON.stringify(legacyLog))).toEqual(legacyLog);
  });

  it("les suggestions survivent à un aller-retour JSON (stockage local)", () => {
    const log = recordVersion(emptyLog(), DAY, versionOf(day(at(8)), starterWindows()));
    expect(parseLog(JSON.stringify(log))).toEqual(log);
  });

  it("un journal mélangeant anciennes et nouvelles versions se relit sans perte", () => {
    const mixed = recordVersion(legacyLog, DAY, versionOf(day(at(8, 3)), starterWindows()));
    const reread = parseLog(JSON.stringify(mixed));
    expect(reread).toEqual(mixed);
    expect(reread.days[DAY].versions[0].tasks.every((task) => !task.suggestion)).toBe(true);
  });

  it("une suggestion illisible est écartée, la tâche et la version sont conservées", () => {
    const good = versionOf(day(at(8)), starterWindows());
    const broken = (suggestion: unknown) => ({ days: { [DAY]: { versions: [{ ...good, tasks: good.tasks.map((task, index) => (index === 0 ? { ...task, suggestion } : task)) }], override: null } } });
    const first = good.tasks[0];
    for (const bad of ["oui", 42, { load: "extrême", fit: "ideale", window: null }, { load: "elevee", fit: "parfaite", window: null }, { load: "elevee", fit: "ideale", window: { id: "nuit", start: "01:00", end: "05:00", level: "haute" } }, { load: "elevee", fit: "ideale", window: { id: "matin", start: "12:00", end: "08:00", level: "haute" } }, { load: "elevee", fit: "ideale" }]) {
      const reread = parseLog(JSON.stringify(broken(bad)));
      const tasks = reread.days[DAY].versions[0].tasks;
      expect(tasks).toHaveLength(good.tasks.length);
      expect(tasks[0]).not.toHaveProperty("suggestion");
      expect(tasks[0].key).toBe(first.key);
      expect(tasks[0].minutes).toBe(first.minutes);
      expect(tasks[1]).toEqual(good.tasks[1]);
    }
  });

  it("un journal corrompu reste un journal vide", () => {
    expect(parseLog("{cassé")).toEqual({ days: {} });
    expect(parseLog(null)).toEqual({ days: {} });
  });
});

describe("journal — rétention et neutralité", () => {
  it("la trace garde 7 jours, suggestions comprises", () => {
    const version = versionOf(day(at(8)), starterWindows());
    let log = emptyLog();
    for (let dayOfMonth = 1; dayOfMonth <= 9; dayOfMonth += 1) log = recordVersion(log, `2026-09-0${dayOfMonth}`, version);
    expect(Object.keys(log.days)).toHaveLength(7);
    expect(Object.keys(log.days)[0]).toBe("2026-09-03");
    expect(log.days["2026-09-09"].versions[0].tasks[0].suggestion).toBeDefined();
  });

  it("le plafond de 40 versions par jour reste vrai", () => {
    let log = emptyLog();
    for (let step = 0; step < 55; step += 1) {
      const minutes = 60 + step * 5; // minutes différentes ⇒ chaque version est un changement
      const version = versionOf(day(at(8)), starterWindows());
      log = recordVersion(log, DAY, { ...version, at: at(8, step).toISOString(), tasks: version.tasks.map((task, index) => (index === 0 ? { ...task, minutes } : task)) });
    }
    expect(log.days[DAY].versions).toHaveLength(40);
  });

  it("les suggestions ne changent pas ce que dit `diffVersions` (causes et changements)", () => {
    const pair = (windows: PerformanceWindow[] | null) => diffVersions(versionOf(day(at(9)), windows), versionOf(day(at(15)), windows));
    expect(pair(starterWindows())).toEqual(pair(null));
  });
});
