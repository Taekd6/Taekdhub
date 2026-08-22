import { describe, expect, it } from "vitest";
import {
  addDeadline,
  chapterDeadlineSignals,
  daysUntilDeadline,
  deadlineChapterLabels,
  deadlineLabel,
  nearestDeadlineForSubject,
  removeDeadline,
  updateDeadline,
  upcomingDeadlines,
} from "@/lib/deadlines";
import type { Chapter, Deadline } from "@/lib/storage";

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: "d-1",
    type: "DS",
    subject: "Mathématiques",
    date: "2026-08-28",
    title: "DS de rentrée",
    chapterIds: ["c-continuite"],
    ...overrides,
  };
}

// 2026-08-24 est un lundi.
const MONDAY = new Date("2026-08-24T09:00:00.000Z");

describe("addDeadline / removeDeadline / updateDeadline", () => {
  it("addDeadline génère un id et ajoute en fin de liste", () => {
    const result = addDeadline([], { type: "DS", subject: "Mathématiques", date: "2026-08-28", title: "DS", chapterIds: [] });
    expect(result).toHaveLength(1);
    expect(typeof result[0].id).toBe("string");
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it("removeDeadline retire uniquement l'échéance visée", () => {
    const deadlines = [makeDeadline({ id: "d-1" }), makeDeadline({ id: "d-2" })];
    expect(removeDeadline(deadlines, "d-1").map((d) => d.id)).toEqual(["d-2"]);
  });

  it("updateDeadline modifie seulement les champs fournis", () => {
    const deadlines = [makeDeadline({ id: "d-1", title: "DS" })];
    const updated = updateDeadline(deadlines, "d-1", { title: "DS reporté" });
    expect(updated[0].title).toBe("DS reporté");
    expect(updated[0].date).toBe("2026-08-28");
  });
});

describe("daysUntilDeadline", () => {
  it("calcule le nombre de jours entiers jusqu'à une date future", () => {
    expect(daysUntilDeadline("2026-08-28", MONDAY)).toBe(4);
  });

  it("une date passée renvoie un nombre négatif (contrairement à daysUntilContest)", () => {
    expect(daysUntilDeadline("2026-08-20", MONDAY)).toBe(-4);
  });

  it("aujourd'hui → 0", () => {
    expect(daysUntilDeadline("2026-08-24", MONDAY)).toBe(0);
  });

  it("date absente ou invalide → null", () => {
    expect(daysUntilDeadline("", MONDAY)).toBeNull();
    expect(daysUntilDeadline("pas une date", MONDAY)).toBeNull();
  });
});

describe("upcomingDeadlines", () => {
  it("exclut les échéances déjà passées", () => {
    const deadlines = [makeDeadline({ id: "d-past", date: "2026-08-20" }), makeDeadline({ id: "d-future", date: "2026-08-28" })];
    const result = upcomingDeadlines(deadlines, MONDAY);
    expect(result.map((entry) => entry.deadline.id)).toEqual(["d-future"]);
  });

  it("trie de la plus proche à la plus lointaine", () => {
    const deadlines = [makeDeadline({ id: "d-far", date: "2026-09-15" }), makeDeadline({ id: "d-near", date: "2026-08-26" })];
    const result = upcomingDeadlines(deadlines, MONDAY);
    expect(result.map((entry) => entry.deadline.id)).toEqual(["d-near", "d-far"]);
  });

  it("exclut une échéance à date invalide, sans planter", () => {
    const deadlines = [makeDeadline({ date: "corrompu" })];
    expect(upcomingDeadlines(deadlines, MONDAY)).toEqual([]);
  });
});

describe("nearestDeadlineForSubject", () => {
  it("retourne la plus proche échéance à venir pour cette matière", () => {
    const deadlines = [
      makeDeadline({ id: "d-maths", subject: "Mathématiques", date: "2026-08-28" }),
      makeDeadline({ id: "d-physique", subject: "Physique", date: "2026-08-26" }),
    ];
    expect(nearestDeadlineForSubject(deadlines, "Physique", MONDAY)?.deadline.id).toBe("d-physique");
  });

  it("null si aucune échéance à venir pour cette matière", () => {
    expect(nearestDeadlineForSubject([makeDeadline({ subject: "Mathématiques" })], "Chimie", MONDAY)).toBeNull();
  });
});

describe("deadlineLabel", () => {
  it("formule un libellé adapté selon le type et l'échéance (aujourd'hui/demain/dans N j)", () => {
    expect(deadlineLabel(makeDeadline({ type: "DS", subject: "Mathématiques" }), 3)).toBe("ton DS de Mathématiques dans 3 j");
    expect(deadlineLabel(makeDeadline({ type: "khôlle", subject: "Physique" }), 1)).toBe("ta khôlle de Physique demain");
    expect(deadlineLabel(makeDeadline({ type: "autre" }), 0)).toContain("aujourd'hui");
  });
});

describe("chapterDeadlineSignals", () => {
  it("associe un chapitre à l'échéance la plus proche qui le concerne", () => {
    const deadlines = [
      makeDeadline({ id: "d-1", date: "2026-08-30", chapterIds: ["c-1"] }),
      makeDeadline({ id: "d-2", date: "2026-08-26", chapterIds: ["c-1"] }), // plus proche
    ];
    const signals = chapterDeadlineSignals(deadlines, MONDAY);
    expect(signals.get("c-1")?.days).toBe(2);
  });

  it("une échéance trop lointaine (au-delà de l'horizon) n'apparaît pas dans le signal", () => {
    const deadlines = [makeDeadline({ date: "2026-09-30", chapterIds: ["c-1"] })];
    expect(chapterDeadlineSignals(deadlines, MONDAY).has("c-1")).toBe(false);
  });

  it("une échéance passée n'apparaît jamais dans le signal", () => {
    const deadlines = [makeDeadline({ date: "2026-08-01", chapterIds: ["c-1"] })];
    expect(chapterDeadlineSignals(deadlines, MONDAY).has("c-1")).toBe(false);
  });

  it("plusieurs chapitres d'une même échéance reçoivent tous le signal", () => {
    const deadlines = [makeDeadline({ date: "2026-08-28", chapterIds: ["c-1", "c-2", "c-3"] })];
    const signals = chapterDeadlineSignals(deadlines, MONDAY);
    expect(signals.has("c-1")).toBe(true);
    expect(signals.has("c-2")).toBe(true);
    expect(signals.has("c-3")).toBe(true);
  });

  it("aucune échéance → Map vide, jamais une erreur", () => {
    expect(chapterDeadlineSignals([], MONDAY).size).toBe(0);
  });
});

describe("deadlineChapterLabels", () => {
  const chapters: Chapter[] = [
    { id: "c-1", subject: "Mathématiques", label: "Continuité" },
    { id: "c-2", subject: "Mathématiques", label: "Dérivation" },
  ];

  it("résout les chapterIds en libellés, dans l'ordre", () => {
    expect(deadlineChapterLabels(makeDeadline({ chapterIds: ["c-2", "c-1"] }), chapters)).toEqual(["Dérivation", "Continuité"]);
  });

  it("un chapterId sans chapitre correspondant (supprimé depuis) est simplement omis", () => {
    expect(deadlineChapterLabels(makeDeadline({ chapterIds: ["c-1", "c-deleted"] }), chapters)).toEqual(["Continuité"]);
  });
});
