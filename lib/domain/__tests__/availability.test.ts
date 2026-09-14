import { describe, expect, it } from "vitest";
import {
  capacityMinutes,
  freeSlotsForDay,
  normalizeRanges,
  rangesForDay,
  slotsForDay,
  weeklyCapacityMinutes,
} from "@/lib/domain/availability";
import { dayKey } from "@/lib/domain/date";
import { at, makeState, NOW, slot } from "./fixtures";

describe("plages horaires", () => {
  it("fusionne les plages qui se chevauchent au lieu de compter deux fois le même temps", () => {
    expect(normalizeRanges([{ start: "18:00", end: "20:00" }, { start: "19:00", end: "22:00" }])).toEqual([
      { start: "18:00", end: "22:00" },
    ]);
  });

  it("rejette une plage dont la fin précède le début", () => {
    expect(normalizeRanges([{ start: "20:00", end: "18:00" }])).toEqual([]);
  });

  it("ordonne les plages désordonnées", () => {
    expect(normalizeRanges([{ start: "20:00", end: "22:00" }, { start: "10:00", end: "12:00" }])[0].start).toBe("10:00");
  });
});

describe("capacité", () => {
  const state = makeState();

  it("mesure la capacité d'un jour à partir du rythme hebdomadaire", () => {
    // NOW est un lundi : 18:00 → 22:00 dans le rythme par défaut.
    expect(capacityMinutes(state.availability, NOW)).toBe(240);
  });

  it("une exception REMPLACE le rythme du jour, elle ne s'y ajoute pas", () => {
    const key = dayKey(NOW);
    const withException = makeState({
      availability: { ...state.availability, exceptions: [{ date: key, ranges: [{ start: "20:00", end: "21:00" }] }] },
    });
    expect(capacityMinutes(withException.availability, key)).toBe(60);
  });

  it("une exception sans plage exprime une journée à zéro — ce qu'une addition ne saurait pas dire", () => {
    const key = dayKey(NOW);
    const off = makeState({ availability: { ...state.availability, exceptions: [{ date: key, ranges: [], label: "Férié" }] } });
    expect(capacityMinutes(off.availability, key)).toBe(0);
    expect(rangesForDay(off.availability, key)).toEqual([]);
  });

  it("somme la capacité hebdomadaire ordinaire", () => {
    // 4 h + 3 h + 5 h + 4 h + 2 h + 6 h 30 + 6 h 30 = 31 h.
    expect(weeklyCapacityMinutes(state.availability)).toBe(31 * 60);
  });
});

describe("créneaux libres", () => {
  const state = makeState();
  const today = dayKey(NOW);

  it("retire ce qui est déjà posé", () => {
    const free = freeSlotsForDay(state.availability, today, [slot(0, "19:00", 60)]);
    expect(free.map((item) => item.minutes)).toEqual([60, 120]);
  });

  it("ne propose jamais un créneau déjà écoulé", () => {
    const evening = new Date(NOW);
    evening.setHours(20, 0, 0, 0);
    const free = freeSlotsForDay(state.availability, today, [], evening);
    expect(free).toHaveLength(1);
    expect(free[0].minutes).toBe(120);
    expect(free[0].start.getTime()).toBe(evening.getTime());
  });

  it("ignore les miettes de moins de 10 minutes", () => {
    const free = freeSlotsForDay(state.availability, today, [slot(0, "18:05", 235)]);
    expect(free).toEqual([]);
  });

  it("gère plusieurs plages dans la même journée", () => {
    // Samedi : 10:00-12:30 puis 14:00-18:00.
    const saturday = dayKey(new Date(at(5)));
    expect(slotsForDay(state.availability, saturday)).toHaveLength(2);
    expect(freeSlotsForDay(state.availability, saturday, []).reduce((sum, item) => sum + item.minutes, 0)).toBe(390);
  });
});
