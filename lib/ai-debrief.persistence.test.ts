// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { parseAiDebrief } from "@/lib/ai-debrief";
import { applyDebrief, buildDebrief, DEBRIEF_DRAFT_KEY, questionsFromAttempts } from "@/lib/debrief";
import { createGrade } from "@/lib/grades";
import { evaluationHistory, pedagogyInputFrom, recurringDifficulties } from "@/lib/pedagogy";
import { localData, readFlag, writeFlag } from "@/lib/storage";

const NOW = new Date(2026, 9, 16, 18, 0);

const RESPONSE = JSON.stringify({
  matiere: "maths", titre: "DS 3", date: "2026-10-10", note: 11,
  questions: [
    { libelle: "Q2", chapitre: "m2-reduction", resultat: "fausse", cause: "méthode", confiance: "probable", description: "Critère oublié", correction: "dim E_λ" },
    { libelle: "Q3", chapitre: "m2-reduction", resultat: "fausse", cause: "calcul", confiance: "incertaine" },
  ],
});

function validateAndSave() {
  const parsed = parseAiDebrief(RESPONSE, "2026-10-16");
  if (!parsed.ok) throw new Error("invalide");
  const grade = createGrade({ ...parsed.value.grade, score: 11 }, NOW)!;
  localData.saveGrades([...localData.grades(), grade]);
  const next = applyDebrief(grade.id, { attempts: localData.attempts(), errors: localData.errors() }, buildDebrief(grade, parsed.value.questions, NOW));
  expect(localData.saveAttempts(next.attempts)).toBe(true);
  expect(localData.saveErrors(next.errors)).toBe(true);
  return grade;
}

describe("(2) le débrief validé survit au rechargement", () => {
  beforeEach(() => window.localStorage.clear());

  it("tout est relu depuis le stockage : questions, fiabilité, marque IA, bonne idée, historique pour l'IA", () => {
    const grade = validateAndSave();
    // « Rechargement » : plus rien en mémoire, seulement le localStorage.
    const questions = questionsFromAttempts(grade.id, localData.attempts(), localData.errors());
    expect(questions.map((q) => q.label)).toEqual(["Q2", "Q3"]);
    expect(questions[0]).toMatchObject({ cause: "méthode", confidence: "probable", byAi: true, correction: "dim E_λ", chapterId: "m2-reduction" });
    expect(questions[1]).toMatchObject({ cause: null, confidence: "incertaine", byAi: true });

    const raw = {
      grades: JSON.parse(window.localStorage.getItem("prepahub:grades")!),
      attempts: JSON.parse(window.localStorage.getItem("prepahub:attempts")!),
      errors: JSON.parse(window.localStorage.getItem("prepahub:errors")!),
    };
    const input = pedagogyInputFrom(raw, [], NOW);
    expect(evaluationHistory(input)[0].questions.map((q) => q.confiance)).toEqual(["probable", "incertaine"]);
    expect(recurringDifficulties(input).recommandations[0].niveau).toBe("signal");
  });

  it("un second enregistrement du même débrief ne crée aucun doublon dans le stockage", () => {
    const grade = validateAndSave();
    const parsed = parseAiDebrief(RESPONSE, "2026-10-16");
    if (!parsed.ok) throw new Error("invalide");
    const next = applyDebrief(grade.id, { attempts: localData.attempts(), errors: localData.errors() }, buildDebrief(grade, parsed.value.questions, NOW));
    localData.saveAttempts(next.attempts);
    localData.saveErrors(next.errors);
    expect(localData.attempts()).toHaveLength(2);
    expect(localData.errors()).toHaveLength(1);
  });

  it("le brouillon à valider survit au rechargement tant qu'il n'est pas enregistré", () => {
    writeFlag(DEBRIEF_DRAFT_KEY, JSON.stringify({ gradeId: "g1", ai: true, questions: [], notes: null }));
    expect(JSON.parse(readFlag(DEBRIEF_DRAFT_KEY)!)).toMatchObject({ gradeId: "g1", ai: true });
  });
});
