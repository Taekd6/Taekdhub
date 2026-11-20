import { describe, expect, it } from "vitest";
import { bookmarkletHref, decodeFragment, encodeFragment, normalizeBooleanopera, parseBilanText } from "@/lib/booleanopera";

const NOW = new Date("2026-11-20T22:00:00.000Z");
const PAGE = `Vue Synthétique Élève PASSAGES AU TABLEAU 2 passage(s) ASSIGNATIONS (COURS & TD) 3 faites • 1 en cours
BRIQUES TRAVAILLÉES SUR LE SITE 12 briques pointées 7 acquises • 4 en cours • 1 à revoir`;

describe("booleanopera", () => {
  it("lit le bilan", () => {
    expect(parseBilanText(PAGE, NOW)).toEqual({
      takenAt: NOW.toISOString(),
      bricks: 12,
      acquired: 7,
      inProgress: 4,
      toReview: 1,
      boardPassages: 2,
      assignmentsDone: 3,
      assignmentsOpen: 1,
    });
  });

  it("ne devine rien sur une page inconnue", () => {
    expect(parseBilanText("Page de connexion", NOW)).toBeNull();
  });

  it("fait l'aller-retour par le fragment", () => {
    const report = parseBilanText(PAGE, NOW)!;
    expect(decodeFragment("#" + encodeFragment(report))).toEqual(report);
  });

  it("refuse un fragment abîmé ou étranger", () => {
    expect(decodeFragment("#bo=%%%")).toBeNull();
    expect(decodeFragment("#autre=abc")).toBeNull();
    expect(decodeFragment("#bo=" + "a".repeat(3000))).toBeNull();
  });

  it("borne et nettoie les nombres", () => {
    const report = normalizeBooleanopera({ takenAt: NOW.toISOString(), bricks: -4, acquired: "x", inProgress: 1e12, toReview: 2.6 });
    expect(report).toMatchObject({ bricks: 0, acquired: 0, inProgress: 100000, toReview: 3 });
    expect(normalizeBooleanopera({ bricks: 3 })).toBeNull();
  });

  it("fabrique un signet qui vise l'adresse de TaekdHub", () => {
    const href = bookmarkletHref("https://taekdhub.vercel.app/");
    expect(href.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(href)).toContain("https://taekdhub.vercel.app/exos");
  });
});
