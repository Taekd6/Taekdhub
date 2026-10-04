import { describe, expect, it } from "vitest";
import { normalizeAnnaleLog } from "@/lib/annales";
import { cardFromItem, deckFor } from "@/lib/anki-export";
import { addLockCards, courseLocks, isRecalled, lockFor, lockKey, locksForClaude, LOCK_CARDS_MAX, rateLockCards, type LockCardInput } from "@/lib/course-lock";
import { computeNextMove, rankCandidates, type NextMoveInput } from "@/lib/next-move/engine";
import { resolveOutcomes } from "@/lib/next-move/history";
import { dueReviewItems, rateReviewItem } from "@/lib/spaced-repetition";
import { normalizePreferences, normalizeReviewItem, type NextMoveRecord, type ReviewItem } from "@/lib/storage";

/** Lundi 5 octobre 2026, 18 h, heure locale. Les fiches sont créées ce jour-là. */
const CREATED = new Date(2026, 9, 5, 18, 0);
const NEXT_DAY = new Date(2026, 9, 6, 18, 0);

const REDUCTION: LockCardInput[] = [
  { matiere: "maths", chapitre: "Réduction", recto: "Critère de diagonalisabilité par le polynôme minimal ?", verso: "u diagonalisable ⟺ π_u scindé à racines simples.", raison: "a diagonalisé sans vérifier que le polynôme était scindé" },
  { matiere: "maths", chapitre: "Réduction", recto: "Lien entre polynôme annulateur et valeurs propres ?", verso: "Toute valeur propre est racine de tout polynôme annulateur." },
];

function locked(now: Date = CREATED): ReviewItem[] {
  const result = addLockCards([], REDUCTION, now);
  if (!result.ok) throw new Error(result.error);
  return result.items;
}

function rateAll(items: ReviewItem[], rating: "again" | "hard" | "good" | "easy", now: Date): ReviewItem[] {
  return items.reduce((current, item) => rateReviewItem(current, item.id, rating, now), items);
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return {
    sessions: [],
    workItems: [],
    grades: [],
    reviewItems: [],
    errors: [],
    checkins: [],
    chapterMemory: [],
    preferences: normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 } }),
    history: [],
    now: NEXT_DAY,
    availableMinutes: null,
    ...overrides,
  };
}

/** Une annale de réduction ratée le 1er octobre : elle est à refaire le 6. */
const FAILED_ANNALE = normalizeAnnaleLog({ id: "a-1", created_at: new Date(2026, 9, 1, 15).toISOString(), matiere: "maths", chapitre: "Réduction", source: "Mines 2023", resultat: "échec", indices: 0 })!;

describe("addLockCards — les fiches envoyées par Claude", () => {
  it("crée des fiches « à apprendre » avec verso, chapitre, origine et raison", () => {
    const items = locked();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ subject: "Mathématiques", kind: "à apprendre", chapter: "Réduction", origin: "claude", doneAt: null, reason: REDUCTION[0].raison });
    expect(items[0].answer).toContain("scindé à racines simples");
    expect(items[1].reason).toBeUndefined();
  });

  it("ne recrée pas une fiche déjà présente (même recto, même matière), à la casse et aux accents près", () => {
    const once = locked();
    const again = addLockCards(once, [{ ...REDUCTION[0], recto: "CRITERE de diagonalisabilite par le polynome minimal ?" }], CREATED);
    expect(again.ok && again.added).toEqual([]);
    expect(again.ok && again.skipped).toBe(1);
  });

  it("refuse tout l'appel quand une fiche est illisible, et dit laquelle", () => {
    expect(addLockCards([], [{ ...REDUCTION[0], matiere: "philo" }], CREATED)).toEqual({ ok: false, error: expect.stringContaining("Fiche 1 : matière inconnue") });
    expect(addLockCards([], [REDUCTION[0], { ...REDUCTION[1], verso: " " }], CREATED)).toEqual({ ok: false, error: expect.stringContaining("Fiche 2 : verso") });
    expect(addLockCards([], [{ ...REDUCTION[0], chapitre: "" }], CREATED)).toEqual({ ok: false, error: expect.stringContaining("chapitre manquant") });
    expect(addLockCards([], [], CREATED).ok).toBe(false);
    expect(addLockCards([], Array.from({ length: LOCK_CARDS_MAX + 1 }, (_, i) => ({ ...REDUCTION[0], recto: `Q${i}` })), CREATED).ok).toBe(false);
  });

  it("les nouveaux champs survivent à l'aller-retour du stockage, et les anciennes fiches n'en gagnent pas", () => {
    const [item] = locked();
    expect(normalizeReviewItem(JSON.parse(JSON.stringify(item)))).toEqual(item);
    const plain = normalizeReviewItem({ id: "x", subject: "Physique", text: "Revoir Gauss", kind: "à revoir", createdAt: CREATED.toISOString(), doneAt: null })!;
    expect(Object.keys(plain)).not.toContain("origin");
    expect(Object.keys(plain)).not.toContain("chapter");
  });
});

