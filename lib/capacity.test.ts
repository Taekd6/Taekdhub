import { describe, expect, it } from "vitest";
import {
  CAPACITY_SUGGESTION_MIN_SAMPLES,
  cumulativePlannableMinutes,
  declaredCapacityMinutes,
  plannableMinutes,
  remainingPlannableToday,
  suggestCapacityFromHistory,
  weekdayIndex,
  workedMinutesOnDay,
} from "@/lib/capacity";
import { normalizePreferences, type Preferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date("2026-09-14T08:00:00"); // lundi

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({
    capacityByWeekday: [120, 120, 120, 120, 120, 240, 180],
    planningMarginPercent: 20,
    ...overrides,
  });
}

function session(startedAt: string, minutes: number): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

describe("index de jour — lundi vaut 0", () => {
  it("aligne la semaine sur le lundi, pas sur le dimanche de Date#getDay", () => {
    expect(weekdayIndex(new Date("2026-09-14T12:00:00"))).toBe(0);
    expect(weekdayIndex(new Date("2026-09-19T12:00:00"))).toBe(5);
    expect(weekdayIndex(new Date("2026-09-20T12:00:00"))).toBe(6);
  });
});

describe("capacité déclarée vs planifiable — la marge n'est jamais planifiée", () => {
  it("la planifiable est strictement inférieure à la déclarée", () => {
    const p = prefs();
    expect(declaredCapacityMinutes(p, NOW)).toBe(120);
    expect(plannableMinutes(p, NOW)).toBe(96);
  });

  it("le samedi a bien sa propre capacité — c'est tout l'intérêt des sept valeurs", () => {
    const p = prefs();
    expect(declaredCapacityMinutes(p, new Date("2026-09-19T08:00:00"))).toBe(240);
    expect(plannableMinutes(p, new Date("2026-09-19T08:00:00"))).toBe(192);
  });

  it("une marge à zéro rend toute la capacité planifiable", () => {
    expect(plannableMinutes(prefs({ planningMarginPercent: 0 }), NOW)).toBe(120);
  });

  it("un jour déclaré à zéro n'offre rien à planifier", () => {
    expect(plannableMinutes(prefs({ capacityByWeekday: [0, 120, 120, 120, 120, 240, 180] }), NOW)).toBe(0);
  });
});

describe("capacité cumulée d'ici une échéance", () => {
  it("additionne bien chaque jour, bornes incluses", () => {
    // lundi → mercredi : trois jours à 96 min planifiables.
    expect(cumulativePlannableMinutes(prefs(), NOW, new Date("2026-09-16T08:00:00"))).toBe(288);
  });

  it("une échéance déjà passée n'offre aucune capacité", () => {
    expect(cumulativePlannableMinutes(prefs(), NOW, new Date("2026-09-13T08:00:00"))).toBe(0);
  });

  it("le week-end pèse son vrai poids dans le cumul", () => {
    // vendredi → dimanche : 96 + 192 + 144.
    expect(cumulativePlannableMinutes(prefs(), new Date("2026-09-18T08:00:00"), new Date("2026-09-20T08:00:00"))).toBe(432);
  });
});

describe("aujourd'hui — le temps déjà passé n'est plus disponible", () => {
  it("retranche les minutes déjà travaillées du jour", () => {
    const sessions = [session("2026-09-14T09:00:00", 60)];
    expect(remainingPlannableToday(prefs(), sessions, NOW)).toBe(36);
  });

  it("ne descend jamais sous zéro, même après une très grosse journée", () => {
    const sessions = [session("2026-09-14T09:00:00", 300)];
    expect(remainingPlannableToday(prefs(), sessions, NOW)).toBe(0);
  });

  it("les séances d'un autre jour ne sont pas comptées", () => {
    expect(workedMinutesOnDay([session("2026-09-13T09:00:00", 60)], NOW)).toBe(0);
  });
});

describe("suggestion depuis l'historique — ce que les données disent, rien de plus", () => {
  /**
   * Cette fonction est le seul endroit où TaekdHub a le droit de dire
   * « d'après tes séances ». Les trois garde-fous ci-dessous sont sa raison
   * d'être : sans eux, la suggestion deviendrait une affirmation sur
   * l'emploi du temps de l'élève, que personne n'a mesuré.
   */
  it("ne suggère rien pour un jour observé une seule fois", () => {
    const suggestions = suggestCapacityFromHistory([session("2026-09-12T09:00:00", 90)], NOW);
    expect(suggestions).toEqual([]);
  });

  it("suggère à partir de deux observations, et dit combien", () => {
    const sessions = [session("2026-09-12T09:00:00", 90), session("2026-09-05T09:00:00", 110)];
    const [suggestion] = suggestCapacityFromHistory(sessions, NOW);
    expect(suggestion.weekday).toBe(5); // samedi
    expect(suggestion.samples).toBe(CAPACITY_SUGGESTION_MIN_SAMPLES);
    expect(suggestion.minutes).toBe(100);
  });

  it("prend la MÉDIANE : une journée exceptionnelle ne devient pas la norme", () => {
    const sessions = [
      session("2026-09-12T09:00:00", 60),
      session("2026-09-05T09:00:00", 60),
      session("2026-08-29T09:00:00", 360),
    ];
    const [suggestion] = suggestCapacityFromHistory(sessions, NOW);
    expect(suggestion.minutes).toBe(60);
  });

  it("ignore les journées sans séance : une absence ne prouve pas une indisponibilité", () => {
    const sessions = [session("2026-09-12T09:00:00", 90), session("2026-09-05T09:00:00", 90)];
    const suggestions = suggestCapacityFromHistory(sessions, NOW);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].weekday).toBe(5);
  });

  it("ignore les séances hors de la fenêtre d'observation", () => {
    const sessions = [session("2026-06-05T09:00:00", 90), session("2026-06-12T09:00:00", 90)];
    expect(suggestCapacityFromHistory(sessions, NOW)).toEqual([]);
  });

  it("aucune séance : aucune suggestion, pas un chiffre par défaut déguisé en mesure", () => {
    expect(suggestCapacityFromHistory([], NOW)).toEqual([]);
  });
});

describe("préférences corrompues", () => {
  it("un tableau de capacité tronqué est complété par les défauts, jamais laissé à undefined", () => {
    const p = normalizePreferences({ capacityByWeekday: [60, 60] });
    expect(p.capacityByWeekday).toHaveLength(7);
    expect(p.capacityByWeekday[0]).toBe(60);
    expect(p.capacityByWeekday[6]).toBe(180);
  });

  it("une capacité absurde est bornée plutôt que propagée", () => {
    const p = normalizePreferences({ capacityByWeekday: [99999, 60, 60, 60, 60, 60, 60] });
    expect(p.capacityByWeekday[0]).toBe(960);
  });

  it("une marge hors bornes retombe dans l'échelle autorisée", () => {
    expect(normalizePreferences({ planningMarginPercent: 90 }).planningMarginPercent).toBe(50);
    expect(normalizePreferences({ planningMarginPercent: -5 }).planningMarginPercent).toBe(20);
  });

  it("une préférence d'avant ce chantier reçoit la capacité par défaut sans rien perdre d'autre", () => {
    const legacy = normalizePreferences({ displayName: "Taekd", dailyGoalMinutes: 90 });
    expect(legacy.displayName).toBe("Taekd");
    expect(legacy.dailyGoalMinutes).toBe(90);
    expect(legacy.capacityByWeekday).toHaveLength(7);
    expect(legacy.planningMarginPercent).toBe(20);
  });
});
