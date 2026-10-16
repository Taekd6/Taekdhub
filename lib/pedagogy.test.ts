import { describe, expect, it } from "vitest";
import { parseAiDebrief } from "@/lib/ai-debrief";
import type { ExerciseAttempt } from "@/lib/attempts";
import { applyDebrief, buildDebrief } from "@/lib/debrief";
import { createGrade } from "@/lib/grades";
import { evaluationHistory, pedagogyInputFrom, recurringDifficulties, resolveChapter, type PedagogyInput } from "@/lib/pedagogy";
import type { ErrorEntry, Grade, WorkItem } from "@/lib/storage";

const NOW = new Date(2026, 9, 16, 18, 0);
const TODAY = "2026-10-16";

function debrief(title: string, date: string, questions: object[], opts: { subject?: string } = {}) {
  const parsed = parseAiDebrief(JSON.stringify({ matiere: opts.subject ?? "maths", titre: title, date, questions }), TODAY);
  if (!parsed.ok) throw new Error(parsed.errors.join("|"));
  const grade = createGrade({ ...parsed.value.grade, score: 10 }, NOW)!;
  return { grade, ...applyDebrief(grade.id, { attempts: [], errors: [] }, buildDebrief(grade, parsed.value.questions, NOW)) };
}

function inputOf(parts: { grade: Grade; attempts: ExerciseAttempt[]; errors: ErrorEntry[] }[], extra: Partial<PedagogyInput> = {}): PedagogyInput {
  return {
    grades: parts.map((part) => part.grade),
    attempts: parts.flatMap((part) => part.attempts),
    errors: parts.flatMap((part) => part.errors),
    workItems: [],
    chapterMemory: [],
    annales: [],
    retryDelaysDays: [2, 5, 12],
    today: TODAY,
    ...extra,
  };
}

const failRed = (label: string, cause: string, confiance = "probable") => ({ libelle: label, chapitre: "m2-reduction", resultat: "fausse", cause, confiance, description: `ratée ${label}` });

function ds(daysFromToday: number, extra: Partial<WorkItem> = {}): WorkItem {
  const due = new Date(2026, 9, 16 + daysFromToday);
  return {
    id: "w-ds", title: "DS 4", kind: "ds", subject: "Mathématiques", estimatedMinutes: 240,
    dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
    dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [],
    createdAt: "2026-10-01T08:00:00.000Z", completedAt: null, postponements: [], ...extra,
  };
}

