import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOU DU SYSTÈME VISUEL.
 *
 * Ces tests ne jugent pas du goût : ils empêchent la DÉRIVE, c'est-à-dire
 * l'accumulation silencieuse de variantes pour des rôles identiques. C'est
 * exactement ce qui avait dégradé la version précédente : sept opacités de
 * bordure pour un seul rôle, deux feuilles de style se redéfinissant l'une
 * l'autre, et des ombres semées écran par écran jusqu'à ce que tout
 * ressemble à une pile de cartes.
 *
 * Ils lisent les SOURCES plutôt que le DOM : le projet teste volontairement
 * la logique pure sans environnement navigateur (voir vitest.config.ts), et
 * ajouter jsdom uniquement pour ça coûterait plus que ça ne rapporte. La
 * vérification visuelle réelle se fait au navigateur, sur un build de
 * production.
 */

const ROOTS = ["components", "app"];

function sourceFiles(dir: string, extensions = /\.(tsx?|css)$/): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full, extensions));
    else if (extensions.test(entry)) out.push(full);
  }
  return out;
}

function allSources(): { file: string; content: string }[] {
  return ROOTS.flatMap((root) =>
    sourceFiles(path.resolve(process.cwd(), root)).map((file) => ({
      file: path.relative(process.cwd(), file),
      content: readFileSync(file, "utf8"),
    }))
  );
}

/** Toutes les occurrences d'un motif dans le dépôt, avec leur fichier — pour que l'échec nomme précisément le coupable. */
function collect(pattern: RegExp): { file: string; value: string }[] {
  const found: { file: string; value: string }[] = [];
  for (const { file, content } of allSources()) {
    for (const match of content.matchAll(new RegExp(pattern.source, "g"))) {
      found.push({ file, value: match[1] ?? match[0] });
    }
  }
  return found;
}

