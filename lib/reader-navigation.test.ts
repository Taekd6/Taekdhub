import { describe, expect, it } from "vitest";
import { readerNavigation } from "@/lib/reader-navigation";

/**
 * VERROUS DE RÉGRESSION — navigation du lecteur.
 *
 * Chacun de ces cas correspond à un bug réellement observé au navigateur,
 * pas à une précaution théorique.
 */
describe("readerNavigation", () => {
  const actif = (archivés: string[] = []) => (id: string) => !archivés.includes(id);

  it("suit l'ordre figé, PAS un classement recalculé", () => {
    /*
     * Le tri « Recommandé » reclasse la banque dès qu'un résultat est noté.
     * Si la navigation suivait ce classement, « suivant » sauterait à un
     * exercice arbitraire. L'ordre passé au lecteur est celui de la liste au
     * moment de son ouverture : il ne bouge pas pendant la lecture.
     */
    const figé = ["a", "b", "c", "d"];
    const reclassé = ["d", "a", "c", "b"]; // ce que donnerait un re-tri

    expect(readerNavigation(figé, "b", actif()).nextId).toBe("c");
    expect(readerNavigation(figé, "b", actif()).previousId).toBe("a");
    // Le classement recalculé donnerait une autre réponse : c'est bien deux
    // ordres différents, donc le test discrimine vraiment.
    expect(readerNavigation(reclassé, "b", actif()).nextId).toBe(null);
  });

  it("saute les exercices archivés depuis le lecteur", () => {
    const nav = readerNavigation(["a", "b", "c"], "a", actif(["b"]));
    expect(nav.order).toEqual(["a", "c"]);
    expect(nav.nextId).toBe("c");
  });

  it("n'expose jamais un bouton mort en bout de liste", () => {
    expect(readerNavigation(["a", "b"], "b", actif()).nextId).toBe(null);
    expect(readerNavigation(["a", "b"], "a", actif()).previousId).toBe(null);
  });

  it("désactive les deux boutons pour un exercice hors sélection", () => {
    // Ouverture depuis le tableau de bord : l'exercice peut ne pas figurer
    // dans la liste filtrée.
    const nav = readerNavigation(["a", "b"], "z", actif());
    expect(nav).toMatchObject({ index: -1, previousId: null, nextId: null });
  });

  it("l'exercice courant archivé ne laisse aucune navigation", () => {
    const nav = readerNavigation(["a", "b", "c"], "b", actif(["b"]));
    expect(nav.index).toBe(-1);
    expect(nav.nextId).toBe(null);
  });

  it("un ordre vide ne casse rien", () => {
    expect(readerNavigation([], "a", actif())).toMatchObject({ index: -1, previousId: null, nextId: null });
  });
});
