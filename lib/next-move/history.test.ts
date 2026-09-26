import { describe, expect, it } from "vitest";
import type { MoveCandidate } from "@/lib/next-move/engine";
import {
  HISTORY_MAX,
  HISTORY_MIN_SAMPLES,
  activeMove,
  markDone,
  markSkipped,
  markStarted,
  recordProposal,
  resolveOutcomes,
  summarizeHistory,
} from "@/lib/next-move/history";
import { normalizeNextMoveRecord, type NextMoveRecord, type ReviewItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const NOW = new Date(2026, 8, 24, 19, 0);
const hoursLater = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

function candidate(key = "rappel:ch-1", subject: Subject = "Physique", kind: MoveCandidate["kind"] = "rappel"): MoveCandidate {
  return {
    key,
    kind,
    subject,
    title: "Électrostatique",
    action: "rappel actif",
    instruction: "",
    minMinutes: 10,
    idealMinutes: 25,
    maxMinutes: 30,
    href: "/timer",
    resource: null,
    terms: [],
    score: 40,
  };
}

function session(subject: Subject, minutes: number, startedAt: Date): WorkSession {
  return {
    id: `s-${startedAt.getTime()}`,
    subject,
    exercise_id: null,
    started_at: startedAt.toISOString(),
    ended_at: null,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt.toISOString(),
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

let counter = 0;
const id = () => `id-${++counter}`;

describe("enregistrement des propositions", () => {
  it("une proposition revue dans l'heure ne crée pas de deuxième ligne (même référence renvoyée)", () => {
    const once = recordProposal([], candidate(), 25, ["raison"], NOW, id());
    expect(once).toHaveLength(1);
    expect(recordProposal(once, candidate(), 25, ["raison"], hoursLater(1))).toBe(once);
  });

  it("la même proposition quelques heures plus tard est une nouvelle ligne", () => {
    const once = recordProposal([], candidate(), 25, [], NOW, id());
    expect(recordProposal(once, candidate(), 25, [], hoursLater(4), id())).toHaveLength(2);
  });

  it("l'historique est élagué au-delà du maximum", () => {
    let history: NextMoveRecord[] = [];
    for (let index = 0; index < HISTORY_MAX + 5; index += 1) history = recordProposal(history, candidate(`k-${index}`), 10, [], NOW, id());
    expect(history).toHaveLength(HISTORY_MAX);
    expect(history[0].key).toBe("k-5");
  });

  it("Commencer, Pas maintenant, C'est fait : les statuts se suivent sur la bonne ligne", () => {
    let history = markStarted([], candidate(), 25, ["r"], NOW);
    expect(history[0]).toMatchObject({ status: "commencé", startedAt: NOW.toISOString(), minutes: 25 });
    history = markDone(history, "rappel:ch-1", hoursLater(1));
    expect(history[0].status).toBe("fait");
    history = markSkipped(history, candidate("cartes:Chimie", "Chimie", "cartes"), 10, [], hoursLater(2));
    expect(history.map((record) => record.status)).toEqual(["fait", "écarté"]);
  });

  it("chaque ligne survit à la normalisation (sauvegarde, synchronisation)", () => {
    const history = markStarted([], candidate(), 25, ["Chance estimée : 62 %"], NOW);
    const roundTripped = JSON.parse(JSON.stringify(history)).map(normalizeNextMoveRecord);
    expect(roundTripped).toEqual(history);
    expect(normalizeNextMoveRecord({ id: "x" })).toBeNull();
    expect(normalizeNextMoveRecord({ ...history[0], kind: "inconnu" })).toBeNull();
  });
});

describe("issue constatée", () => {
  it("assez de temps dans la matière après le démarrage : « fait », avec les minutes mesurées", () => {
    const history = markStarted([], candidate(), 25, [], NOW);
    const resolved = resolveOutcomes(history, { sessions: [session("Physique", 20, hoursLater(0.1))], reviewItems: [], chapterMemory: [] }, hoursLater(1));
    expect(resolved[0]).toMatchObject({ status: "fait", outcomeMinutes: 20 });
  });

  it("du temps dans une AUTRE matière ne compte pas", () => {
    const history = markStarted([], candidate(), 25, [], NOW);
    const resolved = resolveOutcomes(history, { sessions: [session("Mathématiques", 60, hoursLater(0.1))], reviewItems: [], chapterMemory: [] }, hoursLater(1));
    expect(resolved).toBe(history);
    expect(resolved[0].status).toBe("commencé");
  });

  it("des cartes notées depuis le démarrage suffisent pour une séance de cartes", () => {
    const history = markStarted([], candidate("cartes:Chimie", "Chimie", "cartes"), 10, [], NOW);
    const reviewed: ReviewItem = {
      id: "c1",
      subject: "Chimie",
      text: "pKa",
      kind: "à apprendre",
      createdAt: "2026-09-10T08:00:00.000Z",
      doneAt: null,
      srs: { dueAt: "2026-09-30", intervalDays: 6, stability: 6, difficulty: 5, state: "review", reviews: 2, lapses: 0, lastReviewedAt: hoursLater(0.2).toISOString() },
    };
    const resolved = resolveOutcomes(history, { sessions: [], reviewItems: [reviewed], chapterMemory: [] }, hoursLater(1));
    expect(resolved[0].status).toBe("fait");
  });

  it("rien n'est inventé : sans trace, la ligne reste « commencé »", () => {
    const history = markStarted([], candidate(), 25, [], NOW);
    expect(resolveOutcomes(history, { sessions: [], reviewItems: [], chapterMemory: [] }, hoursLater(2))).toBe(history);
  });

  it("la recommandation commencée reste active quelques heures, puis plus", () => {
    const history = markStarted([], candidate(), 25, [], NOW);
    expect(activeMove(history, hoursLater(1))?.key).toBe("rappel:ch-1");
    expect(activeMove(history, hoursLater(7))).toBeNull();
  });
});

describe("statistiques", () => {
  it("se taisent sous le minimum d'échantillons", () => {
    const history = [markStarted([], candidate(), 25, [], new Date(2026, 8, 20, 18))[0]];
    const summary = summarizeHistory(history, NOW);
    expect(summary.sufficient).toBe(false);
    expect(summary.followRate).toBeNull();
    expect(summary.mostPostponed).toBeNull();
  });

  it("comptent les propositions suivies et nomment la matière souvent repoussée", () => {
    let history: NextMoveRecord[] = [];
    for (let day = 0; day < HISTORY_MIN_SAMPLES; day += 1) {
      const at = new Date(2026, 8, 12 + day, 18);
      const subject: Subject = day < 4 ? "Chimie" : "Physique";
      const move = candidate(`k-${day}`, subject);
      history = day < 4 ? markSkipped(history, move, 20, [], at) : markStarted(history, move, 20, [], at);
    }
    const summary = summarizeHistory(history, NOW);
    expect(summary).toMatchObject({ proposed: 8, started: 4, skipped: 4, followRate: 50, sufficient: true });
    expect(summary.mostPostponed).toEqual({ subject: "Chimie", count: 4 });
  });

  it("une proposition toute fraîche n'est pas encore comptée comme ignorée", () => {
    const history = recordProposal([], candidate(), 25, [], hoursLater(-1), id());
    expect(summarizeHistory(history, NOW).proposed).toBe(0);
  });
});
