import { describe, expect, it } from "vitest";
import { FORMULAIRE, formulaGroups } from "@/lib/formulaire-data";
import { cardsFor, groupMastery, weakestCards } from "@/lib/formulaire";
import { drawQuestion, recordGrade } from "@/lib/kholle";

const NOW = new Date(2026, 9, 2, 18, 0);
const OLD = new Date(2026, 8, 1, 18, 0);

describe("données du formulaire", () => {
  it("des identifiants uniques, un recto et un verso pour chaque carte", () => {
    expect(new Set(FORMULAIRE.map((card) => card.id)).size).toBe(FORMULAIRE.length);
    for (const card of FORMULAIRE) {
      expect(card.front.trim()).not.toBe("");
      expect(card.back.trim()).not.toBe("");
    }
  });

  it("des rubriques par matière, dans l'ordre du formulaire", () => {
    expect(formulaGroups("Mathématiques")[0]).toBe("DL usuels en 0");
    expect(formulaGroups("Chimie")).toContain("Cristallographie");
  });
});

describe("tirage et maîtrise", () => {
  const dl = cardsFor("Mathématiques", ["DL usuels en 0"]);

  it("filtre par matière et par rubrique", () => {
    expect(dl.every((card) => card.group === "DL usuels en 0")).toBe(true);
    expect(cardsFor("Physique", null).every((card) => card.subject === "Physique")).toBe(true);
  });

  it("compte sues, à revoir et jamais vues d'après le dernier résultat", () => {
    let history = recordGrade({}, dl[0].id, "su", OLD);
    history = recordGrade(history, dl[1].id, "pas su", OLD);
    history = recordGrade(history, dl[2].id, "hésitant", OLD);
    expect(groupMastery(dl, history)).toEqual({ su: 1, toReview: 2, unseen: dl.length - 3 });
  });

  it("les cartes ratées passent avant les hésitantes", () => {
    let history = recordGrade({}, dl[1].id, "hésitant", OLD);
    history = recordGrade(history, dl[2].id, "pas su", OLD);
    expect(weakestCards(dl, history, NOW).map((card) => card.id)).toEqual([dl[2].id, dl[1].id]);
  });

  it("le tirage de la khôlle fonctionne aussi sur les cartes", () => {
    expect(drawQuestion(dl, {}, NOW, new Set(), () => 0)?.id).toBe(dl[0].id);
  });
});
