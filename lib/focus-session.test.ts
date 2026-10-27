import { describe, expect, it } from "vitest";
import { buildPhases, DEFAULT_FOCUS_CONFIG, focusAlerts, focusState, normalizeFocusConfig, parseStoredFocus, suggestGoals, workedSeconds } from "@/lib/focus-session";
import { createWorkItem } from "@/lib/work-items";

const MIN = 60_000;
const T0 = new Date(2026, 9, 28, 18, 0, 0).getTime();

describe("buildPhases", () => {
  it("enchaîne travail et pause, sans pause après le dernier cycle", () => {
    const phases = buildPhases(T0, { workMinutes: 50, breakMinutes: 10, cycles: 2 });
    expect(phases.map((p) => p.kind)).toEqual(["travail", "pause", "travail"]);
    expect(phases[0].end - phases[0].start).toBe(50 * MIN);
    expect(phases[1].start).toBe(phases[0].end);
    expect(phases[2].end).toBe(T0 + 110 * MIN);
  });

  it("un seul cycle = une seule phase", () => {
    expect(buildPhases(T0, { workMinutes: 25, breakMinutes: 5, cycles: 1 })).toHaveLength(1);
  });
});

describe("focusState et workedSeconds", () => {
  const phases = buildPhases(T0, DEFAULT_FOCUS_CONFIG);

  it("donne la phase courante et le temps restant", () => {
    const s = focusState(phases, T0 + 10 * MIN);
    expect(s.status).toBe("en cours");
    if (s.status === "en cours") {
      expect(s.phase.kind).toBe("travail");
      expect(s.remainingMs).toBe(40 * MIN);
    }
    const p = focusState(phases, T0 + 55 * MIN);
    expect(p.status === "en cours" && p.phase.kind).toBe("pause");
  });

  it("se termine à la fin de la dernière phase", () => {
    expect(focusState(phases, T0 + 110 * MIN).status).toBe("terminée");
  });

  it("ne compte pas les pauses dans le temps travaillé", () => {
    expect(workedSeconds(phases, T0 + 55 * MIN)).toBe(50 * 60);
    expect(workedSeconds(phases, T0 + 200 * MIN)).toBe(100 * 60);
    expect(workedSeconds(phases, T0 - MIN)).toBe(0);
  });
});

describe("focusAlerts", () => {
  it("une alerte par fin de phase, la dernière demande si l'objectif est fait", () => {
    const alerts = focusAlerts(buildPhases(T0, DEFAULT_FOCUS_CONFIG), "Exo 3 TD séries");
    expect(alerts).toHaveLength(3);
    expect(alerts[0].title).toMatch(/^Pause 10 min/);
    expect(alerts[1].title).toMatch(/^Reprise — cycle 2/);
    expect(alerts[2].title).toContain("Exo 3 TD séries");
    expect(alerts[2].at).toBe(T0 + 110 * MIN);
  });
});

describe("normalizeFocusConfig", () => {
  it("borne et complète les entrées", () => {
    expect(normalizeFocusConfig({ workMinutes: "999", breakMinutes: 0, cycles: "x" })).toEqual({ workMinutes: 120, breakMinutes: 1, cycles: 2 });
    expect(normalizeFocusConfig(null)).toEqual(DEFAULT_FOCUS_CONFIG);
  });
});

describe("suggestGoals", () => {
  const now = new Date(2026, 9, 28, 18, 0);
  it("propose d'abord ce soir, puis le plus urgent, jamais le terminé", () => {
    const tonight = createWorkItem({ title: "TD séries exo 3", kind: "autre", subject: null, estimatedMinutes: 45, dueDate: "2026-10-28" }, now);
    const later = createWorkItem({ title: "DM physique", kind: "autre", subject: null, estimatedMinutes: 60, dueDate: "2026-11-03" }, now);
    const done = { ...createWorkItem({ title: "Fini", kind: "autre", subject: null, estimatedMinutes: 30, dueDate: "2026-10-28" }, now), status: "terminé" as const, completedAt: "2026-10-27T10:00:00.000Z" };
    const goals = suggestGoals([later, done, tonight], now);
    expect(goals.map((g) => g.title)).toEqual(["TD séries exo 3", "DM physique"]);
    expect(goals[0].reason).toBe("pour aujourd'hui");
  });
});

describe("parseStoredFocus", () => {
  it("refuse un contenu invalide et normalise la config", () => {
    expect(parseStoredFocus("{")).toBeNull();
    expect(parseStoredFocus(JSON.stringify({ goal: "", startedAt: 1 }))).toBeNull();
    const ok = parseStoredFocus(JSON.stringify({ goal: "x", startedAt: T0, config: { cycles: 3 } }));
    expect(ok?.config).toEqual({ workMinutes: 50, breakMinutes: 10, cycles: 3 });
  });
});
