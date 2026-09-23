import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { subjects, subjectMeta } from "@/lib/study";
import { SUBJECT_KEYS, subjectFill } from "@/lib/subject-colors";

/**
 * Refonte « Apple » : les matières n'ont plus de couleur, seulement un palier
 * de gris (app/globals.css). Ces tests gardent les deux promesses qui
 * restent : chaque matière a sa variable, et aucune teinte ne revient par la
 * bande.
 */
const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");

function grayOf(key: string, block: string): number[] {
  const match = new RegExp(`--subj-${key}:\\s*(\\d+) (\\d+) (\\d+);`).exec(block);
  expect(match, `--subj-${key} manquant`).not.toBeNull();
  return (match as RegExpExecArray).slice(1, 4).map(Number);
}

describe("clés de matière", () => {
  it("les clés sont uniques et sans caractère exotique", () => {
    const keys = Object.values(SUBJECT_KEYS);
    expect(new Set(keys).size).toBe(subjects.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]+$/);
  });

  it("subjectFill référence la variable thème-aware", () => {
    expect(subjectFill("Physique")).toBe("rgb(var(--subj-phys))");
    expect(subjectFill("Physique", 0.2)).toBe("rgb(var(--subj-phys) / 0.2)");
  });
});

describe("paliers de gris (app/globals.css)", () => {
  const dark = css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="light"]'));
  const light = css.slice(css.indexOf(':root[data-theme="light"]'), css.indexOf("@media (prefers-color-scheme: light)"));

  it("chaque matière a un palier dans les deux thèmes, et c'est un GRIS (r = g ≈ b)", () => {
    for (const block of [dark, light]) {
      for (const key of Object.values(SUBJECT_KEYS)) {
        const [r, g, b] = grayOf(key, block);
        expect(r).toBe(g);
        expect(Math.abs(b - r)).toBeLessThanOrEqual(4);
      }
    }
  });

  it("les paliers sont tous distincts et régulièrement espacés (≥ 18 niveaux entre voisins)", () => {
    for (const block of [dark, light]) {
      const levels = subjects.map((subject) => grayOf(SUBJECT_KEYS[subject], block)[0]);
      for (let index = 1; index < levels.length; index++) {
        expect(Math.abs(levels[index] - levels[index - 1])).toBeGreaterThanOrEqual(18);
      }
    }
  });
});

describe("subjectMeta — pastilles neutres", () => {
  it("aucune pastille de matière ne référence une teinte", () => {
    for (const subject of subjects) {
      const meta = subjectMeta[subject];
      expect(`${meta.className} ${meta.ink}`).not.toMatch(/violet|sky|teal|orange|amber|rose|emerald|accent/);
      expect(meta.fill).toBe(subjectFill(subject));
    }
  });
});