describe("une seule feuille de style", () => {
  /**
   * L'ancien couple `globals.css` + `ui-redesign.css` redéfinissait `.surface`,
   * `.eyebrow`, `aside`, `button` et `input` — dont plusieurs par SÉLECTEUR DE
   * BALISE. Toute correction dans l'un était annulée par l'autre, et rien dans
   * le code ne disait lequel gagnait. Une seule feuille, point.
   */
  it("app/ ne contient qu'un seul fichier CSS", () => {
    const stylesheets = sourceFiles(path.resolve(process.cwd(), "app"), /\.css$/).map((file) =>
      path.relative(process.cwd(), file)
    );
    expect(stylesheets).toEqual(["app/globals.css"]);
  });

  it("`.surface` n'est défini qu'une fois", () => {
    const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    const definitions = [...css.matchAll(/^\s*\.surface\s*\{/gm)];
    expect(definitions).toHaveLength(1);
  });

  it("aucune règle ne cible une balise nue de contrôle ou de mise en page", () => {
    // `button { … }`, `aside { … }`, `main > div { … }` : ce sont ces règles
    // qui rendaient impossible de savoir, en lisant un composant, à quoi il
    // ressemblerait vraiment. Les balises de TEXTE (html, body) et les
    // pseudo-éléments restent légitimes.
    const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    const forbidden = /^\s*(button|input|select|textarea|aside|nav|main|h1|h2|h3|article|section)\s*[,{>]/gm;
    const offenders = [...css.matchAll(forbidden)]
      .map((match) => match[1])
      // `button, input, select, textarea { font: inherit }` est la seule
      // exception assumée : hériter la police des contrôles natifs est une
      // remise à zéro, pas un style.
      .filter((tag) => !["button", "input", "select", "textarea"].includes(tag));
    expect(offenders).toEqual([]);
  });
});

describe("pas d'ombre sur du contenu en place", () => {
  /**
   * Une carte se détache par sa VALEUR et par un filet. `shadow-surface` est
   * la seule ombre du système, et elle est réservée aux couches réellement
   * flottantes (feuille modale, menu) — d'où sa présence dans `.floating`
   * uniquement.
   */
  it("aucune classe d'ombre autre que `shadow-surface`", () => {
    const offenders = collect(/shadow-(?!surface)([a-z0-9[\]/.,_-]+)/)
      // `shadow-none` est une ANNULATION, pas une ombre.
      .filter((entry) => entry.value !== "none");
    expect(offenders.map((entry) => `${entry.file}: shadow-${entry.value}`)).toEqual([]);
  });
});

describe("échelle des filets — un rôle, un token", () => {
  /**
   * Les traits et les fonds en creux passent par `border-line` / `divide-line`
   * / `bg-inset`, jamais par une opacité choisie au cas par cas. Seules
   * subsistent trois valeurs, pour les PISTES (le fond d'une jauge, d'un
   * squelette, d'un point de difficulté éteint) — un rôle que les tokens
   * sémantiques ne couvrent pas, parce qu'il doit rester plus discret qu'un
   * filet.
   */
  const ALLOWED_TRACK = new Set(["0.07", "0.10", "0.14"]);

  it("aucune opacité `hairline` hors de l'échelle des pistes", () => {
    const offenders = collect(/hairline\/\[([0-9.]+)\]/).filter((entry) => !ALLOWED_TRACK.has(entry.value));
    expect(
      offenders.map((entry) => `${entry.file}: hairline/[${entry.value}]`),
      `Valeurs autorisées pour une PISTE : ${[...ALLOWED_TRACK].join(", ")}. Pour un filet, utiliser border-line/divide-line ; pour un fond en creux, bg-inset.`
    ).toEqual([]);
  });

  it("l'échelle sémantique est réellement utilisée", () => {
    // Sans ce contrôle, supprimer toutes les bordures du dépôt ferait passer
    // le test précédent — il doit échouer si le système disparaît.
    expect(collect(/border-line/).length).toBeGreaterThan(20);
    expect(collect(/bg-inset/).length).toBeGreaterThan(10);
  });
});

describe("typographie — des rôles, pas des tailles ad hoc", () => {
  /**
   * Les six rôles (`t-display`, `t-heading`, `t-subhead`, `t-body`, `t-meta`,
   * `t-label`, plus `t-read` pour le contenu lu) sont définis une fois dans
   * `app/globals.css`. Un écran choisit un RÔLE ; il ne choisit pas une
   * taille en rem. Sans cette règle, on retrouve `text-[1.375rem]` dans un
   * composant et `text-[1.4rem]` dans le suivant, pour le même niveau de
   * titre.
   */
  it("les rôles typographiques sont définis dans la feuille de style", () => {
    const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    for (const role of ["t-display", "t-heading", "t-subhead", "t-body", "t-meta", "t-label", "t-read"]) {
      expect(css, `Rôle typographique manquant : .${role}`).toContain(`.${role}`);
    }
  });

  /**
   * RÉGRESSION RÉELLE. `components/ui/sheet.tsx` composait son titre en
   * `t-title` — un rôle qui n'a jamais existé. Aucune erreur, aucun
   * avertissement : la classe ne correspondait simplement à rien, et le
   * titre de chaque feuille modale du mobile tombait à la taille du texte
   * courant. C'est le mode d'échec propre aux systèmes en classes CSS, et il
   * est invisible à la relecture — d'où ce contrôle.
   */
  it("tout rôle `t-…` employé par un écran est défini dans la feuille de style", () => {
    const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    const defined = new Set([...css.matchAll(/^\s*\.(t-[a-z-]+)/gm)].map((match) => match[1]));
    const offenders = new Set<string>();
    for (const { file, content } of allSources()) {
      if (file.endsWith(".css")) continue;
      // Uniquement les rôles écrits dans un attribut de classe : le mot
      // « t-il » d'une phrase française en commentaire n'en est pas un.
      for (const attribute of content.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\})/g)) {
        const value = attribute[1] ?? attribute[2] ?? attribute[3] ?? "";
        for (const role of value.matchAll(/\bt-[a-z-]+/g)) {
          if (!defined.has(role[0])) offenders.add(`${file}: ${role[0]}`);
        }
      }
    }
    expect([...offenders], "Rôle typographique inexistant — la classe ne s'applique à rien.").toEqual([]);
  });

  /**
   * MÊME MODE D'ÉCHEC, AUTRE FAMILLE DE CLASSES — et il s'est reproduit.
   *
   * `components/ui/chart.tsx` peignait ses barres en `bg-accent-ink/70`. La
   * couleur Tailwind s'appelle `accent` (son `DEFAULT` EST l'encre) : il
   * n'existe aucun `accent-ink`. La classe ne correspondait donc à rien, les
   * barres avaient la bonne hauteur dans le DOM mais AUCUN fond, et le
   * graphique s'affichait vide. Invisible au typecheck, invisible aux tests,
   * invisible à la relecture — seule une capture d'écran l'a montré.
   *
   * On vérifie donc que toute variante d'accent employée dans une classe
   * existe réellement dans la palette.
   */
  it("toute nuance `accent-…` employée existe dans la palette Tailwind", () => {
    const config = readFileSync(path.resolve(process.cwd(), "tailwind.config.ts"), "utf8");
    const scale = config.slice(config.indexOf("accent: {"), config.indexOf("},", config.indexOf("accent: {")));
    const defined = new Set([...scale.matchAll(/^\s*"?([a-z-]+)"?:/gm)].map((match) => match[1]).filter((key) => key !== "DEFAULT"));

    const offenders = new Set<string>();
    for (const { file, content } of allSources()) {
      if (file.endsWith(".css")) continue;
      for (const attribute of content.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\})/g)) {
        const value = attribute[1] ?? attribute[2] ?? attribute[3] ?? "";
        // `bg-accent`, `text-accent/70` : la couleur par défaut, toujours valide.
        // `bg-accent-brand`, `text-accent-ink` : une nuance, qui doit exister.
        for (const used of value.matchAll(/\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|shadow|accent)-accent-([a-z-]+?)(?:\/\d+)?\b/g)) {
          if (!defined.has(used[1])) offenders.add(`${file}: accent-${used[1]}`);
        }
      }
    }
    expect([...offenders], "Nuance d'accent inexistante — la classe ne peint rien.").toEqual([]);
  });

  it("aucune taille de police arbitraire supérieure au corps de texte", () => {
    // Les valeurs SOUS 1 rem restent tolérées : ce sont des micro-étiquettes
    // dont l'échelle Tailwind ne couvre pas tous les crans. Au-dessus, c'est
    // un TITRE, et un titre doit passer par un rôle. `clamp(...)` est
    // également accepté : c'est une taille fluide, pas une valeur figée.
    //
    // La feuille de style est exclue : c'est là que les rôles sont DÉFINIS,
    // donc le seul endroit où une taille en rem est à sa place.
    const offenders = collect(/text-\[([0-9.]+)rem\]/)
      .filter((entry) => !entry.file.endsWith(".css"))
      .filter((entry) => Number(entry.value) >= 1);
    expect(
      offenders.map((entry) => `${entry.file}: text-[${entry.value}rem]`),
      "Utiliser un rôle (t-display / t-heading / t-subhead / t-read) plutôt qu'une taille figée."
    ).toEqual([]);
  });
});

