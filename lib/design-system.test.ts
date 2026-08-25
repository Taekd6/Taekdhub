import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou de l'échelle `hairline` (voir la note en tête de
 * app/globals.css). Le problème corrigé n'était pas une valeur fausse mais
 * une DÉRIVE : sept opacités de bordure et sept de fond s'étaient accumulées
 * pour des rôles identiques, chaque nouvelle carte introduisant sa propre
 * nuance sub-perceptuelle. Aucun typecheck ni lint ne peut voir ça — d'où ce
 * test, qui échoue dès qu'une huitième nuance réapparaît.
 *
 * Il lit les sources plutôt que le DOM : le projet teste volontairement la
 * logique pure sans environnement navigateur (voir vitest.config.ts), et
 * ajouter jsdom + testing-library uniquement pour ça coûterait plus que ça
 * ne rapporte.
 */

const ALLOWED_BORDER = new Set(["0.07", "0.09", "0.14"]);
const ALLOWED_BG = new Set(["0.025", "0.04", "0.08"]);

const ROOTS = ["components", "app"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Toutes les occurrences de `<prefix>-hairline/[N]` du dépôt, avec leur fichier — pour que l'échec nomme précisément le coupable. */
function collect(prefix: "border" | "bg"): { file: string; value: string }[] {
  const pattern = new RegExp(`${prefix}-hairline/\\[([0-9.]+)\\]`, "g");
  const found: { file: string; value: string }[] = [];
  for (const root of ROOTS) {
    for (const file of sourceFiles(path.resolve(process.cwd(), root))) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(pattern)) {
        found.push({ file: path.relative(process.cwd(), file), value: match[1] });
      }
    }
  }
  return found;
}

describe("échelle hairline — trois marches, pas sept", () => {
  it("aucune opacité de bordure hors de l'échelle documentée", () => {
    const offenders = collect("border").filter((entry) => !ALLOWED_BORDER.has(entry.value));
    expect(
      offenders.map((entry) => `${entry.file}: border-hairline/[${entry.value}]`),
      `Opacités autorisées : ${[...ALLOWED_BORDER].join(", ")} (voir app/globals.css)`
    ).toEqual([]);
  });

  it("aucune opacité de fond hors de l'échelle documentée", () => {
    const offenders = collect("bg").filter((entry) => !ALLOWED_BG.has(entry.value));
    expect(
      offenders.map((entry) => `${entry.file}: bg-hairline/[${entry.value}]`),
      `Opacités autorisées : ${[...ALLOWED_BG].join(", ")} (voir app/globals.css)`
    ).toEqual([]);
  });

  it("l'échelle est réellement utilisée (le test ne passerait pas à vide si les classes disparaissaient)", () => {
    expect(collect("border").length).toBeGreaterThan(10);
    expect(collect("bg").length).toBeGreaterThan(5);
  });
});
