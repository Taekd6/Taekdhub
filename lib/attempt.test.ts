import { describe, expect, it } from "vitest";
import { appendAttempt, parsePendingAttempt, pendingAttemptKey, resumeAid, PENDING_ATTEMPT_PREFIX } from "@/lib/attempt";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * LA TENTATIVE EN ATTENTE DE VERDICT.
 *
 * Ces tests protègent le moment le plus fragile du produit : le travail est
 * fait, le chrono est arrêté, et rien n'est encore écrit. Le défaut d'origine
 * (reproduit en navigateur : 42 minutes perdues par un simple rechargement)
 * ne venait d'aucune logique fausse — il venait de ce qu'aucune logique ne
 * couvrait cet instant.
 */

function makeSession(over: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s-1",
    subject: "Mathématiques",
    exercise_id: "ex-1",
    started_at: "2026-08-30T17:00:00.000Z",
    ended_at: "2026-08-30T17:42:00.000Z",
    duration_seconds: 2520,
    note: "Exercice focus : Intégration par parties",
    created_at: "2026-08-30T17:42:00.000Z",
    result: null,
    hints_used: 2,
    correction_viewed: false,
    ...over,
  };
}

describe("clé du brouillon", () => {
  it("encode l'exercice concerné, comme celle du chrono", () => {
    expect(pendingAttemptKey("ex-42")).toBe(`${PENDING_ATTEMPT_PREFIX}ex-42`);
  });
});

describe("parsePendingAttempt", () => {
  it("restitue une tentative en attente avec son temps et son niveau d'aide intacts", () => {
    const draft = makeSession({ duration_seconds: 2520, hints_used: 3, correction_viewed: true });
    const restored = parsePendingAttempt(JSON.stringify(draft), "ex-1");
    expect(restored).not.toBeNull();
    expect(restored!.duration_seconds).toBe(2520);
    expect(restored!.hints_used).toBe(3);
    expect(restored!.correction_viewed).toBe(true);
    expect(restored!.result).toBeNull();
  });

  it("REPRODUIT LE DÉFAUT CORRIGÉ : sans brouillon, il n'y a rien à reprendre", () => {
    // C'était l'état du produit à l'écran de résultat : la clé du chrono
    // venait d'être effacée par `stop()`, la séance n'existait que dans un
    // `useState`, et un rechargement l'emportait sans un message.
    expect(parsePendingAttempt(null, "ex-1")).toBeNull();
  });

  it("refuse un brouillon illisible plutôt que de faire échouer le montage", () => {
    expect(parsePendingAttempt("{ pas du json", "ex-1")).toBeNull();
  });

  it("refuse le brouillon d'un AUTRE exercice — jamais de temps attribué à la mauvaise fiche", () => {
    const draft = makeSession({ exercise_id: "ex-2" });
    expect(parsePendingAttempt(JSON.stringify(draft), "ex-1")).toBeNull();
  });

  it("refuse une durée nulle : sans une seconde enregistrée, il n'y a rien à qualifier", () => {
    expect(parsePendingAttempt(JSON.stringify(makeSession({ duration_seconds: 0 })), "ex-1")).toBeNull();
  });

  it("ne devine JAMAIS un résultat à la place de l'élève", () => {
    // Reprendre une séance perdue, c'est reposer la question — pas y répondre.
    const restored = parsePendingAttempt(JSON.stringify(makeSession({ result: null })), "ex-1");
    expect(restored!.result).toBeNull();
  });

  it("un brouillon antérieur au suivi de la correction reste `null`, jamais `false`", () => {
    // Même doctrine que `hints_used` : l'absence de mesure n'est pas une
    // preuve d'autonomie (voir lib/supabase/types.ts#correction_viewed).
    const legacy = { ...makeSession(), correction_viewed: undefined };
    expect(parsePendingAttempt(JSON.stringify(legacy), "ex-1")!.correction_viewed).toBeNull();
  });
});

describe("appendAttempt", () => {
  it("ajoute la tentative en tête de l'historique", () => {
    const existing = [makeSession({ id: "vieille" })];
    const added = appendAttempt(makeSession({ id: "neuve" }), existing);
    expect(added.map((s) => s.id)).toEqual(["neuve", "vieille"]);
  });

  it("INVARIANT : valider deux fois la même tentative n'écrit qu'une séance", () => {
    // Vérifié en navigateur : aucune double écriture n'est aujourd'hui
    // atteignable (double-clic, double frappe, deux évènements dans le même
    // tour). Mais cette sûreté tenait à une coïncidence — les deux appels
    // reconstruisaient le tableau à partir du même état périmé. La reprise
    // après rechargement permet désormais à un même brouillon d'être chargé
    // par deux montages successifs : l'identifiant est ce qui les relie.
    const draft = makeSession({ id: "tentative-unique", result: "réussi" });
    const once = appendAttempt(draft, []);
    const twice = appendAttempt(draft, once);
    expect(twice).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it("deux tentatives DISTINCTES sur le même exercice restent deux séances", () => {
    // L'idempotence porte sur l'identifiant, jamais sur l'exercice : refaire
    // un exercice demain est un fait nouveau, pas un doublon.
    const lundi = makeSession({ id: "lundi", result: "échoué" });
    const mardi = makeSession({ id: "mardi", result: "réussi", started_at: "2026-08-31T17:00:00.000Z" });
    expect(appendAttempt(mardi, appendAttempt(lundi, []))).toHaveLength(2);
  });
});

describe("resumeAid — l'aide utilisée survit à un rechargement", () => {
  it("restitue les indices et la correction d'une séance interrompue", () => {
    expect(resumeAid({ hintCount: 3, correctionRevealed: true })).toEqual({ hintCount: 3, correctionRevealed: true });
  });

  it("REPRODUIT LE DÉFAUT CORRIGÉ : sans ces champs, l'aide repartait à zéro", () => {
    // C'est exactement ce que produisait un rechargement en cours de séance
    // quand `hintCount` et `correctionRevealed` étaient de simples états
    // React : trois indices révélés et la correction lue réapparaissaient en
    // 0 / false — non pas « on ne sait pas », mais la PREUVE POSITIVE que
    // l'élève s'en est sorti seul. Ils vivent désormais dans le contexte
    // persisté du chrono ; ce test fixe le comportement de repli.
    expect(resumeAid({})).toEqual({ hintCount: 0, correctionRevealed: false });
  });

  it("MIGRATION : un chrono d'une version antérieure ne porte que `exerciseId`", () => {
    // Il retombe sur 0 / false, exactement le comportement d'avant — jamais
    // `undefined`, qui filtrerait jusque dans la séance enregistrée.
    const { hintCount, correctionRevealed } = resumeAid({ exerciseId: "ex-1" } as { hintCount?: number });
    expect(hintCount).toBe(0);
    expect(correctionRevealed).toBe(false);
    expect(hintCount).not.toBeUndefined();
  });

  it("refuse les valeurs impossibles plutôt que de les propager", () => {
    expect(resumeAid({ hintCount: -4 }).hintCount).toBe(0);
    expect(resumeAid({ hintCount: NaN }).hintCount).toBe(0);
    expect(resumeAid({ hintCount: Infinity }).hintCount).toBe(0);
    expect(resumeAid({ hintCount: 2.7 }).hintCount).toBe(2);
    expect(resumeAid(null).correctionRevealed).toBe(false);
  });

  it("seul `true` vaut correction lue — une valeur douteuse ne condamne pas l'élève", () => {
    expect(resumeAid({ correctionRevealed: undefined }).correctionRevealed).toBe(false);
  });
});
