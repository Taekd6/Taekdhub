import { describe, expect, it } from "vitest";
import { computePilotagePhrase } from "@/lib/pilotage";

/**
 * Micro-sprint polish UX final — Micro-amélioration 1. Sept états requis par
 * le brief : objectif atteint ; dans le rythme ; retard global ; matière
 * prioritaire ; matière prioritaire avec échéance ; aucune activité ;
 * aucune échéance. Ne duplique aucun test métier existant (le moteur de
 * pondération et `computeSubjectTrajectory` restent testés dans
 * lib/plan.test.ts) — vérifie uniquement la composition en phrase.
 */

const base = { weeklyGoalMet: false, weeklyPace: null as null, workedMinutes: 0, trajectoryBySubject: [] };

describe("computePilotagePhrase", () => {
  it("objectif atteint — prime sur tout autre signal", () => {
    expect(
      computePilotagePhrase({
        ...base,
        weeklyGoalMet: true,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Physique", status: "prioritaire", deadlineDays: 2 }],
      })
    ).toBe("Objectif de la semaine atteint. Bien joué.");
  });

  it("dans le rythme — aucune matière prioritaire", () => {
    expect(computePilotagePhrase({ ...base, weeklyPace: "dans le rythme" })).toBe("Tu es dans le rythme cette semaine. Continue comme ça.");
  });

  it("en avance — même phrase que \"dans le rythme\" (jamais signalé différemment)", () => {
    expect(computePilotagePhrase({ ...base, weeklyPace: "en avance" })).toBe("Tu es dans le rythme cette semaine. Continue comme ça.");
  });

  it("retard global — aucune matière prioritaire spécifique", () => {
    expect(computePilotagePhrase({ ...base, weeklyPace: "à travailler" })).toBe("Tu es un peu en retard cette semaine sur ton objectif.");
  });

  it("matière prioritaire sans échéance", () => {
    expect(
      computePilotagePhrase({
        ...base,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Physique", status: "prioritaire", deadlineDays: null }],
      })
    ).toBe("Concentre-toi sur Physique aujourd'hui : ta trajectoire est en retard cette semaine.");
  });

  it("matière prioritaire avec échéance proche", () => {
    expect(
      computePilotagePhrase({
        ...base,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Physique", status: "prioritaire", deadlineDays: 3 }],
      })
    ).toBe("Concentre-toi sur Physique aujourd'hui : ton échéance approche (dans 3 j) et ta trajectoire est en retard.");
  });

  it("matière prioritaire, échéance demain/aujourd'hui — libellés spéciaux", () => {
    expect(
      computePilotagePhrase({
        ...base,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Chimie", status: "prioritaire", deadlineDays: 1 }],
      })
    ).toContain("(demain)");
    expect(
      computePilotagePhrase({
        ...base,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Chimie", status: "prioritaire", deadlineDays: 0 }],
      })
    ).toContain("(aujourd'hui)");
  });

  it("ignore une matière \"à renforcer\" (pas assez urgent pour dominer la phrase)", () => {
    expect(
      computePilotagePhrase({
        ...base,
        weeklyPace: "à travailler",
        trajectoryBySubject: [{ subject: "Physique", status: "à renforcer", deadlineDays: 2 }],
      })
    ).toBe("Tu es un peu en retard cette semaine sur ton objectif.");
  });

  it("aucune activité — pace pas encore mesurable (début de semaine), rien travaillé", () => {
    expect(computePilotagePhrase({ ...base, weeklyPace: null, workedMinutes: 0 })).toBe(
      "Aucune activité cette semaine pour l'instant — lance ta première séance."
    );
  });

  it("aucune échéance connue — la phrase de retard/prioritaire reste correcte sans jamais afficher \"null\"", () => {
    const phrase = computePilotagePhrase({
      ...base,
      weeklyPace: "à travailler",
      trajectoryBySubject: [{ subject: "Mathématiques", status: "prioritaire", deadlineDays: null }],
    });
    expect(phrase).not.toContain("null");
    expect(phrase).not.toContain("undefined");
  });

  it("pace null mais déjà un peu de travail (trop tôt pour juger) — aucune phrase creuse", () => {
    expect(computePilotagePhrase({ ...base, weeklyPace: null, workedMinutes: 20 })).toBeNull();
  });
});
