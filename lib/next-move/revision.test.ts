import { describe, expect, it } from "vitest";
import { parseAiDebrief } from "@/lib/ai-debrief";
import { createChapter } from "@/lib/chapter-memory";
import { applyDebrief, buildDebrief } from "@/lib/debrief";
import { parseRestitution, recordRestitution } from "@/lib/demonstrations";
import { createGrade } from "@/lib/grades";
import { addEcheances } from "@/lib/mcp-echeances";
import { buildRevisionContext, revisionInputFromState } from "@/lib/revision-context";
import { computeNextMove, rankCandidates, topReasons, type NextMoveInput } from "@/lib/next-move/engine";
import { normalizePreferences, type ChapterMemory, type ErrorEntry, type Grade, type WorkItem } from "@/lib/storage";
import type { ExerciseAttempt } from "@/lib/attempts";

/**
 * Next Move ↔ contexte de révision (lib/revision-context.ts, outil MCP
 * `get_contexte_revision`). Données de TEST « [TEST] », construites avec les
 * fonctions réelles de l'application (addEcheances, parseAiDebrief →
 * buildDebrief, parseRestitution → recordRestitution).
 */
const NOW = new Date(2026, 9, 16, 18, 0);
const TODAY = "2026-10-16";
const DEMO_KEY = "refaire:demo:m1-theoreme-du-rang";

type Echeance = Parameters<typeof addEcheances>[1][number];

function memory(id: string, subject: "Mathématiques" | "Physique", title: string): ChapterMemory {
  return createChapter({ subject, title, learnedAt: "2026-10-01" }, new Date(2026, 9, 1, 12), id);
}

const MEMORIES = [memory("mem-al", "Mathématiques", "Applications linéaires"), memory("mem-red", "Mathématiques", "Réduction des endomorphismes")];

function restitution(attempts: ExerciseAttempt[], day: string, resultat: "incomplète" | "réussie", aide: "sans" | "indices" = "sans"): ExerciseAttempt[] {
  const parsed = parseRestitution(
    JSON.stringify({ demonstration: "m1-theoreme-du-rang", date: day, resultat, aide, ...(resultat === "incomplète" ? { lacunes: [{ type: "hypothèse", detail: "[TEST] dimension finie oubliée", confiance: "certaine" }] } : {}) }),
    TODAY
  );
  if (!parsed.ok) throw new Error(parsed.errors.join("|"));
  return recordRestitution(attempts, parsed.value, NOW);
}

/** Deux DS débriefés avec la même difficulté de COURS sur « Réduction ». */
function reductionDebriefs(): { attempts: ExerciseAttempt[]; errors: ErrorEntry[]; grades: Grade[] } {
  let attempts: ExerciseAttempt[] = [];
  let errors: ErrorEntry[] = [];
  const grades: Grade[] = [];
  const debriefs = [
    ["[TEST] DS 2 — réduction", "2026-09-26", { libelle: "Q3", chapitre: "m2-reduction", resultat: "fausse", cause: "cours", confiance: "certaine", description: "Critère de diagonalisabilité oublié", correction: "dim E_λ = multiplicité" }],
    ["[TEST] DS 3 — réduction", "2026-10-10", { libelle: "Q1", chapitre: "m2-reduction", resultat: "fausse", cause: "cours", confiance: "probable", description: "Sous-espaces propres : somme directe non justifiée" }],
  ] as const;
  for (const [titre, date, question] of debriefs) {
    const parsed = parseAiDebrief(JSON.stringify({ matiere: "maths", titre, date, questions: [question] }), TODAY);
    if (!parsed.ok) throw new Error(parsed.errors.join("|"));
    const grade = createGrade({ ...parsed.value.grade, score: 9 }, NOW)!;
    grades.push(grade);
    ({ attempts, errors } = applyDebrief(grade.id, { attempts, errors }, buildDebrief(grade, parsed.value.questions, NOW)));
  }
  return { attempts, errors, grades };
}

/** Débriefs de « Réduction » ET démonstration fragile, dans les mêmes tentatives. */
function withDebriefsAndDemo() {
  const debriefs = reductionDebriefs();
  return { ...debriefs, attempts: [...debriefs.attempts, ...fragileDemo()] };
}

function items(echeances: Echeance[]): WorkItem[] {
  const added = addEcheances([], echeances, MEMORIES, NOW);
  if (!added.ok) throw new Error(added.error);
  return added.items as WorkItem[];
}

