import { describe, expect, it } from "vitest";
import {
  checkinForDay,
  clampSleep,
  computeCheckinAverages,
  computeSleepWorkRelation,
  computeSleepWorkSeries,
  describeSleepWorkRelation,
  formatSleep,
  shouldPromptCheckin,
  SLEEP_RELATION_MIN_DAYS,
  upsertCheckin,
} from "@/lib/checkin-insights";
import { dayKey } from "@/lib/study";
import type { DailyCheckin } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/** Toutes les dates sont construites en heure LOCALE : `dayKey` raisonne en jours locaux, comme l'élève. */
const NOW = new Date(2026, 8, 23, 21, 0);

function daysAgo(offset: number, hour = 12): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - offset, hour);
}

function checkin(offset: number, sleepHours: number, overrides: Partial<DailyCheckin> = {}): DailyCheckin {
  return { date: dayKey(daysAgo(offset)), sleepHours, energy: 3, stress: 3, note: null, updatedAt: daysAgo(offset, 21).toISOString(), ...overrides };
}

function session(offset: number, minutes: number): WorkSession {
  const started = daysAgo(offset, 10).toISOString();
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: null,
    started_at: started,
    ended_at: started,
    duration_seconds: minutes * 60,
    note: null,
    created_at: started,
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

describe("saisie — un check-in par jour, corrigeable", () => {
  it("refaire le check-in le même soir CORRIGE celui du jour, sans doublon", () => {
    const first = upsertCheckin([], { sleepHours: 6, energy: 2, stress: 4 }, NOW);
    const second = upsertCheckin(first, { sleepHours: 7.5, energy: 4, stress: 2, note: "  DS demain  " }, NOW);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ sleepHours: 7.5, energy: 4, stress: 2, note: "DS demain" });
  });

  it("borne le sommeil à [4 ; 10] par pas d'une demi-heure, et les échelles à [1 ; 5]", () => {
    expect(clampSleep(12)).toBe(10);
    expect(clampSleep(2)).toBe(4);
    expect(clampSleep(6.8)).toBe(7);
    const [entry] = upsertCheckin([], { sleepHours: 7, energy: 9, stress: -2 }, NOW);
    expect(entry.energy).toBe(5);
    expect(entry.stress).toBe(1);
  });

  it("garde les autres jours et trie par date", () => {
    const list = upsertCheckin([checkin(2, 7), checkin(1, 6)], { sleepHours: 8, energy: 3, stress: 3 }, NOW);
    expect(list.map((item) => item.date)).toEqual([dayKey(daysAgo(2)), dayKey(daysAgo(1)), dayKey(NOW)]);
    expect(checkinForDay(list, dayKey(NOW))?.sleepHours).toBe(8);
  });
});

describe("invitation du Dashboard", () => {
  it("seulement le soir, et seulement si le check-in du jour n'est pas fait", () => {
    expect(shouldPromptCheckin([], new Date(2026, 8, 23, 16, 59))).toBe(false);
    expect(shouldPromptCheckin([], new Date(2026, 8, 23, 17, 0))).toBe(true);
    expect(shouldPromptCheckin([checkin(0, 7)], NOW)).toBe(false);
  });
});

describe("moyennes 7 / 30 jours", () => {
  it("ignore les jours sans check-in — jamais une nuit de zéro heure", () => {
    const averages = computeCheckinAverages([checkin(0, 8), checkin(3, 6), checkin(20, 5)], 7, NOW);
    expect(averages.count).toBe(2);
    expect(averages.sleepHours).toBe(7);
    expect(computeCheckinAverages([checkin(0, 8), checkin(3, 6), checkin(20, 5)], 30, NOW).count).toBe(3);
  });

  it("fenêtre vide : aucune moyenne", () => {
    expect(computeCheckinAverages([], 7, NOW)).toMatchObject({ count: 0, sleepHours: null, energy: null, stress: null });
  });
});

describe("sommeil et temps travaillé — une observation, pas une cause", () => {
  it("apparie le sommeil saisi le soir de J aux minutes travaillées pendant J, et exclut aujourd'hui", () => {
    const series = computeSleepWorkSeries([checkin(1, 8), checkin(0, 6)], [session(1, 90), session(0, 30)], 2, NOW);
    expect(series).toEqual([
      { date: dayKey(daysAgo(1)), sleepHours: 8, minutes: 90 },
      { date: dayKey(NOW), sleepHours: 6, minutes: null },
    ]);
  });

  it("les jours antérieurs à la première séance ne comptent pas comme zéro minute", () => {
    const series = computeSleepWorkSeries([checkin(3, 8)], [session(1, 60)], 4, NOW);
    expect(series[0]).toMatchObject({ sleepHours: 8, minutes: null });
  });

  function history(days: number): { checkins: DailyCheckin[]; sessions: WorkSession[] } {
    const checkins: DailyCheckin[] = [];
    const sessions: WorkSession[] = [];
    for (let offset = 1; offset <= days; offset += 1) {
      const long = offset % 2 === 0;
      checkins.push(checkin(offset, long ? 8 : 6));
      sessions.push(session(offset, long ? 150 : 110));
    }
    return { checkins, sessions };
  }

  it(`ne se prononce pas sous ${SLEEP_RELATION_MIN_DAYS} jours appariés`, () => {
    const { checkins, sessions } = history(SLEEP_RELATION_MIN_DAYS - 1);
    const relation = computeSleepWorkRelation(checkins, sessions, NOW);
    expect(relation.pairedDays).toBe(SLEEP_RELATION_MIN_DAYS - 1);
    expect(relation.sufficient).toBe(false);
    expect(relation.gapMinutes).toBeNull();
    expect(describeSleepWorkRelation(relation)).toBeNull();
  });

  it("à partir de 14 jours, décrit l'écart observé en minutes, sans mot de cause", () => {
    const { checkins, sessions } = history(20);
    const relation = computeSleepWorkRelation(checkins, sessions, NOW);
    expect(relation.sufficient).toBe(true);
    expect(relation.gapMinutes).toBe(40);
    expect(relation.correlation).toBe(1);
    const sentence = describeSleepWorkRelation(relation);
    expect(sentence).toBe("Les jours après ≥ 7 h de sommeil, tu as travaillé en moyenne 40 min de plus que les jours après une nuit plus courte.");
    expect(sentence).not.toMatch(/grâce|parce|cause|fait travailler|améliore/);
  });

  it("ne compare pas quand l'un des deux groupes est presque vide", () => {
    const checkins = Array.from({ length: 20 }, (_, index) => checkin(index + 1, index < 18 ? 8 : 6));
    const sessions = Array.from({ length: 20 }, (_, index) => session(index + 1, 60));
    expect(computeSleepWorkRelation(checkins, sessions, NOW).sufficient).toBe(false);
  });

  it("un écart négligeable se dit « à peu près autant »", () => {
    const checkins = Array.from({ length: 16 }, (_, index) => checkin(index + 1, index % 2 ? 8 : 6));
    const sessions = Array.from({ length: 16 }, (_, index) => session(index + 1, index % 2 ? 62 : 60));
    expect(describeSleepWorkRelation(computeSleepWorkRelation(checkins, sessions, NOW))).toMatch(/à peu près autant/);
  });
});

describe("formatage", () => {
  it("écrit une durée, pas un décimal", () => {
    expect(formatSleep(7)).toBe("7 h");
    expect(formatSleep(6.5)).toBe("6 h 30");
  });
});
