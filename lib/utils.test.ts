import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutesSpan, formatSpan } from "./utils";

/**
 * `formatSpan` est un format de LECTURE, pas un calcul : ces tests figent
 * exactement ce qui s'affiche, parce que c'est la forme elle-même qui était
 * le défaut (voir la note de `formatSpan`, lib/utils.ts).
 */
describe("formatSpan — une durée écoulée", () => {
  it("compose les minutes sans secondes", () => {
    expect(formatSpan(45 * 60)).toBe("45 min");
    expect(formatSpan(60)).toBe("1 min");
  });

  it("ne produit jamais de `m:ss`, qui se lit comme une heure", () => {
    expect(formatSpan(30 * 60)).not.toContain(":");
    expect(formatSpan(3600 + 5 * 60)).not.toContain(":");
  });

  it("garde la même forme de part et d'autre de l'heure", () => {
    expect(formatSpan(55 * 60)).toBe("55 min");
    expect(formatSpan(65 * 60)).toBe("1 h 05");
  });

  it("n'écrit pas de minutes postiches sur une heure ronde", () => {
    expect(formatSpan(2 * 3600)).toBe("2 h");
  });

  it("distingue « rien » de « presque rien »", () => {
    expect(formatSpan(0)).toBe("0 min");
    expect(formatSpan(20)).toBe("< 1 min");
  });

  it("ne descend jamais sous zéro", () => {
    expect(formatSpan(-120)).toBe("0 min");
  });

  it("accepte des minutes en entrée", () => {
    expect(formatMinutesSpan(7936)).toBe("132 h 16");
  });
});

describe("formatDuration reste le CHRONOMÈTRE", () => {
  /** Le compteur qui tourne garde ses secondes — c'est son seul usage restant. */
  it("compose `m:ss` sous l'heure", () => {
    expect(formatDuration(95)).toBe("1:35");
  });
});