function input(over: Partial<NextMoveInput> = {}): NextMoveInput {
  return {
    sessions: [],
    workItems: [],
    grades: [],
    reviewItems: [],
    errors: [],
    checkins: [],
    chapterMemory: MEMORIES,
    preferences: normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], demoCards: { "m1-theoreme-du-rang": "2026-10-09T10:00:00.000Z" } }),
    history: [],
    now: NOW,
    availableMinutes: 90,
    ...over,
  };
}

const KHOLLE_3J: Echeance = { titre: "[TEST] Khôlle maths", matiere: "maths", type: "colle", date: "2026-10-19", chapitres: ["Applications linéaires"] };
const DS_4J: Echeance = { titre: "[TEST] DS 4 maths", matiere: "maths", type: "DS", date: "2026-10-20", chapitres: ["Réduction des endomorphismes"] };
const fragileDemo = () => restitution(restitution([], "2026-10-08", "incomplète"), "2026-10-13", "incomplète");
const byKey = (ranked: ReturnType<typeof rankCandidates>, key: string) => ranked.find((candidate) => candidate.key === key);

describe("1 · khôlle proche + démonstration plusieurs fois ratée", () => {
  const base = input({ workItems: items([KHOLLE_3J]), attempts: fragileDemo() });
  const ranked = rankCandidates(base);

  it("propose UNE restitution de la démonstration, avec deux raisons lisibles et un lien disponible", () => {
    const demo = byKey(ranked, DEMO_KEY)!;
    expect(demo).toBeDefined();
    expect(demo.action).toBe("restituer sans aide");
    expect(demo.href).toBe("/anki#demonstrations");
    expect(demo.chapterId).toBe("m1-applications-lineaires");
    // Les raisons propres à l'action (hors « bloc » absorbé) : le constat observé, puis l'épreuve — deux phrases, pas un score.
    const own = demo.terms.filter((term) => term.points > 0 && !term.id.startsWith("bloc:"));
    expect(own.map((term) => term.id)).toEqual(["démonstration", "au-programme"]);
    expect(own[0].reason).toMatch(/Restitution incomplète/);
    expect(own[1].reason).toMatch(/khôlle « \[TEST\] Khôlle maths » dans 3\s?j/);
    expect(topReasons(demo)).toHaveLength(2);
    expect(ranked.filter((candidate) => candidate.key === DEMO_KEY)).toHaveLength(1);
  });

  it("ne compte pas deux fois la proximité de la khôlle", () => {
    const demo = byKey(ranked, DEMO_KEY)!;
    expect(demo.terms.filter((term) => term.id === "au-programme")).toHaveLength(1);
    expect(demo.terms.some((term) => term.id === "évaluation-proche")).toBe(false);
  });

  it("figure parmi les premières actions de la session", () => {
    const plan = computeNextMove(base);
    expect(plan.steps.filter((step) => step.type === "move").map((step) => step.candidate!.key)).toContain(DEMO_KEY);
  });
});

describe("2 · DS proche + erreur récurrente", () => {
  const debriefs = reductionDebriefs();
  const base = input({ workItems: items([DS_4J]), ...debriefs });
  const ranked = rankCandidates(base);

  it("une difficulté de cours récurrente devient un rappel de ce chapitre, justifié par les faits du DS", () => {
    const candidate = byKey(ranked, "rappel:mem-red")!;
    expect(candidate.kind).toBe("rappel");
    expect(candidate.terms.map((t) => t.id)).toEqual(expect.arrayContaining(["difficulté-récurrente", "au-programme"]));
    expect(candidate.terms.find((t) => t.id === "difficulté-récurrente")!.reason).toMatch(/2 évaluations ou exercices distincts/);
    expect(candidate.terms.find((t) => t.id === "au-programme")!.reason).toMatch(/DS « \[TEST\] DS 4 maths »/);
    expect(candidate.terms.some((t) => t.id === "évaluation-proche")).toBe(false);
  });

  it("une seule action pour ce fait : le même chapitre n'est pas proposé deux fois comme rappel", () => {
    expect(ranked.filter((c) => c.kind === "rappel" && c.terms.some((t) => t.id === "difficulté-récurrente"))).toHaveLength(1);
    expect(ranked.some((c) => c.key === "cours:m2-reduction")).toBe(false);
  });
});

