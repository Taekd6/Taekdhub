import { describe, expect, it } from "vitest";
import { normalizeAnkiSnapshot } from "@/lib/anki-snapshot";
import { parseAiDebrief } from "@/lib/ai-debrief";
import { createChapter } from "@/lib/chapter-memory";
import { applyDebrief, buildDebrief } from "@/lib/debrief";
import { parseRestitution, recordRestitution } from "@/lib/demonstrations";
import { createGrade } from "@/lib/grades";
import { addEcheances } from "@/lib/mcp-echeances";
import { buildRevisionContext, revisionInputFrom } from "@/lib/revision-context";
import type { ExerciseAttempt } from "@/lib/attempts";
import type { ErrorEntry, Grade } from "@/lib/storage";

/**
 * Données de TEST, identifiables : tous les titres commencent par « [TEST] »
 * et tout est construit avec les fonctions que l'application utilise vraiment
 * (addEcheances = l'écriture MCP des échéances ; parseAiDebrief → buildDebrief
 * = le débrief IA validé ; parseRestitution → recordRestitution = la
 * restitution d'une démonstration). Rien ne vient de l'élève réel.
 */
const NOW = new Date(2026, 9, 16, 18, 0);
const TODAY = "2026-10-16";
const MEM = { al: "mem-al", red: "mem-red", libre: "mem-libre" };

function memory(id: string, subject: "Mathématiques" | "Physique", title: string) {
  return createChapter({ subject, title, learnedAt: "2026-10-01" }, new Date(2026, 9, 1, 12), id);
}

interface Scenario {
  workItems: unknown;
  chapterMemory: ReturnType<typeof memory>[];
  grades: Grade[];
  attempts: ExerciseAttempt[];
  errors: ErrorEntry[];
  preferences: Record<string, unknown>;
  ankiSnapshots: unknown[];
}

function scenario(over: Partial<Scenario> = {}): Scenario {
  const chapterMemory = [memory(MEM.al, "Mathématiques", "Applications linéaires"), memory(MEM.red, "Mathématiques", "Réduction des endomorphismes"), memory(MEM.libre, "Mathématiques", "Mon chapitre perso sans équivalent")];
  const added = addEcheances(
    [],
    [
      { titre: "[TEST] Khôlle maths vendredi", matiere: "maths", type: "colle", date: "2026-10-23", chapitres: ["Applications linéaires"] },
      { titre: "[TEST] DS 4 maths", matiere: "maths", type: "DS", date: "2026-10-31", chapitres: ["Réduction des endomorphismes"] },
      { titre: "[TEST] DS physique", matiere: "physique", type: "DS", date: "2026-10-28" },
      { titre: "[TEST] Khôlle info (chapitre hors Mémoire)", matiere: "info", type: "colle", date: "2026-10-22", chapitres: ["Théorie des catégories"] },
      { titre: "[TEST] DM maths", matiere: "maths", type: "DM", date: "2026-10-20", chapitres: ["Réduction des endomorphismes"] },
    ],
    chapterMemory,
    NOW
  );
  if (!added.ok) throw new Error(added.error);

  // Deux DS débriefés où la même difficulté de cours apparaît sur « Réduction ».
  const debriefs = [
    ["[TEST] DS 2 — réduction", "2026-09-26", [{ libelle: "Q3", chapitre: "m2-reduction", resultat: "fausse", cause: "cours", confiance: "certaine", description: "Critère de diagonalisabilité oublié", correction: "dim E_λ = multiplicité" }]],
    ["[TEST] DS 3 — réduction", "2026-10-10", [{ libelle: "Q1", chapitre: "m2-reduction", resultat: "fausse", cause: "cours", confiance: "probable", description: "Sous-espaces propres : somme directe non justifiée" }]],
  ] as const;
  let attempts: ExerciseAttempt[] = [];
  let errors: ErrorEntry[] = [];
  const grades: Grade[] = [];
  for (const [titre, date, questions] of debriefs) {
    const parsed = parseAiDebrief(JSON.stringify({ matiere: "maths", titre, date, questions }), TODAY);
    if (!parsed.ok) throw new Error(parsed.errors.join("|"));
    const grade = createGrade({ ...parsed.value.grade, score: 9 }, NOW)!;
    grades.push(grade);
    ({ attempts, errors } = applyDebrief(grade.id, { attempts, errors }, buildDebrief(grade, parsed.value.questions, NOW)));
  }
  // Deux restitutions incomplètes du théorème du rang (même lacune), carte connue de TaekdHub.
  for (const day of ["2026-10-08", "2026-10-13"]) {
    const restitution = parseRestitution(JSON.stringify({ demonstration: "m1-theoreme-du-rang", date: day, resultat: "incomplète", aide: "sans", lacunes: [{ type: "hypothèse", detail: "[TEST] dimension finie oubliée", confiance: "certaine" }] }), TODAY);
    if (!restitution.ok) throw new Error(restitution.errors.join("|"));
    attempts = recordRestitution(attempts, restitution.value, NOW);
  }
  return {
    workItems: added.items,
    chapterMemory,
    grades,
    attempts,
    errors,
    preferences: { demoCards: { "m1-theoreme-du-rang": "2026-10-09T10:00:00.000Z" }, colleChapters: ["m1-prehilbertiens"], ankiDeckChapters: {} },
    ankiSnapshots: [
      normalizeAnkiSnapshot({
        day: "2026-10-15", takenAt: new Date(2026, 9, 15, 9, 0).toISOString(), source: "ankiconnect",
        decks: [
          { name: "TaekdHub::Mathématiques::Applications linéaires", total: 12, due: 4, reviewed30: 40, failed30: 3, mature: 5, lapsing: 0 },
          { name: "TaekdHub::Mathématiques::Réduction des endomorphismes", total: 20, due: 0, reviewed30: 30, failed30: 6, mature: 8, lapsing: 1 },
        ],
      })!,
    ],
    ...over,
  };
}

