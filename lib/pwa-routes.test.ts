import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE PRÉCHARGEMENT HORS LIGNE DOIT SUIVRE LES PAGES, PAS L'INVERSE.
 *
 * `service-worker/sw.template.js` précharge les pages à l'installation pour
 * qu'un élève dans le métro puisse ouvrir n'importe quel écran sans l'avoir
 * visité en ligne au préalable. Cette liste est écrite à la main : elle avait
 * dérivé au fil des ajouts de pages, jusqu'à ce que Radiographie et Objectifs
 * — deux destinations de la barre de navigation — en soient absentes. Hors
 * ligne, `networkFirst` n'avait alors ni réseau ni cache : erreur sèche.
 *
 * Rien ne pouvait le voir : ni le typecheck (c'est un tableau de chaînes),
 * ni les tests (aucun ne lisait ce fichier), ni le build. D'où ce garde, qui
 * lit les sources comme lib/design-system.test.ts et
 * lib/session-integrity.test.ts le font déjà.
 */

/** Routes réelles de l'App Router : tout `page.tsx`, les segments entre parenthèses étant des groupes sans effet sur l'URL. */
function routesFromApp(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `(app)` et consorts groupent sans apparaître dans l'URL ; `_x` et `@x` ne sont pas des routes.
      if (entry.startsWith("_") || entry.startsWith("@")) continue;
      const segment = entry.startsWith("(") && entry.endsWith(")") ? prefix : `${prefix}/${entry}`;
      found.push(...routesFromApp(full, segment));
    } else if (entry === "page.tsx") {
      found.push(prefix === "" ? "/" : prefix);
    }
  }
  return found;
}

describe("préchargement hors ligne", () => {
  const template = readFileSync(path.resolve(process.cwd(), "service-worker/sw.template.js"), "utf8");
  const declared = new Set([...template.matchAll(/"(\/[a-z-]*)"/g)].map((match) => match[1]));
  const actual = routesFromApp(path.resolve(process.cwd(), "app"));

  it("connaît toutes les pages de l'application", () => {
    // Le message nomme les manquantes : ajouter une page sans l'inscrire ici
    // la rend inaccessible hors ligne tant qu'elle n'a pas été ouverte en ligne.
    const missing = actual.filter((route) => !declared.has(route));
    expect(missing).toEqual([]);
  });

  it("ne précharge aucune route qui n'existe plus", () => {
    // Une route supprimée resterait demandée à chaque installation : un aller
    // -retour réseau pour une 404, à chaque nouvelle version.
    const known = new Set(actual);
    const ghosts = [...declared].filter((route) => !known.has(route));
    expect(ghosts).toEqual([]);
  });

  it("couvre bien toutes les destinations de la barre de navigation", () => {
    const nav = readFileSync(path.resolve(process.cwd(), "components/app-sidebar.tsx"), "utf8");
    const destinations = [...nav.matchAll(/href: "(\/[a-z-]*)"/g)].map((match) => match[1]);
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.filter((route) => !declared.has(route))).toEqual([]);
  });
});
