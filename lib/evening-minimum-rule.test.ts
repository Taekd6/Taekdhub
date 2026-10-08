import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import { plannableMinutes } from "@/lib/capacity";
import { eveningMinimumConflicts, eveningMinimumSaveErrors } from "@/lib/evening-minimums";
import { DEFAULT_CAPACITY_BY_WEEKDAY, DEFAULT_EVENING_MINIMUMS, normalizePreferences, type Preferences } from "@/lib/storage";

/**
 * RÈGLE — LE MINIMUM DU SOIR TIENT DANS LA CAPACITÉ PLANIFIABLE DU JOUR.
 *
 * Décision produit : le minimum du soir FAIT PARTIE de la capacité, il ne
 * s'y ajoute pas. Il se compare à la capacité PLANIFIABLE (déclarée moins
 * la marge), jour par jour. Trois comportements, testés ici :
 *
 *   1. RÉGLAGES — une saisie qui violerait la règle est REFUSÉE ;
 *   2. ANCIEN RÉGLAGE — une préférence déjà enregistrée qui la viole est
 *      DÉTECTÉE et signalée, jamais corrigée en silence ;
 *   3. VALEURS PAR DÉFAUT — elles la respectent dès le départ.
 */

const NO_EVENING: Preferences["eveningMinimums"] = [{}, {}, {}, {}, {}, {}, {}];

/** Capacité 120 min tous les jours, marge 20 % : 96 min planifiables par jour. */
function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ capacityByWeekday: [120, 120, 120, 120, 120, 120, 120], planningMarginPercent: 20, eveningMinimums: NO_EVENING, ...overrides });
}

/** Les minimums d'un seul jour (0 = lundi), les autres soirs libres. */
function onDay(day: number, minimum: Partial<Record<"Mathématiques" | "Physique", number>>): Preferences["eveningMinimums"] {
  return NO_EVENING.map((entry, index) => (index === day ? minimum : entry));
}

describe("détection, jour par jour", () => {
  it("aucun minimum : aucun conflit", () => {
    expect(eveningMinimumConflicts(prefs())).toEqual([]);
  });

  it("un minimum égal à la capacité planifiable est permis (la borne est incluse)", () => {
    expect(eveningMinimumConflicts(prefs({ eveningMinimums: onDay(0, { Mathématiques: 60, Physique: 36 }) }))).toEqual([]);
  });

  it("le total des matières d'un soir est comparé à la capacité PLANIFIABLE, pas à la déclarée", () => {
    // 100 min ≤ 120 déclarées, mais > 96 planifiables.
    expect(eveningMinimumConflicts(prefs({ eveningMinimums: onDay(0, { Mathématiques: 60, Physique: 40 }) }))).toEqual([
      { weekday: 0, minimumMinutes: 100, plannableMinutes: 96, excessMinutes: 4 },
    ]);
  });

  it("chaque jour est jugé avec SA capacité : 150 min tiennent le samedi (240), pas le lundi (60)", () => {
    const capacity = [60, 120, 120, 120, 120, 240, 0];
    const minimums = NO_EVENING.map(() => ({ Mathématiques: 150 }));
    const conflicts = eveningMinimumConflicts(prefs({ capacityByWeekday: capacity, planningMarginPercent: 0, eveningMinimums: minimums }));
    expect(conflicts.map((conflict) => conflict.weekday)).toEqual([0, 1, 2, 3, 4, 6]);
    expect(conflicts[conflicts.length - 1]).toEqual({ weekday: 6, minimumMinutes: 150, plannableMinutes: 0, excessMinutes: 150 });
  });

  it("la marge compte : à 50 %, 96 min de minimum ne tiennent plus dans 120 déclarées", () => {
    const minimums = onDay(2, { Mathématiques: 96 });
    expect(eveningMinimumConflicts(prefs({ eveningMinimums: minimums }))).toEqual([]);
    expect(eveningMinimumConflicts(prefs({ eveningMinimums: minimums, planningMarginPercent: 50 }))).toEqual([
      { weekday: 2, minimumMinutes: 96, plannableMinutes: 60, excessMinutes: 36 },
    ]);
  });
});

