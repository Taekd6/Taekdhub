import { describe, expect, it } from "vitest";
import { createChapter, setArchived } from "@/lib/chapter-memory";
import { rankCandidates, type NextMoveInput } from "@/lib/next-move/engine";
import { khollePracticeSessions } from "@/lib/practice-session";
import { chapterWorkIndex, computeMastery } from "@/lib/programme";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { normalizePreferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date(2026, 8, 24, 10, 0);
const DERIV = "m1-derivabilite";

function session(chapterId: string | undefined, minutes: number, day = new Date(2026, 8, 23, 18)): WorkSession {
  return {
    id: `s-${Math.random()}`, subject: "Mathématiques", exercise_id: null, started_at: day.toISOString(), ended_at: null,
    duration_seconds: minutes * 60, note: null, created_at: day.toISOString(), result: null, hints_used: null, work_item_id: null,
    ...(chapterId ? { chapter_id: chapterId } : {}),
  };
}

function memory(id = "mem-1") {
  const programme = PROGRAMME_BY_ID.get(DERIV)!;
  return createChapter({ subject: programme.subject, title: programme.title, learnedAt: "2026-09-20" }, new Date(2026, 8, 20, 12), id);
}

describe("temps chronométré par chapitre du programme", () => {
  it("sans séance rattachée à un chapitre : zéro, jamais une répartition devinée", () => {
    const index = chapterWorkIndex([session(undefined, 90)], [memory()]);
    expect(index.size).toBe(0);
  });

  it("additionne chrono (id de Mémoire) et khôlle (id du programme) sur le même chapitre", () => {
    const index = chapterWorkIndex([session("mem-1", 30), session(DERIV, 15, new Date(2026, 8, 24, 9))], [memory()]);
    expect(index.get(DERIV)).toEqual({ minutes: 45, lastDay: "2026-09-24" });
  });

  it("le temps d'un chapitre rangé reste compté ; une référence cassée est ignorée", () => {
    const shelved = setArchived(memory(), true);
    const index = chapterWorkIndex([session("mem-1", 20), session("chapitre-supprimé", 50)], [shelved]);
    expect([...index.keys()]).toEqual([DERIV]);
    expect(index.get(DERIV)?.minutes).toBe(20);
  });

  it("anciennes données : séances sans chapter_id, ou sans `sessions` fournies", () => {
    const base = { chapterMemory: [], annales: [], seen: [], today: "2026-09-24" };
    expect(computeMastery(base).every((entry) => entry.workedMinutes === 0 && entry.lastWorkedDay === null)).toBe(true);
  });

  it("l'information n'entre pas dans le statut : du temps sans trace reste « jamais revu »", () => {
    const entry = computeMastery({ chapterMemory: [], annales: [], seen: [DERIV], today: "2026-09-24", sessions: [session(DERIV, 20)] }).find((e) => e.chapter.id === DERIV)!;
    expect(entry.status).toBe("jamais");
    expect(entry.workedMinutes).toBe(20);
  });
});

describe("la recommandation « jamais revu » dit le temps déjà passé", () => {
  const base: NextMoveInput = {
    sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], history: [], now: NOW, availableMinutes: null,
    preferences: normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: {}, capacityByWeekday: [120, 120, 120, 120, 120, 240, 180], programmeSeen: [DERIV] }),
  };

  it("sans temps : phrase d'origine ; avec 20 min de khôlle : elle le mentionne, score inchangé", () => {
    const find = (input: NextMoveInput) => rankCandidates(input).find((c) => c.key === `jamais:${DERIV}`)!;
    const without = find(base);
    const withTime = find({ ...base, sessions: [session(DERIV, 20)] });
    expect(without.terms[1].reason).toBe("Aucune mesure d'oubli tant qu'il n'est pas dans Mémoire");
    expect(withTime.terms[1].reason).toMatch(/20\s?min.*chronométrées/);
    expect(withTime.score).toBe(without.score);
  });
});

describe("séances de khôlle", () => {
  const end = new Date(2026, 8, 24, 11, 0);
  it("une séance par chapitre, rattachée à son chapitre, bout à bout", () => {
    const out = khollePracticeSessions(
      [
        { subject: "Mathématiques", chapterId: DERIV, seconds: 120 },
        { subject: "Mathématiques", chapterId: "m1-reels-suites", seconds: 180 },
        { subject: "Mathématiques", chapterId: DERIV, seconds: 60 },
      ],
      end
    );
    expect(out.map((s) => [s.chapter_id, s.duration_seconds])).toEqual([[DERIV, 180], ["m1-reels-suites", 180]]);
    expect(new Date(out[1].ended_at!).getTime()).toBe(new Date(out[0].started_at).getTime());
  });
  it("moins d'une minute au total sur un chapitre : pas de séance", () => {
    expect(khollePracticeSessions([{ subject: "Mathématiques", chapterId: DERIV, seconds: 40 }], end)).toEqual([]);
  });
});
