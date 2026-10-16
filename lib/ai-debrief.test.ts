import { describe, expect, it } from "vitest";
import { aiDebriefPrompt, matchGrade, mergeWithSaved, parseAiDebrief, type AiDebriefParsed } from "@/lib/ai-debrief";
import { applyDebrief, buildDebrief, questionsFromAttempts } from "@/lib/debrief";
import { createGrade } from "@/lib/grades";
import { normalizeAttempt } from "@/lib/attempts";
import { normalizeErrorEntry } from "@/lib/storage";

const TODAY = "2026-10-16";
const NOW = new Date(2026, 9, 16, 18, 0);

const FULL = {
  version: 1,
  matiere: "maths",
  type: "ds",
  titre: "DS 3 — Réduction",
  date: "2026-10-10",
  note: 12.5,
  bareme: 20,
  resume: "Cours solide, méthode fragile.",
  incertitudes: ["Page 3 illisible : Q5 non évaluée."],
  questions: [
    { libelle: "Q1", chapitre: "m1-derivabilite", resultat: "réussie" },
    { libelle: "Q2", chapitre: "m2-reduction", resultat: "fausse", cause: "méthode", confiance: "probable", description: "Critère de diagonalisabilité oublié.", correction: "Somme des dim(E_λ) = n.", points: 4, minutes: 12, niveau: "classique" },
    { libelle: "Q3", chapitre: "Réduction des endomorphismes", resultat: "fausse", cause: "calcul", confiance: "incertaine", description: "Résultat final faux." },
  ],
};

function parse(data: unknown): AiDebriefParsed {
  const result = parseAiDebrief(JSON.stringify(data), TODAY);
  if (!result.ok) throw new Error(result.errors.join(" | "));
  return result.value;
}

function save(value: AiDebriefParsed, grades = [createGrade({ ...value.grade, score: 12.5 }, NOW)!]) {
  const grade = grades[0];
  const built = buildDebrief(grade, value.questions, NOW);
  return { grade, ...applyDebrief(grade.id, { attempts: [], errors: [] }, built) };
}

