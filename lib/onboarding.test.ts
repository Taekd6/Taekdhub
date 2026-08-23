import { describe, expect, it } from "vitest";
import { ONBOARDING_TIME_CHOICES, ONBOARDING_TRACK_CHOICES, onboardingReadyMessage } from "@/lib/onboarding";

/**
 * Micro-sprint « Ah ouais » — onboarding, partie pure uniquement (voir la
 * doc du module). Le comportement React (fermeture/skip, détection du
 * premier lancement, sauvegarde réelle) est vérifié manuellement — voir le
 * rapport final — conformément à la convention du dépôt (pas de composants
 * testés via vitest, environnement node sans DOM).
 */
describe("ONBOARDING_TIME_CHOICES", () => {
  it("quatre choix, alignés sur les ordres de grandeur déjà utilisés ailleurs (dailyGoalMinutes)", () => {
    expect(ONBOARDING_TIME_CHOICES).toEqual([
      { label: "1 h", minutes: 60 },
      { label: "2 h", minutes: 120 },
      { label: "3 h", minutes: 180 },
      { label: "4 h+", minutes: 240 },
    ]);
  });

  it("chaque choix a une durée strictement positive et croissante", () => {
    for (let i = 1; i < ONBOARDING_TIME_CHOICES.length; i++) {
      expect(ONBOARDING_TIME_CHOICES[i].minutes).toBeGreaterThan(ONBOARDING_TIME_CHOICES[i - 1].minutes);
    }
  });
});

describe("ONBOARDING_TRACK_CHOICES", () => {
  it("MPSI → MP, PCSI → PC, Autre", () => {
    expect(ONBOARDING_TRACK_CHOICES.map((choice) => choice.value)).toEqual(["MP", "PC", "autre"]);
  });
});

describe("onboardingReadyMessage", () => {
  it("mentionne la filière quand MP ou PC a été choisi", () => {
    expect(onboardingReadyMessage("MP")).toBe("Parfait. Ton espace de prépa MP est prêt.");
    expect(onboardingReadyMessage("PC")).toBe("Parfait. Ton espace de prépa PC est prêt.");
  });

  it("reste générique pour \"autre\" ou aucune sélection (rien d'informatif à ajouter)", () => {
    expect(onboardingReadyMessage("autre")).toBe("Parfait. Ton espace est prêt.");
    expect(onboardingReadyMessage(null)).toBe("Parfait. Ton espace est prêt.");
  });
});