function context(sc: Scenario, filter = {}) {
  const raw = { workItems: sc.workItems, chapterMemory: sc.chapterMemory, grades: sc.grades, attempts: sc.attempts, errors: sc.errors, preferences: sc.preferences, ankiSnapshots: sc.ankiSnapshots };
  return buildRevisionContext(revisionInputFrom(JSON.parse(JSON.stringify(raw)), [], NOW), filter);
}
const titles = (ctx: ReturnType<typeof context>) => ctx.echeances.map((e) => e.echeance.titre);

describe("la prochaine khôlle et son programme", () => {
  const ctx = context(scenario(), { type: "colle", subject: "Mathématiques" });
  it("retrouve la prochaine khôlle de la matière, avec son programme rattaché au programme officiel", () => {
    expect(titles(ctx)).toEqual(["[TEST] Khôlle maths vendredi"]);
    const [exam] = ctx.echeances;
    expect(exam.echeance).toMatchObject({ type: "khôlle", date: "2026-10-23", dans_jours: 7, matiere: "Mathématiques" });
    expect(exam.programme.connu).toBe(true);
    expect(exam.chapitres.map((c) => c.chapitre)).toEqual([{ id: "m1-applications-lineaires", titre: "Applications linéaires" }]);
  });

  it("rattache la bonne démonstration — par le chapitre du programme, pas par la matière", () => {
    const demos = ctx.echeances[0].chapitres[0].demonstrations.map((d) => d.id);
    expect(demos).toEqual(["m1-theoreme-du-rang"]);
    const everything = JSON.stringify(ctx);
    expect(everything).not.toContain("m1-cauchy-schwarz"); // même matière, autre chapitre : jamais rattachée
    expect(everything).not.toContain("m2-lemme-abel");
  });

  it("une restitution ratée deux fois passe en tête, avec ses faits et sa vérification", () => {
    const first = ctx.priorites[0];
    expect(first).toMatchObject({ action: "creer-carte-ciblee", demonstration: "m1-theoreme-du-rang", chapitre: "Applications linéaires" });
    expect(first.pourquoi_ce_rang).toMatch(/restitution observée ratée/);
    expect(first.pourquoi.join(" ")).toMatch(/khôlle « \[TEST\] Khôlle maths vendredi » le 2026-10-23 \(dans 7 j\)/);
    expect(first.pourquoi.join(" ")).toMatch(/Restitution incomplète/);
    expect(first.validation).toMatch(/validée par l'élève/);
    expect(ctx.priorites.map((p) => p.action)).toContain("restituer-demonstration");
  });

  it("n'invente aucune carte Anki : sans paquet relevé pour le chapitre, rien n'est dit sur ses cartes, avec les chiffres quand ils existent", () => {
    const anki = ctx.echeances[0].chapitres[0].anki!;
    expect(anki).toMatchObject({ cartes_dues: 4, ratees_30j: 3, releve_le: "2026-10-15", releve_ancien: false });
    expect(anki.attention).toMatch(/pas des restitutions/);
    expect(ctx.echeances[0].chapitres[0].demonstrations[0].carte_anki.dans_anki).toMatch(/^oui, d'après TaekdHub/);
  });
});

describe("les DS à venir", () => {
  it("liste les DS dans l'ordre des dates, filtrés par type, matière ou échéance", () => {
    const sc = scenario();
    expect(titles(context(sc, { type: "DS" }))).toEqual(["[TEST] DS physique", "[TEST] DS 4 maths"]);
    expect(titles(context(sc, { type: "DS", subject: "Mathématiques" }))).toEqual(["[TEST] DS 4 maths"]);
    expect(titles(context(sc))).toEqual(["[TEST] Khôlle info (chapitre hors Mémoire)", "[TEST] Khôlle maths vendredi", "[TEST] DS physique", "[TEST] DS 4 maths"]);
    const id = context(sc, { type: "DS", subject: "Mathématiques" }).echeances[0].echeance.id;
    expect(titles(context(sc, { examId: id }))).toEqual(["[TEST] DS 4 maths"]);
  });

  it("un DM n'est ni une khôlle ni un DS : il n'apparaît pas", () => {
    expect(JSON.stringify(context(scenario()))).not.toContain("[TEST] DM maths");
  });

  it("la fenêtre en jours limite les épreuves", () => {
    expect(titles(context(scenario(), { horizonDays: 7 }))).toEqual(["[TEST] Khôlle info (chapitre hors Mémoire)", "[TEST] Khôlle maths vendredi"]); // le 23 est à 7 jours : inclus
    expect(titles(context(scenario(), { horizonDays: 6 }))).toEqual(["[TEST] Khôlle info (chapitre hors Mémoire)"]);
    expect(titles(context(scenario(), { horizonDays: 0 }))).toEqual([]);
  });

  it("recommandations du DS de maths fondées sur les débriefs : difficulté de cours récurrente, non corrigée, avec les faits datés", () => {
    const [exam] = context(scenario(), { type: "DS", subject: "Mathématiques" }).echeances;
    const chapter = exam.chapitres.find((c) => c.chapitre.id === "m2-reduction")!;
    expect(chapter.difficulte).toMatchObject({ niveau: "récurrente", donnees_suffisantes: true });
    expect(chapter.difficulte!.observations.join(" ")).toMatch(/2026-10-10 · \[TEST\] DS 3 — réduction/);
    expect(chapter.erreurs_ouvertes_evaluations_precedentes.map((e) => e.evaluation)).toEqual(expect.arrayContaining(["[TEST] DS 3 — réduction", "[TEST] DS 2 — réduction"]));
    const first = exam.recommandations[0];
    // Cause « cours » + un paquet Anki relevé pour le chapitre : on revoit les cartes existantes.
    expect(first).toMatchObject({ chapitre: "Réduction des endomorphismes", action: "revoir-carte-anki", pourquoi_ce_rang: "difficulté récurrente non corrigée" });
    expect(first.pourquoi.join(" ")).toMatch(/2 évaluations ou exercices distincts/);
    expect(first.supports).toEqual(["cours", "anki"]);
    expect(first.verification).toMatch(/Les révisions d'Anki ne comptent pas/);
  });

  it("même difficulté de cours SANS paquet Anki relevé : rappel actif du cours, jamais « revoir une carte » qu'on ne sait pas exister", () => {
    const [exam] = context(scenario({ ankiSnapshots: [] }), { type: "DS", subject: "Mathématiques" }).echeances;
    expect(exam.recommandations[0]).toMatchObject({ action: "rappel-actif", chapitre: "Réduction des endomorphismes" });
  });

  it("une difficulté déjà corrigée par une réussite autonome n'est plus recommandée comme active", () => {
    const sc = scenario();
    const success: ExerciseAttempt = { id: "ok-1", exerciseKey: "td:reduction", label: "[TEST] TD réduction", subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day: "2026-10-14", createdAt: "2026-10-14T15:00:00.000Z", updatedAt: "2026-10-14T15:00:00.000Z", result: "réussi", help: "sans", minutes: 25, plannedMinutes: null, cause: null, lackOfTime: false, gradeId: null, note: null };
    const [exam] = context({ ...sc, attempts: [...sc.attempts, success] }, { type: "DS", subject: "Mathématiques" }).echeances;
    const chapter = exam.chapitres.find((c) => c.chapitre.id === "m2-reduction")!;
    expect(chapter.difficulte).toBeNull();
    expect(chapter.deja_corrigee?.preuve).toMatch(/réussi sans aide le 2026-10-14/);
    expect(exam.recommandations.filter((r) => r.pourquoi_ce_rang === "difficulté récurrente non corrigée")).toEqual([]);
  });
});

describe("informations absentes : on le dit, on n'invente pas", () => {
  it("un DS sans programme : « programme inconnu », aucune recommandation de chapitre, rien déduit de la matière", () => {
    const [exam] = context(scenario(), { type: "DS", subject: "Physique" }).echeances;
    expect(exam.programme).toMatchObject({ connu: false });
    expect(exam.chapitres).toEqual([]);
    expect(exam.recommandations).toEqual([]);
    const ctx = context(scenario(), { type: "DS", subject: "Physique" });
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Programme de « \[TEST\] DS physique » inconnu/);
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Rien n'est déduit de la matière seule/);
    expect(ctx.priorites).toEqual([]);
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Il manque des données, pas une priorité à inventer/);
  });

  it("un programme sans rattachement mais des erreurs dans la matière : elles sont montrées comme contexte hors programme, sans plan", () => {
    const sc = scenario();
    const withoutScope = addEcheances(sc.workItems, [{ titre: "[TEST] DS maths sans programme", matiere: "maths", type: "DS", date: "2026-10-27" }], sc.chapterMemory, NOW);
    if (!withoutScope.ok) throw new Error(withoutScope.error);
    const ctx = context({ ...sc, workItems: withoutScope.items }, { examId: withoutScope.value.added[0].id });
    const [exam] = ctx.echeances;
    expect(exam.recommandations).toEqual([]);
    expect(exam.erreurs_de_la_matiere_hors_programme?.portee).toMatch(/programme de cette épreuve est inconnu/);
    expect(exam.erreurs_de_la_matiere_hors_programme?.erreurs.length).toBeGreaterThan(0);
  });

  it("des chapitres saisis mais absents de Mémoire sont signalés tels quels, jamais devinés", () => {
    const ctx = context(scenario(), { type: "colle", subject: "Informatique TC" });
    const [exam] = ctx.echeances;
    expect(exam.programme).toMatchObject({ connu: false, non_rattaches_texte: "Théorie des catégories" });
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Chapitres notés en texte libre mais non rattachés.*Théorie des catégories/);
  });

  it("un chapitre de Mémoire sans équivalent certain dans le programme est gardé sous son nom, sans démonstration ni difficulté inventées", () => {
    const sc = scenario();
    const added = addEcheances(sc.workItems, [{ titre: "[TEST] Khôlle chapitre perso", matiere: "maths", type: "colle", date: "2026-10-21", chapitres: ["Mon chapitre perso sans équivalent"] }], sc.chapterMemory, NOW);
    if (!added.ok) throw new Error(added.error);
    const ctx = context({ ...sc, workItems: added.items }, { examId: added.value.added[0].id });
    const [chapter] = ctx.echeances[0].chapitres;
    expect(chapter.chapitre).toEqual({ id: null, titre: "Mon chapitre perso sans équivalent" });
    expect(chapter.demonstrations).toEqual([]);
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/ne correspond à aucun chapitre certain du programme/);
  });

  it("aucune épreuve dans la fenêtre : message explicite", () => {
    const ctx = context(scenario({ workItems: [] }));
    expect(ctx.echeances).toEqual([]);
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Aucune épreuve .* datée dans les 21 prochains jours/);
  });

  it("sans aucun relevé Anki : l'état d'Anki est déclaré inconnu, et aucune carte n'est dite due", () => {
    const ctx = context(scenario({ ankiSnapshots: [] }), { type: "colle", subject: "Mathématiques" });
    expect(ctx.anki).toMatch(/Aucun relevé Anki enregistré/);
    expect(ctx.echeances[0].chapitres[0].anki).toBeNull();
    expect(ctx.priorites.some((p) => /carte.* due/.test(p.quoi))).toBe(false);
  });

  it("données anciennes ou partielles : collections absentes ou abîmées, pas d'exception", () => {
    const ctx = buildRevisionContext(revisionInputFrom({ workItems: "n'importe quoi", chapterMemory: [null, 3], preferences: { x: 1 } }, null, NOW));
    expect(ctx.echeances).toEqual([]);
    expect(ctx.programme_colle_de_la_semaine).toBeNull();
    expect(ctx.anki).toMatch(/Aucun relevé/);
  });
});

