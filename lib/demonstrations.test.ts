import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeAttempt, type ExerciseAttempt } from "@/lib/attempts";
import { DEMO_AFMT, DEMO_FIELDS, DEMO_MODEL, DEMO_MODEL_NAME, DEMO_QFMT, demoRef, previewFace } from "@/lib/demo-cards";
import {
  DEMONSTRATIONS,
  REACTIVATE_AFTER_DAYS,
  demoActions,
  demoById,
  demoDeck,
  demoNoteOf,
  demoStatus,
  findDemoNotes,
  parseRestitution,
  recordRestitution,
  recurringGaps,
  restitutionAttempt,
  sendDemoNotes,
  targetedCard,
  type ParsedRestitution,
} from "@/lib/demonstrations";
import { recurringDifficulties } from "@/lib/pedagogy";
import { rankCandidates } from "@/lib/next-move/engine";
import { normalizePreferences } from "@/lib/storage";
import type { AnkiTransport } from "@/lib/anki-connect";

const NOW = new Date(2026, 9, 16, 18, 0);
const TODAY = "2026-10-16";
const RANG = "m1-theoreme-du-rang";
const demo = demoById(RANG)!;

function restitution(day: string, over: Record<string, unknown> = {}) {
  const result = parseRestitution(JSON.stringify({ demonstration: RANG, date: day, resultat: "incomplète", aide: "sans", lacunes: [{ type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }], ...over }), TODAY);
  if (!result.ok) throw new Error(result.errors.join(" | "));
  return result.value;
}

function history(...parsed: ParsedRestitution[]): ExerciseAttempt[] {
  return parsed.reduce<ExerciseAttempt[]>((list, entry) => recordRestitution(list, entry, NOW), []);
}

