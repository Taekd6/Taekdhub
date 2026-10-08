import { describe, expect, it } from "vitest";
import { createChapter } from "@/lib/chapter-memory";
import { addLockCards } from "@/lib/course-lock";
import { createErrorEntry } from "@/lib/error-log";
import { computeNextMove, rankCandidates, topReasons, type MoveCandidate, type NextMoveInput } from "@/lib/next-move/engine";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, type ErrorType, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SCÉNARIOS DE RÉFÉRENCE DU BARÈME NEXT MOVE.
 *
 * Six élèves typiques, et ce que le moteur leur propose : la première
 * proposition, puis les trois premières du classement. Ces tests FIGENT le
 * classement : toute modification du barème qui en change un doit le faire
 * exprès, et dire pourquoi dans le test.
 *
 * Ils ne vérifient pas un poids précis (les tests de lib/next-move/engine.test.ts
 * le font) : ils vérifient ce que l'élève VOIT.
 */

/** Jeudi 24 septembre 2026, 19 h 12. */
const NOW = new Date(2026, 8, 24, 19, 12);
const NO_EVENING: Preferences["eveningMinimums"] = [{}, {}, {}, {}, {}, {}, {}];
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ eveningMinimums: NO_EVENING, weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [120, 120, 120, 120, 120, 240, 180], ...overrides });
}

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return { sessions: [], workItems: [], grades: [], reviewItems: [], errors: [], checkins: [], chapterMemory: [], preferences: prefs(), history: [], now: NOW, availableMinutes: null, ...overrides };
}

function workItem(overrides: Partial<WorkItem>): WorkItem {
  return { id: "w", title: "DM", kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: "2026-09-25", dueTime: null, status: "à faire", important: false, notBeforeDate: null, chapterIds: [], createdAt: "2026-09-20T08:00:00.000Z", completedAt: null, postponements: [], ...overrides } as WorkItem;
}

const chapter = (subject: Subject, title: string, learnedAt: string, id: string) => createChapter({ subject, title, learnedAt }, new Date(`${learnedAt}T12:00:00`), id);
const error = (subject: Subject, type: ErrorType, date: string) => createErrorEntry({ subject, type, date, source: "exercice", description: `Erreur ${type} ${date}` }, NOW)!;
const cards = (subject: Subject, count: number) =>
  Array.from({ length: count }, (_, index) => ({ ...createReviewItem({ subject, text: `Carte ${index}`, kind: "à apprendre" }, new Date(2026, 8, 20))!, id: `${subject}-${index}` }));
const session = (subject: Subject, minutes: number, start: Date): WorkSession => ({
  id: `s-${start.getTime()}`, subject, exercise_id: null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
  duration_seconds: minutes * 60, note: null, created_at: start.toISOString(), result: null, hints_used: null, work_item_id: null,
});

const top = (candidates: MoveCandidate[], count = 3) => candidates.slice(0, count).map((candidate) => candidate.key);

/* ── Les six élèves ──────────────────────────────────────────────── */

const ELEC = chapter("Physique", "Électrostatique", "2026-08-15", "elec");
const SERIES = chapter("Mathématiques", "Séries", "2026-08-25", "series");
const DS_TOMORROW = workItem({ id: "ds", kind: "ds", title: "DS 2", subject: "Physique", dueDate: "2026-09-25", estimatedMinutes: 30, scope: { chapterIds: ["elec"], updatedAt: "2026-09-24T08:00:00.000Z" } } as Partial<WorkItem>);
const DM_TOMORROW = workItem({ id: "dm", title: "DM 5", subject: "Mathématiques", dueDate: "2026-09-25" });

const STUDENTS: Record<string, NextMoveInput> = {
  "1. nouvel élève, rien saisi": input(),
  "2. DM pour demain, un chapitre qui s'efface, des erreurs": input({
    workItems: [DM_TOMORROW],
    chapterMemory: [SERIES],
    errors: [error("Physique", "méthode", "2026-09-23"), error("Physique", "méthode", "2026-09-22"), error("Physique", "calcul", "2026-09-20")],
  }),
  "3. DS de physique demain (Électrostatique au programme) et DM de maths demain": input({ workItems: [DS_TOMORROW, DM_TOMORROW], chapterMemory: [ELEC] }),
  "4. soir de minimum, cartes dues, erreurs de physique": input({
    preferences: prefs({ eveningMinimums: [{}, {}, {}, { Mathématiques: 90 }, {}, {}, {}] }),
    reviewItems: cards("Physique", 6),
    errors: [error("Physique", "cours", "2026-09-23"), error("Physique", "cours", "2026-09-24")],
  }),
  "5. fatigué (check-in), DM dans 5 jours, cartes dues": input({
    checkins: [{ date: "2026-09-24", sleepHours: 5, energy: 2, stress: 4, updatedAt: "2026-09-24T07:00:00.000Z" } as never],
    workItems: [workItem({ id: "dm5", title: "DM 6", dueDate: "2026-09-29", estimatedMinutes: 180 })],
    reviewItems: cards("Anglais", 8),
  }),
  "6. DM en retard, chapitre verrouillé, 2 h de maths déjà faites": input({
    workItems: [workItem({ id: "late", title: "DM 4", dueDate: "2026-09-22", estimatedMinutes: 90, subject: "Physique" })],
    reviewItems: (() => {
      const added = addLockCards([], [{ matiere: "maths", chapitre: "Réduction", recto: "Critère de diagonalisabilité ?", verso: "π scindé à racines simples" }], new Date(2026, 8, 23, 18));
      return added.ok ? added.items : [];
    })(),
    sessions: [session("Mathématiques", 120, new Date(2026, 8, 24, 16, 30))],
  }),
};

describe("ce que chaque élève voit (classement figé)", () => {
  it.each(Object.entries(STUDENTS))("%s", (_, student) => {
    expect({ primary: computeNextMove(student).primary?.key ?? null, top: top(rankCandidates(student)) }).toMatchSnapshot();
  });
});

describe("règles du barème", () => {
  it("le score reste exactement la somme des termes affichés, pour tous les candidats de tous les élèves", () => {
    for (const student of Object.values(STUDENTS)) {
      for (const candidate of rankCandidates(student)) expect(candidate.score).toBe(candidate.terms.reduce((sum, term) => sum + term.points, 0));
    }
  });

  it("au plus deux raisons montrées sur la carte", () => {
    for (const student of Object.values(STUDENTS)) {
      for (const candidate of rankCandidates(student)) expect(topReasons(candidate).length).toBeLessThanOrEqual(2);
    }
  });

  it("une épreuve proche n'est comptée qu'une fois sur un même candidat", () => {
    for (const student of Object.values(STUDENTS)) {
      for (const candidate of rankCandidates(student)) {
        const ids = candidate.terms.map((term) => term.id);
        expect(ids.includes("au-programme") && ids.includes("évaluation-proche")).toBe(false);
      }
    }
  });

  it("l'oubli d'un chapitre n'est compté qu'une fois : « s'efface » et « au programme » ne s'additionnent pas pour la mémoire", () => {
    const recall = rankCandidates(STUDENTS["3. DS de physique demain (Électrostatique au programme) et DM de maths demain"]).find((candidate) => candidate.key === "rappel:elec")!;
    const memory = recall.terms.filter((term) => term.id === "oubli" || term.id === "au-programme");
    // Oubli seul (42), au programme seul (52 de mémoire + 20 pour « demain ») : on garde le plus fort des deux constats sur la mémoire.
    expect(memory.reduce((sum, term) => sum + term.points, 0)).toBe(72);
  });
});
