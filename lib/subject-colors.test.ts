import { describe, expect, it } from "vitest";
import { subjects } from "@/lib/study";
import {
  applySubjectColors,
  DEFAULT_SUBJECT_PALETTE,
  isSubjectPaletteId,
  normalizeSubjectColorOverrides,
  resolveSubjectColors,
  SUBJECT_KEYS,
  SUBJECT_PALETTES,
  subjectColorVariables,
  subjectFill,
} from "@/lib/subject-colors";
import { hexToRgb, relativeLuminance } from "@/lib/theme";

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function parse(value: string): [number, number, number] {
  return value.split(" ").map(Number) as [number, number, number];
}

/** Pastille du thème clair : la teinte brute à 18 % posée sur le fond de page (#f4f5f7) — le pire cas mesuré. */
function tintedChip(raw: [number, number, number]): [number, number, number] {
  const ground: [number, number, number] = [244, 245, 247];
  return ground.map((channel, index) => Math.round(channel * 0.82 + raw[index] * 0.18)) as [number, number, number];
}

describe("palettes de matières", () => {
  it("chaque palette couvre les sept matières avec un hex valide", () => {
    for (const palette of SUBJECT_PALETTES) {
      for (const subject of subjects) {
        expect(hexToRgb(palette.colors[subject]), `${palette.label} / ${subject}`).not.toBeNull();
      }
    }
  });

  it("la palette par défaut est Néon, avec les teintes validées", () => {
    expect(DEFAULT_SUBJECT_PALETTE).toBe("neon");
    const colors = resolveSubjectColors("neon");
    expect(colors.Mathématiques).toBe("#a78bfa");
    expect(colors.Anglais).toBe("#f472b6");
  });

  it("aucune palette ne répète une teinte", () => {
    for (const palette of SUBJECT_PALETTES) {
      const values = Object.values(palette.colors).map((hex) => hex.toLowerCase());
      expect(new Set(values).size, palette.label).toBe(values.length);
    }
  });

  it("les clés de variables sont uniques et sans caractère exotique", () => {
    const keys = Object.values(SUBJECT_KEYS);
    expect(new Set(keys).size).toBe(subjects.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]+$/);
  });

  it("isSubjectPaletteId n'accepte que les palettes connues", () => {
    expect(isSubjectPaletteId("ocean")).toBe(true);
    expect(isSubjectPaletteId("fluo")).toBe(false);
    expect(isSubjectPaletteId(42)).toBe(false);
  });
});

describe("surcharges par matière", () => {
  it("une surcharge remplace la teinte de la palette, et seulement celle-là", () => {
    const colors = resolveSubjectColors("neon", { Chimie: "#FF0000" });
    expect(colors.Chimie).toBe("#ff0000");
    expect(colors.Physique).toBe("#38bdf8");
  });

  it("les valeurs invalides et les matières inconnues sont ignorées", () => {
    const clean = normalizeSubjectColorOverrides({ Chimie: "rouge", Physique: 12, Latin: "#123456", Anglais: "00ff00" });
    expect(clean).toEqual({ Anglais: "#00ff00" });
  });

  it("une entrée qui n'est pas un objet donne des surcharges vides", () => {
    expect(normalizeSubjectColorOverrides(null)).toEqual({});
    expect(normalizeSubjectColorOverrides("#fff")).toEqual({});
    expect(normalizeSubjectColorOverrides(["#ffffff"])).toEqual({});
  });
});

describe("variables CSS", () => {
  it("trois variables par matière, au format `r g b`", () => {
    const vars = subjectColorVariables("neon");
    expect(Object.keys(vars)).toHaveLength(subjects.length * 3);
    expect(vars["--subj-math-raw"]).toBe("167 139 250");
    for (const value of Object.values(vars)) expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });

  it("en thème clair, chaque trait tient 3:1 sur une carte blanche et chaque texte 4,5:1 sur sa pastille — pour toutes les palettes", () => {
    for (const palette of SUBJECT_PALETTES) {
      const vars = subjectColorVariables(palette.id);
      for (const subject of subjects) {
        const key = SUBJECT_KEYS[subject];
        const soft = parse(vars[`--subj-${key}-soft`]);
        const deep = parse(vars[`--subj-${key}-deep`]);
        const raw = parse(vars[`--subj-${key}-raw`]);
        expect(contrast(soft, [255, 255, 255]), `${palette.label} / ${subject} (trait)`).toBeGreaterThanOrEqual(3);
        expect(contrast(deep, tintedChip(raw)), `${palette.label} / ${subject} (texte)`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("une surcharge très claire est elle aussi ramenée sous les seuils", () => {
    const vars = subjectColorVariables("neon", { Chimie: "#ffffff" });
    expect(contrast(parse(vars["--subj-chim-deep"]), tintedChip([255, 255, 255]))).toBeGreaterThanOrEqual(4.5);
  });

  it("applySubjectColors écrit toutes les variables sur la racine fournie", () => {
    const written = new Map<string, string>();
    const root = { style: { setProperty: (name: string, value: string) => written.set(name, value) } } as unknown as HTMLElement;
    applySubjectColors("ocean", { Français: "#123456" }, root);
    expect(written.size).toBe(subjects.length * 3);
    expect(written.get("--subj-fr-raw")).toBe("18 52 86");
  });

  it("subjectFill référence la variable thème-aware", () => {
    expect(subjectFill("Physique")).toBe("rgb(var(--subj-phys))");
    expect(subjectFill("Physique", 0.2)).toBe("rgb(var(--subj-phys) / 0.2)");
  });
});
