import { describe, expect, it } from "vitest";
import { computeDailyLoad, describeLoad } from "@/lib/workload";
import { normalizePreferences, type Preferences } from "@/lib/storage";

const MONDAY = new Date("2026-09-14T08:00:00");

/** 120 min déclarées en semaine, marge 20 % ⇒ 96 min planifiables. */
function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({
    capacityByWeekday: [120, 120, 120, 120, 120, 240, 180],
    planningMarginPercent: 20,
    ...overrides,
  });
}

describe("les cinq états — et surtout l'écart entre les deux derniers", () => {
  /**
   * « Surchargé » = le planning mord sur la marge, la journée tiendra si rien
   * ne dérape. « Intenable » = il dépasse la capacité déclarée, elle ne
   * tiendra pas. Les fondre en un seul signal reviendrait à alerter sur
   * toute journée dense, jusqu'à ce que l'élève cesse de regarder.
   */
  it("une journée à moitié pleine est légère", () => {
    expect(computeDailyLoad(MONDAY, 40, prefs()).status).toBe("léger");
  });

  it("une journée aux trois quarts est normale", () => {
    expect(computeDailyLoad(MONDAY, 70, prefs()).status).toBe("normal");
  });

  it("une journée pleine mais dans les clous est « chargée »", () => {
    expect(computeDailyLoad(MONDAY, 95, prefs()).status).toBe("chargé");
  });

  it("dépasser la planifiable sans dépasser la déclarée entame la marge : « surchargé »", () => {
    const load = computeDailyLoad(MONDAY, 110, prefs());
    expect(load.status).toBe("surchargé");
    expect(load.overflowMinutes).toBe(0);
  });

  it("dépasser la capacité DÉCLARÉE est « intenable », et le dépassement est chiffré", () => {
    const load = computeDailyLoad(MONDAY, 165, prefs());
    expect(load.status).toBe("intenable");
    expect(load.overflowMinutes).toBe(45);
  });
});

describe("cas limites", () => {
  it("un jour sans capacité déclarée et sans rien de prévu n'est pas alarmant", () => {
    const load = computeDailyLoad(MONDAY, 0, prefs({ capacityByWeekday: [0, 120, 120, 120, 120, 240, 180] }));
    expect(load.status).toBe("léger");
    expect(load.ratio).toBe(0);
  });

  it("y planifier quoi que ce soit devient immédiatement intenable", () => {
    const load = computeDailyLoad(MONDAY, 30, prefs({ capacityByWeekday: [0, 120, 120, 120, 120, 240, 180] }));
    expect(load.status).toBe("intenable");
    expect(load.overflowMinutes).toBe(30);
  });

  it("le ratio reste borné, jamais infini", () => {
    const load = computeDailyLoad(MONDAY, 5000, prefs());
    expect(Number.isFinite(load.ratio)).toBe(true);
    expect(load.ratio).toBeLessThanOrEqual(4);
  });
});

describe("la phrase cite toujours un chiffre calculé", () => {
  it("un dépassement dit de combien", () => {
    expect(describeLoad(computeDailyLoad(MONDAY, 165, prefs()))).toBe("Dépassement de 45 min sur ta capacité du jour.");
  });

  it("une journée surchargée dit ce qui est prévu ET ce qui était planifiable", () => {
    expect(describeLoad(computeDailyLoad(MONDAY, 110, prefs()))).toBe("1 h 50 prévues pour 1 h 36 planifiables : la marge y passe.");
  });

  it("une journée vide dit ce qui reste disponible", () => {
    expect(describeLoad(computeDailyLoad(MONDAY, 0, prefs()))).toBe("Rien de prévu — 1 h 36 disponibles.");
  });
});

/*
 * LE MINIMUM DU SOIR DANS LA CHARGE. Le planning réserve le minimum avant
 * les échéances (lib/evening-minimums.ts#splitDayBudget) ; la charge d'un
 * jour doit donc le compter, sinon un soir déjà promis au minimum s'affichait
 * « Rien de prévu — 1 h 36 disponibles ». `plannedMinutes` reste la seule
 * part des échéances : c'est ce chiffre que l'historique enregistre.
 */
describe("la réserve du minimum du soir compte dans la charge", () => {
  it("sans réserve, rien ne change : 0 réservée, engagé = prévu", () => {
    expect(computeDailyLoad(MONDAY, 40, prefs())).toMatchObject({ reservedMinutes: 0, committedMinutes: 40, plannedMinutes: 40 });
  });

  it("prévu et réserve s'additionnent pour l'état de la journée, sans changer `plannedMinutes`", () => {
    const load = computeDailyLoad(MONDAY, 30, prefs(), [], 60);
    expect(load).toMatchObject({ plannedMinutes: 30, reservedMinutes: 60, committedMinutes: 90, status: "chargé" });
  });

  it("la phrase dit la part réservée au minimum", () => {
    expect(describeLoad(computeDailyLoad(MONDAY, 30, prefs(), [], 60))).toBe("30 min prévues + 1 h pour le minimum du soir, sur 1 h 36 planifiables.");
  });

  it("un soir pris par le seul minimum n'est pas « rien de prévu »", () => {
    expect(describeLoad(computeDailyLoad(MONDAY, 0, prefs(), [], 60))).toBe("1 h pour le minimum du soir — 36 min encore libres.");
  });
});
