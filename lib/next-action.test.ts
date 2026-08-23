import { describe, expect, it } from "vitest";
import {
  computeChaptersToConsolidate,
  computeCommandCenterProgress,
  computeDailyObjective,
  computeNextAction,
  computeStatusLine,
  computeUpcoming,
} from "@/lib/next-action";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

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
    priority: 3 as Priority,
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

function makeSession(exerciseId: string | null, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${exerciseId}-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: exerciseId,
    started_at: "2026-08-10T08:00:00.000Z",
    ended_at: "2026-08-10T08:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T08:10:00.000Z",
    result: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-10T12:00:00.000Z");

describe("computeDailyObjective", () => {
  it("aucune séance aujourd'hui : 0 travaillé, tout l'objectif restant", () => {
    const objective = computeDailyObjective([], 45, NOW);
    expect(objective).toEqual({ goalMinutes: 45, workedMinutes: 0, workedSeconds: 0, remainingMinutes: 45, percent: 0, met: false });
  });

  it("objectif partiellement atteint : temps travaillé et restant cohérents", () => {
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 23 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.workedMinutes).toBe(23);
    expect(objective.remainingMinutes).toBe(22);
    expect(objective.percent).toBe(Math.round((23 / 45) * 100));
    expect(objective.met).toBe(false);
  });

  it("objectif dépassé : remainingMinutes reste à 0, jamais négatif", () => {
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 60 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.remainingMinutes).toBe(0);
    expect(objective.percent).toBe(100);
    expect(objective.met).toBe(true);
  });

  it("les séances d'hier ne comptent pas dans l'objectif du jour", () => {
    const sessions = [makeSession(null, { started_at: "2026-08-09T09:00:00.000Z", duration_seconds: 3600 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.workedMinutes).toBe(0);
    expect(objective.workedSeconds).toBe(0);
  });

  /**
   * Audit "Grand Jour" (Launch Readiness) : `workedMinutes` (arrondi à la
   * minute) servait aussi de signal booléen "l'utilisateur a-t-il déjà
   * travaillé aujourd'hui ?" — une séance de quelques dizaines de secondes
   * (exercice rapide, focus bref) le laissait à 0, et le Dashboard affirmait
   * "Tu n'as encore rien travaillé aujourd'hui" juste après une vraie séance
   * enregistrée — repro réelle en simulation du grand jour, visible côte à
   * côte avec "Ta progression"/"Activité récente" qui comptaient déjà cette
   * même séance. `workedSeconds` (jamais arrondi) est le signal correct.
   */
  it("workedSeconds reflète le temps réel, même sous la minute (jamais arrondi à 0 à tort)", () => {
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:59:38.000Z", duration_seconds: 22 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    expect(objective.workedSeconds).toBe(22);
    // `workedMinutes` reste à 0 (arrondi), volontairement — seul le signal
    // booléen "rien travaillé" doit se baser sur `workedSeconds`, pas ce champ.
    expect(objective.workedMinutes).toBe(0);
  });
});

describe("computeNextAction", () => {
  it("banque vide : état empty-bank, renvoie vers /exercises", () => {
    const action = computeNextAction([], [], 45, NOW);
    expect(action.kind).toBe("empty-bank");
    expect(action.href).toBe("/exercises");
    expect(action.picks).toHaveLength(0);
  });

  it("tous les exercices maîtrisés et récents : état up-to-date, aucun pick", () => {
    const exercise = makeExercise({ status: "maîtrisé", mastery: 100, priority: 1, attempts: 3, last_worked_at: "2026-08-09T00:00:00.000Z" });
    const action = computeNextAction([exercise], [], 45, NOW);
    expect(action.kind).toBe("up-to-date");
    expect(action.picks).toHaveLength(0);
  });

  it("des exercices signalés et de l'objectif restant : start-session dimensionné sur le temps restant", () => {
    const exercise = makeExercise({ mastery: 0, estimated_minutes: 20 });
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 15 * 60 })];
    const action = computeNextAction([exercise], sessions, 45, NOW);
    expect(action.kind).toBe("start-session");
    expect(action.minutes).toBe(30); // 45 - 15
    expect(action.picks.length).toBeGreaterThan(0);
    expect(action.picks[0].exercise.id).toBe(exercise.id);
    expect(action.href).toBe("/session");
  });

  it("objectif du jour déjà atteint mais des exercices restent signalés : propose quand même une séance (bloc par défaut)", () => {
    const exercise = makeExercise({ mastery: 0 });
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 60 * 60 })];
    const action = computeNextAction([exercise], sessions, 45, NOW);
    expect(action.kind).toBe("start-session");
    expect(action.minutes).toBeGreaterThan(0);
    expect(action.picks.length).toBeGreaterThan(0);
  });

  it("budget trop serré pour tout exercice signalé : retombe sur un aperçu non borné plutôt que rien du tout", () => {
    const exercise = makeExercise({ mastery: 0, estimated_minutes: 90 });
    const action = computeNextAction([exercise], [], 10, NOW);
    expect(action.kind).toBe("start-session");
    expect(action.picks).toHaveLength(1);
  });

  it("exercices archivés ignorés pour décider de l'état", () => {
    const archived = makeExercise({ archived: true, mastery: 0 });
    const action = computeNextAction([archived], [], 45, NOW);
    expect(action.kind).toBe("empty-bank");
  });
});

