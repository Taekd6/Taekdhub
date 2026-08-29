import { describe, expect, it } from "vitest";
import {
  buildNotionIndex,
  buildNotionSessionPlan,
  computeNotionEvidence,
  computeNotionOverview,
  findRootCauseNotions,
  resolveNotionChapters,
  ROOT_CAUSE_WINDOW,
} from "@/lib/notions";
import type { Chapter } from "@/lib/storage";
import type { AttemptResult, Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

let counter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  counter += 1;
  const now = "2026-01-01T00:00:00.000Z";
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
    created_at: now,
    updated_at: now,
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
function makeSession(exerciseId: string, result: AttemptResult, hintsUsed: number | null, daysAgo = 0): WorkSession {
  sessionCounter += 1;
  const startedAt = new Date(Date.UTC(2026, 5, 1) - daysAgo * 86400000).toISOString();
  return {
    id: `ws-${sessionCounter}`,
    subject: "Mathématiques" as Subject,
    exercise_id: exerciseId,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: 1200,
    note: null,
    created_at: startedAt,
    result,
    hints_used: hintsUsed,
  };
}

describe("buildNotionIndex — ce que la banque déclare", () => {
  it("relie une notion à tous ses exercices, chapitres et matières", () => {
    const exercises = [
      makeExercise({ prerequisites: ["équation caractéristique"], chapter_id: "ch-edo", subject: "Mathématiques" }),
      makeExercise({ prerequisites: ["équation caractéristique"], chapter_id: "ch-oscill", subject: "Physique" }),
    ];
    const [entry] = buildNotionIndex(exercises);
    expect(entry.notion).toBe("équation caractéristique");
    expect(entry.exercises).toHaveLength(2);
    expect(entry.chapterIds).toHaveLength(2);
    expect(entry.crossesChapters).toBe(true);
    expect(entry.crossesSubjects).toBe(true);
  });

  it("ne compte pas deux fois une notion citée en double sur un même exercice", () => {
    const index = buildNotionIndex([makeExercise({ prerequisites: ["dérivées usuelles", "dérivées usuelles"] })]);
    expect(index).toHaveLength(1);
    expect(index[0].exercises).toHaveLength(1);
  });

  it("ignore les exercices archivés — une notion qui n'existerait que sur eux n'est proposable nulle part", () => {
    const index = buildNotionIndex([makeExercise({ prerequisites: ["réduction des endomorphismes"], archived: true })]);
    expect(index).toEqual([]);
  });

  it("ordonne de la notion la plus portante à la moins portante, de façon déterministe", () => {
    const exercises = [
      makeExercise({ prerequisites: ["rare"] }),
      makeExercise({ prerequisites: ["fréquente"] }),
      makeExercise({ prerequisites: ["fréquente"] }),
    ];
    expect(buildNotionIndex(exercises).map((entry) => entry.notion)).toEqual(["fréquente", "rare"]);
  });
});

describe("computeNotionEvidence — jamais d'état sans preuve", () => {
  it("classe « jamais testée » une notion sans aucune tentative, jamais « faible »", () => {
    const [evidence] = computeNotionEvidence([makeExercise({ prerequisites: ["intégration par parties"] })], []);
    expect(evidence.state).toBe("jamais testée");
    expect(evidence.attempts).toBe(0);
  });

  it("ne crédite aucune autonomie quand le nombre d'indices n'a jamais été enregistré (hints_used null)", () => {
    const exercise = makeExercise({ prerequisites: ["théorème du rang"] });
    const sessions = [makeSession(exercise.id, "réussi", null), makeSession(exercise.id, "réussi", null)];
    const [evidence] = computeNotionEvidence([exercise], sessions);
    expect(evidence.autonomousSuccesses).toBe(0);
    expect(evidence.assistedSuccesses).toBe(2);
    // Deux réussites, mais aucune preuve d'autonomie : « fragile », pas « solide ».
    expect(evidence.state).toBe("fragile");
  });

  it("déclare « solide » après deux réussites autonomes sans échec", () => {
    const a = makeExercise({ prerequisites: ["loi des mailles"] });
    const b = makeExercise({ prerequisites: ["loi des mailles"] });
    const [evidence] = computeNotionEvidence([a, b], [makeSession(a.id, "réussi", 0), makeSession(b.id, "réussi", 1)]);
    expect(evidence.autonomousSuccesses).toBe(2);
    expect(evidence.state).toBe("solide");
  });

  it("une réussite assistée ne suffit jamais à rendre une notion solide", () => {
    const a = makeExercise({ prerequisites: ["produit de solubilité"] });
    const b = makeExercise({ prerequisites: ["produit de solubilité"] });
    const [evidence] = computeNotionEvidence([a, b], [makeSession(a.id, "réussi", 0), makeSession(b.id, "réussi", 3)]);
    expect(evidence.autonomousSuccesses).toBe(1);
    expect(evidence.assistedSuccesses).toBe(1);
    expect(evidence.state).toBe("fragile");
  });

  it("la difficulté prime sur l'acquis : deux échecs annulent un passé autonome", () => {
    const a = makeExercise({ prerequisites: ["séries entières"] });
    const b = makeExercise({ prerequisites: ["séries entières"] });
    const c = makeExercise({ prerequisites: ["séries entières"] });
    const evidence = computeNotionEvidence(
      [a, b, c],
      [
        makeSession(a.id, "réussi", 0, 30),
        makeSession(b.id, "réussi", 0, 29),
        makeSession(c.id, "échoué", 3, 2),
        makeSession(a.id, "échoué", 3, 1),
      ]
    )[0];
    expect(evidence.autonomousSuccesses).toBe(2);
    expect(evidence.failures).toBe(2);
    expect(evidence.state).toBe("en difficulté");
  });

  it("ignore les séances sans résultat et les séances libres sans exercice", () => {
    const exercise = makeExercise({ prerequisites: ["notation O"] });
    const free: WorkSession = { ...makeSession(exercise.id, "réussi", 0), exercise_id: null };
    const noResult: WorkSession = { ...makeSession(exercise.id, "réussi", 0), result: null };
    const [evidence] = computeNotionEvidence([exercise], [free, noResult]);
    expect(evidence.attempts).toBe(0);
    expect(evidence.state).toBe("jamais testée");
  });
});

describe("findRootCauseNotions — la notion que le grain chapitre ne peut pas voir", () => {
  it("désigne la notion commune à plusieurs échecs répartis sur des chapitres différents", () => {
    const a = makeExercise({ prerequisites: ["tableau d'avancement", "stœchiométrie"], chapter_id: "ch-acide-base", subject: "Chimie" });
    const b = makeExercise({ prerequisites: ["tableau d'avancement", "quotient de réaction"], chapter_id: "ch-equilibres", subject: "Chimie" });
    const causes = findRootCauseNotions([a, b], [makeSession(a.id, "échoué", 3), makeSession(b.id, "échoué", 2)]);

    // « stœchiométrie » et « quotient de réaction » n'apparaissent que dans un
    // seul échec : elles n'expliquent rien de plus que l'exercice lui-même.
    expect(causes.map((cause) => cause.notion)).toEqual(["tableau d'avancement"]);
    expect(causes[0].recentlyFailedExercises).toHaveLength(2);
    expect(causes[0].crossesChapters).toBe(true);
  });

  it("n'invente aucune cause à partir d'un échec unique", () => {
    const exercise = makeExercise({ prerequisites: ["développements limités usuels"] });
    expect(findRootCauseNotions([exercise], [makeSession(exercise.id, "échoué", 3)])).toEqual([]);
  });

  it("ne compte qu'une fois un même exercice échoué plusieurs fois", () => {
    const exercise = makeExercise({ prerequisites: ["pivot de Gauss"] });
    const causes = findRootCauseNotions(
      [exercise],
      [makeSession(exercise.id, "échoué", 3, 1), makeSession(exercise.id, "échoué", 3, 2), makeSession(exercise.id, "échoué", 3, 3)]
    );
    // Trois échecs, mais un seul exercice : la preuve reste trop étroite.
    expect(causes).toEqual([]);
  });

  it("ne diagnostique que sur les tentatives récentes — un échec sorti de la fenêtre ne compte plus", () => {
    const a = makeExercise({ prerequisites: ["série harmonique"] });
    const b = makeExercise({ prerequisites: ["série harmonique"] });
    const others = Array.from({ length: ROOT_CAUSE_WINDOW }, () => makeExercise({ prerequisites: ["autre chose"] }));

    const sessions = [
      // Les plus récentes : uniquement des réussites sur d'autres notions.
      ...others.map((exercise, index) => makeSession(exercise.id, "réussi", 0, index + 1)),
      // Les deux échecs sont plus anciens que la fenêtre d'analyse.
      makeSession(a.id, "échoué", 3, ROOT_CAUSE_WINDOW + 10),
      makeSession(b.id, "échoué", 3, ROOT_CAUSE_WINDOW + 11),
    ];

    expect(findRootCauseNotions([a, b, ...others], sessions)).toEqual([]);
  });

  it("classe la cause la mieux étayée en premier", () => {
    const a = makeExercise({ prerequisites: ["large", "étroite"] });
    const b = makeExercise({ prerequisites: ["large", "étroite"] });
    const c = makeExercise({ prerequisites: ["large"] });
    const causes = findRootCauseNotions(
      [a, b, c],
      [makeSession(a.id, "échoué", 3, 1), makeSession(b.id, "échoué", 3, 2), makeSession(c.id, "échoué", 3, 3)]
    );
    expect(causes.map((cause) => cause.notion)).toEqual(["large", "étroite"]);
    expect(causes[0].recentlyFailedExercises).toHaveLength(3);
  });
});

describe("computeNotionOverview — des totaux, jamais un score composite", () => {
  it("compte séparément ce qui est démontré et ce qui n'a jamais été testé", () => {
    const proved = makeExercise({ prerequisites: ["acquis"] });
    const second = makeExercise({ prerequisites: ["acquis"] });
    const untouched = makeExercise({ prerequisites: ["jamais vu"] });
    const overview = computeNotionOverview(
      computeNotionEvidence([proved, second, untouched], [makeSession(proved.id, "réussi", 0), makeSession(second.id, "réussi", 0)])
    );
    expect(overview.total).toBe(2);
    expect(overview.solid).toBe(1);
    expect(overview.untested).toBe(1);
    expect(overview.tested).toBe(1);
  });
});

describe("resolveNotionChapters — jamais un identifiant brut à l'écran", () => {
  it("résout les chapitres connus et écarte silencieusement les autres", () => {
    const chapters: Chapter[] = [{ id: "ch-1", subject: "Physique", label: "Oscillateurs" }];
    const exercises = [
      makeExercise({ prerequisites: ["oscillateur harmonique"], chapter_id: "ch-1" }),
      makeExercise({ prerequisites: ["oscillateur harmonique"], chapter_id: "ch-supprimé" }),
    ];
    const [entry] = buildNotionIndex(exercises);
    expect(resolveNotionChapters(entry, chapters).map((chapter) => chapter.label)).toEqual(["Oscillateurs"]);
  });
});

describe("buildNotionSessionPlan — reconstruire une notion, du plus abordable au plus exigeant", () => {
  it("ordonne par difficulté croissante et transporte la notion visée", () => {
    const hard = makeExercise({ prerequisites: ["déterminant"], difficulty: 4, title: "Dur" });
    const easy = makeExercise({ prerequisites: ["déterminant"], difficulty: 1, title: "Facile" });
    const [entry] = buildNotionIndex([hard, easy]);
    const plan = buildNotionSessionPlan(entry, []);

    expect(plan.items.map((item) => item.exerciseId)).toEqual([easy.id, hard.id]);
    expect(plan.source).toBe("notion");
    expect(plan.label).toBe("déterminant");
    expect(plan.items[0].reasons).toEqual(["Notion ciblée : déterminant"]);
    expect(plan.requestedMinutes).toBe(40);
  });

  it("à difficulté égale, ce qui n'est pas encore maîtrisé passe devant", () => {
    const done = makeExercise({ prerequisites: ["encadrement"], difficulty: 2, status: "maîtrisé", title: "A" });
    const todo = makeExercise({ prerequisites: ["encadrement"], difficulty: 2, status: "à faire", title: "B" });
    const [entry] = buildNotionIndex([done, todo]);
    expect(buildNotionSessionPlan(entry, []).items.map((item) => item.exerciseId)).toEqual([todo.id, done.id]);
  });

  it("respecte la limite demandée", () => {
    const exercises = Array.from({ length: 8 }, (unused, index) => makeExercise({ prerequisites: ["limite"], difficulty: ((index % 5) + 1) as Exercise["difficulty"] }));
    const [entry] = buildNotionIndex(exercises);
    expect(buildNotionSessionPlan(entry, [], 3).items).toHaveLength(3);
  });
});