describe("Réglages : une saisie qui viole la règle est refusée", () => {
  const saved = prefs();

  it("valeur valide : acceptée", () => {
    expect(eveningMinimumSaveErrors(saved, { ...saved, eveningMinimums: onDay(0, { Mathématiques: 60, Physique: 30 }) })).toEqual([]);
  });

  it("valeur supérieure à la capacité planifiable du jour : refusée, avec le jour et les deux nombres", () => {
    const errors = eveningMinimumSaveErrors(saved, { ...saved, eveningMinimums: onDay(0, { Mathématiques: 90, Physique: 60 }) });
    expect(errors).toEqual([{ weekday: 0, minimumMinutes: 150, plannableMinutes: 96, excessMinutes: 54 }]);
  });

  it("baisser la capacité, ou monter la marge, sous un minimum déjà enregistré : refusé aussi", () => {
    const withMinimum = prefs({ eveningMinimums: onDay(0, { Mathématiques: 90 }) });
    expect(eveningMinimumSaveErrors(withMinimum, { ...withMinimum, capacityByWeekday: [60, 120, 120, 120, 120, 120, 120] })).toEqual([
      { weekday: 0, minimumMinutes: 90, plannableMinutes: 48, excessMinutes: 42 },
    ]);
    expect(eveningMinimumSaveErrors(withMinimum, { ...withMinimum, planningMarginPercent: 50 })).toEqual([
      { weekday: 0, minimumMinutes: 90, plannableMinutes: 60, excessMinutes: 30 },
    ]);
  });

  it("corriger un ancien réglage en dessous de la capacité : accepté", () => {
    const legacy = prefs({ eveningMinimums: onDay(0, { Mathématiques: 120, Physique: 90 }) });
    expect(eveningMinimumSaveErrors(legacy, { ...legacy, eveningMinimums: onDay(0, { Mathématiques: 60, Physique: 30 }) })).toEqual([]);
  });

  it("le baisser sans le ramener sous la capacité : toujours refusé — on n'enregistre pas un minimum qui dépasse", () => {
    const legacy = prefs({ eveningMinimums: onDay(0, { Mathématiques: 120, Physique: 90 }) });
    expect(eveningMinimumSaveErrors(legacy, { ...legacy, eveningMinimums: onDay(0, { Mathématiques: 90, Physique: 60 }) })).toHaveLength(1);
  });

  it("un ancien réglage incohérent que l'on ne touche pas ne bloque pas l'enregistrement du reste (prénom, objectifs…)", () => {
    const legacy = prefs({ eveningMinimums: onDay(0, { Mathématiques: 120, Physique: 90 }) });
    const renamed: Preferences = { ...legacy, displayName: "Alix", dailyGoalMinutes: 90 };
    expect(eveningMinimumSaveErrors(legacy, renamed)).toEqual([]);
  });
});

describe("ancienne préférence incohérente : détectée, jamais modifiée automatiquement", () => {
  // Exactement les anciennes valeurs par défaut : 3 h 30 de minimum pour 2 h déclarées, quatre soirs par semaine.
  const LEGACY_EVENING = { Mathématiques: 120, Physique: 90 };
  const stored = {
    capacityByWeekday: [120, 120, 120, 120, 120, 240, 180],
    planningMarginPercent: 20,
    eveningMinimums: [LEGACY_EVENING, {}, LEGACY_EVENING, LEGACY_EVENING, LEGACY_EVENING, {}, {}],
  };

  it("la lecture (normalisation) conserve les valeurs telles qu'enregistrées", () => {
    const read = normalizePreferences(stored);
    expect(read.eveningMinimums).toEqual(stored.eveningMinimums);
    expect(read.capacityByWeekday).toEqual(stored.capacityByWeekday);
    expect(read.planningMarginPercent).toBe(20);
  });

  it("le conflit est détecté sur les quatre soirs concernés, avec l'excès", () => {
    expect(eveningMinimumConflicts(normalizePreferences(stored))).toEqual(
      [0, 2, 3, 4].map((weekday) => ({ weekday, minimumMinutes: 210, plannableMinutes: 96, excessMinutes: 114 }))
    );
  });

  it("une alerte explicite demande de le corriger dans Réglages — dans l'app seulement, pas en notification", () => {
    const now = new Date(2026, 8, 15, 10, 0); // mardi : aucun minimum ce soir-là, l'alerte vaut quand même
    const alert = computeAlerts({ sessions: [], workItems: [], reviewItems: [], preferences: normalizePreferences(stored), now }).find((entry) => entry.id.startsWith("minimum-incoherent"));
    expect(alert).toMatchObject({ level: "info", href: "/settings#soirs", action: "Corriger" });
    expect(alert!.body).toContain("Lundi");
    expect(alert!.body).toContain("3 h 30");
    expect(alert!.body).toContain("1 h 36");
  });

  it("pas d'alerte quand les réglages sont cohérents", () => {
    const now = new Date(2026, 8, 15, 10, 0);
    expect(computeAlerts({ sessions: [], workItems: [], reviewItems: [], preferences: prefs(), now }).some((entry) => entry.id.startsWith("minimum-incoherent"))).toBe(false);
  });
});

describe("valeurs par défaut", () => {
  const defaults = normalizePreferences({});

  it("elles respectent la règle, jour par jour", () => {
    expect(eveningMinimumConflicts(defaults)).toEqual([]);
    for (let day = 0; day < 7; day += 1) {
      const minimum = Object.values(defaults.eveningMinimums[day] ?? {}).reduce((sum: number, value) => sum + (value ?? 0), 0);
      const date = new Date(2026, 8, 14 + day); // lundi 14 → dimanche 20 septembre 2026
      expect(minimum).toBeLessThanOrEqual(plannableMinutes(defaults, date));
    }
  });

  it("les valeurs décidées : 1 h 30 de maths et 1 h de physique les lundi, mercredi, jeudi et vendredi ; 3 h 10 déclarées du lundi au vendredi", () => {
    const evening = { Mathématiques: 90, Physique: 60 };
    expect(DEFAULT_EVENING_MINIMUMS).toEqual([evening, {}, evening, evening, evening, {}, {}]);
    expect(DEFAULT_CAPACITY_BY_WEEKDAY).toEqual([190, 190, 190, 190, 190, 240, 180]);
    expect(defaults.planningMarginPercent).toBe(20);
  });
});