describe("computeUpcoming", () => {
  it("aucune donnée : liste vide, pas d'erreur", () => {
    expect(computeUpcoming([], [], [], NOW)).toEqual([]);
  });

  it("signale le chapitre le plus faible avec un exercice restant, en priorité sur les chapitres mieux maîtrisés", () => {
    const chapters: Chapter[] = [
      { id: "chap-weak", subject: "Mathématiques", label: "Faible" },
      { id: "chap-strong", subject: "Mathématiques", label: "Solide" },
    ];
    const weak = makeExercise({ chapter_id: "chap-weak", mastery: 0, status: "à faire" });
    const strong = makeExercise({ chapter_id: "chap-strong", mastery: 100, status: "maîtrisé" });
    const items = computeUpcoming([weak, strong], [], chapters, NOW);
    const chapterItem = items.find((item) => item.key === "chapter");
    expect(chapterItem?.label).toBe("Faible");
    expect(chapterItem?.href).toBe(`/exercises?focus=${weak.id}`);
  });

  it("ne signale pas un chapitre déjà entièrement maîtrisé", () => {
    const chapters: Chapter[] = [{ id: "chap-done", subject: "Mathématiques", label: "Terminé" }];
    const done = makeExercise({ chapter_id: "chap-done", mastery: 100, status: "maîtrisé" });
    const items = computeUpcoming([done], [], chapters, NOW);
    expect(items.find((item) => item.key === "chapter")).toBeUndefined();
  });

  it("jamais plus de 3 entrées", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Un" }];
    const exercises = [
      makeExercise({ chapter_id: "chap-1", mastery: 0, status: "à faire", subject: "Mathématiques" }),
      makeExercise({ subject: "Physique", mastery: 0, status: "à faire" }),
      makeExercise({
        subject: "Chimie",
        status: "maîtrisé",
        mastery: 100,
        attempts: 2,
        last_worked_at: "2026-06-01T00:00:00.000Z", // largement > MASTERY_STALE_DAYS avant NOW
      }),
    ];
    const items = computeUpcoming(exercises, [], chapters, NOW);
    expect(items.length).toBeLessThanOrEqual(3);
  });
});

