import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog } from "@/lib/annales";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildExercises } from "@/lib/exercises";
import { exerciseRequest, fixableIssues, levelToRequest, qualityIssues, transferRequest, varietyWarning } from "@/lib/exercise-quality";

const TODAY = "2026-10-20";
const CH = "m2-reduction";

let seq = 0;
function attempt(key: string, day: string, result: ExerciseAttempt["result"], extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return { id: `q${seq}`, exerciseKey: key, label: key, subject: "Mathématiques", chapterId: CH, origin: "exercice", day, createdAt: `${day}T18:00:${String(seq % 60).padStart(2, "0")}.000Z`, updatedAt: `${day}T18:00:00.000Z`, result, help: "sans", minutes: null, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null, ...extra };
}

const build = (attempts: ExerciseAttempt[]) => buildExercises({ annales: [], attempts, retryDelaysDays: [2, 5, 12], today: TODAY });

describe("données d'un exercice", () => {
  it("sans chapitre, sans niveau, échec sans cause : tout est signalé ; chapitre et niveau sont corrigeables ici", () => {
    const [exercise] = build([attempt("td", "2026-10-10", "échec", { chapterId: null })]);
    expect(qualityIssues(exercise)).toEqual(["chapitre", "niveau", "cause"]);
    expect(fixableIssues(exercise)).toEqual(["chapitre", "niveau"]);
  });

  it("un exercice complet n'a rien à signaler", () => {
    const [exercise] = build([attempt("td", "2026-10-10", "échec", { level: "classique", cause: "méthode" })]);
    expect(qualityIssues(exercise)).toEqual([]);
  });

  it("une annale ne se corrige pas ici, et son aide déduite est signalée", () => {
    const log = normalizeAnnaleLog({ id: "a1", created_at: "2026-10-10T15:00:00Z", matiere: "maths", chapitre: "Réduction", source: "Mines 2023", resultat: "réussi", indices: 0 })!;
    const [exercise] = buildExercises({ annales: [log], attempts: [], retryDelaysDays: [2], today: TODAY });
    expect(qualityIssues(exercise)).toContain("aide");
    expect(fixableIssues(exercise)).toEqual([]);
  });
});

describe("niveau à viser : on monte sur preuve, jamais au temps passé", () => {
  it("sans réussite de niveau connu : classique", () => {
    expect(levelToRequest(build([attempt("a", "2026-10-10", "échec", { level: "direct" })]), CH).level).toBe("classique");
  });

  it("deux classiques réussis sans aide : difficile ; avec indices, non", () => {
    expect(levelToRequest(build([attempt("a", "2026-10-10", "réussi", { level: "classique" }), attempt("b", "2026-10-11", "réussi", { level: "classique" })]), CH)).toMatchObject({ level: "difficile" });
    expect(levelToRequest(build([attempt("a", "2026-10-10", "réussi", { level: "classique" }), attempt("b", "2026-10-11", "réussi", { level: "classique", help: "indices" })]), CH).level).toBe("classique");
  });

  it("un autre chapitre ne compte pas", () => {
    const other = [attempt("a", "2026-10-10", "réussi", { level: "classique", chapterId: "m2-series-entieres" }), attempt("b", "2026-10-11", "réussi", { level: "classique", chapterId: "m2-series-entieres" })];
    expect(levelToRequest(build(other), CH).level).toBe("classique");
  });
});

describe("variété", () => {
  it("trois réussites toutes en application directe : la méthode n'est pas prouvée", () => {
    const easy = ["a", "b", "c"].map((key) => attempt(key, "2026-10-10", "réussi", { level: "direct" }));
    expect(varietyWarning(build(easy), CH)).toContain("application directe");
  });

  it("une réussite difficile parmi elles, ou moins de trois réussites : rien à signaler", () => {
    const mixed = [attempt("a", "2026-10-10", "réussi", { level: "direct" }), attempt("b", "2026-10-10", "réussi", { level: "direct" }), attempt("c", "2026-10-10", "réussi", { level: "difficile" })];
    expect(varietyWarning(build(mixed), CH)).toBeNull();
    expect(varietyWarning(build(mixed.slice(0, 2)), CH)).toBeNull();
  });
});

describe("demande d'exercice à Claude", () => {
  it("les cinq exigences, et la correction gardée pour après l'essai", () => {
    const text = exerciseRequest({ subject: "Mathématiques", chapter: "Réduction des endomorphismes", level: "difficile", method: "Diagonaliser" });
    for (const part of ["sous-thème", "Difficile (Mines, Centrale, X-ENS)", "prérequis", "objectif", "Diagonaliser", "Ne donne PAS la correction", "rigoureuse", "log_exercise"]) expect(text).toContain(part);
  });

  it("transfert : même niveau que l'origine, énoncé différent", () => {
    const [exercise] = build([attempt("TD 4 ex 12", "2026-10-01", "échec", { level: "difficile" }), attempt("TD 4 ex 12", "2026-10-05", "réussi")]);
    const text = transferRequest(exercise, "Diagonaliser");
    expect(text).toContain("Difficile (Mines, Centrale, X-ENS)");
    expect(text).toContain("DIFFÉRENT de « TD 4 ex 12 »");
    expect(text).toContain("chapitre « Réduction des endomorphismes »");
  });
});
