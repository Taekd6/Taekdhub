import { describe, expect, it } from "vitest";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildExercises } from "@/lib/exercises";
import { resolveOutcomes } from "@/lib/next-move/history";
import { attemptsFromDebrief, emptyEntry, isComplete, manualExerciseKey, prefillEntry } from "@/lib/session-debrief";
import type { NextMoveRecord } from "@/lib/storage";

const TODAY = "2026-10-03";

function attempt(key: string, day: string, result: ExerciseAttempt["result"], extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return { id: `${key}-${day}`, exerciseKey: key, label: "TD 4 — ex 12", subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day, createdAt: `${day}T18:00:00.000Z`, updatedAt: `${day}T18:00:00.000Z`, result, help: "sans", minutes: null, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null, ...extra };
}

const KEY = manualExerciseKey("TD 4 — ex 12");
const exercises = buildExercises({ annales: [], attempts: [attempt(KEY, "2026-09-25", "échec", { level: "classique" }), attempt("exercice:td-2", "2026-09-20", "échec"), attempt("exercice:td-2", "2026-09-25", "réussi")], retryDelaysDays: [2, 5, 12], today: TODAY });

function move(key: string, subject: NextMoveRecord["subject"] = "Mathématiques"): NextMoveRecord {
  return { id: "m", key, kind: "refaire", subject, title: "x", minutes: 30, reasons: [], proposedAt: "2026-10-03T13:00:00.000Z", status: "commencé", startedAt: "2026-10-03T13:00:00.000Z", resolvedAt: null, outcomeMinutes: null };
}

const session = { subject: "Mathématiques" as const, ended_at: "2026-10-03T14:00:00.000Z" };

describe("clé d'un exercice saisi", () => {
  it("identique à « Noter un exercice » : le même énoncé retombe sur le même exercice", () => {
    expect(manualExerciseKey("  TD 4 — ex 12 ")).toBe("exercice:td-4-ex-12");
    expect(manualExerciseKey("Équation (b)")).toBe("exercice:equation-b-");
  });
});

describe("pré-remplissage d'après la recommandation commencée", () => {
  it("refaire : l'exercice lui-même", () => {
    expect(prefillEntry(move(`refaire:${KEY}`), "Mathématiques", exercises)).toMatchObject({ mode: "refaire", exerciseKey: KEY, label: "TD 4 — ex 12", chapterId: "m2-reduction" });
  });

  it("transfert : l'exercice d'origine ; exercice ciblé : son chapitre et le niveau difficile si c'est le cas", () => {
    expect(prefillEntry(move("transfert:exercice:td-2"), "Mathématiques", exercises)).toMatchObject({ mode: "transfert", exerciseKey: "exercice:td-2" });
    expect(prefillEntry(move("exercice:m2-series-entieres:difficile"), "Mathématiques", exercises)).toMatchObject({ mode: "nouveau", chapterId: "m2-series-entieres", level: "difficile" });
  });

  it("autre matière, ou aucune recommandation : une ligne vide", () => {
    expect(prefillEntry(move(`refaire:${KEY}`, "Physique"), "Mathématiques", exercises)).toEqual(emptyEntry());
    expect(prefillEntry(null, "Mathématiques", exercises)).toEqual(emptyEntry());
  });
});

describe("tentatives créées", () => {
  it("refaire : même exercice, niveau hérité ; un nouvel exercice : clé saisie à la main ; les lignes incomplètes sont ignorées", () => {
    const entries = [
      { ...prefillEntry(move(`refaire:${KEY}`), "Mathématiques", exercises), result: "réussi" as const },
      { ...emptyEntry("m2-reduction"), label: "TD 4 — ex 13", result: "échec" as const, cause: "calcul" as const },
      { ...emptyEntry(), label: "sans résultat" },
    ];
    expect(entries.map(isComplete)).toEqual([true, true, false]);
    const created = attemptsFromDebrief(entries, session, exercises);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ exerciseKey: KEY, result: "réussi", level: "classique", day: "2026-10-03" });
    expect(created[1]).toMatchObject({ exerciseKey: "exercice:td-4-ex-13", chapterId: "m2-reduction", cause: "calcul" });
    expect(created[0].createdAt < created[1].createdAt).toBe(true);
    // Réussi sans aide : l'exercice est vérifié.
    const after = buildExercises({ annales: [], attempts: [attempt(KEY, "2026-09-25", "échec"), ...created], retryDelaysDays: [2, 5, 12], today: TODAY });
    expect(after.find((exercise) => exercise.key === KEY)!.status).toBe("vérifié");
  });

  it("transfert : un autre énoncé, rattaché à l'origine — et c'est la preuve qui clôt la recommandation", () => {
    const entry = { ...prefillEntry(move("transfert:exercice:td-2"), "Mathématiques", exercises), label: "Centrale 2019 Q4", result: "réussi" as const };
    const [created] = attemptsFromDebrief([entry], session, exercises);
    expect(created).toMatchObject({ transferOf: "exercice:td-2" });
    expect(created.exerciseKey).not.toBe("exercice:td-2");
    const resolved = resolveOutcomes([move("transfert:exercice:td-2")], { sessions: [], reviewItems: [], chapterMemory: [], attempts: [created] }, new Date("2026-10-03T14:30:00.000Z"));
    expect(resolved[0].status).toBe("fait");
  });
});
