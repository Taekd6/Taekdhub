// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { createReviewItem } from "@/lib/review-items";
import { createErrorEntry } from "@/lib/error-log";
import { localData, STORAGE_KEYS } from "@/lib/storage";
import { DATA_CHANGED_EVENT } from "@/lib/sync/events";

/**
 * SCÉNARIOS DE PERTE DE DONNÉES — deux copies du hook dans le même onglet.
 *
 * Sur un écran, plusieurs composants appellent chacun `usePrepahubData()`
 * (27 appelants dans le projet). Avant le store partagé, chaque appel avait
 * SA copie React des données, et une écriture d'une copie ne prévenait pas
 * les autres copies du même onglet (l'événement `storage` ne part que vers
 * les AUTRES onglets) : pour les collections écrites en REMPLACEMENT (notes,
 * erreurs, à revoir, tentatives, mémoire, check-ins, Next Move, Anki,
 * préférences), une copie périmée qui écrivait effaçait ce que l'autre venait
 * d'ajouter (docs/AUDIT.md, P1-1).
 *
 * Désormais toutes les copies lisent le MÊME instantané : une écriture est
 * vue partout, aussitôt. Ces tests le vérifient, et vérifient que les autres
 * sources de changement (autre onglet, synchronisation) arrivent aussi
 * partout.
 */

function item(text: string) {
  return createReviewItem({ subject: "Mathématiques", text, kind: "à revoir" })!;
}

beforeEach(() => localStorage.clear());
// Démonter les hooks entre deux tests : le store est partagé par le module, et ne doit rien garder d'un test à l'autre.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("usePrepahubData — deux composants sur le même écran", () => {
  it("P1-1 : une copie périmée n'efface pas une entrée ajoutée par une autre", () => {
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

  it("une écriture est vue AUSSITÔT par toutes les copies, pour chaque collection écrite en remplacement", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    const error = createErrorEntry({ subject: "Physique", type: "calcul", source: "DS", description: "Signe oublié", date: "2026-10-04" })!;

    act(() => a.result.current.saveReviewItems([item("Revoir IPP")]));
    act(() => a.result.current.saveErrors([error]));
    act(() => a.result.current.saveGrades([{ id: "g1", subject: "Mathématiques", title: "DS 1", date: "2026-10-01", score: 12, outOf: 20, predicted: null, coefficient: 1, kind: "ds", createdAt: "2026-10-01T10:00:00.000Z" } as never]));

    expect(b.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Revoir IPP"]);
    expect(b.result.current.errors.map((entry) => entry.id)).toEqual([error.id]);
    expect(b.result.current.grades.map((entry) => entry.id)).toEqual(["g1"]);
    // Une seule source : les deux copies tiennent littéralement la même liste.
    expect(b.result.current.reviewItems).toBe(a.result.current.reviewItems);
  });

  it("une copie montée APRÈS une écriture voit l'état courant", () => {
    const a = renderHook(() => usePrepahubData());
    act(() => a.result.current.saveReviewItems([item("Revoir IPP")]));
    const late = renderHook(() => usePrepahubData());
    expect(late.result.current.ready).toBe(true);
    expect(late.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Revoir IPP"]);
  });

  it("la synchronisation qui réécrit le disque est vue par toutes les copies", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    act(() => {
      localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify([item("Venu du cloud")]));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    });
    expect(a.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Venu du cloud"]);
    expect(b.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Venu du cloud"]);
  });

  it("une écriture d'un AUTRE onglet (événement storage) est vue par toutes les copies", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    act(() => {
      localStorage.setItem(STORAGE_KEYS.reviewItems, JSON.stringify([item("Autre onglet")]));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEYS.reviewItems }));
    });
    expect(a.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Autre onglet"]);
    expect(b.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Autre onglet"]);
  });

  it("une écriture refusée (quota) : toutes les copies montrent ce qui est RÉELLEMENT sur le disque, et le refus", () => {
    const a = renderHook(() => usePrepahubData());
    const b = renderHook(() => usePrepahubData());
    act(() => a.result.current.saveReviewItems([item("Enregistrée")]));
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      act(() => a.result.current.saveReviewItems([...a.result.current.reviewItems, item("Refusée")]));
    } finally {
      Storage.prototype.setItem = setItem;
    }
    expect(b.result.current.reviewItems.map((entry) => entry.text)).toEqual(["Enregistrée"]);
    expect(a.result.current.writeFailedAt).not.toBeNull();
    expect(b.result.current.writeFailedAt).toBe(a.result.current.writeFailedAt);
  });

  it("une écriture ne change pas la référence des collections qu'elle ne touche pas (pas de recalcul inutile)", () => {
    const a = renderHook(() => usePrepahubData());
    const sessionsBefore = a.result.current.sessions;
    act(() => a.result.current.saveReviewItems([item("Revoir IPP")]));
    expect(a.result.current.sessions).toBe(sessionsBefore);
  });
});
