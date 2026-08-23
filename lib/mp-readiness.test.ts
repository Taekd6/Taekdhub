import { describe, expect, it } from "vitest";
import {
  assessMpReadinessNotion,
  computeMpReadinessAssessments,
  computeMpReadinessBonus,
  matchedExercisesForNotion,
  MP_READINESS_NOTIONS,
  type MpReadinessNotion,
} from "@/lib/mp-readiness";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, Exercise, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

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
    difficulty: 3 as Difficulty,
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
    answer: null,
    correction: null,
    last_worked_at: null,
    ...overrides,
  };
}

function makeSession(exerciseId: string, overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: `s-${exerciseId}-${Math.random()}`,
    subject: "Mathématiques" as Subject,
    exercise_id: exerciseId,
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T00:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-01-01T00:10:00.000Z",
    result: null,
    ...overrides,
  };
}

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return { id: `ch-${Math.random()}`, subject: "Mathématiques", label: "Chapitre test", ...overrides };
}

const groupesNotion = MP_READINESS_NOTIONS.find((n) => n.id === "maths-groupes")!;
const ideauxNotion = MP_READINESS_NOTIONS.find((n) => n.id === "maths-ideaux")!;
const equadiffNotion = MP_READINESS_NOTIONS.find((n) => n.id === "physique-equadiff")!;

describe("MP_READINESS_NOTIONS — catalogue", () => {
  it("marque uniquement les idéaux comme nouveaux à la rentrée", () => {
    const newOnes = MP_READINESS_NOTIONS.filter((n) => n.isNewAtRentree);
    expect(newOnes.map((n) => n.id)).toEqual(["maths-ideaux"]);
  });

  it("classe toutes les notions du catalogue comme priorité de rentrée (documents sources)", () => {
    expect(MP_READINESS_NOTIONS.every((n) => n.tier === "rentree")).toBe(true);
  });
});

describe("matchedExercisesForNotion", () => {
  it("trouve un exercice par correspondance de chapitre (insensible à la casse/aux accents)", () => {
    const chapters = [makeChapter({ id: "c1", subject: "Mathématiques", label: "Polynômes" })];
    const exercises = [makeExercise({ chapter_id: "c1" })];
    const polynomes = MP_READINESS_NOTIONS.find((n) => n.id === "maths-polynomes")!;
    expect(matchedExercisesForNotion(polynomes, chapters, exercises)).toHaveLength(1);
  });

  it("trouve un exercice par tag même sans chapitre correspondant", () => {
    const exercises = [makeExercise({ chapter_id: null, tags: ["groupe symétrique"] })];
    expect(matchedExercisesForNotion(groupesNotion, [], exercises)).toHaveLength(1);
  });

  it("trouve un exercice par titre même sans chapitre ni tag correspondant", () => {
    const exercises = [makeExercise({ title: "Sous-groupes de (Z/nZ, +)", tags: [] })];
    expect(matchedExercisesForNotion(groupesNotion, [], exercises)).toHaveLength(1);
  });

  it("exclut les exercices archivés", () => {
    const exercises = [makeExercise({ title: "Groupe cyclique", archived: true })];
    expect(matchedExercisesForNotion(groupesNotion, [], exercises)).toHaveLength(0);
  });

  it("une notion physique peut retrouver un chapitre de mathématiques (matchSubjects)", () => {
    const chapters = [makeChapter({ id: "c1", subject: "Mathématiques", label: "Équations différentielles" })];
    const exercises = [makeExercise({ subject: "Mathématiques", chapter_id: "c1" })];
    expect(matchedExercisesForNotion(equadiffNotion, chapters, exercises)).toHaveLength(1);
  });

  it("ne matche jamais une notion sans rapport (pas de faux positif)", () => {
    const exercises = [makeExercise({ title: "Intégrales généralisées", tags: ["intégration"] })];
    expect(matchedExercisesForNotion(groupesNotion, [], exercises)).toHaveLength(0);
  });
});

