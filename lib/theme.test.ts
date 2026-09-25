import { describe, expect, it } from "vitest";
import {
  accentForeground,
  applyPalette,
  applyThemeMode,
  contrastRatio,
  DEFAULT_PALETTE,
  DEFAULT_THEME_MODE,
  hexToRgb,
  PALETTES,
  paletteById,
  paletteVariables,
  relativeLuminance,
  resolvePaletteId,
} from "@/lib/theme";

/**
 * Refonte « Revolut clair » — palettes en dégradé et mode d'apparence.
 *
 * `applyThemeMode` / `applyPalette` acceptent un `root` injectable : un
 * simple objet imitant les méthodes utilisées suffit, pas besoin
 * d'environnement DOM (voir vitest.config.ts).
 */
function makeFakeRoot() {
  const attributes = new Map<string, string>();
  const styles = new Map<string, string>();
  return {
    element: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      style: { setProperty: (name: string, value: string) => styles.set(name, value) },
    } as unknown as HTMLElement,
    attributes,
    styles,
  };
}

const rgb = (hex: string) => hexToRgb(hex) as [number, number, number];
const WHITE: [number, number, number] = [255, 255, 255];
/** Le fond clair de l'application (#f5f6fa, app/globals.css). */
const CANVAS: [number, number, number] = [245, 246, 250];

describe("applyThemeMode", () => {
  it("le clair est le défaut du produit", () => {
    expect(DEFAULT_THEME_MODE).toBe("light");
  });

  it("pose data-theme tel quel, y compris \"system\"", () => {
    const { element, attributes } = makeFakeRoot();
    for (const mode of ["light", "dark", "system"] as const) {
      applyThemeMode(mode, element);
      expect(attributes.get("data-theme")).toBe(mode);
    }
  });
});

describe("palettes — les valeurs de la maquette validée", () => {
  it("quatre palettes, Aurora par défaut, avec les couleurs de la maquette", () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual(["aurora", "sunset", "ocean", "neon"]);
    expect(DEFAULT_PALETTE).toBe("aurora");
    const aurora = paletteById("aurora");
    expect([aurora.c1, aurora.c2, aurora.ink]).toEqual(["#7c5cff", "#22d3ee", "#5b3fd6"]);
    expect(aurora.review).toEqual(["#f97316", "#ec4899"]);
  });

  it("chaque palette a quatre paires de cartes et trois pastilles d'échéance, en hex valides", () => {
    for (const palette of PALETTES) {
      expect(palette.cards).toHaveLength(4);
      expect(palette.dl).toHaveLength(3);
      const all = [palette.c1, palette.c2, palette.ink, ...palette.solid, ...palette.cards.flat(), ...palette.review, ...palette.dl];
      for (const hex of all) expect(hexToRgb(hex), `${palette.id} ${hex}`).not.toBeNull();
    }
  });

  it("un identifiant inconnu retombe sur Aurora", () => {
    expect(paletteById("arc-en-ciel").id).toBe("aurora");
    expect(paletteById(undefined).id).toBe("aurora");
  });
});

describe("contraste — la couleur ne sacrifie jamais la lecture", () => {
  it("l'encre de chaque palette tient 4,5:1 sur le fond clair et sur une carte blanche", () => {
    for (const palette of PALETTES) {
      expect(contrastRatio(rgb(palette.ink), CANVAS), `${palette.id} sur le fond`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(rgb(palette.ink), WHITE), `${palette.id} sur blanc`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le blanc tient 4,5:1 sur les deux teintes du dégradé des boutons à texte", () => {
    for (const palette of PALETTES) {
      for (const hex of palette.solid) {
        const ratio = contrastRatio(rgb(hex), WHITE);
        expect(ratio, `${palette.id} ${hex} : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("le texte posé sur l'aplat brut est le plus lisible du noir et du blanc", () => {
    for (let value = 0; value <= 255; value += 5) {
      const hex = `#${value.toString(16).padStart(2, "0").repeat(3)}`;
      const grey = [value, value, value] as [number, number, number];
      const chosen = accentForeground(hex);
      const other: [number, number, number] = chosen[0] === 0 ? WHITE : [0, 0, 0];
      expect(contrastRatio(grey, chosen), `gris ${value}`).toBeGreaterThanOrEqual(contrastRatio(grey, other));
    }
  });

  it("relativeLuminance : blanc plus lumineux que noir", () => {
    expect(relativeLuminance(WHITE)).toBeGreaterThan(relativeLuminance([0, 0, 0]));
  });
});

describe("variables CSS d'une palette", () => {
  it("expose le dégradé, l'encre, les cartes cyclées et les dégradés de révision", () => {
    const vars = paletteVariables(paletteById("aurora"));
    expect(vars["--g1"]).toBe("#7c5cff");
    expect(vars["--g2"]).toBe("#22d3ee");
    expect(vars["--g1-rgb"]).toBe("124 92 255");
    expect(vars["--accent-ink-base-rgb"]).toBe("91 63 214");
    expect(vars["--card-grad-1"]).toBe("linear-gradient(135deg, #6d28d9, #2563eb)");
    expect(vars["--card-grad-4"]).toBe("linear-gradient(135deg, #9333ea, #ec4899)");
    expect(vars["--review-grad"]).toBe("linear-gradient(135deg, #f97316, #ec4899)");
    expect(vars["--dl-3"]).toBe("#0891b2");
  });

  it("toutes les palettes publient exactement les mêmes noms de variables", () => {
    const names = Object.keys(paletteVariables(PALETTES[0])).sort();
    for (const palette of PALETTES) expect(Object.keys(paletteVariables(palette)).sort()).toEqual(names);
  });

  it("applyPalette écrit les variables et marque la palette sur la racine", () => {
    const { element, attributes, styles } = makeFakeRoot();
    applyPalette("sunset", element);
    expect(styles.get("--g1")).toBe("#fb7185");
    expect(styles.get("--accent-ink-base-rgb")).toBe(hexToRgb("#cc344d")?.join(" "));
    expect(attributes.get("data-palette")).toBe("sunset");
  });
});

describe("resolvePaletteId — autonome, recopiée dans le script anti-flash", () => {
  it("fonctionne une fois sérialisée puis réévaluée hors module (comme dans app/layout.tsx)", () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const revived = new Function(`return (${resolvePaletteId.toString()})`)() as typeof resolvePaletteId;
    expect(revived({ palette: "neon" })).toBe("neon");
    expect(revived({ accent: "#ff375f" })).toBe("sunset");
    expect(revived({ accent: "#0a84ff", subjectPalette: "ocean" })).toBe("ocean");
    expect(revived(null)).toBe("aurora");
  });
});