describe("computeChaptersToConsolidate", () => {
  it("aucune donnée : liste vide, pas d'erreur", () => {
    expect(computeChaptersToConsolidate([], [], [], NOW)).toEqual([]);
  });

  it("signale un chapitre déjà engagé à faible maîtrise avec la raison correspondante", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Suites" }];
    const exercise = makeExercise({ chapter_id: "chap-1", mastery: 0, status: "à revoir" });
    const items = computeChaptersToConsolidate([exercise], [], chapters, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].chapter.label).toBe("Suites");
    expect(items[0].reasons).toContain("Maîtrise faible");
    expect(items[0].href).toBe(`/exercises?focus=${exercise.id}`);
  });

  it("un chapitre jamais engagé (aucune tentative, jamais travaillé) n'apparaît pas : ce n'est pas encore un chapitre \"à consolider\"", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Mathématiques", label: "Vierge" }];
    const exercise = makeExercise({ chapter_id: "chap-1", mastery: 0, status: "à faire", attempts: 0, last_worked_at: null });
    const items = computeChaptersToConsolidate([exercise], [], chapters, NOW);
    expect(items).toHaveLength(0);
  });

  it("ne signale jamais un chapitre déjà entièrement maîtrisé", () => {
    const chapters: Chapter[] = [{ id: "chap-done", subject: "Mathématiques", label: "Terminé" }];
    const exercise = makeExercise({ chapter_id: "chap-done", mastery: 100, status: "maîtrisé" });
    const items = computeChaptersToConsolidate([exercise], [], chapters, NOW);
    expect(items).toHaveLength(0);
  });

  it("détecte plusieurs échecs récents sur les exercices du chapitre", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Physique", label: "Mécanique" }];
    const exercise = makeExercise({ chapter_id: "chap-1", mastery: 50, status: "en cours" });
    const sessions = [
      makeSession(exercise.id, { result: "échoué", started_at: "2026-08-09T10:00:00.000Z" }),
      makeSession(exercise.id, { result: "échoué", started_at: "2026-08-08T10:00:00.000Z" }),
    ];
    const items = computeChaptersToConsolidate([exercise], sessions, chapters, NOW);
    expect(items[0].reasons).toContain("2 échecs récents");
  });

  it("signale un chapitre non retravaillé depuis longtemps", () => {
    const chapters: Chapter[] = [{ id: "chap-1", subject: "Chimie", label: "Oxydoréduction" }];
    const exercise = makeExercise({
      chapter_id: "chap-1",
      mastery: 75,
      status: "en cours",
      last_worked_at: "2026-07-01T00:00:00.000Z",
    });
    const items = computeChaptersToConsolidate([exercise], [], chapters, NOW);
    expect(items[0].reasons.some((reason) => reason.startsWith("Non travaillé depuis"))).toBe(true);
  });

  it("à maîtrise égale, un chapitre avec échecs récents passe avant un chapitre juste signalé en retard", () => {
    const chapters: Chapter[] = [
      { id: "chap-stale", subject: "Mathématiques", label: "En retard" },
      { id: "chap-failing", subject: "Mathématiques", label: "En échec" },
    ];
    const stale = makeExercise({ chapter_id: "chap-stale", mastery: 0, status: "en cours", last_worked_at: "2026-07-01T00:00:00.000Z" });
    const failing = makeExercise({ chapter_id: "chap-failing", mastery: 0, status: "en cours", last_worked_at: "2026-08-09T00:00:00.000Z" });
    const sessions = [
      makeSession(failing.id, { result: "échoué", started_at: "2026-08-09T10:00:00.000Z" }),
      makeSession(failing.id, { result: "échoué", started_at: "2026-08-08T10:00:00.000Z" }),
    ];
    const items = computeChaptersToConsolidate([stale, failing], sessions, chapters, NOW);
    expect(items.map((item) => item.chapter.id)).toEqual(["chap-failing", "chap-stale"]);
  });

  it("jamais plus de 5 chapitres", () => {
    const chapters: Chapter[] = Array.from({ length: 8 }, (_, i) => ({
      id: `chap-${i}`,
      subject: "Mathématiques" as const,
      label: `Chapitre ${i}`,
    }));
    const exercises = chapters.map((chapter) => makeExercise({ chapter_id: chapter.id, mastery: 0, status: "en cours" }));
    const items = computeChaptersToConsolidate(exercises, [], chapters, NOW);
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

describe("computeStatusLine", () => {
  it("banque vide : message d'amorçage", () => {
    const objective = computeDailyObjective([], 45, NOW);
    const action = computeNextAction([], [], 45, NOW);
    expect(computeStatusLine(objective, action)).toMatch(/banque est vide/);
  });

  it("objectif atteint : message positif", () => {
    const exercise = makeExercise({ mastery: 0 });
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 60 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    const action = computeNextAction([exercise], sessions, 45, NOW);
    expect(computeStatusLine(objective, action)).toMatch(/atteint/);
  });

  it("rien travaillé aujourd'hui : message dédié", () => {
    const exercise = makeExercise({ mastery: 0 });
    const objective = computeDailyObjective([], 45, NOW);
    const action = computeNextAction([exercise], [], 45, NOW);
    expect(computeStatusLine(objective, action)).toBe("Tu n'as encore rien travaillé aujourd'hui.");
  });

  /**
   * Audit "Grand Jour" : une séance réellement enregistrée mais sous la
   * minute (exercice rapide) ne doit plus déclencher le message "rien
   * travaillé" — repro réelle en simulation du grand jour, où ce message
   * s'affichait juste après une séance déjà comptée ailleurs sur le
   * Dashboard ("Ta progression", "Activité récente").
   */
  it("une séance sous la minute ne déclenche PLUS le message \"rien travaillé\"", () => {
    const exercise = makeExercise({ mastery: 0 });
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:59:38.000Z", duration_seconds: 22 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    const action = computeNextAction([exercise], sessions, 45, NOW);
    expect(computeStatusLine(objective, action)).not.toBe("Tu n'as encore rien travaillé aujourd'hui.");
  });

  it("progression partielle : reprend le temps travaillé et restant", () => {
    const exercise = makeExercise({ mastery: 0 });
    const sessions = [makeSession(null, { started_at: "2026-08-10T09:00:00.000Z", duration_seconds: 20 * 60 })];
    const objective = computeDailyObjective(sessions, 45, NOW);
    const action = computeNextAction([exercise], sessions, 45, NOW);
    const line = computeStatusLine(objective, action);
    expect(line).toContain("20 min");
    expect(line).toContain("25 min");
  });
});

describe("computeCommandCenterProgress", () => {
  it("aucun historique : réussite null, compteurs à 0", () => {
    const progress = computeCommandCenterProgress([], [], NOW);
    expect(progress.results.successRate).toBeNull();
    expect(progress.sessionCount).toBe(0);
    expect(progress.totalSeconds).toBe(0);
    expect(progress.averageMastery).toBe(0);
  });

  it("agrège maîtrise moyenne, résultats et temps total à partir des données réelles", () => {
    const exercises = [makeExercise({ mastery: 100 }), makeExercise({ mastery: 0 })];
    const sessions = [
      makeSession(exercises[0].id, { result: "réussi", duration_seconds: 300 }),
      makeSession(exercises[1].id, { result: "échoué", duration_seconds: 200 }),
    ];
    const progress = computeCommandCenterProgress(exercises, sessions, NOW);
    expect(progress.averageMastery).toBe(50);
    expect(progress.results.successRate).toBe(50);
    expect(progress.sessionCount).toBe(2);
    expect(progress.totalSeconds).toBe(500);
  });

  it("ignore les exercices archivés dans la maîtrise moyenne", () => {
    const active = makeExercise({ mastery: 0 });
    const archived = makeExercise({ mastery: 100, archived: true });
    const progress = computeCommandCenterProgress([active, archived], [], NOW);
    expect(progress.averageMastery).toBe(0);
  });
});
