import { describe, expect, it } from "vitest";
import {
  clockToMinutes,
  MIN_WINDOW_MINUTES,
  normalizePerformanceWindows,
  performanceWindowIssues,
  STARTER_WINDOWS,
  starterWindows,
  type PerformanceWindow,
} from "@/lib/performance-windows";
import { normalizePreferences, validateBackupPayload } from "@/lib/storage";

const morning: PerformanceWindow = { id: "matin", start: "08:00", end: "12:00", level: "haute" };
const afternoon: PerformanceWindow = { id: "apres-midi", start: "14:00", end: "18:00", level: "moyenne" };

describe("plages de performance — lecture blindée", () => {
  it("absent, null ou pas une liste ⇒ null (aucun profil activé d'office)", () => {
    for (const raw of [undefined, null, 42, "matin", {}, { id: "matin" }]) expect(normalizePerformanceWindows(raw)).toBeNull();
  });

  it("une liste vide ou entièrement illisible ⇒ null", () => {
    expect(normalizePerformanceWindows([])).toBeNull();
    expect(normalizePerformanceWindows([{ id: "nuit", start: "01:00", end: "05:00", level: "haute" }, "x", null])).toBeNull();
  });

  it("conserve les plages valides, triées par heure de début", () => {
    expect(normalizePerformanceWindows([afternoon, morning])).toEqual([morning, afternoon]);
  });

  it("écarte une plage douteuse sans toucher aux autres", () => {
    const raw = [
      morning,
      { id: "apres-midi", start: "25:00", end: "18:00", level: "moyenne" }, // heure illisible
      { id: "soir", start: "20:00", end: "20:10", level: "basse" }, // trop courte
    ];
    expect(normalizePerformanceWindows(raw)).toEqual([morning]);
    expect(normalizePerformanceWindows([{ ...morning, level: "extrême" }])).toBeNull();
  });

  it("écarte l'identifiant répété et la plage qui en chevauche une autre", () => {
    expect(normalizePerformanceWindows([morning, { ...morning, start: "09:00", end: "11:00" }])).toEqual([morning]);
    expect(normalizePerformanceWindows([morning, { id: "apres-midi", start: "11:00", end: "15:00", level: "moyenne" }])).toEqual([morning]);
  });

  it("deux plages qui se touchent (12:00-12:00) ne se chevauchent pas", () => {
    const touching: PerformanceWindow = { id: "apres-midi", start: "12:00", end: "16:00", level: "moyenne" };
    expect(normalizePerformanceWindows([morning, touching])).toEqual([morning, touching]);
  });
});

describe("plages de performance — profil de départ et saisie", () => {
  it("le profil de départ est valide : trois plages, enregistrable, sans chevauchement", () => {
    expect(STARTER_WINDOWS).toHaveLength(3);
    expect(performanceWindowIssues(starterWindows())).toEqual([]);
    expect(normalizePerformanceWindows(starterWindows())).toEqual([...STARTER_WINDOWS]);
  });

  it("starterWindows renvoie une copie : la modifier ne change pas le profil de départ", () => {
    const copy = starterWindows();
    copy[0].level = "basse";
    expect(STARTER_WINDOWS[0].level).toBe("haute");
  });

  it("la saisie est refusée avec son motif plutôt que corrigée en silence", () => {
    expect(performanceWindowIssues([{ ...morning, start: "12:00", end: "08:00" }])[0]).toMatch(/au moins/);
    expect(performanceWindowIssues([{ ...morning, end: "08:10" }])[0]).toContain(`${MIN_WINDOW_MINUTES} minutes`);
    expect(performanceWindowIssues([morning, { id: "apres-midi", start: "11:00", end: "15:00", level: "moyenne" }])[0]).toMatch(/chevauchent/);
    expect(performanceWindowIssues([{ ...morning, start: "8h" }])[0]).toMatch(/illisible/);
  });

  it("clockToMinutes n'accepte que HH:MM", () => {
    expect(clockToMinutes("08:30")).toBe(510);
    expect(clockToMinutes("24:00")).toBeNull();
    expect(clockToMinutes("8:30")).toBeNull();
    expect(clockToMinutes(830)).toBeNull();
  });
});

describe("compatibilité — anciennes préférences et sauvegardes", () => {
  it("des préférences d'avant ce champ se relisent avec performanceWindows = null", () => {
    expect(normalizePreferences({}).performanceWindows).toBeNull();
    expect(normalizePreferences({ displayName: "Léa", dailyGoalMinutes: 90 }).performanceWindows).toBeNull();
    expect(normalizePreferences(null).performanceWindows).toBeNull();
  });

  it("des plages corrompues dans les préférences ne plantent pas et n'activent rien", () => {
    expect(normalizePreferences({ performanceWindows: "n'importe quoi" }).performanceWindows).toBeNull();
    expect(normalizePreferences({ performanceWindows: [{ id: 1 }] }).performanceWindows).toBeNull();
  });

  it("des plages valides survivent à un aller-retour JSON (sauvegarde → restauration)", () => {
    const stored = normalizePreferences({ performanceWindows: [morning, afternoon] });
    const roundTripped = normalizePreferences(JSON.parse(JSON.stringify(stored)));
    expect(roundTripped.performanceWindows).toEqual([morning, afternoon]);
  });

  it("une sauvegarde exportée avant ce champ reste valide et se restaure sans plages", () => {
    const legacy = { version: 1, exportedAt: "2026-01-01T00:00:00.000Z", sessions: [], preferences: { dailyGoalMinutes: 60, capacityByWeekday: [100, 100, 100, 100, 100, 100, 100] } };
    expect(validateBackupPayload(legacy)).toBe(true);
    const restored = normalizePreferences(legacy.preferences);
    expect(restored.performanceWindows).toBeNull();
    // Le reste de la préférence n'a pas bougé.
    expect(restored.capacityByWeekday).toEqual([100, 100, 100, 100, 100, 100, 100]);
  });

  it("les autres réglages ne sont pas affectés par la présence des plages", () => {
    const without = normalizePreferences({ dailyGoalMinutes: 75 });
    const withWindows = normalizePreferences({ dailyGoalMinutes: 75, performanceWindows: [morning] });
    expect({ ...withWindows, performanceWindows: null }).toEqual(without);
  });
});
