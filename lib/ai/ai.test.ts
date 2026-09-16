import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAIContext, buildExerciseContext, buildLearnerContext, clip, clipStudentText, contextWeight, MAX_CONTEXT_CHARS, MAX_STATEMENT_CHARS } from "@/lib/ai/context";
import { HINT_RESPONSE_JSON_SCHEMA, MAX_FIELD_LENGTH, parseHintPayload, parseHintResponse } from "@/lib/ai/schema";
import { guardHintRequest } from "@/lib/ai/guard";
import { allLevels, isContiguousLadder, nextHintLevel, totalHintsUsed } from "@/lib/ai/ladder";
import { renderHintPrompt, HINT_SYSTEM_PROMPT } from "@/lib/ai/service";
import { unconfiguredProvider } from "@/lib/ai/provider";
import { probeAIAvailability, readFailure, requestHint } from "@/lib/ai/client";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";
import type { AIContext, AIHintResponse, HintLevel } from "@/lib/ai/types";

/* ── Gréement ──────────────────────────────────────────────────── */

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    subject: "Mathématiques",
    title: "Suite récurrente",
    statement: "Soit $u_{n+1} = \\frac{u_n}{2} + 1$. Étudier la convergence.",
    chapter_id: "ch-1",
    source: "TD8",
    year: null,
    competition: null,
    programme_level: null,
    license_status: null,
    external_id: null,
    epreuve: null,
    filieres: [],
    exercise_number: null,
    provenance: "personnel",
    source_url: null,
    prerequisites: ["suites récurrentes", "point fixe"],
    pedagogical_goal: "transfert : reconnaître une suite arithmético-géométrique",
    level: 3,
    type: "exercice",
    difficulty: 3,
    mastery: 40,
    status: "en cours",
    estimated_minutes: null,
    attempts: 2,
    note: null,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
    tags: [],
    favorite: false,
    archived: false,
    hints: ["Cherche le point fixe.", "Pose $v_n = u_n - \\ell$."],
    correction: "Le point fixe vaut 2, puis $v_n$ est géométrique de raison 1/2.",
    last_worked_at: null,
    ...overrides,
  } as Exercise;
}

const chapters: Chapter[] = [{ id: "ch-1", subject: "Mathématiques", label: "Suites numériques" }];

function session(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Mathématiques",
    exercise_id: "ex-1",
    started_at: "2026-09-10T10:00:00.000Z",
    ended_at: "2026-09-10T10:30:00.000Z",
    duration_seconds: 1800,
    note: null,
    created_at: "2026-09-10T10:30:00.000Z",
    result: null,
    hints_used: null,
    work_item_id: null,
    ...overrides,
  } as WorkSession;
}