describe("3 · difficulté corrigée par une réussite autonome", () => {
  it("ne reste pas recommandée par le contexte de révision ni par Next Move", () => {
    const debriefs = reductionDebriefs();
    const success: ExerciseAttempt = { id: "ok-1", exerciseKey: "td:reduction", label: "[TEST] TD réduction", subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day: "2026-10-14", createdAt: "2026-10-14T15:00:00.000Z", updatedAt: "2026-10-14T15:00:00.000Z", result: "réussi", help: "sans", minutes: 25, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null };
    const corrected = input({ workItems: items([DS_4J]), ...debriefs, attempts: [...debriefs.attempts, success] });
    expect(rankCandidates(corrected).some((c) => c.terms.some((t) => t.id === "difficulté-récurrente"))).toBe(false);
    // Même verdict que le contexte de révision.
    const ctx = buildRevisionContext(revisionInputFromState(corrected), { horizonDays: 7 });
    expect(ctx.priorites.filter((p) => p.pourquoi_ce_rang === "difficulté récurrente non corrigée")).toEqual([]);
  });

  it("une démonstration restituée sans aide n'est plus proposée", () => {
    const done = restitution(fragileDemo(), "2026-10-15", "réussie");
    expect(byKey(rankCandidates(input({ workItems: items([KHOLLE_3J]), attempts: done })), DEMO_KEY)).toBeUndefined();
  });
});

describe("4 · programme incomplet ou inconnu", () => {
  it("un DS sans programme : aucune recommandation par chapitre, mais une information sur l'échéance", () => {
    const ranked = rankCandidates(input({ workItems: items([{ titre: "[TEST] DS physique", matiere: "physique", type: "DS", date: "2026-10-20" }]), ...withDebriefsAndDemo() }));
    expect(ranked.some((c) => c.terms.some((t) => t.id === "difficulté-récurrente" || t.id === "démonstration"))).toBe(false);
    const deadline = ranked.find((c) => c.key.startsWith("échéance:"))!;
    expect(deadline.terms.find((t) => t.id === "programme-inconnu")).toMatchObject({ points: 0 });
    expect(deadline.terms.find((t) => t.id === "programme-inconnu")!.reason).toMatch(/inconnu/);
  });

  it("un programme dont le chapitre n'existe pas dans le programme officiel ne désigne aucune démonstration", () => {
    const ranked = rankCandidates(input({ workItems: items([{ titre: "[TEST] Khôlle libre", matiere: "maths", type: "colle", date: "2026-10-19", chapitres: ["Théorie des catégories"] }]), attempts: fragileDemo() }));
    expect(byKey(ranked, DEMO_KEY)).toBeUndefined();
  });

  it("une démonstration inexistante dans la banque n'est jamais proposée (carte, lien ou restitution indisponible)", () => {
    const ghost = restitution([], "2026-10-13", "incomplète").map((a) => ({ ...a, exerciseKey: "demo:n-existe-pas", id: "demo:n-existe-pas:2026-10-13" }));
    const ranked = rankCandidates(input({ workItems: items([KHOLLE_3J]), attempts: ghost }));
    expect(ranked.some((c) => c.key.includes("n-existe-pas"))).toBe(false);
  });
});

describe("5 · échéance absente", () => {
  it("sans échéance, aucune priorité tirée du contexte de révision : pas de proximité inventée", () => {
    const ranked = rankCandidates(input({ ...withDebriefsAndDemo() }));
    expect(ranked.some((c) => c.terms.some((t) => t.id === "difficulté-récurrente"))).toBe(false);
    expect(ranked.some((c) => c.terms.some((t) => t.id === "au-programme" && /khôlle|DS/.test(t.reason)))).toBe(false);
  });

  it("une épreuve hors de la fenêtre de 7 jours n'ajoute rien", () => {
    const far = { ...KHOLLE_3J, date: "2026-11-20" };
    expect(byKey(rankCandidates(input({ workItems: items([far]), attempts: fragileDemo() })), DEMO_KEY)).toBeUndefined();
  });
});

describe("6 · action déjà dans le plan", () => {
  it("la restitution d'une démonstration n'existe qu'une fois, même quand le moteur la proposait déjà", () => {
    const ranked = rankCandidates(input({ workItems: items([KHOLLE_3J, { ...KHOLLE_3J, titre: "[TEST] Autre khôlle maths", date: "2026-10-21" }]), attempts: fragileDemo() }));
    expect(ranked.filter((c) => c.key === DEMO_KEY)).toHaveLength(1);
    expect(ranked.filter((c) => c.terms.some((t) => t.id === "démonstration" || t.id === "à-refaire") && c.key === DEMO_KEY)).toHaveLength(1);
  });

  it("une restitution déjà faite ce matin (historique de Next Move) est pénalisée une fois, pas redoublée", () => {
    const record = { id: "h1", key: DEMO_KEY, kind: "refaire" as const, subject: "Mathématiques" as const, title: "Théorème du rang", minutes: 20, reasons: [], proposedAt: new Date(2026, 9, 16, 9, 0).toISOString(), status: "fait" as const, startedAt: new Date(2026, 9, 16, 9, 5).toISOString(), resolvedAt: new Date(2026, 9, 16, 9, 30).toISOString(), outcomeMinutes: 20 };
    const ranked = rankCandidates(input({ workItems: items([KHOLLE_3J]), attempts: fragileDemo(), history: [record] }));
    const demo = ranked.filter((c) => c.key === DEMO_KEY);
    expect(demo).toHaveLength(1);
    expect(demo[0].terms.filter((t) => t.id === "déjà-fait")).toHaveLength(1);
  });

  it("une démonstration jamais travaillée n'est pas proposée à l'aveugle (le contexte propose d'abord sa carte)", () => {
    const ranked = rankCandidates(input({ workItems: items([KHOLLE_3J]), attempts: [] }));
    expect(byKey(ranked, DEMO_KEY)).toBeUndefined();
  });
});

