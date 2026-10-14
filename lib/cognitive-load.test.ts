import { describe, expect, it } from "vitest";
import { createChapter } from "@/lib/chapter-memory";
import { classifyCognitiveLoad, CHAPTER_HARD_DIFFICULTY, COGNITIVE_LABEL, type CognitiveContext, type CognitiveLevel } from "@/lib/cognitive-load";
import type { Exercise, ExerciseStep } from "@/lib/exercises";
import { PROGRAMME } from "@/lib/programme-data";
import type { ChapterMemory, WorkItem } from "@/lib/storage";

/** Jeudi 24 septembre 2026, 9 h. */
const NOW = new Date(2026, 8, 24, 9, 0);
const CHAPTER = PROGRAMME.find((entry) => entry.subject === "Mathématiques")!;

function workItem(overrides: Partial<WorkItem>): WorkItem {
  return { id: "w1", title: "Travail", kind: "dm", subject: "Mathématiques", estimatedMinutes: 90, dueDate: "2026-10-30", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-10T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

function memory(overrides: { difficulty?: number; reps?: number; archived?: boolean; id?: string } = {}): ChapterMemory {
  const base = createChapter({ subject: "Mathématiques", title: CHAPTER.title, learnedAt: "2026-09-01" }, new Date(2026, 8, 1, 12), overrides.id ?? "m1");
  return { ...base, archived: overrides.archived ?? false, card: { ...base.card, difficulty: overrides.difficulty ?? 5, reps: overrides.reps ?? 5 } };
}

function step(level: ExerciseStep["level"]): ExerciseStep {
  return { id: "a1", at: "2026-09-20T10:00:00.000Z", day: "2026-09-20", result: "échec", help: "sans", helpDeclared: true, hints: null, minutes: 30, plannedMinutes: null, cause: null, lackOfTime: false, source: "app", level };
}

function exercise(level: ExerciseStep["level"], chapterId: string | null = null): Exercise {
  return { key: "e1", label: "Exercice", subject: "Mathématiques", chapterId, origin: "exercice", steps: [step(level)], status: "à-refaire", failedStreak: 1, nextRetryDay: "2026-09-24", verifiedOn: null, changeApproach: null };
}

function ctx(overrides: Partial<CognitiveContext> = {}): CognitiveContext {
  return { workItems: [], chapterMemory: [], exercises: [], now: NOW, ...overrides };
}

const classify = (key: string, context: CognitiveContext = ctx(), workItemId: string | null = null) => classifyCognitiveLoad({ key, workItemId }, context);

describe("classification cognitive — chaque type de tâche est classé et expliqué", () => {
  const cases: Array<[string, string, CognitiveLevel, CognitiveContext?]> = [
    ["échéance DS", "échéance:w1", "elevee", ctx({ workItems: [workItem({ kind: "ds" })] })],
    ["échéance concours", "échéance:w1", "elevee", ctx({ workItems: [workItem({ kind: "concours" })] })],
    ["échéance DM", "échéance:w1", "elevee", ctx({ workItems: [workItem({ kind: "dm" })] })],
    ["échéance colle", "échéance:w1", "moyenne", ctx({ workItems: [workItem({ kind: "colle" })] })],
    ["échéance chapitre", "échéance:w1", "moyenne", ctx({ workItems: [workItem({ kind: "chapitre" })] })],
    ["échéance exercices", "échéance:w1", "moyenne", ctx({ workItems: [workItem({ kind: "exercices" })] })],
    ["échéance autre", "échéance:w1", "moyenne", ctx({ workItems: [workItem({ kind: "autre" })] })],
    ["échéance introuvable", "échéance:inconnu", "moyenne"],
    ["refaire sans aide", "refaire:e1", "moyenne"],
    ["transfert", "transfert:e1", "elevee"],
    ["exercice ciblé", `exercice:${CHAPTER.id}`, "moyenne"],
    ["problème difficile", `exercice:${CHAPTER.id}:difficile`, "elevee"],
    ["exercice chronométré", `exercice:${CHAPTER.id}:temps`, "elevee"],
    ["rappel actif", "rappel:m1", "moyenne", ctx({ chapterMemory: [memory()] })],
    ["rappel de cours", `cours:${CHAPTER.id}`, "moyenne"],
    ["khôlle", `kholle:${CHAPTER.id}`, "moyenne"],
    ["reprise de calculs", `calcul:${CHAPTER.id}`, "moyenne"],
    ["reprise d'erreurs", "erreurs:Physique:calcul", "moyenne"],
    ["fiches espacées", "cartes:Mathématiques", "legere"],
    ["Anki dues", "anki:dues", "legere"],
    ["Anki d'un chapitre", `anki:${CHAPTER.id}`, "legere"],
    ["bloc libre", "bloc:Physique", "moyenne"],
    ["verrou : relire le cours", "verrou:maths-x:cours", "legere"],
    ["verrou : interrogation", "verrou:maths-x", "moyenne"],
    ["type inconnu", "nouveau-type:x", "moyenne"],
  ];

  it.each(cases)("%s → %s", (_label, key, expected, context) => {
    const load = classify(key, context ?? ctx());
    expect(load.level).toBe(expected);
    expect(load.reasons.length).toBeGreaterThan(0);
    expect(load.explanation.length).toBeGreaterThan(15);
    expect(load.explanation.endsWith(".")).toBe(true);
    expect(COGNITIVE_LABEL[load.level]).toBeTruthy();
  });

  it("un bloc libre et une feuille d'exercices disent que leur contenu est inconnu : aucune fausse précision", () => {
    expect(classify("bloc:Physique").explanation).toMatch(/pas connu|n'est pas connu/);
    expect(classify("échéance:w1", ctx({ workItems: [workItem({ kind: "exercices" })] })).explanation).toMatch(/pas connu/);
    expect(classify("nouveau-type:x").explanation).toMatch(/non reconnu/);
  });

  it("une clé inconnue ne lève jamais et reste au niveau intermédiaire", () => {
    for (const key of ["", ":", "refaire:", "échéance:", "????"]) expect(() => classify(key)).not.toThrow();
  });
});

describe("classification cognitive — ajustements lisibles", () => {
  it("niveau d'exercice : difficile relève, direct abaisse, classique ou inconnu ne changent rien", () => {
    expect(classify("refaire:e1", ctx({ exercises: [exercise("difficile")] })).level).toBe("elevee");
    expect(classify("refaire:e1", ctx({ exercises: [exercise("direct")] })).level).toBe("legere");
    expect(classify("refaire:e1", ctx({ exercises: [exercise("classique")] })).level).toBe("moyenne");
    const unknown = classify("refaire:e1", ctx({ exercises: [exercise(null)] }));
    expect(unknown.level).toBe("moyenne");
    expect(unknown.explanation).toMatch(/non renseigné/);
  });

  it("difficulté du chapitre : un chapitre difficile relève un rappel, un chapitre facile l'abaisse", () => {
    const hard = classify("rappel:m1", ctx({ chapterMemory: [memory({ difficulty: CHAPTER_HARD_DIFFICULTY })] }));
    expect(hard.level).toBe("elevee");
    expect(hard.explanation).toMatch(/difficile pour toi/);
    expect(hard.explanation).toMatch(/estimation, pas une mesure/);
    expect(classify("rappel:m1", ctx({ chapterMemory: [memory({ difficulty: 2 })] })).level).toBe("legere");
    expect(classify("rappel:m1", ctx({ chapterMemory: [memory({ difficulty: 5 })] })).level).toBe("moyenne");
  });

  it("la difficulté d'un chapitre trop peu révisé n'est PAS lue : c'est la valeur initiale du modèle", () => {
    const few = memory({ difficulty: 9, reps: 2 });
    expect(classify("rappel:m1", ctx({ chapterMemory: [few] })).level).toBe("moyenne");
    expect(classify(`cours:${CHAPTER.id}`, ctx({ chapterMemory: [few] })).level).toBe("moyenne");
  });

  it("la difficulté du chapitre s'applique aussi aux tâches désignées par le chapitre du programme", () => {
    const hard = ctx({ chapterMemory: [memory({ difficulty: 8 })] });
    expect(classify(`cours:${CHAPTER.id}`, hard).level).toBe("elevee");
    expect(classify(`kholle:${CHAPTER.id}`, hard).level).toBe("elevee");
    expect(classify(`exercice:${CHAPTER.id}`, hard).level).toBe("elevee");
    expect(classify("refaire:e1", ctx({ chapterMemory: [memory({ difficulty: 8 })], exercises: [exercise("classique", CHAPTER.id)] })).level).toBe("elevee");
  });

  it("un chapitre archivé est ignoré", () => {
    expect(classify(`cours:${CHAPTER.id}`, ctx({ chapterMemory: [memory({ difficulty: 9, archived: true })] })).level).toBe("moyenne");
  });

  it("échéance proche : relève un travail intermédiaire, pas un travail léger ni déjà exigeant", () => {
    const near = (kind: WorkItem["kind"], dueDate: string | null) => classify("échéance:w1", ctx({ workItems: [workItem({ kind, dueDate })] }));
    expect(near("exercices", "2026-09-26").level).toBe("elevee"); // dans 2 jours
    expect(near("exercices", "2026-09-26").explanation).toMatch(/dans 2 jours/);
    expect(near("exercices", "2026-09-25").explanation).toMatch(/demain/);
    expect(near("exercices", "2026-09-24").explanation).toMatch(/aujourd'hui/);
    expect(near("exercices", "2026-09-20").explanation).toMatch(/déjà passée/);
    expect(near("exercices", "2026-09-27").level).toBe("moyenne"); // dans 3 jours : pas encore
    expect(near("exercices", null).level).toBe("moyenne"); // pas de date, pas d'enjeu inventé
    expect(near("dm", "2026-09-25").level).toBe("elevee");
  });

  it("un ajustement sans effet n'est pas cité dans l'explication", () => {
    const load = classify("échéance:w1", ctx({ workItems: [workItem({ kind: "dm", dueDate: "2026-09-24" })] }));
    expect(load.reasons).toHaveLength(1);
  });

  it("le même contexte donne toujours la même réponse", () => {
    const context = ctx({ chapterMemory: [memory({ difficulty: 8 })], exercises: [exercise("difficile", CHAPTER.id)] });
    expect(classify("refaire:e1", context)).toEqual(classify("refaire:e1", context));
  });
});
