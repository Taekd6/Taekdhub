import { describe, expect, it } from "vitest";
import { normalizeAttempt, type ExerciseAttempt } from "@/lib/attempts";
import { buildExercises, dueRetries, upcomingRetries } from "@/lib/exercises";
import { createReviewItem } from "@/lib/review-items";
import { createTransferAttempt, isTransferKey, methodCardFrom, TRANSFER_DELAY_DAYS, transferChecks, transferExerciseKey } from "@/lib/transfer";

const TODAY = "2026-10-20";
const DELAYS = [2, 5, 12];
const KEY = "exercice:td4-12";

let seq = 0;
function attempt(key: string, day: string, result: ExerciseAttempt["result"], help: ExerciseAttempt["help"], extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return {
    id: `t${seq}`,
    exerciseKey: key,
    label: "TD 4 — exercice 12",
    subject: "Mathématiques",
    chapterId: "m2-reduction",
    origin: "exercice",
    day,
    createdAt: `${day}T18:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    updatedAt: `${day}T18:00:00.000Z`,
    result,
    help,
    minutes: null,
    plannedMinutes: null,
    cause: null,
    lackOfTime: false,
    gradeId: null,
    note: null,
    ...extra,
  };
}

const ANALYSIS = { missed: "Pourquoi diagonaliser", derailedAt: "J'ai calculé A^n à la main", tool: "Diagonaliser puis élever à la puissance", cue: "Une puissance n-ième de matrice" };

/** Raté le 1er, réussi sans aide le 5 : correction vérifiée. */
function verified(extra: ExerciseAttempt[] = [], today = TODAY) {
  const attempts = [attempt(KEY, "2026-10-01", "échec", "sans", { cause: "méthode", analysis: ANALYSIS }), attempt(KEY, "2026-10-05", "réussi", "sans"), ...extra];
  const exercises = buildExercises({ annales: [], attempts, retryDelaysDays: DELAYS, today });
  return { attempts, exercises, checks: transferChecks(exercises, attempts, DELAYS, today) };
}

describe("quand un transfert est demandé", () => {
  it("un exercice réussi du premier coup n'appelle pas de transfert : il n'a jamais été raté", () => {
    const attempts = [attempt("exercice:facile", "2026-10-01", "réussi", "sans")];
    const exercises = buildExercises({ annales: [], attempts, retryDelaysDays: DELAYS, today: TODAY });
    expect(transferChecks(exercises, attempts, DELAYS, TODAY)).toEqual([]);
  });

  it("un exercice encore à refaire n'appelle pas de transfert : il faut d'abord savoir le refaire", () => {
    const attempts = [attempt(KEY, "2026-10-01", "échec", "sans")];
    const exercises = buildExercises({ annales: [], attempts, retryDelaysDays: DELAYS, today: TODAY });
    expect(transferChecks(exercises, attempts, DELAYS, TODAY)).toEqual([]);
  });

  it(`raté puis réussi sans aide : un transfert, ${TRANSFER_DELAY_DAYS} jours après la réussite, avec la méthode analysée`, () => {
    const { checks } = verified();
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ status: "à-faire", dueDay: "2026-10-12", attempts: [] });
    expect(checks[0].analysis?.tool).toBe(ANALYSIS.tool);
    // Avant la date : programmé, pas encore dû.
    expect(verified([], "2026-10-08").checks[0]).toMatchObject({ status: "programmé", dueDay: "2026-10-12" });
  });
});

describe("l'essai de transfert", () => {
  it("est une tentative ordinaire sur un AUTRE exercice, rattachée à l'origine, et survit à la normalisation", () => {
    const created = createTransferAttempt({ key: KEY, subject: "Mathématiques", chapterId: "m2-reduction" }, { label: "TD 6 — exercice 3", result: "réussi", help: "sans", minutes: 25, cause: "méthode", level: "classique" }, new Date(2026, 9, 14, 20))!;
    expect(created.exerciseKey).toBe(transferExerciseKey(KEY, "TD 6 — exercice 3"));
    expect(created.exerciseKey).not.toBe(KEY);
    expect(isTransferKey(created.exerciseKey)).toBe(true);
    expect(created).toMatchObject({ transferOf: KEY, cause: null, level: "classique", day: "2026-10-14" });
    expect(normalizeAttempt(JSON.parse(JSON.stringify(created)))).toEqual(created);
  });

  it("sans énoncé, pas d'essai", () => {
    expect(createTransferAttempt({ key: KEY, subject: "Mathématiques", chapterId: null }, { label: "  ", result: "réussi", help: "sans", minutes: null, cause: null }, new Date())).toBeNull();
  });

  it("réussi sans aide : la méthode est acquise", () => {
    const { checks } = verified([attempt(transferExerciseKey(KEY, "TD 6 ex 3"), "2026-10-13", "réussi", "sans", { transferOf: KEY })]);
    expect(checks[0]).toMatchObject({ status: "acquis", dueDay: null });
  });

  it("réussi avec indices ne prouve rien : un nouveau transfert, aux délais des nouvelles tentatives", () => {
    const { checks } = verified([attempt(transferExerciseKey(KEY, "TD 6 ex 3"), "2026-10-13", "réussi", "indices", { transferOf: KEY })]);
    expect(checks[0]).toMatchObject({ status: "à-faire", dueDay: "2026-10-15" });
    const twice = verified([
      attempt(transferExerciseKey(KEY, "TD 6 ex 3"), "2026-10-13", "échec", "sans", { transferOf: KEY }),
      attempt(transferExerciseKey(KEY, "TD 7 ex 1"), "2026-10-16", "partiel", "sans", { transferOf: KEY }),
    ]);
    expect(twice.checks[0]).toMatchObject({ status: "programmé", dueDay: "2026-10-21" });
    expect(twice.checks[0].attempts).toHaveLength(2);
  });

  it("un transfert raté n'entre pas dans « À refaire » : c'est la méthode qu'on revérifie, sur un autre énoncé", () => {
    const failed = attempt(transferExerciseKey(KEY, "TD 6 ex 3"), "2026-10-13", "échec", "sans", { transferOf: KEY });
    const { exercises } = verified([failed], "2026-11-30");
    expect(dueRetries(exercises).some((exercise) => isTransferKey(exercise.key))).toBe(false);
    expect(upcomingRetries(exercises).some((exercise) => isTransferKey(exercise.key))).toBe(false);
  });

  it("un exercice de transfert vérifié n'appelle pas à son tour un transfert", () => {
    const key = transferExerciseKey(KEY, "TD 6 ex 3");
    const { checks } = verified([attempt(key, "2026-10-13", "échec", "sans", { transferOf: KEY }), attempt(key, "2026-10-16", "réussi", "sans", { transferOf: KEY })]);
    expect(checks.map((check) => check.exercise.key)).toEqual([KEY]);
    expect(checks[0].status).toBe("acquis");
  });
});

describe("fiche de méthode", () => {
  const now = new Date(2026, 9, 1, 21);

  it("recto : ce qu'il faut reconnaître ; verso : le réflexe, le piège, ce qui manquait", () => {
    const card = methodCardFrom(ANALYSIS, "Mathématiques", [], now)!;
    expect(card).toMatchObject({ kind: "méthode", subject: "Mathématiques", text: "Quand je vois : Une puissance n-ième de matrice" });
    expect(card.answer).toBe("→ Diagonaliser puis élever à la puissance\nPiège : J'ai calculé A^n à la main\nÀ comprendre : Pourquoi diagonaliser");
  });

  it("sans indice à reconnaître, le recto est la méthode ; sans réflexe ni indice, pas de fiche", () => {
    expect(methodCardFrom({ ...ANALYSIS, cue: "" }, "Physique", [], now)!.text).toBe("Méthode : Diagonaliser puis élever à la puissance");
    expect(methodCardFrom({ missed: "tout", derailedAt: "début", tool: "", cue: "" }, "Physique", [], now)).toBeNull();
  });

  it("pas de doublon : une fiche ouverte avec le même recto suffit", () => {
    const existing = createReviewItem({ subject: "Mathématiques", text: "Quand je vois : Une puissance n-ième de matrice", kind: "méthode" }, now)!;
    expect(methodCardFrom(ANALYSIS, "Mathématiques", [existing], now)).toBeNull();
  });
});
