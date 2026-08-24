import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit du hook central de données — priorité au bug réel trouvé et corrigé
 * ici : `usePrepahubData` est appelé indépendamment par une bonne dizaine de
 * composants (sidebar, Dashboard, BackupReminder, ThemeSync…), souvent
 * plusieurs à la fois sur la même page. Avant ce correctif, chaque instance
 * montée en même temps lançait sa PROPRE tentative d'amorçage de la banque
 * (`maybeSeedBank`), sans savoir que d'autres étaient déjà en cours — chacune
 * générant ses propres identifiants pour les mêmes exercices.
 *
 * Environnement Node (voir vitest.config.ts, pas de DOM) : `window` et
 * `localStorage` n'existent pas globalement ici, contrairement au navigateur
 * réel où `usePrepahubData` tourne — on les simule au minimum nécessaire pour
 * exercer `maybeSeedBank` telle qu'elle s'exécute réellement (elle vérifie
 * `typeof window === "undefined"` en tout premier, exactement comme le reste
 * de lib/storage.ts).
 */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", new MemoryStorage());
  // Repart avec un `seedPromise` (verrou module) vierge à chaque test — sans
  // ça, le premier test laisserait le verrou déjà posé pour les suivants.
  vi.resetModules();
});

describe("maybeSeedBank — protection contre le montage simultané de plusieurs instances", () => {
  it("N appels concurrents (équivalent de N composants montés en même temps) ne déclenchent qu'UN SEUL amorçage réel", async () => {
    const { maybeSeedBank } = await import("@/hooks/use-prepahub-data");
    const { localData } = await import("@/lib/storage");
    const saveExercisesSpy = vi.spyOn(localData, "saveExercises");
    const saveChaptersSpy = vi.spyOn(localData, "saveChapters");

    // Simule 5 composants (sidebar, Dashboard, BackupReminder, ThemeSync…)
    // dont l'effet de montage appelle maybeSeedBank() dans le même tick,
    // exactement comme React exécute plusieurs useEffect de montage à la
    // suite, tous avant le premier `await` de chacun.
    await Promise.all([maybeSeedBank(), maybeSeedBank(), maybeSeedBank(), maybeSeedBank(), maybeSeedBank()]);

    expect(saveExercisesSpy).toHaveBeenCalledTimes(1);
    expect(saveChaptersSpy).toHaveBeenCalledTimes(1);

    const savedExercises = JSON.parse(localStorage.getItem("prepahub:exercises") ?? "[]") as { id: string }[];
    expect(savedExercises.length).toBeGreaterThan(0);
    // Aucun identifiant dupliqué : un seul amorçage a réellement écrit.
    expect(new Set(savedExercises.map((e) => e.id)).size).toBe(savedExercises.length);
  });

  it("marqueur déjà posé : aucun ré-amorçage, même appelé plusieurs fois", async () => {
    const { maybeSeedBank } = await import("@/hooks/use-prepahub-data");
    const { localData } = await import("@/lib/storage");
    const { SEED_FLAG_KEY } = await import("@/lib/seed");
    localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
    const saveExercisesSpy = vi.spyOn(localData, "saveExercises");

    await Promise.all([maybeSeedBank(), maybeSeedBank()]);

    expect(saveExercisesSpy).not.toHaveBeenCalled();
  });

  it("des exercices existent déjà (utilisateur existant, import manuel) : pose seulement le marqueur, n'écrase rien", async () => {
    const { maybeSeedBank } = await import("@/hooks/use-prepahub-data");
    const { localData } = await import("@/lib/storage");
    const { SEED_FLAG_KEY } = await import("@/lib/seed");
    const existing = [{ id: "existing-1", title: "Mon exercice", subject: "Mathématiques" }];
    localStorage.setItem("prepahub:exercises", JSON.stringify(existing));
    const saveExercisesSpy = vi.spyOn(localData, "saveExercises");

    await maybeSeedBank();

    expect(saveExercisesSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(SEED_FLAG_KEY)).not.toBeNull();
    const stillThere = JSON.parse(localStorage.getItem("prepahub:exercises") ?? "[]") as { id: string }[];
    expect(stillThere.map((e) => e.id)).toEqual(["existing-1"]);
  });
});
