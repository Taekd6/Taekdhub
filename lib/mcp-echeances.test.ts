import { describe, expect, it } from "vitest";
import { addEcheances, checkDate, deleteEcheance, listEcheances, updateEcheance, type EcheanceInput } from "@/lib/mcp-echeances";
import { mergeList } from "@/lib/sync/collections";
import { buildTodaySnapshot } from "@/lib/today-snapshot";
import type { WorkItem } from "@/lib/storage";

const NOW = new Date("2026-10-05T10:00:00");

const ds: EcheanceInput = { titre: "DS 3 — Électrocinétique", matiere: "physique", type: "DS", date: "2026-10-12", chapitres: ["Électrocinétique", "Ondes"] };
const colle: EcheanceInput = { titre: "Colle de maths", matiere: "maths", type: "colle", date: "2026-10-08", note: "salle B12" };

const chapters = [
  { id: "ch-elec", subject: "Physique", title: "Électrocinétique", learnedAt: "2026-09-10", reviews: [], archived: false, createdAt: "2026-09-10T08:00:00.000Z" },
];

function added(result: ReturnType<typeof addEcheances>) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("checkDate — une date d'échéance plausible", () => {
  it("accepte aujourd'hui et un jour réel à venir", () => {
    expect(checkDate("2026-10-05", "2026-10-05")).toBeNull();
    expect(checkDate("2027-02-28", "2026-10-05")).toBeNull();
  });

  it("refuse un format, un jour inexistant, une date passée ou à plus d'un an", () => {
    expect(checkDate("12/10/2026", "2026-10-05")).toMatch(/format/);
    expect(checkDate("2027-02-30", "2026-10-05")).toMatch(/n'existe pas/);
    expect(checkDate("2026-10-04", "2026-10-05")).toMatch(/déjà passé/);
    expect(checkDate("2062-10-12", "2026-10-05")).toMatch(/plus d'un an/);
  });
});

describe("addEcheances — écrire là où l'app lit déjà", () => {
  it("crée des WorkItem datés, en tête, sans toucher aux entrées existantes", () => {
    const existing = { id: "old", title: "DM 2", kind: "dm", dueDate: "2026-10-20", status: "à faire", champInconnu: 42 };
    const result = added(addEcheances([existing], [ds, colle], chapters, NOW));
    expect(result.items).toHaveLength(3);
    expect(result.items[2]).toBe(existing);
    const [first, second] = result.value.added;
    expect(first).toMatchObject({ kind: "ds", subject: "Physique", dueDate: "2026-10-12", status: "à faire", scope: { chapterIds: ["ch-elec"] }, note: "Chapitres : Ondes" });
    expect(second).toMatchObject({ kind: "colle", subject: "Mathématiques", note: "salle B12" });
    expect(result.value.unknownChapters).toEqual(["Ondes"]);
  });

  it("saute un doublon exact (même titre à la casse près, même jour), y compris dans le lot", () => {
    const first = added(addEcheances([], [ds], [], NOW));
    const again = added(addEcheances(first.items, [{ ...ds, titre: "ds 3 — electrocinetique" }, colle, colle], [], NOW));
    expect(again.value.added.map((item) => item.title)).toEqual(["Colle de maths"]);
    expect(again.value.duplicates).toHaveLength(2);
  });

  it("refuse tout le lot si une seule date est invalide", () => {
    const result = addEcheances([], [colle, { ...ds, date: "2026-13-01" }], [], NOW);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("rien n'a été ajouté") });
  });

  it("apparaît dans get_today avec son id", () => {
    const result = added(addEcheances([], [colle], [], NOW));
    const snapshot = buildTodaySnapshot({ workItems: result.items }, [], NOW);
    expect(snapshot.echeances).toEqual([expect.objectContaining({ id: result.value.added[0].id, titre: "Colle de maths", date: "2026-10-08", dans_jours: 3, note: "salle B12" })]);
  });
});

describe("updateEcheance / deleteEcheance", () => {
  const base = added(addEcheances([], [ds, colle], chapters, NOW));
  const dsId = base.value.added[0].id;

  it("ne change que les champs fournis et pose updatedAt", () => {
    const later = new Date("2026-10-06T09:00:00");
    const result = updateEcheance(base.items, dsId, { date: "2026-10-13" }, chapters, later);
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toMatchObject({ title: ds.titre, dueDate: "2026-10-13", updatedAt: later.toISOString(), note: "Chapitres : Ondes" });
  });

  it("la version modifiée gagne la fusion contre une copie d'appareil plus ancienne", () => {
    const result = updateEcheance(base.items, dsId, { titre: "DS 3 (décalé)" }, chapters, new Date("2026-10-06T09:00:00"));
    if (!result.ok) throw new Error(result.error);
    const merged = mergeList("workItems", base.items, result.items) as WorkItem[];
    expect(merged.find((item) => item.id === dsId)?.title).toBe("DS 3 (décalé)");
  });

  it("remplace les chapitres et garde la note libre", () => {
    const result = updateEcheance(base.items, dsId, { chapitres: ["Électrocinétique"], note: "calculatrice interdite" }, chapters, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.scope?.chapterIds).toEqual(["ch-elec"]);
    expect(result.value.note).toBe("calculatrice interdite");
  });

  it("refuse un id inconnu, une date passée, ou un doublon créé par la modification", () => {
    expect(updateEcheance(base.items, "nope", { titre: "x" }, [], NOW).ok).toBe(false);
    expect(updateEcheance(base.items, dsId, { date: "2026-10-01" }, [], NOW).ok).toBe(false);
    expect(updateEcheance(base.items, dsId, { titre: colle.titre, date: colle.date }, [], NOW).ok).toBe(false);
  });

  it("supprime en passant « abandonné » : la ligne reste, l'échéance disparaît des listes", () => {
    const result = deleteEcheance(base.items, dsId, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.items).toHaveLength(2);
    expect(result.value.status).toBe("abandonné");
    expect(listEcheances(result.items, chapters, NOW).map((entry) => entry.titre)).toEqual(["Colle de maths"]);
    expect(deleteEcheance(result.items, dsId, NOW).ok).toBe(false);
  });
});

describe("listEcheances", () => {
  it("à venir seulement, la plus proche d'abord, filtrables par horizon", () => {
    const base = added(addEcheances([{ id: "past", title: "DM passé", dueDate: "2026-10-01", status: "à faire" }], [ds, colle], chapters, NOW));
    const all = listEcheances(base.items, chapters, NOW);
    expect(all.map((entry) => [entry.titre, entry.type, entry.dans_jours])).toEqual([
      ["Colle de maths", "colle", 3],
      [ds.titre, "DS", 7],
    ]);
    expect(all[1].chapitres).toEqual(["Électrocinétique"]);
    expect(listEcheances(base.items, chapters, NOW, 5)).toHaveLength(1);
  });
});
