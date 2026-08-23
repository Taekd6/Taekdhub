import { describe, expect, it } from "vitest";
import { resolveResumableFocus } from "@/lib/resume";

const usable = () => true;
const nothingUsable = () => false;

describe("resolveResumableFocus", () => {
  it("aucun signal : rien à reprendre", () => {
    expect(resolveResumableFocus(null, null, null, usable)).toBeNull();
  });

  it("draft prioritaire sur les deux autres, même s'ils existent aussi", () => {
    const draft = { exerciseId: "ex-1", seconds: 120 };
    const active = { exerciseId: "ex-2", seconds: 30 };
    const checkpoint = { exerciseId: "ex-3", seconds: 600 };
    expect(resolveResumableFocus(draft, active, checkpoint, usable)).toEqual(draft);
  });

  it("séance active (sessionStorage) prioritaire sur le checkpoint quand aucun draft", () => {
    const active = { exerciseId: "ex-2", seconds: 30 };
    const checkpoint = { exerciseId: "ex-3", seconds: 600 };
    expect(resolveResumableFocus(null, active, checkpoint, usable)).toEqual(active);
  });

  it("checkpoint en dernier recours quand rien d'autre n'est disponible", () => {
    const checkpoint = { exerciseId: "ex-3", seconds: 600 };
    expect(resolveResumableFocus(null, null, checkpoint, usable)).toEqual(checkpoint);
  });

  it("un exercice supprimé/archivé entre-temps ne doit jamais être proposé — passe au signal suivant", () => {
    const draft = { exerciseId: "ex-1", seconds: 120 };
    const active = { exerciseId: "ex-2", seconds: 30 };
    const isUsable = (id: string) => id !== "ex-1";
    expect(resolveResumableFocus(draft, active, null, isUsable)).toEqual(active);
  });

  it("aucun signal usable : rien à reprendre plutôt qu'une fiche qui n'existe plus", () => {
    const draft = { exerciseId: "ex-1", seconds: 120 };
    expect(resolveResumableFocus(draft, null, null, nothingUsable)).toBeNull();
  });
});