describe("courseLocks — quand le verrou tient, quand il saute", () => {
  it("verrouille le chapitre du programme, quel que soit son intitulé", () => {
    const locks = courseLocks(locked(), CREATED);
    expect(locks).toHaveLength(1);
    expect(locks[0].key).toBe(lockKey("Mathématiques", "Réduction des endomorphismes"));
    expect(lockFor(locks, "Mathématiques", "réduction")).toBe(locks[0]);
    expect(lockFor(locks, "Physique", "Réduction")).toBeNull();
    expect(locks[0].reasons).toEqual([REDUCTION[0].raison]);
  });

  it("le jour même : rien à réviser (la réponse sort de la mémoire immédiate)", () => {
    const items = locked();
    expect(courseLocks(items, CREATED)[0].reviewableToday).toBe(0);
    expect(dueReviewItems(items, CREATED)).toEqual([]);
    // Même notées « Bien » le jour même, elles ne déverrouillent pas.
    expect(courseLocks(rateAll(items, "good", CREATED), CREATED)).toHaveLength(1);
  });

  it("le lendemain : à réviser, et toutes « Bien » ou « Facile » déverrouillent", () => {
    const items = locked();
    expect(dueReviewItems(items, NEXT_DAY)).toHaveLength(2);
    const first = rateReviewItem(items, items[0].id, "good", NEXT_DAY);
    expect(courseLocks(first, NEXT_DAY)[0].remaining).toHaveLength(1);
    const both = rateReviewItem(first, items[1].id, "easy", NEXT_DAY);
    expect(both.every(isRecalled)).toBe(true);
    expect(courseLocks(both, NEXT_DAY)).toEqual([]);
  });

  it("« Difficile » ne suffit pas, et la fiche reste à réviser chaque jour (pas dans plusieurs jours)", () => {
    const hard = rateAll(locked(), "hard", NEXT_DAY);
    expect(courseLocks(hard, NEXT_DAY)).toHaveLength(1);
    expect(dueReviewItems(hard, new Date(2026, 9, 7, 9))).toHaveLength(2);
  });

  it("cocher « fait » ne déverrouille pas ; oublier plus tard reverrouille", () => {
    const checked = locked().map((item) => ({ ...item, doneAt: NEXT_DAY.toISOString() }));
    expect(courseLocks(checked, NEXT_DAY)).toHaveLength(1);
    expect(dueReviewItems(checked, NEXT_DAY)).toHaveLength(2);
    const unlocked = rateAll(locked(), "good", NEXT_DAY);
    const forgotten = rateReviewItem(unlocked, unlocked[0].id, "again", new Date(2026, 9, 12, 9));
    expect(courseLocks(forgotten, new Date(2026, 9, 12, 9))[0].remaining).toHaveLength(1);
  });
});