describe("la carte : recto sans fuite, verso complet, aucune dépendance", () => {
  it("chaque démonstration pointe un vrai chapitre ; identifiants et références uniques", () => {
    const raw = JSON.parse(readFileSync("data/demonstrations.json", "utf8")).demonstrations as { id: string }[];
    expect(DEMONSTRATIONS).toHaveLength(raw.length);
    expect(new Set(DEMONSTRATIONS.map((d) => d.id)).size).toBe(DEMONSTRATIONS.length);
    expect(new Set(DEMONSTRATIONS.map((d) => demoRef(d.id))).size).toBe(DEMONSTRATIONS.length);
    for (const d of DEMONSTRATIONS) expect(demoDeck(d)).toMatch(/^TaekdHub::.+::.+$/);
  });

  it("le recto montre le nom, les hypothèses, la consigne et l'espace de travail — jamais l'énoncé ni une étape", () => {
    for (const d of DEMONSTRATIONS) {
      const front = previewFace("front", demoNoteOf(d).fields);
      expect(front).toContain(d.title);
      for (const hypothesis of d.hypotheses) expect(front).toContain(hypothesis);
      expect(front).toMatch(/Sans support/);
      expect(front).toContain("th-board");
      expect(front).not.toContain(d.statement.split("\n")[0]);
      for (const step of d.steps) expect(front).not.toContain(step.text.slice(0, 40));
      for (const point of d.critical) expect(front).not.toContain(point.slice(0, 30));
    }
  });

  it("le verso donne l'énoncé exact, chaque étape avec sa justification, et les points critiques", () => {
    for (const d of DEMONSTRATIONS) {
      const back = previewFace("back", demoNoteOf(d).fields);
      expect(back).toContain(d.statement.split("\n")[0].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      expect((back.match(/<li>/g) ?? []).length).toBe(d.steps.length + d.critical.length);
      for (const step of d.steps.filter((s) => s.why)) expect(back).toContain(step.why!.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
    }
  });

  it("aucun JavaScript dans le modèle, et les champs sont échappés", () => {
    expect(DEMO_QFMT + DEMO_AFMT + DEMO_MODEL.css).not.toMatch(/<script|onerror|javascript:/i);
    const hostile = { ...demo, title: "<img src=x onerror=alert(1)>", steps: [{ text: "<b>x</b> & y" }] };
    const fields = demoNoteOf(hostile).fields;
    expect(fields.Nom).not.toContain("<img");
    expect(fields.Preuve).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });

  it("le modèle déclare tous ses champs, et les modèles n'utilisent que ceux-là", () => {
    const used = [...(DEMO_QFMT + DEMO_AFMT).matchAll(/\{\{[#/]?(\w+)\}\}/g)].map((m) => m[1]);
    for (const name of used) expect(DEMO_FIELDS as readonly string[]).toContain(name);
    expect(DEMO_MODEL.inOrderFields).toEqual([...DEMO_FIELDS]);
  });

  it("data/demonstrations.notes.json (lu par le script du paquet) est à jour avec le rendu", () => {
    const file = JSON.parse(readFileSync("data/demonstrations.notes.json", "utf8"));
    expect(file.model).toEqual(JSON.parse(JSON.stringify(DEMO_MODEL)));
    expect(file.notes).toEqual(JSON.parse(JSON.stringify(DEMONSTRATIONS.map(demoNoteOf))));
  });
});

describe("états fondés sur des observations, jamais sur le temps passé", () => {
  it("sans restitution : non travaillée — même si des séances existent (elles ne sont pas lues)", () => {
    const status = demoStatus(RANG, [], TODAY);
    expect(status).toMatchObject({ state: "non-travaillée", restitutions: 0, lastDay: null });
    expect(status.because).toMatch(/ouvrir la carte ou y passer du temps ne compte pas/);
  });

  it("incomplète, puis réussie avec aide, puis autonome, puis à réactiver", () => {
    const incomplete = history(restitution("2026-10-01"));
    expect(demoStatus(RANG, incomplete, TODAY)).toMatchObject({ state: "restitution-incomplète" });
    expect(demoStatus(RANG, incomplete, TODAY).because).toMatch(/1 lacune relevée/);

    const withHelp = history(restitution("2026-10-01"), restitution("2026-10-08", { resultat: "réussie", aide: "indices", lacunes: [] }));
    expect(demoStatus(RANG, withHelp, TODAY)).toMatchObject({ state: "réussite-avec-aide", lastDay: "2026-10-08" });

    const alone = history(restitution("2026-10-01"), restitution("2026-10-14", { resultat: "réussie", aide: "sans", lacunes: [] }));
    expect(demoStatus(RANG, alone, TODAY)).toMatchObject({ state: "réussite-autonome" });
    expect(demoStatus(RANG, alone, TODAY).because).toMatch(/2 restitutions enregistrées/);

    // Même observation, des semaines plus tard : elle ne prouve plus rien.
    const later = new Date(2026, 9, 14 + REACTIVATE_AFTER_DAYS);
    const laterDay = later.toLocaleDateString("en-CA");
    expect(demoStatus(RANG, alone, laterDay).state).toBe("à-réactiver");
    expect(demoStatus(RANG, alone, "2026-11-03").state).toBe("réussite-autonome"); // 20 jours : pas encore
  });

  it("un échec APRÈS une réussite autonome ramène à « incomplète » : l'état est celui de la dernière observation", () => {
    const list = history(restitution("2026-10-05", { resultat: "réussie", aide: "sans", lacunes: [] }), restitution("2026-10-12", { resultat: "échec", lacunes: [] }));
    expect(demoStatus(RANG, list, TODAY).state).toBe("restitution-incomplète");
  });

  it("les tentatives d'une autre démonstration ou d'un exercice ne comptent pas", () => {
    const other = { ...history(restitution("2026-10-14", { resultat: "réussie", aide: "sans", lacunes: [] }))[0], exerciseKey: "demo:autre" };
    expect(demoStatus(RANG, [other], TODAY).state).toBe("non-travaillée");
  });
});

describe("lecture d'une restitution rendue par l'IA", () => {
  it("accepte une restitution complète, avec ou sans clôture, et rattache chapitre et référence", () => {
    const value = restitution("2026-10-14", { lacunes: [{ type: "étape", etape: 4, detail: "Surjectivité non montrée", confiance: "probable" }], carte_proposee: { recto: "Q ?", verso: "R" }, points_maitrises: ["Choix du supplémentaire"] });
    expect(value.demo.id).toBe(RANG);
    expect(value.result).toBe("partiel");
    expect(value.gaps).toEqual([{ kind: "étape", detail: "Surjectivité non montrée", step: 4 }]);
    expect(value.proposedCard).toEqual({ front: "Q ?", back: "R" });
    const wrapped = parseRestitution("Voici :\n```json\n" + JSON.stringify({ demonstration: RANG, date: "2026-10-14", resultat: "échec", aide: "sans" }) + "\n```", TODAY);
    expect(wrapped.ok).toBe(true);
  });

  it("une lacune incertaine n'est PAS enregistrée : signalée à confirmer, jamais comptée", () => {
    const value = restitution("2026-10-14", { lacunes: [{ type: "justification", detail: "Peut-être un argument flou", confiance: "incertaine" }, { type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }] });
    expect(value.gaps).toHaveLength(1);
    expect(value.unconfirmed).toEqual(["justification : Peut-être un argument flou"]);
    expect(restitutionAttempt(value, NOW).gaps).toHaveLength(1);
  });

  it("une réussite exige l'aide déclarée ; « réussie » avec des lacunes est refusée ; un identifiant inconnu aussi", () => {
    const bad = (data: unknown, pattern: RegExp) => {
      const result = parseRestitution(typeof data === "string" ? data : JSON.stringify(data), TODAY);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join(" ")).toMatch(pattern);
    };
    bad({ demonstration: RANG, date: "2026-10-14", resultat: "réussie" }, /« aide » est obligatoire/);
    bad({ demonstration: RANG, date: "2026-10-14", resultat: "réussie", aide: "sans", lacunes: [{ type: "étape", detail: "x" }] }, /ne peut pas avoir de lacunes/);
    bad({ demonstration: "inconnue", date: "2026-10-14", resultat: "échec" }, /doit être l'un de : m1-theoreme-du-rang/);
    bad({ demonstration: RANG, date: "2027-01-01", resultat: "échec" }, /futur/);
    bad({ demonstration: RANG, date: "2026-10-14", resultat: "bof" }, /resultat/);
    bad({ demonstration: RANG, date: "2026-10-14", resultat: "échec", lacunes: [{ type: "magie", detail: "x" }] }, /Lacune 1/);
    bad("{ pas du json", /Aucun objet JSON|invalide/);
    bad("", /Colle d'abord/);
  });

  it("données partielles : sans lacune ni carte ni minutes, accepté avec un avertissement honnête ; étape inexistante ignorée", () => {
    const value = restitution("2026-10-14", { lacunes: undefined });
    expect(value.gaps).toEqual([]);
    expect(value.warnings.join(" ")).toMatch(/Aucune lacune précisée/);
    const outOfRange = restitution("2026-10-14", { lacunes: [{ type: "étape", etape: 99, detail: "x", confiance: "certaine" }] });
    expect(outOfRange.gaps[0].step).toBeUndefined();
    expect(outOfRange.warnings.join(" ")).toMatch(/étape 99 inexistante/);
  });
});

describe("une observation = une tentative de l'historique existant, sans doublon", () => {
  it("enregistre dans le modèle de tentatives : clé, chapitre, origine, lacunes", () => {
    const [attempt] = history(restitution("2026-10-14", { lacunes: [{ type: "étape", etape: 3, detail: "Injectivité sautée", confiance: "certaine" }] }));
    expect(attempt).toMatchObject({ id: `demo:${RANG}:2026-10-14`, exerciseKey: `demo:${RANG}`, chapterId: "m1-applications-lineaires", subject: "Mathématiques", origin: "démonstration", result: "partiel", help: "sans", byAi: true });
    expect(attempt.gaps).toEqual([{ kind: "étape", detail: "Injectivité sautée", step: 3 }]);
  });

  it("renvoyer la même restitution le même jour remplace ; un autre jour s'ajoute", () => {
    const first = restitution("2026-10-14");
    const once = history(first);
    expect(recordRestitution(once, first, NOW)).toHaveLength(1);
    expect(recordRestitution(once, restitution("2026-10-14", { resultat: "échec" }), NOW)).toHaveLength(1);
    expect(recordRestitution(once, restitution("2026-10-15"), NOW)).toHaveLength(2);
  });

  it("survit à la normalisation (rechargement) et les anciennes tentatives restent lisibles", () => {
    const [attempt] = history(restitution("2026-10-14"));
    expect(normalizeAttempt(JSON.parse(JSON.stringify(attempt)))).toEqual(attempt);
    const old = normalizeAttempt({ id: "a", exerciseKey: "k", subject: "Mathématiques", result: "échec", createdAt: "2026-09-01T12:00:00.000Z", origin: "annale" })!;
    expect(old.gaps).toBeUndefined();
    expect(normalizeAttempt({ ...old, origin: "inconnue" })!.origin).toBe("exercice");
    expect(normalizeAttempt({ ...attempt, gaps: [{ kind: "magie", detail: "x" }, { kind: "étape" }, "x"] })!.gaps).toBeUndefined();
  });

  it("alimente le même historique pour tous : la difficulté de chapitre et Next Move la voient, sans rien casser", () => {
    const list = history(restitution("2026-10-01"), restitution("2026-10-10"));
    const report = recurringDifficulties({ grades: [], attempts: list, errors: [], workItems: [], chapterMemory: [], annales: [], retryDelaysDays: [2, 5, 12], today: TODAY });
    // Règle du chapitre (lib/pedagogy.ts) : les tentatives successives d'un même exercice — ici une même démonstration — comptent
    // pour UN événement. La récurrence fine d'une lacune est portée par la vue « démonstration » (recurringGaps), testée plus bas.
    expect(report.recommandations[0]).toMatchObject({ chapitre: { id: "m1-applications-lineaires" }, niveau: "signal", evenements_distincts: 1, donnees_suffisantes: false });
    expect(report.recommandations[0].observations[0]).toMatch(/Théorème du rang \(démonstration\)/);
    const ranked = rankCandidates({ sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: normalizePreferences({}), history: [], now: NOW, availableMinutes: null, attempts: list });
    expect(ranked.some((candidate) => candidate.key === `refaire:demo:${RANG}`)).toBe(true);
  });
});

describe("transformer une difficulté en action adaptée", () => {
  const act = (list: ExerciseAttempt[], cardInAnki: boolean) => demoActions({ demo, attempts: list, cardInAnki, today: TODAY });
  const kinds = (list: ExerciseAttempt[], cardInAnki: boolean) => act(list, cardInAnki).map((a) => a.kind);

  it("non travaillée : ajouter la carte si elle manque, sinon une première restitution", () => {
    expect(kinds([], false)).toEqual(["ajouter-carte"]);
    expect(kinds([], true)).toEqual(["refaire"]);
  });

  it("une première hypothèse oubliée : revoir la carte existante — jamais créer une carte", () => {
    const list = history(restitution("2026-10-14"));
    expect(kinds(list, true)).toEqual(["revoir-carte"]);
    expect(kinds(list, false)).toEqual(["ajouter-carte"]);
  });

  it("la même lacune dans deux restitutions : carte CIBLÉE si la carte est dans Anki ; sinon d'abord ajouter la carte", () => {
    const list = history(restitution("2026-10-01"), restitution("2026-10-10"));
    expect(recurringGaps(RANG, list)).toHaveLength(1);
    const withCard = act(list, true);
    expect(withCard.map((a) => a.kind)).toEqual(["creer-carte-ciblee"]);
    expect(withCard[0].target).toMatchObject({ kind: "hypothèse", count: 2, days: ["2026-10-01", "2026-10-10"] });
    expect(kinds(list, false)).toEqual(["ajouter-carte"]);
    expect(kinds(list, false)).not.toContain("creer-carte-ciblee");
  });

  it("deux lacunes différentes ne sont pas « la même » : pas de carte ciblée", () => {
    const list = history(restitution("2026-10-01"), restitution("2026-10-10", { lacunes: [{ type: "justification", detail: "Théorème non cité", confiance: "certaine" }] }));
    expect(recurringGaps(RANG, list)).toEqual([]);
    expect(kinds(list, true)).not.toContain("creer-carte-ciblee");
  });

  it("la même lacune dans UNE restitution comptée deux fois ne devient pas récurrente", () => {
    const twice = restitution("2026-10-14", { lacunes: [{ type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }, { type: "hypothèse", detail: "dimension finie oubliée", confiance: "probable" }] });
    expect(recurringGaps(RANG, history(twice))).toEqual([]);
  });

  it("une lacune de raisonnement, ou trois échecs d'affilée : demander une explication à l'IA, pas une carte", () => {
    const reasoning = history(restitution("2026-10-14", { lacunes: [{ type: "raisonnement", detail: "Ne voit pas pourquoi v est surjective", confiance: "certaine" }] }));
    expect(kinds(reasoning, true)).toContain("expliquer");
    expect(kinds(reasoning, true)).not.toContain("creer-carte-ciblee");
    const fails = history(restitution("2026-10-01", { lacunes: [] }), restitution("2026-10-05", { lacunes: [] }), restitution("2026-10-09", { lacunes: [] }));
    expect(kinds(fails, true)).toEqual(["expliquer", "refaire"]);
  });

  it("une étape manquante ou une restitution sans lacune précisée : refaire la démonstration entière", () => {
    expect(kinds(history(restitution("2026-10-14", { lacunes: [{ type: "étape", etape: 4, detail: "Surjectivité", confiance: "certaine" }] })), true)).toEqual(["refaire"]);
    expect(kinds(history(restitution("2026-10-14", { lacunes: [] })), true)).toEqual(["refaire"]);
  });

  it("réussite avec aide : refaire sans aide ; autonome récente : rien ; ancienne : carte + refaire", () => {
    const helped = history(restitution("2026-10-14", { resultat: "réussie", aide: "correction", lacunes: [] }));
    expect(kinds(helped, true)).toEqual(["refaire"]);
    const alone = history(restitution("2026-10-14", { resultat: "réussie", aide: "sans", lacunes: [] }));
    expect(kinds(alone, true)).toEqual(["rien"]);
    expect(demoActions({ demo, attempts: alone, cardInAnki: true, today: "2026-12-01" }).map((a) => a.kind)).toEqual(["revoir-carte", "refaire"]);
  });

  it("jamais plus de trois actions, jamais deux fois la même", () => {
    const list = history(restitution("2026-10-01", { lacunes: [{ type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }, { type: "raisonnement", detail: "x", confiance: "certaine" }, { type: "étape", detail: "y", etape: 2, confiance: "certaine" }] }), restitution("2026-10-10", { lacunes: [{ type: "hypothèse", detail: "Dimension finie oubliée", confiance: "certaine" }, { type: "raisonnement", detail: "x", confiance: "certaine" }, { type: "étape", detail: "y", etape: 2, confiance: "certaine" }] }));
    const result = kinds(list, true);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(new Set(result).size).toBe(result.length);
  });

  it("la carte ciblée est prête à verser dans Anki : paquet du chapitre, étiquettes, référence — rien n'est envoyé ici", () => {
    const gap = recurringGaps(RANG, history(restitution("2026-10-01"), restitution("2026-10-10")))[0];
    const card = targetedCard(demo, { front: "Q ?", back: "R" }, gap);
    expect(card).toMatchObject({ front: "Q ?", back: "R", deck: demoDeck(demo) });
    expect(card.tags).toEqual(expect.arrayContaining(["taekdhub", "démonstration", "ciblée", demoRef(RANG)]));
  });
});

describe("AnkiConnect : sans doublon, sans écraser, lecture séparée de l'écriture", () => {
  function fakeAnki(opts: { models?: string[]; existing?: string[]; addResult?: (number | null)[] } = {}) {
    const calls: { action: string; params?: Record<string, unknown> }[] = [];
    const transport: AnkiTransport = async (action, params) => {
      calls.push({ action, params });
      if (action === "modelNames") return opts.models ?? [];
      if (action === "multi") {
        const actions = (params as { actions: { params: { query: string } }[] }).actions;
        return actions.map((entry) => ({ result: (opts.existing ?? []).some((id) => entry.params.query === `Ref:${demoRef(id)}`) ? [123] : [], error: null }));
      }
      if (action === "addNotes") return opts.addResult ?? ((params as { notes: unknown[] }).notes.map((_, i) => 1000 + i));
      return null;
    };
    return { transport, calls, names: () => calls.map((c) => c.action) };
  }

  it("findDemoNotes ne fait que lire : aucune création, aucun ajout", async () => {
    const anki = fakeAnki({ existing: [RANG] });
    expect(await findDemoNotes(anki.transport, DEMONSTRATIONS)).toEqual([RANG]);
    expect(anki.names().every((name) => ["multi", "findNotes"].includes(name))).toBe(true);
  });

  it("crée le type de note s'il manque, puis ajoute — avec les champs et le paquet du chapitre", async () => {
    const anki = fakeAnki();
    const result = await sendDemoNotes(anki.transport, [demo]);
    expect(result).toEqual({ added: [RANG], alreadyThere: [], failed: [] });
    const create = anki.calls.find((c) => c.action === "createModel")!;
    expect(create.params).toMatchObject({ modelName: DEMO_MODEL_NAME, isCloze: false });
    const add = anki.calls.find((c) => c.action === "addNotes")!.params as { notes: { deckName: string; fields: Record<string, string>; options: { allowDuplicate: boolean } }[] };
    expect(add.notes[0].deckName).toBe("TaekdHub::Mathématiques::Applications linéaires");
    expect(add.notes[0].fields.Ref).toBe(demoRef(RANG));
    expect(add.notes[0].options.allowDuplicate).toBe(false);
  });

  it("ne recrée pas le type de note existant, ni une note déjà présente (cartes et planification intactes)", async () => {
    const anki = fakeAnki({ models: [DEMO_MODEL_NAME], existing: [RANG] });
    const result = await sendDemoNotes(anki.transport, DEMONSTRATIONS);
    expect(result.alreadyThere).toEqual([RANG]);
    expect(result.added).toEqual(DEMONSTRATIONS.filter((d) => d.id !== RANG).map((d) => d.id));
    expect(anki.names()).not.toContain("createModel");
    const added = (anki.calls.find((c) => c.action === "addNotes")!.params as { notes: { fields: { Ref: string } }[] }).notes.map((n) => n.fields.Ref);
    expect(added).not.toContain(demoRef(RANG));
    // Jamais de modification ni de replanification d'une carte.
    expect(anki.names().filter((name) => /update|answer|suspend|forget|setDue|delete|remove/i.test(name))).toEqual([]);
  });

  it("tout déjà présent : rien n'est envoyé ; un refus d'Anki est rapporté", async () => {
    const all = fakeAnki({ models: [DEMO_MODEL_NAME], existing: DEMONSTRATIONS.map((d) => d.id) });
    expect((await sendDemoNotes(all.transport, DEMONSTRATIONS)).added).toEqual([]);
    expect(all.names()).not.toContain("addNotes");
    const refused = fakeAnki({ models: [DEMO_MODEL_NAME], addResult: [null] });
    expect(await sendDemoNotes(refused.transport, [demo])).toEqual({ added: [], alreadyThere: [], failed: [RANG] });
  });
});

describe("préférences : le lien carte ↔ démonstration", () => {
  it("absent des anciens réglages : vide ; les entrées invalides sont écartées", () => {
    expect(normalizePreferences({}).demoCards).toEqual({});
    const prefs = normalizePreferences({ demoCards: { [RANG]: "2026-10-16T10:00:00.000Z", "Pas un id!": "2026-10-16T10:00:00.000Z", autre: "pas une date", x: 12 } });
    expect(prefs.demoCards).toEqual({ [RANG]: "2026-10-16T10:00:00.000Z" });
  });
});

describe("lecture par une IA (get_demonstrations)", () => {
  it("états observés, lacunes qui reviennent, actions, et ce que TaekdHub sait — ou ignore — de la carte", async () => {
    const { demonstrationsReport } = await import("@/lib/demonstrations");
    const list = history(restitution("2026-10-01"), restitution("2026-10-10"));
    const unknown = demonstrationsReport({ attempts: list, demoCards: {}, today: TODAY }, { demoId: RANG })[0];
    expect(unknown).toMatchObject({ id: RANG, etat: "Restitution incomplète", restitutions: 2, matiere: "Mathématiques" });
    expect(unknown.carte_anki).toMatchObject({ reference: `th-demo-${RANG}`, dans_anki: expect.stringMatching(/^inconnu.*à distance/) });
    expect(unknown.lacunes_recurrentes[0]).toMatchObject({ type: "hypothèse", restitutions: 2, jours: ["2026-10-01", "2026-10-10"] });
    expect(unknown.actions.map((a) => a.action)).toEqual(["ajouter-carte"]); // pas de carte ciblée tant que la carte n'est pas dans Anki
    expect(unknown.observations.map((o) => o.jour)).toEqual(["2026-10-10", "2026-10-01"]);

    const known = demonstrationsReport({ attempts: list, demoCards: { [RANG]: "2026-10-12T09:00:00.000Z" }, today: TODAY }, { demoId: RANG })[0];
    expect(known.carte_anki.dans_anki).toMatch(/^oui \(envoyée ou retrouvée le 2026-10-12\)/);
    expect(known.actions[0]).toMatchObject({ action: "creer-carte-ciblee", lacune: { type: "hypothèse" } });
  });

  it("filtre par chapitre et matière ; sans observation, l'état est « non travaillée »", async () => {
    const { demonstrationsReport } = await import("@/lib/demonstrations");
    const all = demonstrationsReport({ attempts: [], demoCards: {}, today: TODAY });
    expect(all.length).toBe(DEMONSTRATIONS.length);
    expect(all.every((entry) => entry.etat === "Non travaillée" && entry.restitutions === 0)).toBe(true);
    expect(demonstrationsReport({ attempts: [], demoCards: {}, today: TODAY }, { chapterId: "m1-prehilbertiens" }).map((entry) => entry.id)).toEqual(["m1-cauchy-schwarz"]);
    expect(demonstrationsReport({ attempts: [], demoCards: {}, today: TODAY }, { subject: "Physique" })).toEqual([]);
  });
});