describe("(10) recommandations fondées sur des observations enregistrées", () => {
  const ds1 = debrief("DS 1", "2026-09-26", [failRed("Q2", "méthode")]);
  const ds2 = debrief("DS 2", "2026-10-10", [failRed("Q4", "méthode"), failRed("Q5", "calcul")]);

  it("sans aucun débrief : rien, et le rapport le dit", () => {
    const report = recurringDifficulties(inputOf([]));
    expect(report.recommandations).toEqual([]);
    expect(report.corrigees).toEqual([]);
  });

  it("une seule évaluation : un SIGNAL, données insuffisantes — même avec deux questions ratées dans le même DS", () => {
    const only = debrief("DS 2", "2026-10-10", [failRed("Q4", "méthode"), failRed("Q5", "méthode")]);
    const [recommendation] = recurringDifficulties(inputOf([only])).recommandations;
    expect(recommendation.niveau).toBe("signal");
    expect(recommendation.evenements_distincts).toBe(1);
    expect(recommendation.donnees_suffisantes).toBe(false);
    expect(recommendation.justification).toMatch(/Une seule observation/);
  });

  it("deux évaluations distinctes : difficulté RÉCURRENTE, justifiée par les faits datés", () => {
    const [recommendation] = recurringDifficulties(inputOf([ds1, ds2])).recommandations;
    expect(recommendation).toMatchObject({
      chapitre: { id: "m2-reduction", titre: "Réduction des endomorphismes" },
      niveau: "récurrente",
      evenements_distincts: 2,
      donnees_suffisantes: true,
      cause_dominante: "Méthode (je ne voyais pas l'outil)",
      supports: ["exercice"],
    });
    expect(recommendation.justification).toMatch(/2 évaluations ou exercices distincts, sans réussite autonome/);
    expect(recommendation.observations[0]).toBe("2026-10-10 · DS 2 — Q4 : échec, cause méthode (probable) ; Q5 : échec, cause calcul (probable)");
    expect(recommendation.observations[1]).toBe("2026-09-26 · DS 1 — Q2 : échec, cause méthode (probable)");
    expect(recommendation.observations).toHaveLength(2);
    expect(recommendation.verification).toMatch(/sans aide.*relire la correction ne ferme pas/);
  });

  it("une cause « cours » mène aux cartes Anki du chapitre — seulement celles réellement associées", () => {
    const coursDs1 = debrief("DS 1", "2026-09-26", [failRed("Q2", "cours")]);
    const coursDs2 = debrief("DS 2", "2026-10-10", [failRed("Q4", "cours")]);
    const withDeck = recurringDifficulties(inputOf([coursDs1, coursDs2], { ankiDecksByChapter: new Map([["m2-reduction", ["Maths::Réduction"]]]) })).recommandations[0];
    expect(withDeck.supports).toEqual(["cours", "anki"]);
    expect(withDeck.anki_paquets).toEqual(["Maths::Réduction"]);
    const noDeck = recurringDifficulties(inputOf([coursDs1, coursDs2])).recommandations[0];
    expect(noDeck.anki_paquets).toEqual([]);
  });

  it("causes non établies (incertaines) : l'action est d'abord de les diagnostiquer", () => {
    const a = debrief("DS 1", "2026-09-26", [{ ...failRed("Q2", "calcul", "incertaine") }]);
    const b = debrief("DS 2", "2026-10-10", [{ ...failRed("Q4", "calcul", "incertaine") }]);
    const [recommendation] = recurringDifficulties(inputOf([a, b])).recommandations;
    expect(recommendation.cause_dominante).toBeNull();
    expect(recommendation.supports).toEqual(["ia"]);
    expect(recommendation.action).toMatch(/cause n'est pas établie/);
  });

  it("l'échéance : celle du programme de l'épreuve d'abord, sinon la plus proche de la matière, sinon aucune", () => {
    const soon = ds(3, { id: "soon", title: "DS 4" });
    const far = ds(20, { id: "far", title: "DS 5", scope: { chapterIds: ["mem-red"], updatedAt: "2026-10-01T00:00:00.000Z" } });
    const red = { id: "mem-red", subject: "Mathématiques", title: "Réduction des endomorphismes" } as never;
    const withScope = recurringDifficulties(inputOf([ds1, ds2], { workItems: [soon, far], chapterMemory: [red] })).recommandations[0];
    expect(withScope.echeance).toMatchObject({ titre: "DS 5", portee: "programme de l'épreuve", jours: 20 });
    const subjectOnly = recurringDifficulties(inputOf([ds1, ds2], { workItems: [soon] })).recommandations[0];
    expect(subjectOnly.echeance).toMatchObject({ titre: "DS 4", portee: "matière", jours: 3 });
    const none = recurringDifficulties(inputOf([ds1, ds2], { workItems: [ds(3, { subject: "Physique" })] })).recommandations[0];
    expect(none.echeance).toBeNull();
    // Échéance passée ou abandonnée : ignorée.
    expect(recurringDifficulties(inputOf([ds1, ds2], { workItems: [ds(-2), ds(5, { status: "abandonné" })] })).recommandations[0].echeance).toBeNull();
  });

  it("corrigée seulement par une réussite SANS AIDE postérieure : relire ou réussir avec correction ne suffit pas", () => {
    const retry = (help: ExerciseAttempt["help"], result: ExerciseAttempt["result"], day: string): ExerciseAttempt => ({
      id: `r-${help}-${day}`, exerciseKey: "ds:autre:q1", label: "TD réduction", subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice",
      day, createdAt: `${day}T15:00:00.000Z`, updatedAt: `${day}T15:00:00.000Z`, result, help, minutes: 20, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null,
    });
    const withHelp = inputOf([ds1, ds2], { attempts: [...ds1.attempts, ...ds2.attempts, retry("correction", "réussi", "2026-10-12")] });
    expect(recurringDifficulties(withHelp).recommandations).toHaveLength(1);
    const before = inputOf([ds1, ds2], { attempts: [...ds1.attempts, ...ds2.attempts, retry("sans", "réussi", "2026-10-01")] });
    expect(recurringDifficulties(before).recommandations).toHaveLength(1); // réussite ANTÉRIEURE à la dernière difficulté
    const proven = inputOf([ds1, ds2], { attempts: [...ds1.attempts, ...ds2.attempts, retry("sans", "réussi", "2026-10-12")] });
    const report = recurringDifficulties(proven);
    expect(report.recommandations).toEqual([]);
    expect(report.corrigees[0]).toMatchObject({ chapitre: "Réduction des endomorphismes" });
    expect(report.corrigees[0].preuve).toMatch(/réussi sans aide le 2026-10-12/);
  });

  it("une observation sans chapitre n'entre pas dans l'analyse : comptée à part, jamais devinée", () => {
    const orphan = debrief("DS 3", "2026-10-12", [{ libelle: "Q1", resultat: "fausse", cause: "cours", confiance: "certaine" }]);
    const report = recurringDifficulties(inputOf([orphan]));
    expect(report.recommandations).toEqual([]);
    expect(report.observations_sans_chapitre).toBe(1);
  });

  it("filtre par matière et par chapitre", () => {
    const phys = debrief("DS phys", "2026-10-11", [{ libelle: "Q1", chapitre: "Électrostatique", resultat: "fausse", cause: "cours", confiance: "certaine" }], { subject: "physique" });
    const input = inputOf([ds1, ds2, phys]);
    expect(recurringDifficulties(input, { subject: "Physique" }).recommandations.every((r) => r.matiere === "Physique")).toBe(true);
    expect(recurringDifficulties(input, { chapterId: "m2-reduction" }).recommandations).toHaveLength(1);
  });
});

describe("(7) l'interface de lecture pour les IA", () => {
  const a = debrief("DS 1", "2026-09-26", [failRed("Q2", "méthode"), { libelle: "Q1", chapitre: "m1-derivabilite", resultat: "réussie" }]);
  const b = debrief("DS 2", "2026-10-10", [failRed("Q4", "calcul", "incertaine")]);

  it("renvoie les dernières évaluations, les plus récentes d'abord, avec cause, fiabilité, erreur et état", () => {
    const history = evaluationHistory(inputOf([a, b]));
    expect(history.map((e) => e.titre)).toEqual(["DS 2", "DS 1"]);
    const q4 = history[0].questions[0];
    expect(q4).toMatchObject({ libelle: "Q4", cause: null, confiance: "incertaine", par_ia: true, erreur: null, etat: "à vérifier : cause non établie" });
    const q2 = history[1].questions.find((q) => q.libelle === "Q2")!;
    expect(q2).toMatchObject({ confiance: "probable", etat: "à retravailler", chapitre: { id: "m2-reduction", titre: "Réduction des endomorphismes" } });
    expect(q2.erreur?.type).toBeTruthy();
    expect(history[1].questions.find((q) => q.libelle === "Q1")?.etat).toBe("réussie");
  });

  it("cible : nombre d'évaluations borné, filtre chapitre et matière", () => {
    expect(evaluationHistory(inputOf([a, b]), { last: 1 })).toHaveLength(1);
    expect(evaluationHistory(inputOf([a, b]), { last: 999 })).toHaveLength(2);
    expect(evaluationHistory(inputOf([a, b]), { chapterId: "m1-derivabilite" }).map((e) => e.titre)).toEqual(["DS 1"]);
    expect(evaluationHistory(inputOf([a, b]), { subject: "Physique" })).toEqual([]);
  });

  it("reconstruit tout depuis les collections brutes du serveur, même abîmées ou partielles", () => {
    const raw = {
      grades: [...[a, b].map((part) => part.grade), { n: "importe quoi" }, null],
      attempts: [...a.attempts, ...b.attempts, 42, { id: 1 }],
      errors: [...a.errors, "x"],
      workItems: "pas une liste",
      preferences: { garbage: true },
    };
    const input = pedagogyInputFrom(raw, null, NOW);
    expect(input.today).toBe(TODAY);
    expect(input.attempts).toHaveLength(3);
    expect(input.workItems).toEqual([]);
    expect(evaluationHistory(input)).toHaveLength(2);
    expect(recurringDifficulties(input).recommandations).toHaveLength(1);
    // Aucune donnée du tout : rapports vides, pas d'exception.
    const empty = pedagogyInputFrom({}, undefined, NOW);
    expect(evaluationHistory(empty)).toEqual([]);
    expect(recurringDifficulties(empty).recommandations).toEqual([]);
  });

  it("(9) un historique antérieur — tentatives de débrief manuel, sans fiabilité ni marque IA — se lit sans changement", () => {
    const manual = a.attempts.map(({ confidence: _c, byAi: _b, ...rest }) => { void _c; void _b; return rest; });
    const history = evaluationHistory(inputOf([{ ...a, attempts: manual }]));
    expect(history[0].questions.every((q) => q.confiance === null && q.par_ia === false)).toBe(true);
  });

  it("ne modifie jamais ses entrées (lecture seule)", () => {
    const input = inputOf([a, b], { workItems: [ds(3)] });
    const frozen = JSON.stringify(input);
    const deepFreeze = (value: unknown): void => {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value as object).forEach(deepFreeze);
      }
    };
    deepFreeze(input);
    expect(() => {
      evaluationHistory(input);
      recurringDifficulties(input);
    }).not.toThrow();
    expect(JSON.stringify(input)).toBe(frozen);
  });

  it("résout un chapitre sans le deviner", () => {
    expect(resolveChapter("m2-reduction", null)).toBe("m2-reduction");
    expect(resolveChapter("réduction", "Mathématiques")).toBe("m2-reduction");
    expect(resolveChapter("Espaces euclidiens", null)).toBe("m2-euclidiens");
    // « réduction » existe aussi en chimie : ambigu sans matière, donc refusé plutôt que deviné.
    expect(resolveChapter("réduction", null)).toBeNull();
    expect(resolveChapter("zzzzzz", "Mathématiques")).toBeNull();
    expect(resolveChapter("", null)).toBeNull();
  });
});