describe("Next Move — cours d'abord, exercice ensuite", () => {
  it("sans verrou, l'annale ratée est proposée à refaire (témoin)", () => {
    expect(rankCandidates(input({ annales: [FAILED_ANNALE] })).some((entry) => entry.kind === "refaire" && entry.chapterId === lockKey("Mathématiques", "Réduction"))).toBe(true);
  });

  it("verrouillé : plus d'exercice sur ce chapitre, les fiches à la place, avec ce qui est en attente", () => {
    const ranked = rankCandidates(input({ annales: [FAILED_ANNALE], reviewItems: locked() }));
    expect(ranked.some((entry) => entry.kind === "refaire" && entry.chapterId === lockKey("Mathématiques", "Réduction"))).toBe(false);
    const lock = ranked.find((entry) => entry.key.startsWith("verrou:"))!;
    expect(lock.kind).toBe("cartes");
    expect(lock.title).toBe("Cours d'abord : Réduction");
    expect(lock.href).toBe("/revoir/session?subject=Math%C3%A9matiques");
    expect(lock.terms.map((term) => term.reason).join(" ")).toContain("Réduction — Mines 2023");
    expect(lock.score).toBe(lock.terms.reduce((sum, term) => sum + term.points, 0));
    // Les fiches du verrou ne sont pas comptées une deuxième fois dans les révisions ordinaires.
    expect(ranked.some((entry) => entry.key === "cartes:Mathématiques")).toBe(false);
    expect(computeNextMove(input({ annales: [FAILED_ANNALE], reviewItems: locked() })).primary?.key).toBe(lock.key);
  });

  it("le jour de l'échec : « Reprends ton cours », pas encore les fiches", () => {
    const ranked = rankCandidates(input({ reviewItems: locked(), now: CREATED }));
    const lock = ranked.find((entry) => entry.key.startsWith("verrou:"))!;
    expect(lock.kind).toBe("rappel");
    expect(lock.title).toBe("Reprends ton cours : Réduction");
  });

  it("déverrouillé : l'exercice revient", () => {
    const unlocked = rateAll(locked(), "good", NEXT_DAY);
    const ranked = rankCandidates(input({ annales: [FAILED_ANNALE], reviewItems: unlocked }));
    expect(ranked.some((entry) => entry.key.startsWith("verrou:"))).toBe(false);
    expect(ranked.some((entry) => entry.kind === "refaire")).toBe(true);
  });

  it("« Cours d'abord » n'est fait que chapitre déverrouillé, jamais au temps passé", () => {
    const items = locked();
    const key = `verrou:${lockKey("Mathématiques", "Réduction")}`;
    const record: NextMoveRecord = { id: "r1", key, kind: "cartes", subject: "Mathématiques", title: "Cours d'abord", minutes: 10, proposedAt: NEXT_DAY.toISOString(), status: "commencé", startedAt: NEXT_DAY.toISOString(), resolvedAt: null, reasons: [], outcomeMinutes: null };
    const sources = { sessions: [], reviewItems: rateReviewItem(items, items[0].id, "good", NEXT_DAY), chapterMemory: [] };
    expect(resolveOutcomes([record], sources, NEXT_DAY)[0].status).toBe("commencé");
    const done = resolveOutcomes([record], { ...sources, reviewItems: rateAll(items, "good", NEXT_DAY) }, NEXT_DAY);
    expect(done[0].status).toBe("fait");
  });
});

describe("Anki — les fiches de Claude vont dans le paquet du chapitre", () => {
  it("TaekdHub::<matière>::<chapitre>, étiquetées claude", () => {
    const [item] = locked();
    expect(deckFor(item)).toBe("TaekdHub::Mathématiques::Réduction");
    expect(cardFromItem(item).tags).toEqual(expect.arrayContaining(["taekdhub", "claude", "verrou-cours"]));
    expect(deckFor({ subject: "Physique" })).toBe("TaekdHub::Physique");
  });
});

describe("Claude interroge dans la conversation — rateLockCards et locksForClaude", () => {
  it("get_today montre les fiches, leur verso, et lesquelles sont interrogeables", () => {
    const items = locked();
    const [today] = locksForClaude(items, CREATED);
    expect(today).toMatchObject({ matiere: "Mathématiques", chapitre: "Réduction", fiches_restantes: 2 });
    expect(today.fiches.every((fiche) => !fiche.interrogeable)).toBe(true);
    expect(locksForClaude(items, NEXT_DAY)[0].fiches.every((fiche) => fiche.interrogeable && fiche.verso.length > 0)).toBe(true);
  });

  it("noter toutes les fiches « good » le lendemain déverrouille, et le dit", () => {
    const items = locked();
    const partial = rateLockCards(items, [{ id: items[0].id, note: "good" }], NEXT_DAY);
    expect(partial.ok && partial.unlocked).toEqual([]);
    expect(partial.ok && partial.stillLocked[0]).toContain("1 fiche de cours");
    const all = rateLockCards(items, items.map((item) => ({ id: item.id, note: "good" as const })), NEXT_DAY);
    expect(all.ok && all.unlocked).toEqual(["Réduction"]);
    expect(all.ok && courseLocks(all.items, NEXT_DAY)).toEqual([]);
  });

  it("refuse une fiche inconnue ou une fiche de l'élève (le connecteur ne touche qu'aux fiches du verrou)", () => {
    const own = normalizeReviewItem({ id: "perso", subject: "Physique", text: "Revoir Gauss", kind: "à revoir", createdAt: CREATED.toISOString(), doneAt: null })!;
    const items = [...locked(), own];
    expect(rateLockCards(items, [{ id: "inconnue", note: "good" }], NEXT_DAY).ok).toBe(false);
    expect(rateLockCards(items, [{ id: "perso", note: "good" }], NEXT_DAY).ok).toBe(false);
    expect(rateLockCards(items, [], NEXT_DAY).ok).toBe(false);
  });
});
