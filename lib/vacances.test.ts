import { describe, expect, it } from "vitest";
import { offPeriodOf, withoutSchoolOnOffDays } from "./vacances";

describe("vacances", () => {
  it("reconnaît les vacances de la Toussaint, bornes incluses", () => {
    expect(offPeriodOf("2026-10-18")?.label).toBe("Vacances de la Toussaint");
    expect(offPeriodOf("2026-11-01")?.label).toBe("Vacances de la Toussaint");
    expect(offPeriodOf("2026-11-02")).toBeNull();
  });
  it("retire les cours pendant les vacances, garde le perso, la rentrée, le soir et le dimanche", () => {
    const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m - 1, d, h, min).toISOString();
    const events = [
      { start: at(10, 28, 8), kind: "cours" },
      { start: at(10, 31, 13), kind: "ds" },
      { start: at(10, 29, 18), kind: "perso" },
      { start: at(11, 2, 13, 15), kind: "ds" },
      { start: at(10, 28, 19), kind: "cours" },
      { start: at(11, 1, 13), kind: "cours" },
    ];
    expect(withoutSchoolOnOffDays(events)).toEqual([events[2], events[3], events[4], events[5]]);
  });
});
