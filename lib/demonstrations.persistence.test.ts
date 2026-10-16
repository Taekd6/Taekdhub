// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { demoStatus, parseRestitution, recordRestitution, recurringGaps } from "@/lib/demonstrations";
import { localData } from "@/lib/storage";

const NOW = new Date(2026, 9, 16, 18, 0);
const JSON_TEXT = (date: string) => JSON.stringify({ demonstration: "m1-theoreme-du-rang", date, resultat: "incomplète", aide: "sans", lacunes: [{ type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }] });

function save(date: string) {
  const parsed = parseRestitution(JSON_TEXT(date), "2026-10-16");
  if (!parsed.ok) throw new Error("invalide");
  expect(localData.saveAttempts(recordRestitution(localData.attempts(), parsed.value, NOW))).toBe(true);
}

describe("les restitutions survivent au rechargement et ne se doublent pas", () => {
  beforeEach(() => window.localStorage.clear());

  it("relues depuis le stockage : même état, mêmes lacunes", () => {
    save("2026-10-01");
    save("2026-10-10");
    const reloaded = localData.attempts();
    expect(reloaded).toHaveLength(2);
    expect(reloaded[0].gaps).toEqual([{ kind: "hypothèse", detail: "Dimension finie oubliée" }]);
    expect(demoStatus("m1-theoreme-du-rang", reloaded, "2026-10-16").state).toBe("restitution-incomplète");
    expect(recurringGaps("m1-theoreme-du-rang", reloaded)).toHaveLength(1);
  });

  it("enregistrer deux fois la même restitution le même jour ne l'ajoute pas", () => {
    save("2026-10-10");
    save("2026-10-10");
    expect(localData.attempts()).toHaveLength(1);
  });

  it("le lien carte ↔ démonstration se relit depuis les réglages ; un ancien réglage sans lui donne vide", () => {
    expect(localData.preferences().demoCards).toEqual({});
    const prefs = localData.preferences();
    localData.savePreferences({ ...prefs, demoCards: { "m1-theoreme-du-rang": "2026-10-16T10:00:00.000Z" } });
    expect(localData.preferences().demoCards).toEqual({ "m1-theoreme-du-rang": "2026-10-16T10:00:00.000Z" });
  });
});
