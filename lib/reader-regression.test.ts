import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { splitBlocks } from "@/lib/math-segments";
import { loadSeedBank } from "@/lib/seed";

const source = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");

/**
 * ═══════════════════════════════════════════════════════════════════════
 * VERROU 1 — les formules centrées ne doivent plus tuer l'onglet.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bug mesuré : tout exercice dont un texte contient un `$$…$$` faisait
 * PLANTER le moteur de rendu de Chromium à l'ouverture du lecteur (onglet
 * mort, page blanche, aucune erreur JavaScript). Cause : `text-wrap: pretty`
 * sur les rôles de lecture, appliqué à un bloc contenant un `.katex-display`.
 *
 * Le correctif tient en deux moitiés qui n'ont de sens qu'ensemble :
 * `RichMath` marque le bloc concerné (`data-display-math`), la feuille de
 * style y rétablit la césure ordinaire. Retirer l'une ramène le plantage.
 */
describe("formules centrées : le lecteur ne doit plus planter", () => {
  it("tout texte contenant $$…$$ produit bien un segment « block »", async () => {
    // C'est ce segment qui déclenche le marqueur : s'il n'est pas détecté,
    // `text-wrap: pretty` reste actif et Chromium plante.
    expect(splitBlocks("avant\n$$x=1$$\naprès").some((s) => s.type === "block")).toBe(true);
    expect(splitBlocks("$$\\int_0^1 f$$").some((s) => s.type === "block")).toBe(true);
    // Une formule en ligne n'a jamais posé de problème : pas de faux positif.
    expect(splitBlocks("soit $x$ réel").some((s) => s.type === "block")).toBe(false);
  });

  it("chaque exercice de la banque portant $$…$$ est détecté", async () => {
    const { exercises } = await loadSeedBank();
    const suspects = exercises.filter((exercise) =>
      /\$\$[\s\S]+?\$\$/.test([exercise.statement, exercise.correction, ...(exercise.hints ?? [])].filter(Boolean).join("\n"))
    );
    // Non nul : sans cela le test passerait sur une banque vide.
    expect(suspects.length).toBeGreaterThan(50);
    const nonDétectés = suspects.filter((exercise) =>
      ![exercise.statement, exercise.correction, ...(exercise.hints ?? [])]
        .filter(Boolean)
        .some((text) => splitBlocks(text as string).some((segment) => segment.type === "block"))
    );
    expect(nonDétectés.map((e) => e.title)).toEqual([]);
  });

  it("RichMath pose le marqueur et la feuille de style le neutralise", () => {
    const rich = source("components/rich-math.tsx");
    expect(rich, "RichMath doit calculer la présence d'une formule centrée").toMatch(
      /segments\.some\(\(\w+\) => \w+\.type === "block"\)/
    );
    expect(rich, "RichMath doit poser data-display-math sur son conteneur").toMatch(
      /data-display-math=\{/
    );
    const css = source("app/globals.css");
    expect(css, "globals.css doit rétablir text-wrap: wrap sur [data-display-math]").toMatch(
      /\[data-display-math\][\s\S]{0,220}text-wrap:\s*wrap/
    );
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * VERROU 2 — isolation de l'état entre deux exercices.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bug mesuré : sans `key` sur `<FocusView>`, passer à l'exercice suivant
 * conservait les indices déjà révélés, la correction affichée et le
 * chronomètre du précédent (0:03 → 0:06 sans repartir de zéro). Comme
 * `hints_used` et la durée sont écrits dans la `WorkSession` et servent au
 * moteur à décider si une réussite est AUTONOME, le bug faussait aussi les
 * recommandations et l'XP.
 *
 * Le mécanisme de remise à zéro est le remontage du composant. Ces tests
 * verrouillent ses deux conditions : la clé côté parent, l'état LOCAL côté
 * lecteur (un état hissé en dehors survivrait au remontage).
 */
describe("isolation de l'état entre deux exercices", () => {
  const manager = source("components/exercises/exercise-manager.tsx");
  const focus = source("components/exercises/focus-view.tsx");

  it("<FocusView> est monté avec une clé liée à l'exercice affiché", () => {
    expect(manager).toMatch(/<FocusView[\s\S]{0,2000}?key=\{selected\.id\}/);
  });

  it("indices, correction et chronomètre restent des états LOCAUX du lecteur", () => {
    // Chacun de ces états doit être déclaré dans focus-view : c'est ce qui le
    // fait repartir de zéro au remontage.
    for (const state of ["hintCount", "correctionVisible", "committed", "draftSession"]) {
      expect(focus, `${state} doit être un useState de FocusView`).toMatch(
        new RegExp(`const \\[${state},[^\\]]*\\] = useState`)
      );
    }
    // Le chronomètre est persisté par exercice (clé suffixée par l'id) : deux
    // exercices ne peuvent pas partager la même mesure.
    expect(focus).toMatch(/focusTimerKey = \(exerciseId: string\)/);
  });

  it("le lecteur enregistre bien les indices consommés dans la séance", () => {
    expect(focus).toMatch(/hints_used/);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * VERROU 3 — enchaînement et ordre de lecture.
 * ═══════════════════════════════════════════════════════════════════════
 * La logique elle-même est testée dans lib/reader-navigation.test.ts ; ici on
 * verrouille son BRANCHEMENT, c'est-à-dire le fait que le composant s'en
 * serve réellement, et sur l'ordre figé plutôt que sur le tri courant.
 */
describe("enchaînement des exercices", () => {
  const manager = source("components/exercises/exercise-manager.tsx");
  const focus = source("components/exercises/focus-view.tsx");

  it("la navigation passe par readerNavigation, sur l'ordre figé", () => {
    expect(manager).toMatch(/readerNavigation\(readerOrder\.current, selected\.id/);
    expect(manager).toMatch(/onNext=\{nextId \?/);
    expect(manager).toMatch(/onPrev=\{previousId \?/);
  });

  it("l'ordre est figé à l'ouverture du lecteur, pas recalculé", () => {
    // Les deux portes d'entrée du lecteur doivent geler l'ordre affiché.
    const gels = manager.match(/readerOrder\.current = sortedRef\.current\.map/g) ?? [];
    expect(gels.length).toBeGreaterThanOrEqual(2);
  });

  it("après notation, le lecteur propose l'exercice suivant au lieu de fermer", () => {
    expect(focus).toMatch(/if \(result !== null && onNext\)/);
    expect(focus).toMatch(/setCommitted\(result\)/);
    expect(focus).toMatch(/Exercice suivant/);
    // Entrée / flèche droite enchaînent, Échap revient à la liste.
    expect(focus).toMatch(/event\.key === "Enter" \|\| event\.key === "ArrowRight"/);
  });

  it("l'ordre affiché est à jour dès le rendu, pas seulement après un effet", () => {
    /*
     * `FocusQueryHandler` est un composant ENFANT : son effet, qui traite
     * `?focus=<id>`, s'exécute AVANT les effets du parent. Tant que
     * `sortedRef` était mis à jour dans un effet du parent, un exercice ouvert
     * depuis l'accueil gelait un ordre vide : le lecteur arrivait sans
     * « précédent » ni « suivant » et refermait au lieu d'enchaîner.
     */
    expect(manager).toMatch(/const sortedRef = useRef\(sorted\);\s*\n\s*sortedRef\.current = sorted;/);
    expect(manager, "sortedRef ne doit pas être remis à jour dans un effet").not.toMatch(
      /useEffect\(\(\) => \{\s*sortedRef\.current = sorted;/
    );
  });

  it("la position dans la liste est relevée AVANT l'ouverture du lecteur", () => {
    // Sans ce relevé, le retour à la liste repartait de zéro : il fallait
    // re-défiler et retrouver sa ligne après chaque exercice.
    const relevés = manager.match(/listScroll\.current = typeof window === "undefined" \? 0 : window\.scrollY/g) ?? [];
    expect(relevés.length).toBeGreaterThanOrEqual(2);
    expect(manager).toMatch(/window\.scrollTo\(\{ top: target, behavior: "instant" \}\)/);
  });
});
