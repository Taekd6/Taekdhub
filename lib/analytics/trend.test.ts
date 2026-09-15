import { describe, expect, it } from "vitest";
import { computeTrend, describeConfidence, TREND_SOLID_SAMPLES, withSign } from "@/lib/analytics/trend";

/**
 * TESTS DE VÉRACITÉ — le cœur de ce module.
 *
 * Ils ne vérifient pas seulement que le calcul est juste : ils verrouillent
 * les cas où le produit doit REFUSER de conclure. C'est la propriété la plus
 * facile à perdre en ajoutant une métrique, et la plus coûteuse : un élève
 * qui découvre qu'une « tendance » reposait sur deux points cesse de croire
 * toutes les autres.
 */

describe("refuser de conclure", () => {
  it("aucune donnée : pas de tendance, et surtout pas « stable »", () => {
    const trend = computeTrend([]);
    expect(trend.direction).toBe("insuffisant");
    expect(trend.delta).toBeNull();
    expect(trend.samples).toBe(0);
  });

  it("une seule mesure : pas de tendance", () => {
    const trend = computeTrend([42]);
    expect(trend.direction).toBe("insuffisant");
    expect(trend.delta).toBeNull();
  });

  it("deux mesures : une variation descriptive, mais une confiance faible", () => {
    const trend = computeTrend([40, 60]);
    expect(trend.direction).toBe("hausse");
    expect(trend.delta).toBe(20);
    expect(trend.confidence).toBe("faible");
    expect(describeConfidence(trend)).toContain("2 mesures");
  });

  it("assez de mesures : la confiance monte, et la mise en garde disparaît", () => {
    const trend = computeTrend([10, 20, 30, 40, 50]);
    expect(trend.samples).toBeGreaterThanOrEqual(TREND_SOLID_SAMPLES);
    expect(trend.confidence).toBe("élevée");
    expect(describeConfidence(trend)).toBeNull();
  });

  it("une valeur ignorée (NaN, Infinity) ne compte pas comme une mesure", () => {
    expect(computeTrend([10, Number.NaN, Number.POSITIVE_INFINITY]).samples).toBe(1);
  });
});

describe("direction", () => {
  it("deux valeurs égales sont stables, pas en hausse", () => {
    expect(computeTrend([50, 50, 50, 50]).direction).toBe("stable");
  });

  it("un écart sous le seuil de bruit reste stable", () => {
    // 8 h 00 → 8 h 05 : +1 %, sous les 5 % de bruit.
    expect(computeTrend([480, 485, 480, 485]).direction).toBe("stable");
  });

  it("une progression franche est une hausse", () => {
    expect(computeTrend([120, 180, 240, 300]).direction).toBe("hausse");
  });

  it("une chute franche est une baisse", () => {
    expect(computeTrend([300, 240, 180, 60]).direction).toBe("baisse");
  });

  it("une dernière période creuse n'inverse pas à elle seule une progression réelle", () => {
    // La direction compare les MOITIÉS, pas le premier au dernier point :
    // une semaine de vacances en fin de série ne doit pas effacer un
    // trimestre de progression.
    const trend = computeTrend([60, 120, 180, 240, 300, 200]);
    expect(trend.direction).toBe("hausse");
    // …mais l'écart brut, lui, reste celui que l'élève peut recompter.
    expect(trend.delta).toBe(140);
  });
});

describe("écarts", () => {
  it("le delta est l'écart brut premier → dernier, celui que l'élève vérifie", () => {
    expect(computeTrend([100, 130]).delta).toBe(30);
  });

  it("le pourcentage n'est pas calculé quand la première valeur est nulle", () => {
    expect(computeTrend([0, 120]).deltaPercent).toBeNull();
  });

  it("un bruit absolu remplace le seuil relatif quand l'unité l'exige", () => {
    // Une note : passer de 12 à 12,3 n'est pas une progression.
    expect(computeTrend([12, 12.3, 12, 12.3], { absoluteNoise: 0.5 }).direction).toBe("stable");
    expect(computeTrend([12, 13, 14, 15], { absoluteNoise: 0.5 }).direction).toBe("hausse");
  });
});

describe("signe", () => {
  it("emploie le vrai moins typographique, pas un trait d'union", () => {
    expect(withSign(-3, " h")).toBe("−3 h");
    expect(withSign(2)).toBe("+2");
    expect(withSign(0, " pt")).toBe("±0 pt");
  });
});

describe("une série entièrement nulle est un état VIDE, pas une stabilité", () => {
  /**
   * RÉGRESSION TROUVÉE AU PREMIER TEST, et c'est exactement le mode d'échec
   * que ce chantier doit interdire : un compte vierge produisait six points
   * à zéro, donc un écart nul, donc « stable » — avec une confiance
   * « élevée ». L'application aurait affirmé à quelqu'un qui n'a jamais
   * travaillé que son rythme était constant et la mesure fiable.
   */
  it("six semaines sans la moindre séance ne font pas un rythme stable", () => {
    const trend = computeTrend([0, 0, 0, 0, 0, 0]);
    expect(trend.direction).toBe("insuffisant");
    expect(trend.confidence).toBe("faible");
    expect(trend.delta).toBeNull();
  });

  it("mais une seule valeur non nulle suffit à redonner du sens à la série", () => {
    expect(computeTrend([0, 0, 0, 120]).direction).not.toBe("insuffisant");
  });

  it("et la mise en garde affichée est bien celle d'un manque de données", () => {
    expect(describeConfidence(computeTrend([0, 0, 0]))).toBe("Pas encore de données.");
  });
});