describe("lecture d'un débrief IA", () => {
  it("lit un débrief complet, avec ou sans clôture markdown et phrase autour", () => {
    const wrapped = `Voici l'analyse :\n\`\`\`json\n${JSON.stringify(FULL)}\n\`\`\`\nBon courage !`;
    const result = parseAiDebrief(wrapped, TODAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grade).toMatchObject({ subject: "Mathématiques", kind: "ds", date: "2026-10-10", score: 12.5, maxScore: 20 });
    expect(result.value.questions).toHaveLength(3);
    expect(result.value.uncertainties).toEqual(["Page 3 illisible : Q5 non évaluée."]);
  });

  it("(3) rattache les chapitres : identifiant, titre reconnu, titre inconnu laissé vide et signalé", () => {
    const value = parse({ ...FULL, questions: [...FULL.questions, { libelle: "Q4", chapitre: "Théorie des catégories", resultat: "fausse", cause: "cours", confiance: "certaine" }] });
    expect(value.questions.map((q) => q.chapterId)).toEqual(["m1-derivabilite", "m2-reduction", "m2-reduction", null]);
    expect(value.warnings.join(" ")).toMatch(/Q4.*non reconnu/);
  });

  it("(3) un chapitre d'une autre matière n'est pas rattaché", () => {
    const value = parse({ ...FULL, questions: [{ libelle: "Q1", chapitre: "m1-derivabilite", resultat: "fausse", cause: "cours", confiance: "certaine" }], matiere: "physique" });
    expect(value.questions[0].chapterId).toBeNull();
    expect(value.warnings.join(" ")).toMatch(/non reconnu dans cette matière/);
  });

  it("(4) données partielles : sans note, sans chapitre, sans cause — accepté, rien d'inventé", () => {
    const value = parse({ matiere: "Physique", titre: "Colle 2", date: "2026-10-12", type: "colle", questions: [{ libelle: "Q1", resultat: "partielle" }] });
    expect(value.grade.score).toBeNull();
    expect(value.grade.maxScore).toBe(20);
    expect(value.questions[0]).toMatchObject({ chapterId: null, cause: null, points: null, minutes: null, confidence: null, correction: null });
    expect(value.toConfirm).toEqual(["Q1"]);
    expect(value.warnings.join(" ")).toMatch(/aucun chapitre/);
  });

  it("(6) une cause incertaine n'est PAS enregistrée : la question reste à trancher, la cause envisagée reste dans la note", () => {
    const value = parse(FULL);
    const q3 = value.questions[2];
    expect(q3.cause).toBeNull();
    expect(q3.confidence).toBe("incertaine");
    expect(q3.note).toMatch(/Cause envisagée, non retenue : calcul/);
    expect(value.toConfirm).toEqual(["Q3"]);

    const { attempts, errors } = save(value);
    const attempt = attempts.find((a) => a.label.endsWith("Q3"))!;
    expect(attempt).toMatchObject({ result: "échec", cause: null, confidence: "incertaine", byAi: true });
    // Pas de type d'erreur deviné : aucune entrée au carnet pour Q3.
    expect(errors.find((e) => e.id.endsWith(":q3"))).toBeUndefined();
  });

  it("une cause probable est gardée, marquée, et sa bonne idée devient celle de l'erreur", () => {
    const { errors, attempts } = save(parse(FULL));
    const error = errors.find((e) => e.id.endsWith(":q2"))!;
    expect(error).toMatchObject({ type: "méthode", confidence: "probable", fix: "Somme des dim(E_λ) = n.", programmeChapterId: "m2-reduction", source: "DS" });
    expect(attempts.find((a) => a.label.endsWith("Q2"))).toMatchObject({ cause: "méthode", confidence: "probable", byAi: true, chapterId: "m2-reduction" });
  });

  it("refuse net ce qui est invalide, avec des messages utiles", () => {
    const bad = (data: unknown, pattern: RegExp) => {
      const result = parseAiDebrief(typeof data === "string" ? data : JSON.stringify(data), TODAY);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join(" ")).toMatch(pattern);
    };
    bad("", /Colle d'abord/);
    bad("pas de json ici", /Aucun objet JSON/);
    bad('{"matiere": "maths",}', /JSON est invalide/);
    bad({ ...FULL, date: "2026-02-30" }, /date/);
    bad({ ...FULL, date: "2027-01-01" }, /futur/);
    bad({ ...FULL, matiere: "astrologie" }, /matiere/);
    bad({ ...FULL, version: 2 }, /Version/);
    bad({ ...FULL, note: 25 }, /note/);
    bad({ ...FULL, questions: [] }, /questions/);
    bad({ ...FULL, questions: [{ libelle: "Q1", resultat: "peut-être" }] }, /resultat/);
    bad({ ...FULL, questions: [{ libelle: "Q1", resultat: "fausse" }, { libelle: "q1", resultat: "fausse" }] }, /double/);
    bad("{".repeat(70_000), /trop long/);
  });

  it("nettoie le texte venu d'ailleurs et ignore les champs inconnus", () => {
    const value = parse({ ...FULL, questions: [{ libelle: "Q1\u0000\n", resultat: "fausse", cause: "cours", confiance: "certaine", description: "a\u0007b ".repeat(200), __proto__: { admin: true }, extra: "x" }] });
    expect(value.questions[0].label).toBe("Q1");
    expect(value.questions[0].note.length).toBeLessThanOrEqual(200);
    expect(value.questions[0].note).not.toMatch(/\u0007/);
    expect(JSON.stringify(value.questions[0])).not.toMatch(/extra|admin/);
  });

  it("la consigne donne le format ET les identifiants de chapitres, et l'exemple est lui-même valide", () => {
    const prompt = aiDebriefPrompt();
    expect(prompt).toMatch(/m2-reduction = Réduction des endomorphismes/);
    expect(prompt).toMatch(/N'invente rien/);
    const example = prompt.slice(prompt.indexOf("{"), prompt.indexOf("\n\nRÈGLES"));
    expect(parseAiDebrief(example, TODAY).ok).toBe(true);
  });
});

describe("(1)(5) enregistrement validé et absence de doublons au renvoi", () => {
  it("enregistre une tentative par question, des erreurs seulement là où la cause est établie", () => {
    const { attempts, errors } = save(parse(FULL));
    expect(attempts).toHaveLength(3);
    expect(errors).toHaveLength(1);
  });

  it("renvoyer le même débrief remplace : mêmes identifiants, aucun doublon, la note retrouvée", () => {
    const value = parse(FULL);
    const first = save(value);
    const grades = [first.grade];
    // Deuxième envoi : la note est retrouvée (même matière, jour, titre) …
    expect(matchGrade(grades, value.grade)?.id).toBe(first.grade.id);
    // … donc mêmes identifiants, et `applyDebrief` remplace.
    const again = applyDebrief(first.grade.id, { attempts: first.attempts, errors: first.errors }, buildDebrief(first.grade, value.questions, NOW));
    expect(again.attempts.map((a) => a.id).sort()).toEqual(first.attempts.map((a) => a.id).sort());
    expect(again.errors.map((e) => e.id)).toEqual(first.errors.map((e) => e.id));
  });

  it("un renvoi fusionné garde ce que l'élève a corrigé (cause tranchée, exercice relié, question retirée de l'IA)", () => {
    const value = parse(FULL);
    const first = save(value);
    // L'élève a tranché Q3 = calcul, relié Q2 à un exercice, et ajouté une Q9 à la main.
    const saved = questionsFromAttempts(first.grade.id, first.attempts, first.errors).map((q) =>
      q.label === "Q3" ? { ...q, cause: "calcul" as const, confidence: null } : q.label === "Q2" ? { ...q, linkedExerciseKey: "annale:x" } : q
    );
    saved.push({ label: "Q9", chapterId: null, outcome: "fausse", cause: "cours", lackOfTime: false, points: null, minutes: null, linkedExerciseKey: null, note: "" });
    // Le second JSON ne dit plus rien de la cause de Q3 ni du chapitre de Q2, et oublie Q9.
    const second = parse({ ...FULL, questions: [{ libelle: "Q2", resultat: "fausse", cause: "méthode", confiance: "probable" }, { libelle: "Q3", resultat: "fausse", chapitre: "m2-reduction" }] });
    const merged = mergeWithSaved(second.questions, saved);
    const byLabel = Object.fromEntries(merged.map((q) => [q.label, q]));
    expect(merged.map((q) => q.label).sort()).toEqual(["Q1", "Q2", "Q3", "Q9"]);
    expect(byLabel.Q3).toMatchObject({ cause: "calcul", confidence: null });
    expect(byLabel.Q2).toMatchObject({ linkedExerciseKey: "annale:x", chapterId: "m2-reduction" });
  });

  it("la bonne idée déjà notée par l'élève n'est pas écrasée par un renvoi", () => {
    const value = parse(FULL);
    const first = save(value);
    const edited = first.errors.map((e) => (e.id.endsWith(":q2") ? { ...e, fix: "Ma propre formulation" } : e));
    const again = applyDebrief(first.grade.id, { attempts: first.attempts, errors: edited }, buildDebrief(first.grade, value.questions, NOW));
    expect(again.errors.find((e) => e.id.endsWith(":q2"))?.fix).toBe("Ma propre formulation");
  });

  it("matchGrade ne devine pas quand deux notes conviennent", () => {
    const value = parse(FULL);
    const a = createGrade({ ...value.grade, title: "Autre", score: 10 }, NOW)!;
    const b = createGrade({ ...value.grade, title: "Encore autre", score: 11 }, NOW)!;
    expect(matchGrade([a, b], value.grade)).toBeNull();
    expect(matchGrade([a], value.grade)?.id).toBe(a.id);
  });
});

describe("(9) compatibilité avec les historiques existants", () => {
  it("une tentative et une erreur sans les nouveaux champs se lisent comme avant", () => {
    const attempt = normalizeAttempt({ id: "a1", exerciseKey: "ds:g:q1", subject: "Mathématiques", result: "échec", createdAt: "2026-09-01T12:00:00.000Z", day: "2026-09-01", cause: "calcul" })!;
    expect(attempt.confidence).toBeUndefined();
    expect(attempt.byAi).toBeUndefined();
    const error = normalizeErrorEntry({ id: "e1", subject: "Mathématiques", type: "calcul", description: "signe", date: "2026-09-01", createdAt: "2026-09-01T12:00:00.000Z" })!;
    expect(error.confidence).toBeUndefined();
  });

  it("les nouveaux champs survivent à la normalisation ; une valeur étrangère est écartée", () => {
    const attempt = normalizeAttempt({ id: "a1", exerciseKey: "k", subject: "Mathématiques", result: "échec", createdAt: "2026-09-01T12:00:00.000Z", confidence: "probable", byAi: true })!;
    expect(attempt).toMatchObject({ confidence: "probable", byAi: true });
    const weird = normalizeAttempt({ id: "a2", exerciseKey: "k", subject: "Mathématiques", result: "échec", createdAt: "2026-09-01T12:00:00.000Z", confidence: "sûr", byAi: "oui" })!;
    expect(weird.confidence).toBeUndefined();
    expect(weird.byAi).toBeUndefined();
  });
});
