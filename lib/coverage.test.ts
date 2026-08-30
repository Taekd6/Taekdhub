import { describe, expect, it } from "vitest";
import {
  computeSubjectCoverage,
  coverageSlotsFor,
  longestSilence,
  COVERAGE_REASON_PREFIX,
  SUBJECT_DEBT_DAYS,
} from "@/lib/coverage";
import { computeDailyPlan, planIntent, PLAN_DURATION_PRESETS } from "@/lib/plan";
import { computeGoalsDailyPlan, scopeToGoal } from "@/lib/goals";
import type { Goal } from "@/lib/storage";
import { explainReasons, recommendExercises, MASTERY_STALE_DAYS } from "@/lib/recommendation";
import { CHAPTER_STALE_DAYS } from "@/lib/next-action";
import type { Chapter } from "@/lib/storage";
import type { AttemptResult, Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const created = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${counter}`,
    subject: "Mathématiques",
    title: `Exercice ${counter}`,
    statement: "",
    chapter_id: null,
    source: "Test",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    source_url: null,
    prerequisites: [],
    pedagogical_goal: null,
    level: null,
    type: "TD",
    difficulty: 3,
    mastery: 0 as Mastery,
    status: "à faire",
    estimated_minutes: 20,
    attempts: 0,
    note: null,
    created_at: created,
    updated_at: created,
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

let sessionCounter = 0;
function makeSession(exercise: Exercise, days: number, result: AttemptResult | null = "réussi", hintsUsed: number | null = 0): WorkSession {
  sessionCounter += 1;
  return {
    id: `ws-${sessionCounter}`,
    subject: exercise.subject,
    exercise_id: exercise.id,
    started_at: daysAgo(days),
    ended_at: daysAgo(days),
    duration_seconds: 1200,
    note: null,
    created_at: daysAgo(days),
    result,
    hints_used: hintsUsed,
  };
}

/** Une banque plausible : plusieurs matières, plusieurs chapitres, des durées variées. */
function bank(): { exercises: Exercise[]; chapters: Chapter[] } {
  const chapters: Chapter[] = [
    { id: "ch-m1", subject: "Mathématiques", label: "Suites" },
    { id: "ch-m2", subject: "Mathématiques", label: "Complexes" },
    { id: "ch-p1", subject: "Physique", label: "Ondes" },
    { id: "ch-c1", subject: "Chimie", label: "Équilibres" },
  ];
  const exercises = [
    ...Array.from({ length: 6 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-m1", estimated_minutes: 20 })),
    ...Array.from({ length: 6 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-m2", estimated_minutes: 15 })),
    ...Array.from({ length: 5 }, () => makeExercise({ subject: "Physique", chapter_id: "ch-p1", estimated_minutes: 20 })),
    ...Array.from({ length: 5 }, () => makeExercise({ subject: "Chimie", chapter_id: "ch-c1", estimated_minutes: 15 })),
  ];
  return { exercises, chapters };
}

const candidatesFor = (exercises: Exercise[], sessions: WorkSession[]) =>
  recommendExercises(exercises.filter((exercise) => !exercise.archived), sessions, exercises.length, { now: NOW });

const coverageFor = (exercises: Exercise[], sessions: WorkSession[]) =>
  computeSubjectCoverage(candidatesFor(exercises, sessions), exercises, sessions, NOW);

// ═══════════════════════════════════════════════════════════════════════════
describe("computeSubjectCoverage — quatre états, jamais un score", () => {
  it("une matière jamais travaillée est « jamais ouverte », jamais « délaissée »", () => {
    // L'absence de contact peut vouloir dire « pas encore traité en cours » —
    // information que l'app ne possède pas. Elle ne doit donc jamais devenir
    // un reproche (même principe que « jamais testée », lib/notions.ts).
    const { exercises } = bank();
    const entry = coverageFor(exercises, []).find((item) => item.subject === "Chimie")!;
    expect(entry.state).toBe("jamais ouverte");
    expect(entry.engaged).toBe(false);
    expect(entry.daysSinceContact).toBeNull();
    expect(entry.debtDays).toBe(0);
  });

  it("une matière travaillée récemment est « à jour »", () => {
    const { exercises } = bank();
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    const entry = coverageFor(exercises, [makeSession(chimie, 2)]).find((item) => item.subject === "Chimie")!;
    expect(entry.state).toBe("à jour");
    expect(entry.daysSinceContact).toBe(2);
  });

  it("une matière engagée mais silencieuse au-delà du seuil est « délaissée », avec sa dette", () => {
    const { exercises } = bank();
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    const entry = coverageFor(exercises, [makeSession(chimie, SUBJECT_DEBT_DAYS + 4)]).find((item) => item.subject === "Chimie")!;
    expect(entry.state).toBe("délaissée");
    expect(entry.daysSinceContact).toBe(SUBJECT_DEBT_DAYS + 4);
    expect(entry.debtDays).toBe(4);
  });

  it("une matière sans rien en attente n'est jamais délaissée, quel que soit son silence", () => {
    // Rien à reprocher à une matière terminée : elle sort du cycle.
    const exercises = [makeExercise({ subject: "Chimie", status: "maîtrisé", mastery: 100 as Mastery, last_worked_at: daysAgo(1) })];
    const sessions = [makeSession(exercises[0], 90)];
    const entry = coverageFor(exercises, sessions).find((item) => item.subject === "Chimie")!;
    expect(entry.pendingCount).toBe(0);
    expect(entry.state).toBe("à jour (rien en attente)");
  });

  it("omet les matières sans aucun exercice actif — une zone vide ne peut pas être délaissée", () => {
    const { exercises } = bank();
    const covered = coverageFor(exercises, []).map((entry) => entry.subject);
    expect(covered).toEqual(["Mathématiques", "Physique", "Chimie"]);
    expect(covered).not.toContain("Français");
    expect(covered).not.toContain("Anglais");
  });

  it("une séance libre (sans exercice) ne remet pas la dette à zéro", () => {
    // Elle porte bien une matière, mais rien ne dit sur quoi elle a porté :
    // elle ne prouve aucun contact avec le travail restant.
    const { exercises } = bank();
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    const free: WorkSession = { ...makeSession(chimie, 0), exercise_id: null, subject: "Chimie" };
    const old = makeSession(chimie, SUBJECT_DEBT_DAYS + 5);
    const entry = coverageFor(exercises, [free, old]).find((item) => item.subject === "Chimie")!;
    expect(entry.state).toBe("délaissée");
  });

  it("ne compte pas une séance rattachée à un exercice archivé", () => {
    const { exercises } = bank();
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    chimie.archived = true;
    const entry = coverageFor(exercises, [makeSession(chimie, 1)]).find((item) => item.subject === "Chimie")!;
    expect(entry.engaged).toBe(false);
  });
});

describe("longestSilence — un maximum, jamais une moyenne", () => {
  it("désigne la matière au plus long silence, pas la moyenne des matières", () => {
    // Une moyenne se laisse compenser : deux matières fraîches masqueraient
    // une matière abandonnée depuis un mois — exactement ce qu'il faut voir.
    const { exercises } = bank();
    const maths = exercises.find((exercise) => exercise.subject === "Mathématiques")!;
    const physique = exercises.find((exercise) => exercise.subject === "Physique")!;
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    const coverage = coverageFor(exercises, [makeSession(maths, 0), makeSession(physique, 1), makeSession(chimie, 30)]);
    expect(longestSilence(coverage)?.subject).toBe("Chimie");
    expect(longestSilence(coverage)?.daysSinceContact).toBe(30);
  });

  it("se tait quand aucune matière engagée n'attend — pas d'inquiétude inventée", () => {
    const { exercises } = bank();
    expect(longestSilence(coverageFor(exercises, []))).toBeNull();
  });
});

describe("coverageSlotsFor — une place, jamais une enveloppe", () => {
  it("n'accorde AUCUNE place de couverture en dessous de 45 minutes", () => {
    // Le choix le plus important du module : avec un seul exercice au
    // programme, sacrifier le point faible du jour pour de la couverture est
    // un mauvais échange. Le produit le dit à l'écran plutôt que de le forcer.
    expect(coverageSlotsFor(20)).toBe(0);
    expect(coverageSlotsFor(30)).toBe(0);
    expect(coverageSlotsFor(44)).toBe(0);
  });

  it("accorde une place à partir de 45 min, deux à partir de 2 h", () => {
    expect(coverageSlotsFor(45)).toBe(1);
    expect(coverageSlotsFor(90)).toBe(1);
    expect(coverageSlotsFor(120)).toBe(2);
    expect(coverageSlotsFor(360)).toBe(2);
  });
});

describe("cohérence des trois horloges du produit", () => {
  it("CHAPTER_STALE_DAYS < SUBJECT_DEBT_DAYS < MASTERY_STALE_DAYS", () => {
    // Une matière est un objet plus gros qu'un chapitre et plus petit qu'un
    // exercice maîtrisé : son seuil se place entre les deux. Ce test empêche
    // les trois notions d'oubli du produit de dériver l'une par rapport aux
    // autres au fil des sprints.
    //
    // Les trois constantes sont IMPORTÉES. Une version précédente recopiait
    // `CHAPTER_STALE_DAYS = 7` en dur avec la mention « constante privée » :
    // le test passait quoi qu'il arrive, et la garantie annoncée dans la doc
    // de SUBJECT_DEBT_DAYS était purement cosmétique.
    expect(CHAPTER_STALE_DAYS).toBeLessThan(SUBJECT_DEBT_DAYS);
    expect(SUBJECT_DEBT_DAYS).toBeLessThan(MASTERY_STALE_DAYS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANTS DU PLAN — ce que le système promet vraiment
// ═══════════════════════════════════════════════════════════════════════════

/** Un profil où la Chimie est engagée puis abandonnée, et où les maths posent un vrai problème. */
function neglectedChemistryProfile() {
  const { exercises, chapters } = bank();
  const maths = exercises.filter((exercise) => exercise.subject === "Mathématiques");
  const chimie = exercises.filter((exercise) => exercise.subject === "Chimie");
  const sessions: WorkSession[] = [
    // Échecs récents en maths → une faiblesse avérée, qui doit primer.
    makeSession(maths[0], 1, "échoué", 3),
    makeSession(maths[1], 2, "échoué", 3),
    makeSession(maths[2], 3, "échoué", 3),
    // La chimie a bien été travaillée… il y a longtemps.
    makeSession(chimie[0], SUBJECT_DEBT_DAYS + 8),
  ];
  maths.slice(0, 3).forEach((exercise) => {
    exercise.attempts = 1;
    exercise.status = "à revoir";
    exercise.last_worked_at = daysAgo(1);
  });
  chimie[0].attempts = 1;
  chimie[0].last_worked_at = daysAgo(SUBJECT_DEBT_DAYS + 8);
  return { exercises, chapters, sessions };
}

/**
 * Ce que `deferred` DOIT valoir : les matières en retard qu'aucun exercice du
 * plan ne touche. Recalculé ici à partir des seuls blocs, pour que le test
 * vérifie la propriété et non la ligne de code qui la produit.
 */
function expectedDeferred(plan: ReturnType<typeof computeDailyPlan>) {
  const touched = new Set(plan.blocks.flatMap((block) => block.picks.map((pick) => pick.exercise.subject)));
  return plan.coverage.filter((entry) => entry.state === "délaissée" && !touched.has(entry.subject));
}

describe("computeDailyPlan — invariants de budget (inchangés)", () => {
  it("I1 — ne rend jamais plus de minutes que le budget demandé", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    for (const budget of [10, 20, 30, 45, 60, 90, 120, 240, 480]) {
      const plan = computeDailyPlan(exercises, sessions, chapters, budget, NOW);
      expect(plan.totalMinutes, `budget ${budget}`).toBeLessThanOrEqual(budget);
    }
  });

  it("I2 — aucun exercice n'apparaît deux fois dans un plan", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    for (const budget of PLAN_DURATION_PRESETS) {
      const ids = computeDailyPlan(exercises, sessions, chapters, budget, NOW).blocks.flatMap((block) =>
        block.picks.map((pick) => pick.exercise.id)
      );
      expect(new Set(ids).size, `budget ${budget}`).toBe(ids.length);
    }
  });

  it("I3 — déterminisme : deux appels identiques produisent le même plan", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    const a = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const b = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("computeDailyPlan — la couverture ne prend jamais le pas sur la faiblesse", () => {
  it("I4/I5 — l'exercice le plus urgent reste dans le plan même quand une matière est délaissée", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    const withCoverage = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    // Le plan sans aucune dette de couverture, pour comparaison : mêmes
    // exercices, mais la chimie vient d'être travaillée.
    const fresh = [...sessions, makeSession(exercises.find((exercise) => exercise.subject === "Chimie")!, 0)];
    const withoutCoverage = computeDailyPlan(exercises, fresh, chapters, 90, NOW);

    const firstOf = (plan: typeof withCoverage) => plan.blocks[0]?.picks[0]?.exercise.id;
    expect(firstOf(withCoverage)).toBeDefined();
    expect(withCoverage.blocks.flatMap((b) => b.picks).some((p) => p.exercise.id === firstOf(withoutCoverage))).toBe(true);
  });

  it("I6 — AUCUNE place de couverture en dessous de 45 min, même avec une matière abandonnée", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    for (const budget of [20, 30, 44]) {
      const plan = computeDailyPlan(exercises, sessions, chapters, budget, NOW);
      const coveragePicks = plan.blocks
        .flatMap((block) => block.picks)
        .filter((pick) => pick.reasons.some((reason) => reason.startsWith(COVERAGE_REASON_PREFIX)));
      expect(coveragePicks, `budget ${budget}`).toHaveLength(0);
      // …et `deferred` dit exactement ce qui n'est pas touché — que la
      // matière soit entrée par une place de couverture ou par le tout-venant
      // de la consolidation. C'est l'invariant, pas un résultat particulier :
      // une matière en retard servie par un pick ordinaire EST travaillée,
      // donc elle n'est pas laissée de côté.
      expect(plan.deferred.map((entry) => entry.subject), `budget ${budget}`).toEqual(
        expectedDeferred(plan).map((entry) => entry.subject)
      );
    }
  });

  it("la matière délaissée obtient bien une place dès 45 minutes", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    const plan = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const covered = plan.blocks
      .flatMap((block) => block.picks)
      .filter((pick) => pick.reasons.some((reason) => reason.startsWith(COVERAGE_REASON_PREFIX)));
    expect(covered).toHaveLength(1);
    expect(covered[0].exercise.subject).toBe("Chimie");
    expect(plan.deferred).toEqual([]);
  });

  it("I6bis — jamais plus de places de couverture que le budget n'en autorise", () => {
    // Trois matières abandonnées simultanément, budget de 90 min : une seule
    // place. La couverture ne dévore jamais la séance.
    const { exercises, chapters } = bank();
    const perSubject = (subject: Subject) => exercises.find((exercise) => exercise.subject === subject)!;
    const sessions = (["Mathématiques", "Physique", "Chimie"] as Subject[]).map((subject, index) => {
      const exercise = perSubject(subject);
      exercise.attempts = 1;
      exercise.last_worked_at = daysAgo(SUBJECT_DEBT_DAYS + 5 + index);
      return makeSession(exercise, SUBJECT_DEBT_DAYS + 5 + index);
    });
    const plan = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const covered = plan.blocks
      .flatMap((block) => block.picks)
      .filter((pick) => pick.reasons.some((reason) => reason.startsWith(COVERAGE_REASON_PREFIX)));
    expect(covered.length).toBeLessThanOrEqual(coverageSlotsFor(90));
    expect(plan.deferred.map((entry) => entry.subject)).toEqual(expectedDeferred(plan).map((entry) => entry.subject));
  });

  it("I8 — une matière sans rien en attente ne déclenche jamais de réservation", () => {
    // Chimie entièrement maîtrisée ET fraîche : le moteur ne retient aucun de
    // ses exercices, la matière sort du cycle. Rien à couvrir, rien à différer.
    //
    // Le cas « maîtrisée mais silencieuse depuis trois mois » n'est
    // volontairement PAS testé ici : le moteur la rend alors de nouveau
    // candidate (`isStaleMastery`, au-delà de MASTERY_STALE_DAYS), donc elle a
    // bel et bien du travail en attente et mérite sa place. C'est cohérent, et
    // c'est exactement ce que la couverture doit respecter plutôt que
    // contourner.
    const { chapters } = bank();
    const chimie = Array.from({ length: 3 }, () =>
      makeExercise({ subject: "Chimie", chapter_id: "ch-c1", status: "maîtrisé", mastery: 100 as Mastery, attempts: 1, last_worked_at: daysAgo(3) })
    );
    const maths = Array.from({ length: 4 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-m1" }));
    const exercises = [...maths, ...chimie];
    const sessions = chimie.map((exercise) => makeSession(exercise, 3));

    const coverage = coverageFor(exercises, sessions).find((entry) => entry.subject === "Chimie")!;
    expect(coverage.pendingCount).toBe(0);
    expect(coverage.state).toBe("à jour (rien en attente)");

    const plan = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const covered = plan.blocks
      .flatMap((block) => block.picks)
      .filter((pick) => pick.reasons.some((reason) => reason.startsWith(COVERAGE_REASON_PREFIX)));
    expect(covered).toHaveLength(0);
    expect(plan.deferred).toEqual([]);
  });

  it("I14 — proposer n'est pas travailler : un plan ne rembourse pas la dette", () => {
    // Le plan d'hier a proposé de la chimie, l'élève ne l'a pas faite :
    // la dette est identique aujourd'hui.
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    const before = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const after = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const debt = (plan: typeof before) => plan.coverage.find((entry) => entry.subject === "Chimie")!.daysSinceContact;
    expect(debt(after)).toBe(debt(before));
  });
});

describe("computeDailyPlan — la couverture reste explicable", () => {
  it("I13 — une raison de couverture ne change JAMAIS l'intention pédagogique", () => {
    // Piège réel : `planIntent` teste `startsWith("Non retravaillé depuis")`.
    // Un préfixe mal choisi déplacerait silencieusement l'exercice en
    // « réviser » et casserait la structure annoncée à l'élève.
    for (const reasons of [["Jamais travaillé"], ["Plusieurs échecs"], ["Non retravaillé depuis 30 j"], ["Palier suivant (3 réussites d'affilée)"]]) {
      expect(planIntent([...reasons, `${COVERAGE_REASON_PREFIX}Chimie (14 j)`])).toBe(planIntent(reasons));
    }
  });

  it("I9/I10 — la raison de couverture produit une phrase qui cite le bon nombre de jours", () => {
    const { exercises, chapters, sessions } = neglectedChemistryProfile();
    const plan = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    const covered = plan.blocks.flatMap((block) => block.picks).find((pick) => pick.reasons.some((r) => r.startsWith(COVERAGE_REASON_PREFIX)))!;
    const expectedDays = plan.coverage.find((entry) => entry.subject === "Chimie")!.daysSinceContact;

    const sentence = explainReasons(covered.reasons);
    expect(sentence).toBeTruthy();
    expect(sentence).toContain("Chimie");
    expect(sentence).toContain(String(expectedDays));
    // Jamais le texte brut de la raison en dernier recours.
    expect(sentence).not.toBe(covered.reasons[0]);
  });

  it("un échec avéré explique mieux qu'un silence — l'ordre des règles le garantit", () => {
    expect(explainReasons(["Plusieurs échecs", `${COVERAGE_REASON_PREFIX}Chimie (14 j)`])).toContain("échoué plusieurs fois");
  });
});

describe("computeDailyPlan — pas de famine sur la durée", () => {
  it("I7 — en rejouant 21 jours, aucune matière en attente ne reste abandonnée", () => {
    // Le test qui répond littéralement à « ignorer la Chimie pendant trois
    // semaines ». L'élève fait chaque jour exactement ce qu'on lui propose.
    const { exercises, chapters } = bank();
    const sessions: WorkSession[] = [];
    const lastSeen = new Map<Subject, number>();

    for (let day = 21; day >= 1; day--) {
      const today = new Date(NOW.getTime() - day * 86400000);
      const plan = computeDailyPlan(exercises, sessions, chapters, 60, today);
      for (const block of plan.blocks) {
        for (const { exercise } of block.picks) {
          sessions.push({
            id: `sim-${sessions.length}`,
            subject: exercise.subject,
            exercise_id: exercise.id,
            started_at: today.toISOString(),
            ended_at: today.toISOString(),
            duration_seconds: 1200,
            note: null,
            created_at: today.toISOString(),
            result: "réussi",
            hints_used: 0,
          });
          const live = exercises.find((item) => item.id === exercise.id)!;
          live.attempts += 1;
          live.last_worked_at = today.toISOString();
          live.status = "en cours";
          lastSeen.set(exercise.subject, day);
        }
      }
    }

    // Toute matière qui avait encore du travail à faire a été touchée.
    const finalCoverage = coverageFor(exercises, sessions);
    for (const entry of finalCoverage) {
      if (entry.pendingCount === 0) continue;
      expect(lastSeen.has(entry.subject), `${entry.subject} n'a jamais été proposée en 21 jours`).toBe(true);
      expect(entry.daysSinceContact, `${entry.subject} abandonnée`).toBeLessThanOrEqual(SUBJECT_DEBT_DAYS + 7);
    }
  });
});

