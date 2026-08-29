import { describe, expect, it } from "vitest";
import { buildFreeSessionPlan, computeDailyPlan, planIntent, resolveStoredPlan, serializePlan, type StoredPlan } from "@/lib/plan";
import { computeChaptersToConsolidate } from "@/lib/next-action";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

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
    estimated_minutes: null,
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

function makeSession(exerciseId: string | null, subject: Subject, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${exerciseId}-${Math.random()}`,
    subject,
    exercise_id: exerciseId,
    started_at: "2026-08-10T08:00:00.000Z",
    ended_at: "2026-08-10T08:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T08:10:00.000Z",
    result: null,
    hints_used: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-11T12:00:00.000Z"); // mardi

describe("computeDailyPlan — projection temporelle des priorités", () => {
  /** Un exercice réellement en difficulté (échecs récents) → intention "consolider". */
  function struggling(overrides: Partial<Exercise> = {}) {
    const exercise = makeExercise({ mastery: 0, status: "à revoir", estimated_minutes: 15, ...overrides });
    const sessions = [1, 2].map((d) =>
      makeSession(exercise.id, exercise.subject, {
        result: "échoué" as const,
        started_at: new Date(NOW.getTime() - d * 86400000).toISOString(),
      })
    );
    return { exercise, sessions };
  }

  it("aucune donnée : plan vide, pas d'erreur", () => {
    const plan = computeDailyPlan([], [], [], 45, NOW);
    expect(plan.blocks).toEqual([]);
    expect(plan.totalMinutes).toBe(0);
    expect(plan.totalExercises).toBe(0);
    expect(plan.requestedMinutes).toBe(45);
  });

  it("un budget de 0 minute ne produit aucun bloc", () => {
    const exercise = makeExercise({ mastery: 0 });
    expect(computeDailyPlan([exercise], [], [], 0, NOW).blocks).toEqual([]);
  });

  it("un budget négatif ne plante pas et ne produit aucun bloc", () => {
    const exercise = makeExercise({ mastery: 0 });
    expect(computeDailyPlan([exercise], [], [], -30, NOW).blocks).toEqual([]);
  });

  it("ne dépasse JAMAIS le budget demandé, quelle que soit la durée", () => {
    const bank = Array.from({ length: 40 }, (_, i) =>
      makeExercise({ mastery: 0, estimated_minutes: 10 + (i % 4) * 5, subject: i % 2 ? "Physique" : "Mathématiques" })
    );
    for (const budget of [1, 20, 45, 60, 90, 300]) {
      const plan = computeDailyPlan(bank, [], [], budget, NOW);
      expect(plan.totalMinutes, `budget ${budget}`).toBeLessThanOrEqual(budget);
      expect(plan.totalMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("20 min : une seule intention (pas de fragmentation en blocs inutilisables)", () => {
    const bank = Array.from({ length: 20 }, () => makeExercise({ mastery: 0, estimated_minutes: 10 }));
    const plan = computeDailyPlan(bank, [], [], 20, NOW);
    expect(plan.blocks.length).toBeLessThanOrEqual(1);
    if (plan.blocks.length) expect(plan.blocks[0].intent).toBe("consolider");
  });

  it("la structure change avec la durée : 90 min autorise plus d'intentions que 20 min", () => {
    // Banque mixte : de quoi consolider (échecs) ET réviser (maîtrisé ancien).
    const weak = Array.from({ length: 6 }, () => struggling({ estimated_minutes: 10 }));
    const stale = Array.from({ length: 6 }, () =>
      makeExercise({ status: "maîtrisé", mastery: 100, attempts: 2, estimated_minutes: 10, last_worked_at: "2026-05-01T00:00:00.000Z" })
    );
    const exercises = [...weak.map((w) => w.exercise), ...stale];
    const sessions = weak.flatMap((w) => w.sessions);

    const short = computeDailyPlan(exercises, sessions, [], 20, NOW);
    const long = computeDailyPlan(exercises, sessions, [], 90, NOW);
    expect(long.blocks.length).toBeGreaterThan(short.blocks.length);
  });

  it("chaque bloc porte une intention pédagogique lisible, jamais une simple matière", () => {
    const weak = struggling();
    const plan = computeDailyPlan([weak.exercise], weak.sessions, [], 45, NOW);
    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(["consolider", "réviser", "progresser"]).toContain(plan.blocks[0].intent);
    expect(plan.blocks[0].label).toBeTruthy();
  });

  it("COHÉRENCE : le chapitre prioritaire n°1 de la Progression est bien servi en premier dans la consolidation", () => {
    const chapters: Chapter[] = [
      { id: "chap-fort", subject: "Mathématiques", label: "Chapitre solide" },
      { id: "chap-faible", subject: "Mathématiques", label: "Chapitre faible" },
    ];
    // Chapitre faible : engagé, maîtrise très basse, deux échecs récents.
    const weakOne = makeExercise({ chapter_id: "chap-faible", mastery: 0, status: "à revoir", attempts: 2, estimated_minutes: 10, last_worked_at: "2026-08-09T00:00:00.000Z" });
    // Chapitre "fort" : engagé mais nettement mieux maîtrisé.
    const strongOne = makeExercise({ chapter_id: "chap-fort", mastery: 75, status: "en cours", attempts: 1, estimated_minutes: 10, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [1, 2].map((d) =>
      makeSession(weakOne.id, "Mathématiques", { result: "échoué" as const, started_at: new Date(NOW.getTime() - d * 86400000).toISOString() })
    );

    const priorities = computeChaptersToConsolidate([weakOne, strongOne], sessions, chapters, NOW);
    const plan = computeDailyPlan([weakOne, strongOne], sessions, chapters, 45, NOW);
    const consolidation = plan.blocks.find((block) => block.intent === "consolider")!;

    // La même priorité doit ressortir des deux côtés — c'est tout l'enjeu de la refonte.
    expect(priorities[0].chapter.id).toBe("chap-faible");
    expect(consolidation.picks[0].exercise.chapter_id).toBe("chap-faible");
  });

  it("aucun exercice n'est servi deux fois dans un même plan", () => {
    const bank = Array.from({ length: 30 }, () => makeExercise({ mastery: 0, estimated_minutes: 10 }));
    const plan = computeDailyPlan(bank, [], [], 90, NOW);
    const ids = plan.blocks.flatMap((block) => block.picks.map((pick) => pick.exercise.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("le budget non utilisé par une intention absente est redistribué, pas perdu", () => {
    // Que de la consolidation disponible : à 90 min, le plan doit quand même
    // remplir largement le budget plutôt que de s'arrêter à sa seule part.
    const bank = Array.from({ length: 20 }, () => makeExercise({ mastery: 0, status: "à revoir", estimated_minutes: 10 }));
    const plan = computeDailyPlan(bank, [], [], 90, NOW);
    expect(plan.totalMinutes).toBeGreaterThan(90 * 0.45);
    expect(plan.totalMinutes).toBeLessThanOrEqual(90);
  });

  it("une banque entièrement maîtrisée et récente ne produit aucun plan", () => {
    const mastered = Array.from({ length: 5 }, () =>
      makeExercise({ mastery: 100, status: "maîtrisé", attempts: 3, last_worked_at: "2026-08-09T09:00:00.000Z" })
    );
    const sessions = mastered.map((e) => makeSession(e.id, e.subject, { started_at: "2026-08-09T09:00:00.000Z", result: "réussi" as const }));
    expect(computeDailyPlan(mastered, sessions, [], 60, NOW).blocks).toEqual([]);
  });

  it("les exercices archivés ne sont jamais planifiés", () => {
    const archived = makeExercise({ archived: true, mastery: 0 });
    expect(computeDailyPlan([archived], [], [], 60, NOW).blocks).toEqual([]);
  });

  it("le focus d'un bloc nomme les chapitres réellement travaillés", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Suites numériques" }];
    const exercise = makeExercise({ chapter_id: "chap-1", mastery: 0, estimated_minutes: 20 });
    const plan = computeDailyPlan([exercise], [], chapters, 45, NOW);
    expect(plan.blocks[0].focus).toContain("Suites numériques");
  });
});

/**
 * Garantie anti-fragmentation (audit moteur — reproduit un cas réel, pas
 * seulement théorique) : l'exercice le plus urgent du bloc de consolidation
 * ne doit jamais disparaître du plan à cause d'un pur phénomène de
 * fragmentation de budget entre intentions.
 *
 * Mesuré sur un profil réaliste (échecs répétés sur le chapitre le plus
 * faible) : un exercice à la fois le PLUS URGENT (score le plus élevé,
 * chapitre n°1 des priorités) et réellement long (35 min) était totalement
 * absent d'un plan de 45 min, remplacé par trois exercices "jamais
 * travaillé" sans aucun rapport (Physique, Chimie, Informatique TC) —
 * parce que la part réservée à "consolider" (≈70 %, 32 min) ne suffisait
 * pas à elle seule, et le reliquat qui la complète ensuite ne recevait à
 * son tour que quelques minutes, jamais les 35 d'un coup — alors que le
 * budget TOTAL du jour, lui, aurait très bien accueilli l'exercice.
 */
describe("computeDailyPlan — garantie anti-fragmentation : le plus urgent ne disparaît jamais", () => {
  it("un exercice prioritaire mais long n'est jamais exclu au profit de contenu 'jamais travaillé' sans rapport", () => {
    const chapter: Chapter = { id: "chap-urgent", subject: "Mathématiques", label: "Chapitre urgent" };
    const urgent = makeExercise({
      chapter_id: chapter.id,
      status: "à revoir",
      mastery: 0,
      attempts: 2,
      estimated_minutes: 35,
      last_worked_at: "2026-08-05T00:00:00.000Z", // hors repos de 3 jours (voir lib/recommendation.ts#RECENT_ATTEMPT_COOLDOWN_DAYS)
    });
    const session = makeSession(urgent.id, "Mathématiques", { result: "échoué", started_at: "2026-08-05T08:00:00.000Z" });
    // Assez de "jamais travaillé" dans d'autres matières pour, à eux seuls,
    // remplir la part réservée à "consolider" (~70 % de 45 min) avant que
    // `urgent` (35 min) n'ait jamais sa chance.
    const filler = (["Physique", "Chimie", "Informatique TC"] as Subject[]).map((subject) => makeExercise({ subject, estimated_minutes: 15 }));

    const plan = computeDailyPlan([urgent, ...filler], [session], [chapter], 45, NOW);
    const pickedIds = plan.blocks.flatMap((block) => block.picks.map((pick) => pick.exercise.id));
    expect(pickedIds).toContain(urgent.id);
  });

  it("l'exercice réservé n'est jamais compté deux fois, et le budget du plan reste dans la limite demandée", () => {
    const chapter: Chapter = { id: "chap-urgent", subject: "Mathématiques", label: "Chapitre urgent" };
    const urgent = makeExercise({ chapter_id: chapter.id, status: "à revoir", mastery: 0, attempts: 2, estimated_minutes: 35, last_worked_at: "2026-08-05T00:00:00.000Z" });
    const session = makeSession(urgent.id, "Mathématiques", { result: "échoué", started_at: "2026-08-05T08:00:00.000Z" });
    const filler = (["Physique", "Chimie"] as Subject[]).map((subject) => makeExercise({ subject, estimated_minutes: 15 }));

    const plan = computeDailyPlan([urgent, ...filler], [session], [chapter], 45, NOW);
    const pickedIds = plan.blocks.flatMap((block) => block.picks.map((pick) => pick.exercise.id));
    expect(new Set(pickedIds).size).toBe(pickedIds.length);
    expect(plan.totalMinutes).toBeLessThanOrEqual(45);
  });

  it("un exercice prioritaire trop long pour le budget TOTAL du jour n'est jamais forcé dedans", () => {
    const chapter: Chapter = { id: "chap-urgent", subject: "Mathématiques", label: "Chapitre urgent" };
    const tooLong = makeExercise({ chapter_id: chapter.id, status: "à revoir", mastery: 0, attempts: 2, estimated_minutes: 90, last_worked_at: "2026-08-05T00:00:00.000Z" });
    const session = makeSession(tooLong.id, "Mathématiques", { result: "échoué", started_at: "2026-08-05T08:00:00.000Z" });
    const filler = makeExercise({ subject: "Physique", estimated_minutes: 15 });

    const plan = computeDailyPlan([tooLong, filler], [session], [chapter], 20, NOW);
    const pickedIds = plan.blocks.flatMap((block) => block.picks.map((pick) => pick.exercise.id));
    expect(pickedIds).not.toContain(tooLong.id);
    expect(plan.totalMinutes).toBeLessThanOrEqual(20);
  });
});

/**
 * Les parts d'`INTENT_MIX` sont proportionnelles, les exercices non : un
 * exercice dure 15 à 30 minutes, et 25 % de 60 minutes ne suffit pas à en
 * loger un seul. Sans rattrapage, l'intention concernée ne perdait pas
 * quelques minutes — elle DISPARAISSAIT, et son budget repartait à la
 * consolidation déjà servie. Mesuré avant correctif : 45 comme 60 minutes
 * rendaient un plan 100 % consolidation, la structure annoncée n'existant
 * qu'à partir de 90 minutes.
 */
describe("computeDailyPlan — la structure annoncée existe vraiment à chaque durée", () => {
  const chapters: Chapter[] = [
    { id: "c-conso", subject: "Mathématiques", label: "Intégration" } as Chapter,
    { id: "c-revis", subject: "Physique", label: "Mécanique" } as Chapter,
  ];

  function bank() {
    const exercises: Exercise[] = [];
    const sessions: WorkSession[] = [];
    // À consolider : des échecs récents, 20 min pièce.
    for (let index = 0; index < 6; index++) {
      const exercise = makeExercise({
        chapter_id: "c-conso",
        estimated_minutes: 20,
        mastery: 25 as Mastery,
        status: "à revoir",
        attempts: 2,
        last_worked_at: new Date(NOW.getTime() - 2 * 86400000).toISOString(),
      });
      exercises.push(exercise);
      sessions.push(
        makeSession(exercise.id, "Mathématiques", { result: "échoué", started_at: new Date(NOW.getTime() - 2 * 86400000).toISOString() })
      );
    }
    // À réviser : maîtrisés depuis longtemps, 20 min pièce.
    for (let index = 0; index < 6; index++) {
      exercises.push(
        makeExercise({
          subject: "Physique",
          chapter_id: "c-revis",
          estimated_minutes: 20,
          mastery: 100 as Mastery,
          status: "maîtrisé",
          attempts: 3,
          last_worked_at: new Date(NOW.getTime() - 60 * 86400000).toISOString(),
        })
      );
    }
    return { exercises, sessions };
  }

  it("une séance de 20 min ne fait que consolider — pas de miettes de trois intentions", () => {
    const { exercises, sessions } = bank();
    const plan = computeDailyPlan(exercises, sessions, chapters, 20, NOW);
    expect(plan.blocks.map((block) => block.intent)).toEqual(["consolider"]);
  });

  it("une séance de 45 min réserve réellement une place à la révision", () => {
    const { exercises, sessions } = bank();
    const plan = computeDailyPlan(exercises, sessions, chapters, 45, NOW);
    expect(plan.blocks.map((block) => block.intent)).toEqual(["consolider", "réviser"]);
  });

  it("le rattrapage n'accorde qu'UNE place — la consolidation reste majoritaire à 60 min", () => {
    const { exercises, sessions } = bank();
    const plan = computeDailyPlan(exercises, sessions, chapters, 60, NOW);
    const consolider = plan.blocks.find((block) => block.intent === "consolider");
    const reviser = plan.blocks.find((block) => block.intent === "réviser");
    expect(reviser).toBeDefined();
    expect(consolider!.estimatedMinutes).toBeGreaterThan(reviser!.estimatedMinutes);
  });

  it("les blocs restent toujours dans l'ordre réparer → entretenir → pousser", () => {
    const { exercises, sessions } = bank();
    for (const minutes of [20, 45, 60, 90]) {
      const order = computeDailyPlan(exercises, sessions, chapters, minutes, NOW).blocks.map((block) => block.intent);
      expect(order).toEqual([...order].sort((a, b) => ["consolider", "réviser", "progresser"].indexOf(a) - ["consolider", "réviser", "progresser"].indexOf(b)));
    }
  });
});

describe("planIntent — dérivé des raisons du moteur, jamais d'un nouveau score", () => {
  it("une montée de palier relève de la progression", () => {
    expect(planIntent(["Palier suivant (3 réussites d'affilée)"])).toBe("progresser");
  });

  it("un acquis qui s'effrite relève de la révision", () => {
    expect(planIntent(["Non retravaillé depuis 40 j"])).toBe("réviser");
    expect(planIntent(["Maîtrisé, jamais retravaillé"])).toBe("réviser");
  });

  it("échecs, maîtrise faible et réussites assistées relèvent de la consolidation", () => {
    expect(planIntent(["Plusieurs échecs"])).toBe("consolider");
    expect(planIntent(["Maîtrise faible"])).toBe("consolider");
    expect(planIntent(["Réussi avec aide"])).toBe("consolider");
    expect(planIntent(["Jamais travaillé"])).toBe("consolider");
  });

  it("la progression prime sur la révision quand les deux signaux coexistent", () => {
    expect(planIntent(["Non retravaillé depuis 30 j", "Palier suivant (4 réussites d'affilée)"])).toBe("progresser");
  });
});

describe("serializePlan", () => {
  it("aplatit les blocs en une liste d'exercices avec leurs raisons", () => {
    const exercise = makeExercise({ subject: "Mathématiques", mastery: 0, estimated_minutes: 20 });
    const plan = computeDailyPlan([exercise], [], [], 45, NOW);
    const stored = serializePlan(plan);
    expect(stored.requestedMinutes).toBe(45);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].exerciseId).toBe(exercise.id);
    expect(stored.items[0].reasons.length).toBeGreaterThan(0);
    expect(stored.source).toBe("plan-du-jour");
  });
});

describe("buildFreeSessionPlan", () => {
  it("reprend la sélection déjà filtrée telle quelle, dans son ordre, sans recalculer de recommandation", () => {
    const a = makeExercise({ estimated_minutes: 10 });
    const b = makeExercise({ estimated_minutes: 15 });
    const c = makeExercise({ estimated_minutes: 20 });
    const stored = buildFreeSessionPlan([a, b, c], [], 2);
    expect(stored.items.map((item) => item.exerciseId)).toEqual([a.id, b.id]);
    expect(stored.source).toBe("libre");
  });

  it("chaque exercice retenu porte la raison \"Séance libre\"", () => {
    const a = makeExercise();
    const stored = buildFreeSessionPlan([a], [], 5);
    expect(stored.items[0].reasons).toEqual(["Séance libre"]);
  });

  it("requestedMinutes est la somme des durées estimées de la sélection retenue, pas de toute la liste", () => {
    const a = makeExercise({ estimated_minutes: 10 });
    const b = makeExercise({ estimated_minutes: 15 });
    const c = makeExercise({ estimated_minutes: 100 });
    const stored = buildFreeSessionPlan([a, b, c], [], 2);
    expect(stored.requestedMinutes).toBe(25);
  });

  it("une limite supérieure au nombre d'exercices disponibles ne plante pas, retient simplement tout", () => {
    const a = makeExercise();
    const stored = buildFreeSessionPlan([a], [], 50);
    expect(stored.items).toHaveLength(1);
  });
});

describe("resolveStoredPlan — reconstruction du plan transporté vers /session", () => {
  it("reconstruit la sélection dans l'ordre du plan stocké, avec les raisons d'origine", () => {
    const a = makeExercise();
    const b = makeExercise();
    const stored: StoredPlan = { items: [{ exerciseId: b.id, reasons: ["Séance libre"] }, { exerciseId: a.id, reasons: ["Échec récent"] }], requestedMinutes: 20 };
    const picks = resolveStoredPlan(stored, [a, b]);
    expect(picks.map((pick) => pick.exercise.id)).toEqual([b.id, a.id]);
    expect(picks[1].reasons).toEqual(["Échec récent"]);
  });

  it("ignore silencieusement un exercice supprimé depuis le dépôt du plan (banque changée entre-temps)", () => {
    const stored: StoredPlan = { items: [{ exerciseId: "ex-disparu", reasons: [] }], requestedMinutes: 10 };
    expect(resolveStoredPlan(stored, [])).toEqual([]);
  });

  it("ignore un exercice archivé depuis le dépôt du plan, même si son id existe toujours", () => {
    const archived = makeExercise({ archived: true });
    const stored: StoredPlan = { items: [{ exerciseId: archived.id, reasons: [] }], requestedMinutes: 10 };
    expect(resolveStoredPlan(stored, [archived])).toEqual([]);
  });

  it("RÉGRESSION (fix double-montage /session) : appeler deux fois avec le même StoredPlan renvoie exactement le même résultat — la lecture ne dépend d'aucun effet de bord ni d'aucun état mutable, elle est donc sûre à rejouer sur un second montage sans perdre le plan", () => {
    const a = makeExercise();
    const stored: StoredPlan = { items: [{ exerciseId: a.id, reasons: ["Jamais travaillé"] }], requestedMinutes: 15 };
    const first = resolveStoredPlan(stored, [a]);
    const second = resolveStoredPlan(stored, [a]);
    expect(second).toEqual(first);
    expect(second).toHaveLength(1);
  });
});

describe("Performance (audit transversal) — centaines d'exercices, milliers de séances", () => {
  it("computeDailyPlan reste rapide à une échelle réaliste (plusieurs années d'historique simulées)", () => {
    const chapters: Chapter[] = Array.from({ length: 40 }, (_, i) => ({ id: `chap-${i}`, subject: "Mathématiques", label: `Chapitre ${i}` }));
    const exercises = Array.from({ length: 600 }, (_, i) =>
      makeExercise({
        chapter_id: chapters[i % chapters.length].id,
        mastery: ([0, 25, 50, 75, 100] as const)[i % 5] as Mastery,
        status: (["à faire", "en cours", "à revoir", "maîtrisé"] as const)[i % 4],
      })
    );
    const sessions: WorkSession[] = [];
    for (let i = 0; i < 8000; i++) {
      const exercise = exercises[i % exercises.length];
      sessions.push(
        makeSession(exercise.id, exercise.subject, {
          started_at: new Date(NOW.getTime() - (i % 900) * 86400000).toISOString(),
          result: (["réussi", "partiel", "échoué"] as const)[i % 3],
        })
      );
    }
    const start = performance.now();
    const plan = computeDailyPlan(exercises, sessions, chapters, 60, NOW);
    const elapsed = performance.now() - start;
    console.log(`computeDailyPlan — 600 exercices × 8000 séances : ${elapsed.toFixed(1)} ms, ${plan.totalExercises} exercices retenus`);
    // Marge généreuse (dix fois ce qui serait déjà perceptible) — voir
    // lib/recommendation.test.ts pour l'équivalent côté `recommendExercises`.
    expect(elapsed).toBeLessThan(1500);
  });
});
