import { describe, expect, it } from "vitest";
import { buildToday, MAX_LINES } from "@/lib/today-view";
import type { ChapterNotes } from "@/lib/chapter-notes";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ErrorEntry, WorkItem } from "@/lib/storage";
import { completeWorkItem, createWorkItem } from "@/lib/work-items";

const NOW = new Date("2026-10-24T10:00:00");
const STAMP = "2026-10-24T10:00:00.000Z";
const item = (title: string, dueDate: string | null, extra: { kind?: WorkItem["kind"]; dueTime?: string | null; important?: boolean } = {}): WorkItem =>
  createWorkItem({ title, kind: extra.kind ?? "autre", subject: null, estimatedMinutes: 30, dueDate, dueTime: extra.dueTime ?? null, important: extra.important }, NOW);
const error = (id: string, chapter: string, date = "2026-10-20") => ({ id, date, createdAt: STAMP, programmeChapterId: chapter }) as unknown as ErrorEntry;
const notes = (id: string, cours: string | null): ChapterNotes => ({ id, cours, methodes: [], updatedAt: STAMP });
const anki = (takenAt: string, due: number): AnkiSnapshot => ({ id: "anki-manuel:x", day: takenAt.slice(0, 10), takenAt, source: "manuel", decks: [], reviewsByDay: [], manual: { due, reviewedToday: null } });

const view = (over: Partial<Parameters<typeof buildToday>[0]> = {}) => buildToday({ workItems: [], errors: [], chapterNotes: [], ankiSnapshots: [], currentChapterIds: [], now: NOW, ...over });

describe("buildToday — échéances", () => {
  it("montre les échéances des 14 prochains jours, les plus proches d'abord, avec leur raison", () => {
    const result = view({ workItems: [item("DS de maths", "2026-10-29", { kind: "ds", dueTime: "08:00" }), item("Colle", "2026-10-25", { kind: "colle" }), item("Aujourd'hui", "2026-10-24")] });
    expect(result.lines.map((line) => [line.title, line.why, line.urgent])).toEqual([
      ["Aujourd'hui", "Autre · aujourd'hui", true],
      ["Colle", "Colle · demain", true],
      ["DS de maths", "DS · dans 5 jours à 08:00", false],
    ]);
  });

  it("n'affiche pas ce qui est trop lointain, sans date, terminé, ou en retard depuis plus d'une semaine", () => {
    const fait = item("fait", "2026-10-25");
    const result = view({ workItems: [item("loin", "2026-11-08"), item("sans date", null), ...completeWorkItem([fait], fait.id, NOW), item("très en retard", "2026-10-10")] });
    expect(result.lines).toEqual([]);
  });

  it("garde un retard récent, signalé comme urgent", () => {
    const result = view({ workItems: [item("DM", "2026-10-22", { kind: "dm" })] });
    expect(result.lines[0]).toMatchObject({ title: "DM", why: "DM · en retard de 2 jours", urgent: true });
  });

  it("limite à 3 échéances, et met l'important avant à date égale", () => {
    const result = view({ workItems: [item("a", "2026-10-26"), item("b", "2026-10-26", { important: true }), item("c", "2026-10-27"), item("d", "2026-10-28")] });
    expect(result.lines.map((line) => line.title)).toEqual(["b", "a", "c"]);
  });
});

describe("buildToday — chapitres en cours", () => {
  it("n'utilise que les chapitres en cours : les erreurs des autres sont ignorées", () => {
    const result = view({ currentChapterIds: ["m2-reduction"], errors: [error("1", "m2-reduction"), error("2", "m2-reduction", "2026-10-22"), error("3", "m2-euclidiens")], chapterNotes: [notes("m2-reduction", "# Cours")] });
    expect(result.lines.map((line) => [line.kind, line.href])).toEqual([
      ["erreurs", "/chapitre/m2-reduction"],
      ["chapitre", "/chapitre/m2-reduction"],
    ]);
    expect(result.lines[0].why).toBe("2 erreurs notées, la plus récente du 22/10/2026");
    expect(result.lines[1]).toMatchObject({ title: expect.stringContaining("Revoir le cours"), why: "chapitre en cours, cours rangé" });
  });

  it("dit quand le cours n'est pas rangé, et n'invente pas d'erreur absente", () => {
    const result = view({ currentChapterIds: ["m2-reduction"] });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ kind: "chapitre", title: expect.stringContaining("Ranger le cours"), why: expect.stringContaining("pas encore rangé") });
  });

  it("écarte un identifiant inconnu et réclame un chapitre quand il n'y en a aucun de valide", () => {
    expect(view({ currentChapterIds: ["n-importe-quoi"] })).toMatchObject({ lines: [], needsChapter: true });
    expect(view({ currentChapterIds: ["m2-reduction"] }).needsChapter).toBe(false);
  });

  it("met les échéances avant les erreurs et les chapitres, et ne dépasse jamais MAX_LINES", () => {
    const many = ["m2-reduction", "m2-euclidiens", "m2-series-compl"];
    const result = view({
      currentChapterIds: many,
      errors: many.map((id, index) => error(String(index), id)),
      workItems: [item("a", "2026-10-25"), item("b", "2026-10-26"), item("c", "2026-10-27")],
    });
    expect(result.lines).toHaveLength(MAX_LINES);
    expect(result.lines.slice(0, 3).every((line) => line.kind === "echeance")).toBe(true);
    expect(result.lines[3].kind).toBe("erreurs");
  });
});

describe("buildToday — Anki, ligne à part", () => {
  it("aucun relevé : pas de ligne", () => {
    expect(view().anki).toBeNull();
  });

  it("relevé du jour : à jour", () => {
    expect(view({ ankiSnapshots: [anki("2026-10-24T08:00:00", 40)] }).anki).toEqual({ due: 40, day: "2026-10-24", stale: false, ageLabel: "aujourd'hui" });
  });

  it("vieux relevé : signalé comme ancien, avec son âge", () => {
    expect(view({ ankiSnapshots: [anki("2026-10-04T18:00:00", 721)] }).anki).toEqual({ due: 721, day: "2026-10-04", stale: true, ageLabel: "il y a 20 jours" });
  });

  it("ne touche pas aux lignes du plan", () => {
    expect(view({ ankiSnapshots: [anki("2026-10-24T08:00:00", 40)] }).lines).toEqual([]);
  });
});