describe("Anki n'est pas la restitution", () => {
  it("des révisions Anki nombreuses ne changent ni l'état ni les actions d'une démonstration", () => {
    const sc = scenario();
    const heavy = [normalizeAnkiSnapshot({ day: "2026-10-15", takenAt: new Date(2026, 9, 15, 9, 0).toISOString(), source: "ankiconnect", decks: [{ name: "TaekdHub::Mathématiques::Applications linéaires", total: 12, due: 0, reviewed30: 400, failed30: 0, mature: 12, lapsing: 0 }] })!];
    const stateOf = (c: ReturnType<typeof context>) => c.echeances[0].chapitres[0].demonstrations[0];
    const base = stateOf(context(sc, { type: "colle", subject: "Mathématiques" }));
    const withReviews = stateOf(context({ ...sc, ankiSnapshots: heavy }, { type: "colle", subject: "Mathématiques" }));
    expect(withReviews.etat).toBe(base.etat);
    expect(withReviews.actions).toEqual(base.actions);
    expect(withReviews.restitutions_enregistrees).toBe(2);
  });

  it("une réussite autonome ultérieure est ce qui retire la démonstration des priorités", () => {
    const sc = scenario();
    const ok = parseRestitution(JSON.stringify({ demonstration: "m1-theoreme-du-rang", date: "2026-10-15", resultat: "réussie", aide: "sans" }), TODAY);
    if (!ok.ok) throw new Error("invalide");
    const attempts = recordRestitution(sc.attempts, ok.value, NOW);
    const ctx = context({ ...sc, attempts }, { type: "colle", subject: "Mathématiques" });
    expect(ctx.echeances[0].chapitres[0].demonstrations[0].etat).toBe("Réussite autonome");
    expect(ctx.priorites.filter((p) => p.demonstration === "m1-theoreme-du-rang")).toEqual([]);
  });
});

