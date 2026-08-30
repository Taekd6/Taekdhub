import { describe, expect, it } from "vitest";
import { totalXp, xpFromSession } from "@/lib/gamification";
import { computeNotionEvidence } from "@/lib/notions";
import {
  comfortDifficulty,
  computeWorkingLevel,
  countsAsAttempt,
  isAutonomousSuccess,
  recommendExercises,
  wasAssistedSuccess,
} from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * DU GESTE DE L'ÉLÈVE AU SIGNAL REÇU PAR LES MOTEURS.
 *
 * TaekdHub ne corrige aucune réponse : il n'y a ni QCM, ni saisie numérique,
 * ni comparaison à un corrigé. L'élève déclare lui-même « Réussi / Partiel /
 * Échoué » en fin de séance focus. La question que ces tests posent n'est
 * donc PAS « la correction est-elle juste ? » mais la seule qui se pose ici :
 * **le signal transmis aux moteurs correspond-il à ce que l'élève a
 * réellement fait ?**
 *
 * Deux écarts mesurés en parcours réel avant correctif :
 *
 * 1. Correction entière révélée, puis « Réussi » → `hints_used: 0`, soit la
 *    preuve d'autonomie MAXIMALE, pour un élève qui venait de lire la
 *    solution. Le produit dégradait le signal pour un seul indice sur trois
 *    et ignorait l'aide totale.
 * 2. Tentative de 42 secondes → `attempts` inchangé, aucune XP, aucun jour de
 *    série (le produit dit : il ne s'est rien passé), mais Radiographie,
 *    palier de difficulté et classement la comptaient à plein poids. Deux
 *    définitions contradictoires de « tentative » cohabitaient.
 *
 * Les scénarios ci-dessous fixent la lecture unique retenue.
 */

const NOW = new Date("2026-08-30T18:00:00.000Z");

function makeExercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    subject: "Mathématiques",
    title: "Intégration par parties",
    chapter_id: null,
    source: "Banque",
    type: "exercice",
    statement: "Calculer l'intégrale.",
    correction: "Poser u = ln(x).",
    hints: ["I1", "I2", "I3"],
    prerequisites: ["Intégration par parties"],
    difficulty: 3,
    mastery: 50,
    status: "en cours",
    attempts: 1,
    last_worked_at: "2026-08-29T10:00:00.000Z",
    favorite: false,
    archived: false,
    estimated_minutes: 30,
    created_at: "2026-01-01T00:00:00.000Z",
    external_id: null,
    tags: [],
    ...over,
  } as Exercise;
}

/** Une tentative de 30 minutes, réussie, sans aucune aide — le cas de référence. */
function makeAttempt(over: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s-1",
    subject: "Mathématiques",
    exercise_id: "ex-1",
    started_at: "2026-08-30T17:00:00.000Z",
    ended_at: "2026-08-30T17:30:00.000Z",
    duration_seconds: 1800,
    note: null,
    created_at: "2026-08-30T17:30:00.000Z",
    result: "réussi",
    hints_used: 0,
    correction_viewed: false,
    ...over,
  };
}

describe("scénario 1 — correction révélée puis « Réussi »", () => {
  const lue = makeAttempt({ correction_viewed: true });

  it("n'est PAS une réussite autonome, malgré `hints_used: 0`", () => {
    expect(isAutonomousSuccess(lue)).toBe(false);
    expect(wasAssistedSuccess(lue)).toBe(true);
  });

  it("vaut le demi-tarif d'XP, comme une réussite à coups d'indices", () => {
    expect(xpFromSession(lue, 3)).toBe(xpFromSession(makeAttempt({ hints_used: 3 }), 3));
    expect(xpFromSession(lue, 3)).toBeLessThan(xpFromSession(makeAttempt(), 3));
  });

  it("ne rend pas la notion « solide » là où deux réussites autonomes le feraient", () => {
    const exercises = [makeExercise()];
    const autonomes = [makeAttempt({ id: "a" }), makeAttempt({ id: "b", started_at: "2026-08-29T17:00:00.000Z" })];
    const lues = autonomes.map((s) => ({ ...s, correction_viewed: true }));

    expect(computeNotionEvidence(exercises, autonomes)[0].state).toBe("solide");
    expect(computeNotionEvidence(exercises, lues)[0].state).not.toBe("solide");
  });

  it("ne fait pas monter le palier de difficulté visé", () => {
    const exercises = [makeExercise()];
    const troisAutonomes = [0, 1, 2].map((i) =>
      makeAttempt({ id: `a${i}`, started_at: new Date(NOW.getTime() - i * 86400000).toISOString() })
    );
    const troisLues = troisAutonomes.map((s) => ({ ...s, correction_viewed: true }));

    expect(comfortDifficulty(exercises, troisAutonomes)?.steppedUp).toBe(true);
    expect(comfortDifficulty(exercises, troisLues)?.steppedUp).toBe(false);
  });

  it("laisse l'exercice signalé comme réussi AVEC AIDE, donc à reproposer", () => {
    const [top] = recommendExercises([makeExercise()], [lue], 60, { now: NOW });
    expect(top.reasons).toContain("Réussi avec aide");
  });
});

