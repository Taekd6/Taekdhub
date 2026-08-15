import { describe, expect, it } from "vitest";
import { computeStreak, levelFromXp, totalXp, xpForLevel, xpFromExercise, xpFromSession, xpProgressInLevel } from "@/lib/gamification";
import type { Difficulty, Exercise, ExerciseStatus, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

let exerciseCounter = 0;
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  exerciseCounter += 1;
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `ex-${exerciseCounter}`,
    subject: "Mathématiques",
    title: `Exercice ${exerciseCounter}`,
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
    difficulty: 3 as Difficulty,
    priority: 3 as Priority,
    mastery: 0 as Mastery,
    status: "à faire" as ExerciseStatus,
    estimated_minutes: null,
    attempts: 0,
    note: null,
    created_at: now,
    updated_at: now,
    tags: [],
    favorite: false,
    archived: false,
    hints: [],
    answer: null,
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

let sessionCounter = 0;
function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  sessionCounter += 1;
  return {
    id: `s-${sessionCounter}`,
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-08-10T10:00:00.000Z",
    ended_at: "2026-08-10T10:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-08-10T10:10:00.000Z",
    result: null,
    ...overrides,
  };
}

describe("xpFromExercise", () => {
  it("0 pour un exercice non maîtrisé, quelle que soit la difficulté", () => {
    (["à faire", "en cours", "à revoir"] as ExerciseStatus[]).forEach((status) => {
      expect(xpFromExercise(makeExercise({ status, difficulty: 5 as Difficulty }))).toBe(0);
    });
  });

  it("difficulté × 25 pour un exercice maîtrisé, non archivé", () => {
    ([1, 2, 3, 4, 5] as Difficulty[]).forEach((difficulty) => {
      expect(xpFromExercise(makeExercise({ status: "maîtrisé", difficulty }))).toBe(difficulty * 25);
    });
  });

  it("0 pour un exercice maîtrisé mais archivé — jamais compté deux fois via l'archive", () => {
    expect(xpFromExercise(makeExercise({ status: "maîtrisé", difficulty: 5 as Difficulty, archived: true }))).toBe(0);
  });
});

describe("xpFromSession", () => {
  it("0 pour une séance de moins d'une minute (arrondi au flooring de secondsToWholeMinutes)", () => {
    expect(xpFromSession(makeSession({ duration_seconds: 45 }))).toBe(0);
    expect(xpFromSession(makeSession({ duration_seconds: 0 }))).toBe(0);
  });

  it("5 XP par minute entière", () => {
    expect(xpFromSession(makeSession({ duration_seconds: 60 }))).toBe(5);
    expect(xpFromSession(makeSession({ duration_seconds: 600 }))).toBe(50);
    expect(xpFromSession(makeSession({ duration_seconds: 119 }))).toBe(5); // 1 min 59 → arrondi à 1 min
    expect(xpFromSession(makeSession({ duration_seconds: 120 }))).toBe(10);
  });
});

describe("totalXp — avant/après une séance (base du feedback de fin de séance)", () => {
  it("aucune donnée : 0", () => {
    expect(totalXp([], [])).toBe(0);
  });

  it("additionne l'XP de tous les exercices maîtrisés et de toutes les séances", () => {
    const exercises = [
      makeExercise({ status: "maîtrisé", difficulty: 2 as Difficulty }), // 50
      makeExercise({ status: "à faire", difficulty: 5 as Difficulty }), // 0
    ];
    const sessions = [makeSession({ duration_seconds: 600 }), makeSession({ duration_seconds: 300 })]; // 50 + 25
    expect(totalXp(exercises, sessions)).toBe(50 + 50 + 25);
  });

  it("le delta \"avant/après\" d'une nouvelle séance correspond exactement à xpFromSession de cette séance", () => {
    const exercises = [makeExercise({ status: "à faire" })];
    const before = [makeSession({ duration_seconds: 300 })];
    const newSession = makeSession({ duration_seconds: 900 });
    const after = [newSession, ...before];
    expect(totalXp(exercises, after) - totalXp(exercises, before)).toBe(xpFromSession(newSession));
  });

  it("le delta d'une exercice qui devient \"maîtrisé\" correspond exactement à xpFromExercise de cet exercice", () => {
    const sessions: WorkSession[] = [];
    const exerciseBefore = makeExercise({ id: "ex-fixed", status: "à revoir", difficulty: 4 as Difficulty });
    const exerciseAfter = { ...exerciseBefore, status: "maîtrisé" as ExerciseStatus };
    expect(totalXp([exerciseAfter], sessions) - totalXp([exerciseBefore], sessions)).toBe(xpFromExercise(exerciseAfter));
  });

  it("un exercice DÉJÀ maîtrisé avant la séance ne contribue aucun XP supplémentaire — jamais réattribué", () => {
    const alreadyMastered = makeExercise({ id: "ex-fixed", status: "maîtrisé", difficulty: 3 as Difficulty });
    const before = [makeSession({ duration_seconds: 300 })];
    const newSession = makeSession({ duration_seconds: 300 });
    const after = [newSession, ...before];
    // Le delta total ne vient QUE de la nouvelle séance, jamais d'une seconde
    // attribution de l'XP de maîtrise déjà acquis.
    expect(totalXp([alreadyMastered], after) - totalXp([alreadyMastered], before)).toBe(xpFromSession(newSession));
  });
});

