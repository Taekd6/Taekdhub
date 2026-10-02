import { describe, expect, it } from "vitest";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildDiagnosticContext } from "@/lib/diagnostic-context";
import { activeWeeklyFocus, normalizePreferences } from "@/lib/storage";
import { transferExerciseKey } from "@/lib/transfer";
import { adoptFocus, computeWeeklyLearning } from "@/lib/weekly-learning";

const TODAY = "2026-10-20";
const NOW = new Date(2026, 9, 20, 20);
const DELAYS = [2, 5, 12];

let seq = 0;
function attempt(key: string, chapterId: string, day: string, result: ExerciseAttempt["result"], help: ExerciseAttempt["help"] = "sans", extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  seq += 1;
  return { id: `w${seq}`, exerciseKey: key, label: key, subject: "Mathématiques", chapterId, origin: "exercice", day, createdAt: `${day}T18:00:${String(seq % 60).padStart(2, "0")}.000Z`, updatedAt: `${day}T18:00:00.000Z`, result, help, minutes: null, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null, ...extra };
}

function learning(attempts: ExerciseAttempt[]) {
  const context = buildDiagnosticContext({ chapterMemory: [], attempts, errors: [], ankiSnapshots: [], workItems: [], preferences: { ankiDeckChapters: {}, retryDelaysDays: DELAYS }, annales: [], kholle: { sessions: [] } as never, now: NOW });
  return computeWeeklyLearning(context, attempts, DELAYS, TODAY);
}

describe("compétences vérifiées : des preuves, jamais du temps", () => {
  it("un exercice raté puis réussi sans aide dans la semaine, avec ses temps", () => {
    const result = learning([attempt("td4", "m2-reduction", "2026-10-10", "échec", "sans", { minutes: 45 }), attempt("td4", "m2-reduction", "2026-10-16", "réussi", "sans", { minutes: 25 })]);
    expect(result.verified).toEqual([expect.objectContaining({ label: "td4", proof: "refait sans aide", on: "2026-10-16", minutes: "45 → 25 min", chapter: "Réduction des endomorphismes" })]);
  });

  it("réussi avec indices, ou du premier coup, ou avant la semaine : rien de vérifié", () => {
    const result = learning([
      attempt("a", "m2-reduction", "2026-10-10", "échec"),
      attempt("a", "m2-reduction", "2026-10-16", "réussi", "indices"),
      attempt("b", "m2-reduction", "2026-10-16", "réussi"),
      attempt("c", "m2-reduction", "2026-10-01", "échec"),
      attempt("c", "m2-reduction", "2026-10-05", "réussi"),
    ]);
    expect(result.verified).toEqual([]);
  });

  it("un transfert réussi sans aide dans la semaine : méthode acquise", () => {
    const result = learning([
      attempt("td4", "m2-reduction", "2026-10-01", "échec"),
      attempt("td4", "m2-reduction", "2026-10-05", "réussi"),
      attempt(transferExerciseKey("td4", "TD 6"), "m2-reduction", "2026-10-15", "réussi", "sans", { transferOf: "td4" }),
    ]);
    expect(result.verified).toEqual([expect.objectContaining({ label: "Méthode de « td4 »", proof: "transfert réussi", on: "2026-10-15" })]);
  });
});

