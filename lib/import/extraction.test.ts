import { describe, expect, it } from "vitest";
import { extractExercises, extractFromText } from "@/lib/import/detect";
import { readFixture } from "@/lib/import/fixtures/read-fixture";
import type { SheetExtraction } from "@/lib/import/types";

/**
 * Ces tests lisent de VRAIS PDF avec le vrai pdf.js (voir
 * lib/import/fixtures/read-fixture.ts). Ils portent donc sur la chaîne
 * complète — géométrie, exposants, symboles, découpage — et pas sur des
 * fragments écrits à la main qui ne ressembleraient à aucun document réel.
 *
 * Les PDF sont générés par scripts/fixtures/build-pdf-fixtures.mjs, qui
 * contrôle au point près les positions et les tailles : c'est le seul moyen de
 * tester la détection des exposants et des indices sans installer LaTeX.
 */

let cache: SheetExtraction | null = null;
async function sheet(): Promise<SheetExtraction> {
  if (!cache) cache = extractExercises(await readFixture("feuille-integrales.pdf"));
  return cache;
}

describe("détection des exercices dans un PDF", () => {
  it("trouve les trois exercices de la feuille, avec leurs numéros", async () => {
    const result = await sheet();
    expect(result.scanned).toBe(false);
    expect(result.pages).toBe(2);
    expect(result.exercises.map((exercise) => exercise.number)).toEqual(["1", "2", "3"]);
  });

  it("reprend le titre écrit à côté du numéro", async () => {
    const result = await sheet();
    expect(result.exercises.map((exercise) => exercise.title)).toEqual([
      "Convergence d'une suite recurrente",
      "Une integrale a parametre",
      "Somme de Riemann",
    ]);
  });

  it("compte les sous-questions sans les prendre pour des exercices", async () => {
    const result = await sheet();
    // « 1. » et « 2. » dans l'exercice 1, « a) b) c) » dans le 2 : des
    // sous-questions. Les confondre avec des exercices ferait exploser la
    // feuille en morceaux inutilisables.
    expect(result.exercises.map((exercise) => exercise.parts)).toEqual([2, 3, 0]);
    expect(result.exercises[0].statement).toContain("1. Montrer que");
    expect(result.exercises[0].statement).toContain("2. En deduire");
  });

  it("garde l'en-tête de la feuille hors des exercices", async () => {
    const result = await sheet();
    expect(result.header).toContain("Feuille 4");
    expect(result.header).toContain("Lycee Jean Perrin");
    for (const exercise of result.exercises) expect(exercise.statement).not.toContain("Lycee Jean Perrin");
  });
});

describe("un exercice à cheval sur deux pages", () => {
  it("reste un seul exercice, et se souvient des deux pages", async () => {
    const result = await sheet();
    const spanning = result.exercises[1];
    expect(spanning.pages).toEqual([1, 2]);
    // Début en bas de la page 1…
    expect(spanning.statement).toContain("a) Determiner le domaine");
    // …suite en haut de la page 2, dans le même énoncé.
    expect(spanning.statement).toContain("b) Calculer");
    expect(spanning.statement).toContain("c) Etudier la continuite");
  });

  it("ne colle pas le numéro de page au milieu de l'énoncé", async () => {
    const result = await sheet();
    // La page 2 porte un « 2 » en tête. Sans le retrait des folios, il
    // atterrissait entre « a) » et « b) ».
    expect(result.exercises[1].statement).not.toMatch(/^\s*2\s*$/m);
  });
});

