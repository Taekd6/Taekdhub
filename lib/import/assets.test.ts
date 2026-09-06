import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STANDARD_FONTS_URL, WORKER_URL } from "@/lib/import/pdf-source";

/**
 * pdf.js charge DEUX ressources à l'exécution : son worker et les polices
 * standard. Elles ne sont pas empaquetées — elles sont copiées dans
 * `public/pdfjs/` avant chaque build. Si cette copie disparaît, l'import se
 * casse silencieusement : le worker retombe sur le fil principal et les PDF
 * qui n'embarquent pas leurs polices deviennent illisibles. D'où ce garde-fou.
 */
describe("ressources pdf.js servies par l'application", () => {
  const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));

  it("la copie est branchée sur le build", () => {
    expect(pkg.scripts.prebuild).toContain("copy-pdfjs-assets");
    expect(existsSync(path.resolve(process.cwd(), "scripts/copy-pdfjs-assets.mjs"))).toBe(true);
  });

  it("les URL pointent vers le domaine de l'app, jamais vers un CDN", () => {
    // TaekdHub fonctionne hors ligne : aucune ressource ne doit venir
    // d'ailleurs.
    expect(WORKER_URL.startsWith("/")).toBe(true);
    expect(STANDARD_FONTS_URL.startsWith("/")).toBe(true);
    expect(`${WORKER_URL}${STANDARD_FONTS_URL}`).not.toMatch(/https?:/);
  });

  it("pdf.js est une dépendance déclarée", () => {
    expect(pkg.dependencies["pdfjs-dist"]).toBeTruthy();
  });
});
