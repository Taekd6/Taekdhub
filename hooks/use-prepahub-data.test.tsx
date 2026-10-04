// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { createReviewItem } from "@/lib/review-items";
import { localData } from "@/lib/storage";

/**
 * SCÉNARIOS DE PERTE DE DONNÉES — deux copies du hook dans le même onglet.
 *
 * Sur un écran, plusieurs composants appellent chacun `usePrepahubData()`
 * (40 appelants dans le projet). Chaque appel a SA copie React des données.
 * Une écriture d'une copie ne prévient pas les autres copies du même onglet
 * (l'événement `storage` ne part que vers les AUTRES onglets).
 *
 * Pour les collections écrites en REMPLACEMENT (notes, erreurs, à revoir,
 * tentatives, mémoire, check-ins, Next Move, Anki, préférences), une copie
 * périmée qui écrit efface ce que l'autre vient d'ajouter. Voir
 * docs/AUDIT.md, P1-1.
 *
 * `it.fails` : ce test RÉUSSIT tant que le bug existe. Il échouera le jour
 * où la phase 3 (store partagé) le corrige ; il suffira alors de remplacer
 * `it.fails` par `it`.
 */

function item(text: string) {
  return createReviewItem({ subject: "Mathématiques", text, kind: "à revoir" })!;
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("usePrepahubData — deux composants sur le même écran", () => {
  it.fails("P1-1 : une copie périmée n'efface pas une entrée ajoutée par une autre", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    expect(a.result.current.ready).toBe(true);
    expect(b.result.current.ready).toBe(true);

    // Le composant A ajoute « Revoir IPP » au carnet.
    act(() => a.result.current.saveReviewItems([...a.result.current.reviewItems, item("Revoir IPP")]));
    // Le composant B, qui n'a pas vu passer cet ajout, ajoute « Revoir Taylor ».
    act(() => b.result.current.saveReviewItems([...b.result.current.reviewItems, item("Revoir Taylor")]));

    const stored = localData.reviewItems().map((entry) => entry.text);
    expect(stored).toContain("Revoir Taylor");
    expect(stored).toContain("Revoir IPP"); // ← perdu aujourd'hui
  });

  it("le contournement actuel (relire le disque avant d'écrire) protège les préférences", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());

    act(() => a.result.current.savePreferences({ ...localData.preferences(), displayName: "Taekd" }));
    act(() => b.result.current.savePreferences({ ...localData.preferences(), planningMarginPercent: 30 }));

    const prefs = localData.preferences();
    expect(prefs.displayName).toBe("Taekd");
    expect(prefs.planningMarginPercent).toBe(30);
  });

  it("les séances, écrites par fusion, ne se perdent pas entre deux copies", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    const session = (id: string) => ({
      id,
      subject: "Physique" as const,
      exercise_id: null,
      started_at: "2026-10-04T08:00:00.000Z",
      ended_at: "2026-10-04T09:00:00.000Z",
      duration_seconds: 3600,
      note: null,
      created_at: "2026-10-04T09:00:00.000Z",
      result: null,
      hints_used: null,
      work_item_id: null,
    });

    act(() => a.result.current.saveSessions([session("s-a"), ...a.result.current.sessions]));
    act(() => b.result.current.saveSessions([session("s-b"), ...b.result.current.sessions]));

    expect(localData.sessions().map((entry) => entry.id).sort()).toEqual(["s-a", "s-b"]);
  });
});