function validHint(level: HintLevel = 1): AIHintResponse {
  return {
    level,
    question: "Qu'est-ce qu'on te demande exactement ?",
    hint: "Commence par écrire ce que « converger » signifie ici.",
    usedSource: "énoncé",
    confidence: "élevée",
    insufficientData: false,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ══════════════════════════════════════════════════════════════════
   LE CONTEXTE — ce qui part, et surtout ce qui ne part pas
   ══════════════════════════════════════════════════════════════════ */

describe("contexte IA — minimal et ciblé, jamais tout le stockage", () => {
  it("ne transporte QUE les champs prévus, et aucun autre", () => {
    const context = buildAIContext(exercise(), [exercise()], [session()], chapters);
    expect(Object.keys(context).sort()).toEqual(["exercise", "learner"]);
    expect(Object.keys(context.exercise).sort()).toEqual(
      ["chapter", "correction", "difficulty", "hints", "level", "pedagogicalGoal", "prerequisites", "statement", "subject", "title"]
    );
    expect(Object.keys(context.learner).sort()).toEqual(
      ["attemptsOnExercise", "chapterMastery", "classe", "exerciseMastery", "minutesOnExercise", "previousResults"]
    );
  });

  it("n'emporte ni identifiant d'exercice, ni identifiant de chapitre, ni note personnelle", () => {
    const serialized = JSON.stringify(buildAIContext(exercise({ note: "mon code wifi" }), [], [], chapters));
    expect(serialized).not.toContain("ex-1");
    expect(serialized).not.toContain("ch-1");
    expect(serialized).not.toContain("wifi");
  });

  it("transmet le LIBELLÉ du chapitre, pas son identifiant", () => {
    expect(buildExerciseContext(exercise(), chapters).chapter).toBe("Suites numériques");
  });

  it("n'emporte AUCUNE séance brute — seulement des agrégats", () => {
    const sessions = [session({ note: "séance du mardi", result: "réussi" }), session({ result: "échoué" })];
    const serialized = JSON.stringify(buildAIContext(exercise(), [], sessions, chapters));
    expect(serialized).not.toContain("séance du mardi");
    expect(serialized).not.toContain("started_at");
  });

  it("un corrigé absent vaut `null`, jamais une chaîne vide", () => {
    expect(buildExerciseContext(exercise({ correction: null }), chapters).correction).toBeNull();
    expect(buildExerciseContext(exercise({ correction: "   " }), chapters).correction).toBeNull();
  });

  it("tronque un énoncé démesuré, et le SIGNALE au lieu de couper en silence", () => {
    const enorme = "x".repeat(MAX_STATEMENT_CHARS * 3);
    const built = buildExerciseContext(exercise({ statement: enorme }), chapters);
    expect(built.statement.length).toBeLessThan(enorme.length);
    expect(built.statement).toContain("tronqué");
  });

  it("aucune tentative notée → `null`, et surtout pas trois zéros", () => {
    expect(buildLearnerContext(exercise(), [session({ result: null })], []).previousResults).toBeNull();
  });

  it("des tentatives notées sont comptées telles quelles", () => {
    const sessions = [session({ result: "réussi" }), session({ result: "échoué" }), session({ result: null })];
    expect(buildLearnerContext(exercise(), sessions, []).previousResults).toEqual({ succeeded: 1, partial: 0, failed: 1 });
  });

  it("la maîtrise du chapitre est `null` quand la fiche n'a pas de chapitre", () => {
    expect(buildLearnerContext(exercise({ chapter_id: null }), [], []).chapterMastery).toBeNull();
  });

  it("le poids d'un contexte normal reste très en dessous du plafond", () => {
    expect(contextWeight(buildAIContext(exercise(), [exercise()], [session()], chapters))).toBeLessThan(MAX_CONTEXT_CHARS / 2);
  });

  it("une saisie vide de l'élève ne devient pas une chaîne vide envoyée pour rien", () => {
    expect(clipStudentText("   ")).toBeUndefined();
    expect(clipStudentText(undefined)).toBeUndefined();
    expect(clipStudentText("je bloque")).toBe("je bloque");
  });

  it("`clip` ne touche pas ce qui tient déjà", () => {
    expect(clip("court", 100)).toBe("court");
  });
});

/* ══════════════════════════════════════════════════════════════════
   L'ÉCHELLE — un palier est un plafond
   ══════════════════════════════════════════════════════════════════ */

describe("échelle d'indices", () => {
  it("part du palier 1 et progresse d'un cran", () => {
    expect(nextHintLevel(0)).toBe(1);
    expect(nextHintLevel(1)).toBe(2);
    expect(nextHintLevel(5)).toBe(6);
  });

  it("s'arrête à 6 — elle ne boucle pas", () => {
    expect(nextHintLevel(6)).toBeNull();
    expect(nextHintLevel(99)).toBeNull();
  });

  it("résiste à une valeur absurde plutôt que de produire un palier invalide", () => {
    expect(nextHintLevel(Number.NaN)).toBe(1);
    expect(nextHintLevel(-3)).toBe(1);
  });

  it("les six paliers sont bien 1 à 6", () => {
    expect(allLevels()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("détecte un palier sauté", () => {
    expect(isContiguousLadder([{ level: 1 }, { level: 2 }])).toBe(true);
    expect(isContiguousLadder([{ level: 1 }, { level: 4 }])).toBe(false);
  });

  it("une aide IA compte comme une aide dans `hints_used`", () => {
    // Le cœur du sujet : ne pas les compter ferait passer pour autonome un
    // élève ayant gravi cinq paliers.
    expect(totalHintsUsed(0, 5)).toBe(5);
    expect(totalHintsUsed(2, 3)).toBe(5);
    expect(totalHintsUsed(0, 0)).toBe(0);
  });

  it("ne produit jamais un total négatif ou non entier", () => {
    expect(totalHintsUsed(-4, Number.NaN)).toBe(0);
    expect(totalHintsUsed(1.7, 2.2)).toBe(3);
  });
});

/* ══════════════════════════════════════════════════════════════════
   VALIDATION DES RÉPONSES — la frontière de confiance
   ══════════════════════════════════════════════════════════════════ */

describe("validation d'une réponse IA", () => {
  it("accepte une réponse conforme", () => {
    expect(parseHintResponse(validHint(2), 2)).toEqual(validHint(2));
  });

  it("REFUSE une réponse d'un autre palier que celui demandé", () => {
    // Un modèle qui répond au palier 6 quand on demande le 2 vient de
    // court-circuiter toute la pédagogie.
    expect(parseHintResponse(validHint(6), 2)).toBeNull();
  });

  for (const [label, payload] of [
    ["null", null],
    ["un tableau", []],
    ["une chaîne", "désolé, je ne peux pas"],
    ["un nombre", 42],
    ["un objet vide", {}],
  ] as const) {
    it(`refuse ${label} sans lever`, () => {
      expect(() => parseHintResponse(payload, 1)).not.toThrow();
      expect(parseHintResponse(payload, 1)).toBeNull();
    });
  }

  it("refuse un champ manquant", () => {
    const { hint: _hint, ...sansIndice } = validHint(1);
    expect(parseHintResponse(sansIndice, 1)).toBeNull();
  });

  it("refuse un champ vide ou seulement des blancs", () => {
    expect(parseHintResponse({ ...validHint(1), question: "   " }, 1)).toBeNull();
  });

  it("refuse une source ou une confiance hors énumération", () => {
    expect(parseHintResponse({ ...validHint(1), usedSource: "wikipedia" }, 1)).toBeNull();
    expect(parseHintResponse({ ...validHint(1), confidence: "totale" }, 1)).toBeNull();
  });

  it("refuse `insufficientData` non booléen — « peut-être » n'existe pas", () => {
    expect(parseHintResponse({ ...validHint(1), insufficientData: "oui" }, 1)).toBeNull();
  });

  it("borne un champ démesuré au lieu de le laisser inonder l'écran", () => {
    const parsed = parseHintResponse({ ...validHint(1), hint: "a".repeat(MAX_FIELD_LENGTH * 4) }, 1);
    expect(parsed?.hint.length).toBeLessThanOrEqual(MAX_FIELD_LENGTH + 1);
  });

  it("analyse aussi une charge utile arrivée sous forme de texte JSON", () => {
    expect(parseHintPayload(JSON.stringify(validHint(3)), 3)).toEqual(validHint(3));
  });

  it("du texte non-JSON ne fait pas lever — il est simplement refusé", () => {
    expect(() => parseHintPayload("je ne suis pas du JSON", 1)).not.toThrow();
    expect(parseHintPayload("je ne suis pas du JSON", 1)).toBeNull();
  });

  it("le schéma envoyé au modèle exige exactement les champs que le validateur exige", () => {
    expect([...HINT_RESPONSE_JSON_SCHEMA.required].sort()).toEqual(
      ["confidence", "hint", "insufficientData", "level", "question", "usedSource"]
    );
    expect(HINT_RESPONSE_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   LA GARDE CÔTÉ SERVEUR
   ══════════════════════════════════════════════════════════════════ */

describe("garde de la route — une requête cliente n'est jamais fiable", () => {
  const context: AIContext = buildAIContext(exercise(), [], [], chapters);

  it("accepte une requête normale", () => {
    expect(guardHintRequest({ task: "hint", level: 1, context }).ok).toBe(true);
  });

  for (const [label, payload] of [
    ["un corps illisible", null],
    ["une tâche inconnue", { task: "jailbreak", level: 1 }],
    ["un palier hors échelle", { task: "hint", level: 9 }],
    ["un palier non entier", { task: "hint", level: 1.5 }],
    ["un contexte manquant", { task: "hint", level: 1 }],
  ] as const) {
    it(`refuse ${label} SANS appeler le fournisseur`, () => {
      const result = guardHintRequest(payload);
      expect(result.ok).toBe(false);
    });
  }

  it("refuse un contexte trop volumineux — c'est la borne de COÛT", () => {
    const enorme = { ...context, exercise: { ...context.exercise, statement: "x".repeat(MAX_CONTEXT_CHARS + 100) } };
    const result = guardHintRequest({ task: "hint", level: 1, context: enorme });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("volumineux");
  });

  it("refuse une saisie élève démesurée", () => {
    expect(guardHintRequest({ task: "hint", level: 1, context, studentSaid: "x".repeat(100000) }).ok).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   LE PROMPT — les garde-fous pédagogiques sont dans ces chaînes
   ══════════════════════════════════════════════════════════════════ */

describe("prompt", () => {
  const context = buildAIContext(exercise(), [], [], chapters);

  it("impose la source TaekdHub contre la connaissance générale du modèle", () => {
    expect(HINT_SYSTEM_PROMPT).toContain("Ils font autorité");
    expect(HINT_SYSTEM_PROMPT).toContain("Tu n'inventes JAMAIS");
  });

  it("le palier demandé est énoncé comme un PLAFOND", () => {
    const prompt = renderHintPrompt({ task: "hint", level: 2, context });
    expect(prompt).toContain("Palier 2 sur 6");
    expect(prompt).toContain("Identifier la notion");
    expect(prompt).toContain('"level" de ta réponse vaut exactement 2');
  });

  it("transmet le corrigé quand il existe, et le désigne comme vérité terrain", () => {
    expect(renderHintPrompt({ task: "hint", level: 4, context })).toContain("vérité terrain");
  });

  it("DIT explicitement qu'il n'y a pas de corrigé quand il n'y en a pas", () => {
    const sansCorrige = buildAIContext(exercise({ correction: null }), [], [], chapters);
    const prompt = renderHintPrompt({ task: "hint", level: 4, context: sansCorrige });
    expect(prompt).toContain("Aucun corrigé n'est disponible");
  });

  it("n'invente pas de résultats quand aucune tentative n'est notée", () => {
    const prompt = renderHintPrompt({ task: "hint", level: 1, context });
    expect(prompt).toContain("n'en conclus rien");
  });

  it("part de ce que l'élève a écrit quand il a écrit quelque chose", () => {
    const prompt = renderHintPrompt({ task: "hint", level: 1, context, studentSaid: "j'ai essayé une récurrence" });
    expect(prompt).toContain("récurrence");
    expect(prompt).toContain("Pars de CE QU'IL DIT");
  });
});

/* ══════════════════════════════════════════════════════════════════
   FOURNISSEUR ABSENT, ERREURS RÉSEAU, REPLI
   ══════════════════════════════════════════════════════════════════ */

describe("fournisseur absent", () => {
  it("ne lève pas : il répond `not-configured`", async () => {
    const outcome = await unconfiguredProvider.generate({ task: "hint", level: 1, context: buildAIContext(exercise(), [], [], chapters) });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.code).toBe("not-configured");
  });
});

describe("client navigateur — l'IA tombe, l'application non", () => {
  const request = { task: "hint", level: 1, context: buildAIContext(exercise(), [], [], chapters) } as const;

  it("une réponse conforme est acceptée", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, response: validHint(1) }), { status: 200 })));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(true);
  });

  it("une réponse INVALIDE est refusée sans lever, et ne casse rien", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, response: { level: 6, hint: "" } }), { status: 200 })));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.code).toBe("invalid-response");
  });

  it("du HTML au lieu du JSON (proxy, portail captif) ne fait pas lever", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oups</html>", { status: 200 })));
    await expect(requestHint({ ...request })).resolves.toMatchObject({ ok: false });
  });

  it("un échec réseau devient une valeur, jamais une exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.code).toBe("network");
  });

  it("une erreur du fournisseur est relayée telle quelle à l'élève", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, failure: { code: "provider", message: "Le Copilot IA est momentanément saturé." } }), { status: 502 })
    ));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.message).toContain("saturé");
  });

  it("une erreur sans corps exploitable retombe sur un message générique", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ oups: true }), { status: 500 })));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.code).toBe("provider");
  });

  it("un abandon (exercice fermé) est traité comme une absence de réponse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("aborted", "AbortError"); }));
    const outcome = await requestHint({ ...request });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.code).toBe("network");
  });

  it("`readFailure` ne fait confiance à aucune forme", () => {
    expect(readFailure(null)).toBeNull();
    expect(readFailure({ failure: { code: "inventé", message: "x" } })).toBeNull();
    expect(readFailure({ failure: { code: "network", message: "   " } })).toBeNull();
    expect(readFailure({ failure: { code: "network", message: "coupé" } })).toEqual({ code: "network", message: "coupé" });
  });
});

describe("sonde de disponibilité — le mode SANS IA est le défaut", () => {
  it("route absente (export statique) → indisponible, sans erreur", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(probeAIAvailability()).resolves.toBe(false);
  });

  it("réseau coupé → indisponible, sans lever", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(probeAIAvailability()).resolves.toBe(false);
  });

  it("serveur sans clé → indisponible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: false }), { status: 200 })));
    await expect(probeAIAvailability()).resolves.toBe(false);
  });

  it("serveur configuré → disponible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: true }), { status: 200 })));
    await expect(probeAIAvailability()).resolves.toBe(true);
  });
});