describe("computeDailyPlan — cas limites", () => {
  it("banque vide, budget nul, budget énorme : jamais d'erreur, jamais de plan incohérent", () => {
    const { exercises, chapters } = bank();
    expect(computeDailyPlan([], [], chapters, 60, NOW).blocks).toEqual([]);
    expect(computeDailyPlan([], [], chapters, 60, NOW).coverage).toEqual([]);
    expect(computeDailyPlan(exercises, [], chapters, 0, NOW).blocks).toEqual([]);
    const huge = computeDailyPlan(exercises, [], chapters, 480, NOW);
    expect(huge.totalMinutes).toBeLessThanOrEqual(480);
    expect(huge.totalExercises).toBeGreaterThan(0);
  });

  it("une seule matière : le mécanisme de couverture dégénère proprement en no-op", () => {
    const exercises = Array.from({ length: 5 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-m1" }));
    const plan = computeDailyPlan(exercises, [makeSession(exercises[0], SUBJECT_DEBT_DAYS + 5)], [{ id: "ch-m1", subject: "Mathématiques", label: "Suites" }], 90, NOW);
    // La matière est délaissée, elle reçoit sa place — et il n'y a rien d'autre à différer.
    expect(plan.deferred).toEqual([]);
    expect(plan.totalExercises).toBeGreaterThan(0);
  });

  it("tous les exercices d'une matière archivés : elle disparaît de la couverture", () => {
    const { exercises, chapters } = bank();
    exercises.filter((exercise) => exercise.subject === "Chimie").forEach((exercise) => (exercise.archived = true));
    const plan = computeDailyPlan(exercises, [], chapters, 90, NOW);
    expect(plan.coverage.map((entry) => entry.subject)).not.toContain("Chimie");
  });

  it("des exercices trop longs pour le budget ne bloquent jamais la couverture", () => {
    // La chimie est délaissée mais son meilleur candidat dure 75 min :
    // on passe au suivant plutôt que de geler la place.
    const { chapters } = bank();
    const maths = Array.from({ length: 4 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-m1" }));
    const longChem = makeExercise({ subject: "Chimie", chapter_id: "ch-c1", estimated_minutes: 200 });
    const exercises = [...maths, longChem];
    longChem.attempts = 1;
    longChem.last_worked_at = daysAgo(SUBJECT_DEBT_DAYS + 5);
    const plan = computeDailyPlan(exercises, [makeSession(longChem, SUBJECT_DEBT_DAYS + 5)], chapters, 60, NOW);
    expect(plan.totalMinutes).toBeLessThanOrEqual(60);
    // Impossible à caser : le produit le déclare différé plutôt que de mentir.
    expect(plan.deferred.map((entry) => entry.subject)).toContain("Chimie");
  });
});

describe("computeDailyPlan — la couverture ne démantèle jamais la structure annoncée", () => {
  /**
   * Deux mondes strictement identiques SAUF la dette de couverture. La
   * composition par intention doit être la même : une matière silencieuse ne
   * doit jamais faire disparaître un bloc que le mix annonce.
   *
   * Ce test manquait, et son absence a laissé passer une vraie régression :
   * à 45 min avec des exercices de 20 min, urgent (20) + couverture (20)
   * laissaient 5 minutes, la part « réviser » tombait à 2 et le rattrapage à
   * 5 — le plan devenait 100 % consolidation, exactement le défaut que le
   * rattrapage avait été écrit pour corriger. La fixture des tests de
   * structure existants était aveugle : ses exercices « à réviser » n'ont
   * aucune WorkSession, donc leur matière est « jamais ouverte », donc jamais
   * délaissée, donc aucune réservation ne s'y déclenche.
   */
  function twoWorlds() {
    const chapters: Chapter[] = [
      { id: "cm", subject: "Mathématiques", label: "Suites" },
      { id: "cp", subject: "Physique", label: "Ondes" },
      { id: "cc", subject: "Chimie", label: "Équilibres" },
    ];
    // Consolidation : jamais travaillés — fournit l'exercice urgent.
    const maths = Array.from({ length: 4 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "cm" }));
    // Révision : maîtrisés et anciens (isStaleMastery les retient).
    const phys = Array.from({ length: 3 }, () =>
      makeExercise({ subject: "Physique", chapter_id: "cp", status: "maîtrisé", mastery: 100 as Mastery, attempts: 2, last_worked_at: daysAgo(60) })
    );
    // Chimie : ses candidats relèvent de la consolidation — c'est le cas qui
    // fait mal, la place de couverture ne crée alors aucun bloc par elle-même.
    const chim = Array.from({ length: 3 }, () => makeExercise({ subject: "Chimie", chapter_id: "cc" }));
    chim[0].attempts = 1;
    chim[0].last_worked_at = daysAgo(25);

    const exercises = [...maths, ...phys, ...chim];
    // Une séance récente sur la physique la garde fraîche côté couverture,
    // sans toucher `last_worked_at` (donc sans la sortir de la révision).
    const base = [makeSession(phys[0], 1)];
    return {
      exercises,
      chapters,
      withDebt: [...base, makeSession(chim[0], 25)],
      withoutDebt: [...base, makeSession(chim[0], 1)],
    };
  }

  it("la composition par intention est identique avec et sans matière délaissée", () => {
    const { exercises, chapters, withDebt, withoutDebt } = twoWorlds();
    for (const budget of [45, 60, 90]) {
      const intents = (sessions: WorkSession[]) =>
        computeDailyPlan(exercises, sessions, chapters, budget, NOW).blocks.map((block) => block.intent);
      expect(intents(withDebt), `budget ${budget}`).toEqual(intents(withoutDebt));
    }
  });

  it("plutôt que de supprimer une intention, la place de couverture est déclinée", () => {
    const { exercises, chapters, withDebt } = twoWorlds();
    // À 45 min la place ne tient pas sans sacrifier « réviser » : elle est
    // abandonnée, et la matière est déclarée différée au lieu d'être servie
    // au prix de la structure.
    const tight = computeDailyPlan(exercises, withDebt, chapters, 45, NOW);
    expect(tight.blocks.map((block) => block.intent)).toContain("réviser");
    expect(tight.blocks.flatMap((block) => block.picks).filter((p) => p.reasons.some((r) => r.startsWith(COVERAGE_REASON_PREFIX)))).toHaveLength(0);
    // `deferred` reste l'invariant, pas un résultat attendu : décliner la
    // PLACE de couverture ne veut pas dire abandonner la matière — ici la
    // chimie entre quand même par la consolidation ordinaire, donc elle
    // n'est pas laissée de côté, et le produit ne doit pas prétendre le
    // contraire.
    expect(tight.deferred.map((entry) => entry.subject)).toEqual(expectedDeferred(tight).map((entry) => entry.subject));

    // À 60 min elle tient : elle est prise, et « réviser » existe toujours.
    const roomy = computeDailyPlan(exercises, withDebt, chapters, 60, NOW);
    expect(roomy.blocks.map((block) => block.intent)).toContain("réviser");
    expect(roomy.blocks.flatMap((block) => block.picks).filter((p) => p.reasons.some((r) => r.startsWith(COVERAGE_REASON_PREFIX)))).toHaveLength(1);
    expect(roomy.deferred).toEqual([]);
  });
});

describe("computeDailyPlan — la couverture est une propriété de la BANQUE, pas du périmètre", () => {
  /**
   * Le défaut le plus grave trouvé sur cette livraison, et le seul dont la
   * conséquence atteignait l'élève en toutes lettres.
   *
   * `computeGoalsDailyPlan` et la carte d'objectif appellent le plan sur un
   * périmètre déjà restreint (`scopeToGoal`). `computeSubjectCoverage` n'y
   * voyait alors que les exercices du périmètre : une séance faite hier sur
   * un exercice de la MÊME matière mais d'un autre chapitre devenait
   * invisible, et le plan produisait « Zone délaissée : Mathématiques (30 j) »
   * — une phrase datée, fausse, qui remontait jusqu'à l'écran de séance via
   * `explainReasons`.
   */
  function scopedProfile() {
    const chapters: Chapter[] = [
      { id: "ch-a", subject: "Mathématiques", label: "Chapitre A" },
      { id: "ch-b", subject: "Mathématiques", label: "Chapitre B" },
    ];
    const inA = Array.from({ length: 3 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-a" }));
    const inB = Array.from({ length: 3 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "ch-b" }));
    inA[0].attempts = 1;
    inA[0].last_worked_at = daysAgo(1);
    const exercises = [...inA, ...inB];
    // Travaillé HIER, dans le chapitre A. La matière est manifestement fraîche.
    const sessions = [makeSession(inA[0], 1)];
    const goal: Goal = {
      id: "g1",
      title: "Chapitre B",
      subjects: ["Mathématiques"],
      chapterIds: ["ch-b"],
      targetDate: null,
      priority: 2,
      status: "active",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    };
    return { exercises, chapters, sessions, goal };
  }

  it("un plan scopé ne prétend jamais qu'une matière travaillée hier est délaissée", () => {
    const { exercises, chapters, sessions, goal } = scopedProfile();
    const scoped = computeDailyPlan(scopeToGoal(goal, exercises), sessions, chapters, 90, NOW, null);

    const claims = scoped.blocks
      .flatMap((block) => block.picks)
      .flatMap((pick) => pick.reasons)
      .filter((reason) => reason.startsWith(COVERAGE_REASON_PREFIX));
    expect(claims).toEqual([]);
    expect(scoped.coverage).toEqual([]);
    expect(scoped.deferred).toEqual([]);
  });

  it("aucune raison de couverture ne survit dans un plan multi-objectifs", () => {
    const { exercises, chapters, sessions, goal } = scopedProfile();
    const plans = computeGoalsDailyPlan([goal], exercises, sessions, chapters, 90, 60, NOW);
    const claims = plans
      .flatMap(({ plan }) => plan.blocks)
      .flatMap((block) => block.picks)
      .flatMap((pick) => pick.reasons)
      .filter((reason) => reason.startsWith(COVERAGE_REASON_PREFIX));
    expect(claims).toEqual([]);
  });

  it("sur la banque entière, la même matière est correctement vue comme à jour", () => {
    const { exercises, chapters, sessions } = scopedProfile();
    const full = computeDailyPlan(exercises, sessions, chapters, 90, NOW);
    expect(full.coverage.find((entry) => entry.subject === "Mathématiques")?.state).toBe("à jour");
  });
});

describe("computeDailyPlan — la couverture n'invente jamais une intention", () => {
  it("aucun bloc ne porte une intention que le mix n'annonce pas à cette durée", () => {
    // À 45-59 min le mix ne déclare que « consolider » et « réviser ». Un
    // candidat de couverture classé « progresser » créait pourtant son bloc.
    const chapters: Chapter[] = [
      { id: "cm", subject: "Mathématiques", label: "Suites" },
      { id: "cc", subject: "Chimie", label: "Équilibres" },
    ];
    const maths = Array.from({ length: 6 }, () => makeExercise({ subject: "Mathématiques", chapter_id: "cm", difficulty: 3 }));
    const chim = Array.from({ length: 3 }, () => makeExercise({ subject: "Chimie", chapter_id: "cc", difficulty: 5 }));
    chim[0].attempts = 1;
    chim[0].last_worked_at = daysAgo(35);

    // Série de réussites autonomes → comfortDifficulty.steppedUp, donc des
    // candidats « Palier suivant » (intention « progresser »).
    const sessions = [
      ...maths.slice(0, 5).map((exercise, index) => makeSession(exercise, index + 2, "réussi", 0)),
      makeSession(chim[0], 35, "réussi", 0),
    ];
    maths.slice(0, 5).forEach((exercise, index) => {
      exercise.attempts = 1;
      exercise.last_worked_at = daysAgo(index + 2);
    });

    for (let budget = 45; budget <= 59; budget++) {
      const plan = computeDailyPlan([...maths, ...chim], sessions, chapters, budget, NOW);
      expect(plan.blocks.map((block) => block.intent), `budget ${budget}`).not.toContain("progresser");
    }
  });
});

describe("computeDailyPlan — robustesse d'entrée", () => {
  it("ne lève jamais sur un budget NaN ou infini", () => {
    const { exercises, chapters } = bank();
    for (const budget of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => computeDailyPlan(exercises, [], chapters, budget, NOW)).not.toThrow();
      expect(computeDailyPlan(exercises, [], chapters, budget, NOW).blocks).toEqual([]);
    }
  });

  it("une séance à la date illisible ou future ne rend jamais une matière « à jour »", () => {
    const { exercises } = bank();
    const chimie = exercises.find((exercise) => exercise.subject === "Chimie")!;
    const vieille = makeSession(chimie, SUBJECT_DEBT_DAYS + 15);

    const illisible: WorkSession = { ...makeSession(chimie, 0), started_at: "pas-une-date" };
    expect(coverageFor(exercises, [vieille, illisible]).find((e) => e.subject === "Chimie")!.state).toBe("délaissée");

    const future: WorkSession = { ...makeSession(chimie, 0), started_at: daysAgo(-30) };
    expect(coverageFor(exercises, [vieille, future]).find((e) => e.subject === "Chimie")!.state).toBe("délaissée");
  });
});
