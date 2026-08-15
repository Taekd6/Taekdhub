import { describe, expect, it } from "vitest";
import { CONFIRM_EXIT_THRESHOLD_SECONDS, shouldConfirmExit } from "@/lib/focus-exit";

describe("shouldConfirmExit", () => {
  it("séance courte et en cours : pas de confirmation", () => {
    expect(shouldConfirmExit(30, true)).toBe(false);
  });

  it("séance significative et en cours : confirmation demandée", () => {
    expect(shouldConfirmExit(CONFIRM_EXIT_THRESHOLD_SECONDS, true)).toBe(true);
    expect(shouldConfirmExit(CONFIRM_EXIT_THRESHOLD_SECONDS + 60, true)).toBe(true);
  });

  it("pile au seuil : confirmation (seuil inclusif)", () => {
    expect(shouldConfirmExit(CONFIRM_EXIT_THRESHOLD_SECONDS, true)).toBe(true);
    expect(shouldConfirmExit(CONFIRM_EXIT_THRESHOLD_SECONDS - 1, true)).toBe(false);
  });

  it("déjà en pause : jamais de confirmation, quel que soit le temps accumulé", () => {
    expect(shouldConfirmExit(10_000, false)).toBe(false);
  });
});
