// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorLog } from "@/components/errors/error-log";
import { createErrorEntry } from "@/lib/error-log";
import { STORAGE_KEYS } from "@/lib/storage";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/erreurs" }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function seed(entries: object[]) {
  localStorage.setItem(STORAGE_KEYS.errors, JSON.stringify(entries));
}

describe("journal des erreurs — où revoir la notion", () => {
  it("indique les cartes du référentiel à revoir pour une erreur dont le chapitre est connu, et seulement pour elle", () => {
    const today = new Date();
    const debrief = createErrorEntry({ subject: "Mathématiques", source: "DS", type: "cours", description: "Oubli du polynôme minimal" }, today)!;
    const manual = createErrorEntry({ subject: "Mathématiques", source: "DS", type: "calcul", description: "Erreur de signe" }, today)!;
    seed([{ ...debrief, programmeChapterId: "m2-reduction" }, manual]);
    render(createElement(ErrorLog));
    expect(screen.getByText("Oubli du polynôme minimal")).toBeTruthy();
    const hints = screen.getAllByText(/Cartes à revoir sur/);
    expect(hints).toHaveLength(1);
    expect(hints[0].textContent).toContain("Réduction des endomorphismes");
    expect(hints[0].textContent).toContain("« reduction »");
    expect(hints[0].textContent).toContain("(référentiel)");
  });

  it("n'affiche rien pour un chapitre sans paquet sûr", () => {
    const entry = createErrorEntry({ subject: "Mathématiques", source: "DS", type: "cours", description: "Oubli de la récurrence forte" })!;
    seed([{ ...entry, programmeChapterId: "m1-logique" }]);
    render(createElement(ErrorLog));
    expect(screen.getByText("Oubli de la récurrence forte")).toBeTruthy();
    expect(screen.queryByText(/Cartes à revoir sur/)).toBeNull();
  });
});