describe("scénario 2 — réussite réellement autonome", () => {
  it("reste le signal le plus fort du produit, inchangé par ce chantier", () => {
    const seul = makeAttempt();
    expect(isAutonomousSuccess(seul)).toBe(true);
    expect(wasAssistedSuccess(seul)).toBe(false);
    expect(xpFromSession(seul, 3)).toBe(30);
  });
});

describe("scénario 3 — séance antérieure au suivi des indices", () => {
  const ancienne = makeAttempt({ hints_used: null, correction_viewed: null });

  it("n'est créditée d'aucune autonomie : l'absence de preuve n'est pas une preuve", () => {
    expect(isAutonomousSuccess(ancienne)).toBe(false);
  });

  it("n'est pas non plus déclarée assistée — l'absence de preuve ne sanctionne pas davantage", () => {
    expect(wasAssistedSuccess(ancienne)).toBe(false);
  });

  it("NON-RÉGRESSION : garde le plein tarif d'XP qu'elle a toujours eu", () => {
    // Appliquer ici la définition stricte de l'autonomie aurait divisé par
    // deux, rétroactivement et sans que l'élève ait rien fait, toute l'XP
    // acquise avant ces champs.
    expect(xpFromSession(ancienne, 3)).toBe(30);
  });
});

describe("scénario 4 — tentative de moins d'une minute", () => {
  const éclair = makeAttempt({ duration_seconds: 42 });

  it("ne compte comme tentative pour AUCUN moteur", () => {
    expect(countsAsAttempt(éclair)).toBe(false);
  });

  it("n'apprend rien à la Radiographie", () => {
    const notion = computeNotionEvidence([makeExercise()], [éclair])[0];
    expect(notion.attempts).toBe(0);
    expect(notion.state).toBe("jamais testée");
  });

  it("ne déplace pas le palier de difficulté visé", () => {
    const trois = [0, 1, 2].map((i) => makeAttempt({ id: `f${i}`, duration_seconds: 42 }));
    expect(comfortDifficulty([makeExercise()], trois)).toBeNull();
    expect(computeWorkingLevel([makeExercise()], trois)).toBeNull();
  });

  it("COHÉRENCE : ce que l'XP refuse de créditer, les moteurs refusent d'interpréter", () => {
    // C'était l'incohérence de fond : 0 XP, 0 tentative sur la fiche, mais un
    // signal pédagogique à plein poids.
    expect(xpFromSession(éclair, 3)).toBe(0);
    expect(countsAsAttempt(éclair)).toBe(false);
  });
});

describe("scénario 5 — les trois bords du seuil d'une minute", () => {
  it("59 s ne compte pas, 60 s et 61 s comptent : le seuil exclut ce qui est en dessous, pas ce qui l'atteint", () => {
    expect(countsAsAttempt(makeAttempt({ duration_seconds: 59 }))).toBe(false);
    expect(countsAsAttempt(makeAttempt({ duration_seconds: 60 }))).toBe(true);
    expect(countsAsAttempt(makeAttempt({ duration_seconds: 61 }))).toBe(true);
  });

  it("l'XP franchit le seuil au même endroit exactement", () => {
    // Deux définitions du même seuil qui divergeraient d'une seconde
    // suffiraient à recréer l'incohérence que ce chantier ferme.
    expect(xpFromSession(makeAttempt({ duration_seconds: 59 }), 3)).toBe(0);
    expect(xpFromSession(makeAttempt({ duration_seconds: 60 }), 3)).toBe(30);
    expect(xpFromSession(makeAttempt({ duration_seconds: 61 }), 3)).toBe(30);
  });

  it("une durée impossible ne crédite rien, et les deux moteurs sont d'accord", () => {
    // `NaN` rendait `<= 0` faux, traversait le garde et créditait le plein
    // tarif — pendant que `countsAsAttempt` refusait la même séance.
    // `normalizeSession` ramène déjà toute durée non finie à 0 à la lecture,
    // donc le cas n'est pas atteignable : seconde ligne de défense.
    for (const impossible of [NaN, -30, Number.NEGATIVE_INFINITY]) {
      const session = makeAttempt({ duration_seconds: impossible });
      expect(xpFromSession(session, 3)).toBe(0);
      expect(countsAsAttempt(session)).toBe(false);
    }
  });
});

describe("scénario 6 — séance libre du chronomètre", () => {
  it("n'est jamais une tentative : sans exercice, il n'y a rien à réussir", () => {
    const libre = makeAttempt({ exercise_id: null, result: null, hints_used: null, correction_viewed: null });
    expect(countsAsAttempt(libre)).toBe(false);
  });
});

describe("scénario 7 — un historique entièrement antérieur à ces champs", () => {
  it("NON-RÉGRESSION : produit exactement le même total d'XP qu'avant le chantier", () => {
    const exercises = [makeExercise({ status: "en cours" })];
    const legacy = [0, 1, 2].map((i) =>
      makeAttempt({
        id: `l${i}`,
        hints_used: null,
        correction_viewed: null,
        started_at: new Date(NOW.getTime() - i * 86400000).toISOString(),
      })
    );
    // 3 réussites sur le même exercice : plein tarif, puis moitié, puis rien
    // (REPEAT_SHARES) — 30 + 15 + 0.
    expect(totalXp(exercises, legacy)).toBe(45);
  });
});