describe("difficultés récurrentes : pas de conclusion sur un échec isolé", () => {
  it("la même cause sur deux exercices différents du chapitre, en deux semaines", () => {
    const result = learning([attempt("a", "m2-reduction", "2026-10-12", "échec", "sans", { cause: "méthode" }), attempt("b", "m2-reduction", "2026-10-18", "partiel", "sans", { cause: "méthode" })]);
    expect(result.recurring).toEqual([expect.objectContaining({ chapterId: "m2-reduction", cause: "méthode", exercises: 2 })]);
  });

  it("un seul exercice raté deux fois, ou deux causes différentes, ou trop ancien : rien", () => {
    expect(learning([attempt("a", "m2-reduction", "2026-10-12", "échec", "sans", { cause: "méthode" }), attempt("a", "m2-reduction", "2026-10-18", "échec", "sans", { cause: "méthode" })]).recurring).toEqual([]);
    expect(learning([attempt("a", "m2-reduction", "2026-10-12", "échec", "sans", { cause: "méthode" }), attempt("b", "m2-reduction", "2026-10-18", "échec", "sans", { cause: "calcul" })]).recurring).toEqual([]);
    expect(learning([attempt("a", "m2-reduction", "2026-09-20", "échec", "sans", { cause: "méthode" }), attempt("b", "m2-reduction", "2026-10-18", "échec", "sans", { cause: "méthode" })]).recurring).toEqual([]);
  });
});

describe("progrès", () => {
  it("sans assez de tentatives de chaque côté, on le dit au lieu de conclure", () => {
    const result = learning([attempt("a", "m2-reduction", "2026-10-18", "réussi")]);
    expect(result.progress[0]).toContain("Pas de comparaison");
  });

  it("avec assez de tentatives : le taux de réussite sans aide, comparé", () => {
    const before = ["a", "b", "c"].map((key) => attempt(key, "m2-reduction", "2026-10-10", "échec"));
    const week = ["d", "e", "f"].map((key) => attempt(key, "m2-reduction", "2026-10-17", "réussi"));
    expect(learning([...before, ...week]).progress[0]).toBe("Réussites sans aide : 100 % des 3 tentatives, contre 0 % des 3 la semaine d'avant — en hausse.");
  });
});

describe("chapitres à travailler et décisions", () => {
  // Application fragile : trois exercices, chacun réussi sans aide seulement après deux échecs.
  const fragile = ["a", "b", "c"].flatMap((key, index) => [
    attempt(key, "m2-series-entieres", `2026-10-0${index + 1}`, "échec"),
    attempt(key, "m2-series-entieres", `2026-10-0${index + 4}`, "échec"),
    attempt(key, "m2-series-entieres", `2026-10-1${index + 1}`, "réussi"),
  ]);

  it("le diagnostic fournit le chapitre, le fait et l'hypothèse ; la décision en découle", () => {
    const result = learning(fragile);
    expect(result.toWork[0]).toMatchObject({ chapterId: "m2-series-entieres", kind: "application" });
    expect(result.toWork[0].hypothesis.length).toBeGreaterThan(0);
    expect(result.decisions[0].chapterId).toBe("m2-series-entieres");
  });

  it("adopter : sept jours, puis plus rien ; la décision survit à la normalisation des préférences", () => {
    const focus = adoptFocus(learning(fragile), TODAY)!;
    expect(focus).toEqual({ decidedOn: TODAY, until: "2026-10-27", chapterIds: ["m2-series-entieres"] });
    const preferences = normalizePreferences({ weeklyFocus: JSON.parse(JSON.stringify(focus)) });
    expect(preferences.weeklyFocus).toEqual(focus);
    expect(activeWeeklyFocus(preferences, "2026-10-26")).toEqual(focus);
    expect(activeWeeklyFocus(preferences, "2026-10-27")).toBeNull();
    expect(normalizePreferences({ weeklyFocus: { decidedOn: "x", until: "2026-10-27", chapterIds: ["m2-series-entieres"] } }).weeklyFocus).toBeNull();
    expect(normalizePreferences({ weeklyFocus: { decidedOn: TODAY, until: "2026-10-27", chapterIds: ["inconnu"] } }).weeklyFocus).toBeNull();
  });

  it("file « À refaire » débordante : la règle de la semaine le dit", () => {
    const backlog = ["a", "b", "c", "d", "e"].map((key) => attempt(key, "m2-reduction", "2026-10-10", "échec"));
    expect(learning(backlog).decisions.map((decision) => decision.text)).toContain("5 exercices attendent d'être refaits sans aide : les refaire avant d'en ouvrir de nouveaux.");
  });
});