describe("levelFromXp / xpForLevel — cohérence de la courbe de niveau", () => {
  it("niveau 1 à 0 XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("jamais décroissant : plus d'XP ne fait jamais baisser de niveau", () => {
    let previousLevel = levelFromXp(0);
    for (let xp = 0; xp <= 5000; xp += 137) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(previousLevel);
      previousLevel = level;
    }
  });

  it("xpForLevel(levelFromXp(xp)) est toujours ≤ xp — le niveau calculé est toujours atteint, jamais anticipé", () => {
    [0, 1, 99, 100, 250, 999, 1000, 3333].forEach((xp) => {
      expect(xpForLevel(levelFromXp(xp))).toBeLessThanOrEqual(xp);
    });
  });

  it("juste en dessous du seuil du niveau suivant, le niveau ne monte pas encore", () => {
    const level = 4;
    const threshold = xpForLevel(level);
    expect(levelFromXp(threshold - 1)).toBeLessThan(level);
    expect(levelFromXp(threshold)).toBe(level);
  });
});

describe("xpProgressInLevel — barre de progression (réutilisée telle quelle par la sidebar et le feedback Focus)", () => {
  it("current/needed cohérents avec xpForLevel, percent toujours entre 0 et 100", () => {
    [0, 50, 100, 237, 1000, 4321].forEach((xp) => {
      const progress = xpProgressInLevel(xp);
      const level = levelFromXp(xp);
      expect(progress.current).toBe(xp - xpForLevel(level));
      expect(progress.needed).toBe(xpForLevel(level + 1) - xpForLevel(level));
      expect(progress.percent).toBeGreaterThanOrEqual(0);
      expect(progress.percent).toBeLessThanOrEqual(100);
    });
  });

  it("juste au passage d'un niveau, current retombe proche de 0", () => {
    const threshold = xpForLevel(5);
    const progress = xpProgressInLevel(threshold);
    expect(progress.current).toBe(0);
    expect(progress.percent).toBe(0);
  });
});

describe("changement de niveau — détection utilisée par le feedback \"Niveau supérieur !\"", () => {
  it("une séance qui fait franchir un seuil de niveau est détectable via une simple comparaison avant/après", () => {
    const threshold = xpForLevel(3); // 400 XP — xpFromSession = minutes * 5
    const exercises = [makeExercise({ status: "à faire" })];
    // Construit une séance dont la durée place le total XP EXACTEMENT 5 XP sous le seuil.
    const before = [makeSession({ duration_seconds: ((threshold - 5) / 5) * 60 })];
    const crossing = makeSession({ duration_seconds: 60 }); // +5 XP → atteint le seuil
    const after = [crossing, ...before];
    const levelBefore = levelFromXp(totalXp(exercises, before));
    const levelAfter = levelFromXp(totalXp(exercises, after));
    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it("une séance qui ne franchit aucun seuil ne signale jamais de changement de niveau", () => {
    const exercises = [makeExercise({ status: "à faire" })];
    const before = [makeSession({ duration_seconds: 60 })];
    const small = makeSession({ duration_seconds: 60 });
    const after = [small, ...before];
    const levelBefore = levelFromXp(totalXp(exercises, before));
    const levelAfter = levelFromXp(totalXp(exercises, after));
    expect(levelAfter).toBe(levelBefore);
  });
});

describe("computeStreak — non modifié par ce sprint, couverture de base", () => {
  it("aucune séance : streak à 0", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("une séance aujourd'hui : streak à 1", () => {
    const today = new Date().toISOString();
    expect(computeStreak([makeSession({ started_at: today })])).toBe(1);
  });
});