describe("assessMpReadinessNotion — États A à D du brief", () => {
  // État A : aucun travail — une priorité de rentrée peut quand même être proposée.
  it("État A — aucune correspondance dans la banque : état 'renforcer', jamais 'découvrir' ni une lacune passée sous silence", () => {
    const assessment = assessMpReadinessNotion(groupesNotion, [], [], []);
    expect(assessment.state).toBe("renforcer");
    expect(assessment.matchedExercises).toHaveLength(0);
  });

  // État B : notion de rentrée maîtrisée — ne doit pas être proposée inutilement.
  // Le Mastery Engine (Sprint suivant) exige une PREUVE réelle (sessions
  // avec résultat, sur plusieurs exercices ET plusieurs jours) — un simple
  // champ `Exercise.mastery` renseigné sans historique ne suffit plus (voir
  // lib/mastery.ts, Cas I du brief : jamais une preuve fabriquée).
  it("État B — plusieurs exercices réussis, sur plusieurs jours : état 'maitriser'", () => {
    const exercises = [
      makeExercise({ id: "e1", title: "Groupe symétrique" }),
      makeExercise({ id: "e2", title: "Sous-groupes distingués" }),
      makeExercise({ id: "e3", title: "Morphisme de groupe et image" }),
    ];
    const sessions = [
      makeSession("e1", { started_at: "2026-01-01T09:00:00.000Z", result: "réussi" }),
      makeSession("e2", { started_at: "2026-01-02T09:00:00.000Z", result: "réussi" }),
      makeSession("e3", { started_at: "2026-01-03T09:00:00.000Z", result: "réussi" }),
      makeSession("e1", { started_at: "2026-01-04T09:00:00.000Z", result: "réussi" }),
    ];
    const assessment = assessMpReadinessNotion(groupesNotion, [], exercises, sessions);
    expect(assessment.state).toBe("maitriser");
    expect(assessment.knowledgeState).toBe("maitrise");
  });

  it("un seul exercice réussi une fois (même avec un champ mastery élevé) ne vaut jamais 'maitriser' — il faut une vraie preuve, pas un champ renseigné à la main", () => {
    const exercises = [
      makeExercise({ id: "e1", title: "Groupe symétrique", mastery: 90 as Mastery }),
      makeExercise({ id: "e2", title: "Sous-groupes distingués", mastery: 100 as Mastery }),
    ];
    const sessions = [makeSession("e1", { result: "réussi" })];
    const assessment = assessMpReadinessNotion(groupesNotion, [], exercises, sessions);
    expect(assessment.state).toBe("renforcer");
  });

  it("une moyenne élevée sur des exercices JAMAIS travaillés ne vaut pas 'maitriser' (mastery à 0 par défaut faussement haute impossible, mais attempts=0 doit quand même retomber sur 'renforcer')", () => {
    // mastery peut être renseignée manuellement sans qu'aucune tentative n'ait eu lieu — l'absence de tentative reste le signal fort ici.
    const exercises = [makeExercise({ title: "Groupe cyclique", mastery: 90 as Mastery, attempts: 0 })];
    const assessment = assessMpReadinessNotion(groupesNotion, [], exercises, []);
    expect(assessment.state).toBe("renforcer");
  });

  // État C : notion de rentrée fragile — doit pouvoir remonter.
  it("État C — maîtrise basse : état 'renforcer'", () => {
    const exercises = [makeExercise({ title: "Groupe cyclique", mastery: 25 as Mastery, attempts: 2, last_worked_at: "2026-01-01T00:00:00.000Z" })];
    const assessment = assessMpReadinessNotion(groupesNotion, [], exercises, []);
    expect(assessment.state).toBe("renforcer");
  });

  it("État C — un seul échec sur un seul exercice : reste 'renforcer' (pas assez de preuve pour conclure autrement)", () => {
    const exercise = makeExercise({ title: "Groupe cyclique", mastery: 90 as Mastery, attempts: 3, last_worked_at: "2026-01-01T00:00:00.000Z" });
    const sessions = [makeSession(exercise.id, { result: "échoué" })];
    const assessment = assessMpReadinessNotion(groupesNotion, [], [exercise], sessions);
    expect(assessment.state).toBe("renforcer");
    expect(assessment.knowledgeState).not.toBe("maitrise");
    expect(assessment.knowledgeState).not.toBe("solide");
  });

  it("État C — plusieurs échecs récents sur des exercices différents : 'renforcer', Mastery Engine détecte la fragilité", () => {
    const exercises = [makeExercise({ title: "Groupe cyclique" }), makeExercise({ title: "Sous-groupe distingué" })];
    const sessions = [makeSession(exercises[0].id, { result: "échoué" }), makeSession(exercises[1].id, { result: "échoué" })];
    const assessment = assessMpReadinessNotion(groupesNotion, [], exercises, sessions);
    expect(assessment.state).toBe("renforcer");
    expect(assessment.knowledgeState).toBe("fragile");
  });

  // État D : notion jamais étudiée mais nouvelle — toujours "à découvrir".
  it("État D — les idéaux sont toujours 'à découvrir', même sans aucune donnée", () => {
    const assessment = assessMpReadinessNotion(ideauxNotion, [], [], []);
    expect(assessment.state).toBe("decouvrir");
  });

  it("État D — les idéaux restent 'à découvrir' même si un exercice matcherait par erreur (jamais requalifiés en lacune)", () => {
    const exercises = [makeExercise({ title: "Idéaux de Z[X]", mastery: 10 as Mastery, attempts: 1 })];
    const assessment = assessMpReadinessNotion(ideauxNotion, [], exercises, []);
    expect(assessment.state).toBe("decouvrir");
  });
});