describe("les mathématiques survivent à l'extraction", () => {
  it("reconstruit indices et exposants", async () => {
    const [first] = (await sheet()).exercises;
    expect(first.statement).toContain("$u_{n}$");
    expect(first.statement).toContain("$u_{0} = 1$");
    // `u_{n+1} = u_n^2 + 1` : un indice de plusieurs caractères ET un exposant
    // sur la même ligne, chacun rattaché à sa base.
    expect(first.statement).toContain("$u_{n+1} = u_{n}^{2} + 1$");
  });

  it("traduit les symboles en commandes LaTeX que KaTeX comprend", async () => {
    const result = await sheet();
    expect(result.exercises[0].statement).toContain("\\to \\infty");
    expect(result.exercises[1].statement).toContain("\\in");
    expect(result.exercises[1].statement).toContain("\\int");
    expect(result.exercises[2].statement).toContain("\\leq");
    expect(result.exercises[2].statement).toContain("\\sum");
    expect(result.exercises[2].statement).toContain("\\alpha");
  });

  it("ne soude jamais une commande au symbole suivant", async () => {
    // `\inR` n'existe pas : KaTeX n'affiche alors plus rien du tout. Il faut
    // une espace entre la commande et la lettre qui suit.
    const result = await sheet();
    expect(result.exercises[1].statement).toContain("$a \\in R$");
    expect(result.exercises[2].statement).toContain("\\leq f");
    expect(result.exercises[2].statement).toContain("\\sum f");
  });

  it("place les bornes de l'intégrale sur l'intégrale, pas sur le titre", async () => {
    const result = await sheet();
    // Les bornes flottent à mi-hauteur entre deux lignes : mal rattachées,
    // elles partaient s'accrocher au titre de l'exercice.
    expect(result.exercises[1].title).toBe("Une integrale a parametre");
    expect(result.exercises[1].statement).toMatch(/\\int\^\{1\}_\{0\}/);
  });

  it("laisse la phrase française en dehors des formules", async () => {
    const result = await sheet();
    const statements = result.exercises.map((exercise) => exercise.statement).join("\n");
    // Chaque `$` doit avoir son jumeau : une formule ouverte casse tout le
    // rendu de l'énoncé.
    expect((statements.match(/\$/g) ?? []).length % 2).toBe(0);
    // Les mots de la phrase restent du texte, jamais du LaTeX.
    expect(statements).toContain("$u_{n}$ la suite definie par");
    expect(statements).toContain("Montrer que $u_{n}$ est croissante");
    expect(statements).toContain("le domaine de definition de $I$");
    expect(statements).toContain("la constante $\\alpha$");
    expect(statements).toContain("continue sur [0, 1] telle que");
  });

  it("sépare le texte des formules par une espace", async () => {
    const result = await sheet();
    // « Soit$u_{n}$la suite » : lisible par personne. Les PDF ne contiennent
    // pas toujours d'espace — elle se déduit de la géométrie.
    const statements = result.exercises.map((exercise) => exercise.statement).join("\n");
    expect(statements).toContain("Soit $u_{n}$ la");
    expect(statements).not.toMatch(/[a-zA-Z]\$[a-zA-Z]/);
    expect(statements).not.toContain("Soit$");
    expect(statements).not.toContain("$la ");
  });
});

describe("feuilles hors norme", () => {
  it("signale une feuille scannée au lieu d'inventer des exercices", async () => {
    const result = extractExercises(await readFixture("feuille-scannee.pdf"));
    expect(result.scanned).toBe(true);
    expect(result.exercises).toEqual([]);
  });

  it("fait un seul exercice d'une feuille sans numérotation", async () => {
    const result = extractExercises(await readFixture("feuille-sans-numerotation.pdf"));
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].title).toContain("Devoir maison");
    expect(result.exercises[0].statement).toContain("sous-espace vectoriel");
  });
});

describe("saisie manuelle du texte", () => {
  it("produit exactement les mêmes objets que l'extraction PDF", () => {
    const result = extractFromText(
      "Exercice 1. Suites bornées\nMontrer que toute suite convergente est bornée.\n1. Rappeler la définition.\nExercice 2 : Séries\nÉtudier la convergence de la série."
    );
    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0].number).toBe("1");
    expect(result.exercises[0].title).toBe("Suites bornées");
    expect(result.exercises[0].parts).toBe(1);
    expect(result.exercises[1].title).toBe("Séries");
  });

  it("conserve les formules déjà écrites en LaTeX", () => {
    const result = extractFromText("Exercice 1\nMontrer que $\\int_0^1 x^n dx = \\frac{1}{n+1}$.");
    expect(result.exercises[0].statement).toBe("Montrer que $\\int_0^1 x^n dx = \\frac{1}{n+1}$.");
  });

  it("ne rend aucun exercice d'un texte vide", () => {
    expect(extractFromText("   \n  \n").exercises).toEqual([]);
  });
});
