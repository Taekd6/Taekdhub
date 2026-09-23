import { describe, expect, it } from "vitest";
import {
  createQuickLogSession,
  parseQuickLogMemory,
  QUICK_LOG_MAX_MINUTES,
  sanitizeMinutes,
  todayQuickLogs,
} from "@/lib/quick-log";
import { dayKey, todaySeconds } from "@/lib/study";

const noon = new Date(2026, 8, 23, 12, 0);

describe("saisie rapide — une séance ordinaire, comptée partout", () => {
  it("30 min d'anglais saisies à midi se terminent à midi", () => {
    const session = createQuickLogSession({ subject: "Anglais", minutes: 30, day: "aujourd'hui" }, noon)!;
    expect(session.duration_seconds).toBe(1800);
    expect(new Date(session.ended_at!).getTime()).toBe(noon.getTime());
    expect(new Date(session.started_at).getTime()).toBe(noon.getTime() - 30 * 60_000);
  });

  it("compte dans l'objectif du jour, comme une séance chronométrée", () => {
    const session = createQuickLogSession({ subject: "Anglais", minutes: 30, day: "aujourd'hui" }, noon)!;
    expect(todaySeconds([session], noon)).toBe(1800);
  });

  it("« hier » tombe bien la veille et ne compte pas aujourd'hui", () => {
    const session = createQuickLogSession({ subject: "Physique", minutes: 45, day: "hier" }, noon)!;
    expect(dayKey(session.started_at)).toBe("2026-09-22");
    expect(todaySeconds([session], noon)).toBe(0);
  });

  it("ne déborde jamais sur la veille : 90 min à 0 h 30 commencent à minuit", () => {
    const earlyMorning = new Date(2026, 8, 23, 0, 30);
    const session = createQuickLogSession({ subject: "Mathématiques", minutes: 90, day: "aujourd'hui" }, earlyMorning)!;
    expect(dayKey(session.started_at)).toBe("2026-09-23");
    expect(session.duration_seconds).toBe(5400);
  });

  it("refuse une durée absurde plutôt que d'enregistrer n'importe quoi", () => {
    expect(createQuickLogSession({ subject: "Anglais", minutes: 0, day: "aujourd'hui" }, noon)).toBeNull();
    expect(createQuickLogSession({ subject: "Anglais", minutes: QUICK_LOG_MAX_MINUTES + 1, day: "aujourd'hui" }, noon)).toBeNull();
    expect(sanitizeMinutes(Number.NaN)).toBeNull();
    expect(sanitizeMinutes(29.6)).toBe(30);
  });
});

describe("annulation — seules les saisies rapides du jour", () => {
  it("ignore les séances chronométrées et les saisies d'un autre jour", () => {
    const quick = createQuickLogSession({ subject: "Anglais", minutes: 30, day: "aujourd'hui" }, noon)!;
    const timed = { ...quick, id: "chrono", note: null };
    const yesterday = createQuickLogSession({ subject: "Anglais", minutes: 30, day: "aujourd'hui" }, new Date(2026, 8, 22, 12))!;
    expect(todayQuickLogs([timed, yesterday, quick], noon).map((s) => s.id)).toEqual([quick.id]);
  });
});

describe("mémoire du dernier choix", () => {
  it("relit un choix valide", () => {
    expect(parseQuickLogMemory(JSON.stringify({ subject: "Anglais", minutes: 30 }))).toEqual({ subject: "Anglais", minutes: 30 });
  });

  it("rejette tout ce qui est corrompu", () => {
    expect(parseQuickLogMemory(null)).toBeNull();
    expect(parseQuickLogMemory("{pas du json")).toBeNull();
    expect(parseQuickLogMemory(JSON.stringify({ subject: "Latin", minutes: 30 }))).toBeNull();
    expect(parseQuickLogMemory(JSON.stringify({ subject: "Anglais", minutes: -4 }))).toBeNull();
  });
});
