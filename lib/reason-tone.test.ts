import { describe, expect, it } from "vitest";
import { classifyReason, REASON_TONE_META } from "@/lib/reason-tone";

/**
 * Micro-sprint « Ah ouais » — micro-amélioration « Pourquoi cet exercice ? ».
 * Vérifie uniquement la CLASSIFICATION (texte → tonalité visuelle), jamais
 * la génération des raisons elle-même (déjà couverte par
 * lib/recommendation.test.ts) — ne duplique aucun test métier.
 */
describe("classifyReason", () => {
  it("échecs récents/multiples : urgent", () => {
    expect(classifyReason("Échec récent")).toBe("urgent");
    expect(classifyReason("Plusieurs échecs")).toBe("urgent");
  });

  it("signaux à surveiller : attention", () => {
    expect(classifyReason("Maîtrise faible")).toBe("attention");
    expect(classifyReason("Marqué à revoir")).toBe("attention");
    expect(classifyReason("Priorité élevée")).toBe("attention");
  });

  it("signaux positifs : positive", () => {
    expect(classifyReason("Progrès récents")).toBe("positive");
    expect(classifyReason("Réussi récemment")).toBe("positive");
    expect(classifyReason("Favori")).toBe("positive");
  });

  it("signaux informatifs (jamais travaillé, en cours, maîtrisé jamais retravaillé) : neutral", () => {
    expect(classifyReason("Jamais travaillé")).toBe("neutral");
    expect(classifyReason("En cours")).toBe("neutral");
    expect(classifyReason("Maîtrisé, jamais retravaillé")).toBe("neutral");
  });

  it("raison dynamique (contient un nombre de jours variable) : neutral, sans planter", () => {
    expect(classifyReason("Non retravaillé depuis 6 j")).toBe("neutral");
    expect(classifyReason("Non retravaillé depuis 21 j")).toBe("neutral");
  });

  it("raison inconnue (évolution future du moteur) : repli neutral, jamais d'exception", () => {
    expect(classifyReason("Une raison qui n'existe pas encore")).toBe("neutral");
    expect(classifyReason("")).toBe("neutral");
  });

  it("REASON_TONE_META couvre bien les quatre tonalités avec une couleur distincte", () => {
    const dots = Object.values(REASON_TONE_META).map((meta) => meta.dot);
    expect(new Set(dots).size).toBe(4);
  });
});
