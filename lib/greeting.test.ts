import { describe, expect, it } from "vitest";
import { timeOfDayGreetingWord } from "@/lib/greeting";

/**
 * Micro-sprint « Ah ouais » — contexte temporel léger. Utilise le
 * constructeur `Date` par composants (année, mois, jour, heure…) plutôt
 * qu'une chaîne ISO : interprété en heure locale quel que soit le fuseau du
 * runner, donc déterministe.
 */
describe("timeOfDayGreetingWord", () => {
  it("matin (avant midi) : Bonjour", () => {
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 8, 0, 0))).toBe("Bonjour");
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 11, 59, 0))).toBe("Bonjour");
  });

  it("après-midi (midi à 18h exclu) : Bon après-midi", () => {
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 12, 0, 0))).toBe("Bon après-midi");
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 17, 59, 0))).toBe("Bon après-midi");
  });

  it("soir (18h et après) : Bonsoir", () => {
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 18, 0, 0))).toBe("Bonsoir");
    expect(timeOfDayGreetingWord(new Date(2026, 7, 15, 23, 30, 0))).toBe("Bonsoir");
  });
});
