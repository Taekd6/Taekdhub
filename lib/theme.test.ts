import { describe, expect, it } from "vitest";
import { accentForeground, accentInk, ACCENT_PRESETS, applyThemeMode, hexToRgb, relativeLuminance } from "@/lib/theme";

/**
 * Sprint personnalisation (Phase 11) — couvre le mode d'apparence
 * (clair/sombre/système) et confirme que le calcul de contraste de l'accent,
 * déjà existant, reste correct (utilisé aussi bien en thème clair qu'en
 * thème sombre — voir app/globals.css).
 *
 * `applyThemeMode` accepte un `root` injectable : un simple objet imitant les
 * deux méthodes utilisées (`setAttribute`/`removeAttribute`) suffit, pas
 * besoin d'environnement DOM (voir vitest.config.ts).
 */
function makeFakeRoot() {
  const attributes = new Map<string, string>();
  return {
    element: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    } as unknown as HTMLElement,
    attributes,
  };
}

describe("applyThemeMode", () => {
  it("pose data-theme=\"light\" pour le mode clair", () => {
    const { element, attributes } = makeFakeRoot();
    applyThemeMode("light", element);
    expect(attributes.get("data-theme")).toBe("light");
  });

  it("pose data-theme=\"dark\" pour le mode sombre", () => {
    const { element, attributes } = makeFakeRoot();
    applyThemeMode("dark", element);
    expect(attributes.get("data-theme")).toBe("dark");
  });

  it("écrit data-theme=\"system\" pour le mode système — le défaut sans attribut est désormais le sombre (app/globals.css)", () => {
    const { element, attributes } = makeFakeRoot();
    applyThemeMode("dark", element);
    applyThemeMode("system", element);
    expect(attributes.get("data-theme")).toBe("system");
  });
});

describe("accent — contraste, réutilisé en clair comme en sombre", () => {
  it("choisit du texte noir sur un accent clair (lime par défaut)", () => {
    const [r, g, b] = accentForeground("#d4f36b");
    expect([r, g, b]).toEqual([0, 0, 0]);
  });

  it("choisit du texte blanc sur un accent sombre", () => {
    const [r, g, b] = accentForeground("#1a1a2e");
    expect([r, g, b]).toEqual([255, 255, 255]);
  });

  it("hexToRgb rejette un format invalide sans planter", () => {
    expect(hexToRgb("pas-une-couleur")).toBeNull();
  });

  it("relativeLuminance : blanc plus lumineux que noir", () => {
    expect(relativeLuminance([255, 255, 255])).toBeGreaterThan(relativeLuminance([0, 0, 0]));
  });
});

describe("texte posé sur l'accent — noir ou blanc, le plus lisible des deux", () => {
  /**
   * Régression : le seuil valait 0,45, choisi à vue. Une couleur de luminance
   * 0,44 (le nouveau préréglage « Miel ») recevait du texte BLANC — 2,13:1,
   * illisible — là où le noir donne 9,84:1. Le défaut ne pouvait pas se voir
   * tant que tous les préréglages étaient des pastels très clairs.
   */
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: [number, number, number], b: [number, number, number]) => {
    const [high, low] = [Math.max(luminance(a), luminance(b)), Math.min(luminance(a), luminance(b))];
    return (high + 0.05) / (low + 0.05);
  };

  it("chaque préréglage atteint au moins 4,5:1 avec son texte", () => {
    for (const preset of ACCENT_PRESETS) {
      const rgb = hexToRgb(preset.hex) as [number, number, number];
      const ratio = contrast(rgb, accentForeground(preset.hex));
      expect(ratio, `${preset.label} (${preset.hex}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le choix est toujours le meilleur des deux, sur toute l'échelle", () => {
    // Un balayage de gris couvre la zone où le seuil se trompait.
    for (let value = 0; value <= 255; value += 5) {
      const hex = `#${value.toString(16).padStart(2, "0").repeat(3)}`;
      const rgb = [value, value, value] as [number, number, number];
      const chosen = accentForeground(hex);
      const other: [number, number, number] = chosen[0] === 0 ? [255, 255, 255] : [0, 0, 0];
      expect(contrast(rgb, chosen), `gris ${value}`).toBeGreaterThanOrEqual(contrast(rgb, other));
    }
  });
});

describe("l'encre d'accent tient le contraste AA sur la surface la plus sombre du thème clair", () => {
  /**
   * Le plafond de luminance existe précisément pour ça ; il avait été calibré
   * sur un canvas (#f4f5f7) que la palette n'utilise plus, et ne tenait donc
   * plus sa promesse — 4,22:1 mesuré au navigateur sur le badge « Important »
   * et sur l'option retenue du sélecteur de thème.
   */
  const DARKEST_LIGHT_SURFACE: [number, number, number] = [241, 237, 228];

  function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
    const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  }

  it("chaque accent proposé passe 4,5:1, pas seulement celui par défaut", () => {
    for (const preset of ACCENT_PRESETS) {
      const ratio = contrastRatio(accentInk(preset.hex), DARKEST_LIGHT_SURFACE);
      expect(ratio, `${preset.label} (${preset.hex}) : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("un accent saisi à la main, même très clair, est ramené sous le seuil", () => {
    expect(contrastRatio(accentInk("#ffff00"), DARKEST_LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accentInk("#ffffff"), DARKEST_LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("une teinte déjà assez sombre n'est pas assombrie inutilement", () => {
    expect(accentInk("#402d10")).toEqual(hexToRgb("#402d10"));
  });
});