describe("computeMpReadinessAssessments", () => {
  it("évalue exactement une entrée par notion du catalogue", () => {
    const assessments = computeMpReadinessAssessments([], [], []);
    expect(assessments).toHaveLength(MP_READINESS_NOTIONS.length);
  });

  it("reproduit l'exemple maths du brief (logique/ensembles solides — avec une vraie diversité de preuves —, applications moyen, groupes faible, idéaux jamais étudiés)", () => {
    // Logique et Ensembles : deux exercices distincts, réussis sur deux jours
    // différents chacun — une vraie preuve de maîtrise (Mastery Engine, Cas
    // C/I : un seul exercice, même réussi plusieurs fois, ne suffirait pas).
    const exercises = [
      makeExercise({ id: "e-logique-1", title: "Récurrence forte" }),
      makeExercise({ id: "e-logique-2", title: "Raisonnement par l'absurde" }),
      makeExercise({ id: "e-ensembles-1", title: "Ensembles et parties" }),
      makeExercise({ id: "e-ensembles-2", title: "Ensemble quotient" }),
      makeExercise({ id: "e-applications", title: "Bijection réciproque", mastery: 50 as Mastery, attempts: 2 }),
      makeExercise({ id: "e-groupes", title: "Groupe cyclique", mastery: 20 as Mastery, attempts: 2 }),
    ];
    const sessions = [
      makeSession("e-logique-1", { started_at: "2026-01-01T09:00:00.000Z", result: "réussi" }),
      makeSession("e-logique-2", { started_at: "2026-01-02T09:00:00.000Z", result: "réussi" }),
      makeSession("e-ensembles-1", { started_at: "2026-01-01T09:00:00.000Z", result: "réussi" }),
      makeSession("e-ensembles-2", { started_at: "2026-01-02T09:00:00.000Z", result: "réussi" }),
    ];
    const byId = (id: MpReadinessNotion["id"]) => computeMpReadinessAssessments([], exercises, sessions).find((a) => a.notion.id === id)!;
    expect(byId("maths-logique").state).toBe("maitriser");
    expect(byId("maths-ensembles").state).toBe("maitriser");
    expect(byId("maths-applications").state).toBe("renforcer");
    expect(byId("maths-groupes").state).toBe("renforcer");
    expect(byId("maths-ideaux").state).toBe("decouvrir");
  });
});

describe("computeMpReadinessBonus", () => {
  it("ne retient que les notions 'rentree' en état 'renforcer'", () => {
    const fragileExercise = makeExercise({ title: "Groupe cyclique", mastery: 10 as Mastery });
    const masteredExercise1 = makeExercise({ id: "m1", title: "Récurrence forte" });
    const masteredExercise2 = makeExercise({ id: "m2", title: "Raisonnement par l'absurde" });
    const sessions = [
      makeSession("m1", { started_at: "2026-01-01T09:00:00.000Z", result: "réussi" }),
      makeSession("m2", { started_at: "2026-01-02T09:00:00.000Z", result: "réussi" }),
    ];
    const assessments = computeMpReadinessAssessments([], [fragileExercise, masteredExercise1, masteredExercise2], sessions);
    const bonus = computeMpReadinessBonus(assessments);
    expect(bonus.has(fragileExercise.id)).toBe(true);
    expect(bonus.has(masteredExercise1.id)).toBe(false);
    expect(bonus.has(masteredExercise2.id)).toBe(false);
  });

  it("ne propose jamais un exercice pour une notion 'à découvrir' (les idéaux ne doivent jamais être poussés comme une lacune)", () => {
    const suspiciousMatch = makeExercise({ title: "Idéal principal de Z[X]" });
    const bonus = computeMpReadinessBonus(computeMpReadinessAssessments([], [suspiciousMatch], []));
    expect(bonus.has(suspiciousMatch.id)).toBe(false);
  });

  it("raison lisible, sans jargon technique ni culpabilisation", () => {
    const fragile = makeExercise({ title: "Groupe cyclique", mastery: 10 as Mastery });
    const bonus = computeMpReadinessBonus(computeMpReadinessAssessments([], [fragile], []));
    const info = bonus.get(fragile.id)!;
    expect(info.reason).toBe("Priorité de rentrée");
    expect(info.reason.toLowerCase()).not.toMatch(/retard|aurais dû|pas assez/);
  });

  it("un exercice qui ne correspond à aucune notion n'a jamais de bonus", () => {
    const unrelated = makeExercise({ title: "Développements limités usuels", tags: ["dl"] });
    const bonus = computeMpReadinessBonus(computeMpReadinessAssessments([], [unrelated], []));
    expect(bonus.has(unrelated.id)).toBe(false);
  });
});