describe("priorités : le temps disponible, le programme de colle sans date, la lecture seule", () => {
  it("avec un temps limité, seules les actions qui tiennent sont marquées ; durées déclarées estimées", () => {
    const ctx = context(scenario(), { minutes: 25 });
    expect(ctx.temps_disponible_min).toBe(25);
    expect(ctx.remarque_temps).toMatch(/estimées grossièrement/);
    const fitting = ctx.priorites.filter((p) => p.tient_dans_le_temps);
    expect(fitting.reduce((sum, p) => sum + p.minutes_estimees, 0)).toBeLessThanOrEqual(25);
    expect(ctx.temps_utilise_min).toBeLessThanOrEqual(25);
    expect(ctx.priorites.some((p) => p.tient_dans_le_temps === false)).toBe(true);
  });

  it("une même action n'est pas listée deux fois, et le rang précède l'échéance", () => {
    const ctx = context(scenario());
    const keys = ctx.priorites.map((p) => `${p.action}|${p.chapitre}|${p.demonstration ?? p.quoi}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ctx.priorites.length).toBeLessThanOrEqual(8);
  });

  it("le programme de colle de la semaine reste séparé, sans date, avec son avertissement ; filtré par matière", () => {
    const sc = scenario();
    const ctx = context(sc);
    expect(ctx.programme_colle_de_la_semaine?.chapitres).toEqual([{ id: "m1-prehilbertiens", titre: "Espaces préhilbertiens réels", matiere: "Mathématiques" }]);
    expect(ctx.programme_colle_de_la_semaine?.attention).toMatch(/SANS date/);
    // Il n'est rattaché à aucune khôlle : aucune démonstration de ce chapitre dans les épreuves.
    expect(JSON.stringify(ctx.echeances)).not.toContain("m1-cauchy-schwarz");
    expect(context(sc, { subject: "Physique" }).programme_colle_de_la_semaine).toBeNull();
  });

  it("le filtre par chapitre ne garde que ce chapitre", () => {
    const ctx = context(scenario(), { chapterId: "m2-reduction" });
    expect(ctx.echeances.every((e) => e.chapitres.every((c) => c.chapitre.id === "m2-reduction"))).toBe(true);
  });

  it("lecture seule : les entrées ne sont jamais modifiées", () => {
    const sc = scenario();
    const raw = JSON.parse(JSON.stringify({ workItems: sc.workItems, chapterMemory: sc.chapterMemory, grades: sc.grades, attempts: sc.attempts, errors: sc.errors, preferences: sc.preferences, ankiSnapshots: sc.ankiSnapshots }));
    const input = revisionInputFrom(raw, [], NOW);
    const frozen = JSON.stringify(input);
    const deepFreeze = (value: unknown): void => {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const entry of value instanceof Map ? [...value.values()] : Object.values(value as object)) deepFreeze(entry);
      }
    };
    deepFreeze(input);
    expect(() => buildRevisionContext(input, { minutes: 30 })).not.toThrow();
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
