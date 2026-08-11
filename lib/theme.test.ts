import { describe, expect, it } from "vitest";
import { accentForeground, applyThemeMode, hexToRgb, relativeLuminance } from "@/lib/theme";

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

  it("retire l'attribut pour le mode système — laisse prefers-color-scheme décider (app/globals.css)", () => {
    const { element, attributes } = makeFakeRoot();
    applyThemeMode("dark", element);
    expect(attributes.has("data-theme")).toBe(true);
    applyThemeMode("system", element);
    expect(attributes.has("data-theme")).toBe(false);
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