describe("les animations restent en CSS", () => {
  /**
   * `framer-motion` pesait 46 ko de JavaScript sur CHAQUE page pour un
   * soulignement d'onglet, quelques fondus d'entrée et un panneau qui monte —
   * tout cela s'écrit en CSS, sans bloquer le fil principal. Sa suppression a
   * retiré ~40 ko du premier chargement de chaque écran (mesuré au build).
   *
   * Ce test empêche la réintroduction silencieuse d'une librairie d'animation
   * pour un effet que trois lignes de CSS produisent.
   */
  it("aucune librairie d'animation dans les dépendances", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const animation = deps.filter((name) => /framer-motion|gsap|@react-spring|animejs|lottie/.test(name));
    expect(animation).toEqual([]);
  });

  it("aucun composant n'importe de librairie d'animation", () => {
    const offenders = allSources()
      .filter(({ content }) => /from ["'](framer-motion|gsap|@react-spring)/.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe("la mise en page passe par le système de composition", () => {
  /**
   * `Workbench`, `Split` et `Stack` (components/ui/layout.tsx) existent pour
   * qu'un écran choisisse une COMPOSITION plutôt que d'écrire sa propre
   * grille. Sans cette règle, on retrouve `lg:grid-cols-[280px_1fr]` dans un
   * écran et `lg:grid-cols-[15rem_1fr]` dans le suivant, pour le même rôle —
   * et les deux volets ne s'alignent plus.
   */
  it("aucune grille de gabarit ad hoc hors du système de composition", () => {
    const offenders = collect(/grid-cols-\[[^\]]*(?:rem|px)[^\]]*\]/)
      .filter((entry) => entry.file !== "components/ui/layout.tsx")
      .map((entry) => `${entry.file}: ${entry.value}`);
    expect(
      offenders,
      "Utiliser Workbench / Split / Stack (components/ui/layout.tsx) plutôt qu'une grille écrite sur place."
    ).toEqual([]);
  });

  it("les compositions sont réellement utilisées", () => {
    const sources = allSources();
    // `Workbench` (volet collant + zone de travail) n'avait qu'un usage : le
    // navigateur de l'ancienne banque d'exercices, retirée. Il n'est donc
    // plus exigé ici ; son retrait de components/ui/layout.tsx revient au
    // chantier qui tient ce fichier.
    for (const name of ["Split", "Stack"]) {
      const used = sources.filter(({ file, content }) => file !== "components/ui/layout.tsx" && content.includes(`<${name}`));
      expect(used.length, `Composition inutilisée : ${name}`).toBeGreaterThan(0);
    }
  });
});