describe("7 · capacité insuffisante", () => {
  const base = { workItems: items([KHOLLE_3J]), attempts: fragileDemo() };

  it("avec 5 minutes, la restitution (10 min minimum) n'entre pas dans la session", () => {
    const plan = computeNextMove(input({ ...base, availableMinutes: 5 }));
    expect(plan.steps.some((step) => step.candidate?.key === DEMO_KEY)).toBe(false);
    expect(plan.steps.reduce((total, step) => total + step.minutes, 0)).toBeLessThanOrEqual(5);
  });

  it("avec 15 minutes, elle tient dans le temps réel disponible", () => {
    const plan = computeNextMove(input({ ...base, availableMinutes: 15 }));
    const step = plan.steps.find((s) => s.candidate?.key === DEMO_KEY);
    if (step) expect(step.minutes).toBeLessThanOrEqual(15);
    expect(plan.totalMinutes).toBeLessThanOrEqual(15);
  });
});

describe("8 · cohérence Next Move ↔ get_contexte_revision", () => {
  it("Next Move reprend les faits du contexte, avec la même cible, sans priorité supplémentaire", () => {
    const debriefs = reductionDebriefs();
    const attempts = [...debriefs.attempts, ...fragileDemo()];
    const state = input({ workItems: items([KHOLLE_3J, DS_4J]), ...debriefs, attempts });
    const ctx = buildRevisionContext(revisionInputFromState(state), { horizonDays: 7 });
    const ranked = rankCandidates(state);

    // Toute démonstration à restituer du contexte est une action de Next Move, vers la même démonstration.
    // Divergence VOULUE : une démonstration « non travaillée » n'a aucune observation, le contexte propose d'abord sa carte (action que Next Move ne crée pas) — pas de restitution à l'aveugle.
    const stateOf = new Map(ctx.echeances.flatMap((e) => e.chapitres.flatMap((c) => c.demonstrations.map((d) => [d.id, d.etat] as const))));
    const demos = ctx.priorites.filter((p) => p.action === "restituer-demonstration" && p.demonstration);
    const observed = demos.filter((p) => stateOf.get(p.demonstration!) !== "Non travaillée");
    expect(observed.length).toBeGreaterThan(0);
    for (const priority of observed) expect(byKey(ranked, `refaire:demo:${priority.demonstration}`)).toBeDefined();
    for (const priority of demos.filter((p) => stateOf.get(p.demonstration!) === "Non travaillée")) expect(byKey(ranked, `refaire:demo:${priority.demonstration}`)).toBeUndefined();

    // Toute difficulté récurrente du contexte (action de cours ou d'exercice) a une action au chapitre correspondant.
    const recurring = ctx.priorites.filter((p) => p.pourquoi_ce_rang === "difficulté récurrente non corrigée" && (p.action === "rappel-actif" || p.action === "refaire-exercice"));
    expect(recurring.length).toBeGreaterThan(0);
    for (const priority of recurring) {
      const wanted = priority.action === "rappel-actif" ? "rappel" : "refaire";
      expect(ranked.some((c) => c.kind === wanted && c.terms.some((t) => t.id === "difficulté-récurrente")), priority.quoi).toBe(true);
    }

    // Et réciproquement : Next Move n'invente aucune démonstration ni difficulté absente du contexte.
    const contextDemos = new Set(ctx.priorites.map((p) => p.demonstration).filter(Boolean));
    for (const candidate of ranked.filter((c) => c.key.startsWith("refaire:demo:") && c.terms.some((t) => t.id === "au-programme"))) {
      expect(contextDemos.has(candidate.key.slice("refaire:demo:".length))).toBe(true);
    }
  });
});

