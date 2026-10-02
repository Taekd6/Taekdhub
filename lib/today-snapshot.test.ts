import { describe, expect, it } from "vitest";
import { createChapter } from "@/lib/chapter-memory";
import { buildTodaySnapshot } from "@/lib/today-snapshot";

const NOW = new Date(2026, 9, 2, 18, 0);

describe("get_today — l'état du jour pour Claude", () => {
  it("ne lève pas sur des collections absentes ou abîmées", () => {
    const snapshot = buildTodaySnapshot({ sessions: "abîmé", workItems: null }, null, NOW);
    expect(snapshot.date).toBe("2026-10-02");
    expect(snapshot.echeances).toEqual([]);
    expect(snapshot.annales.total).toBe(0);
    expect(snapshot.annales.chapitres_qui_bloquent).toEqual([]);
  });

  it("remonte l'échéance, le chapitre qui s'efface et l'annale qui bloque", () => {
    const chapter = createChapter({ subject: "Physique", title: "Électrostatique", learnedAt: "2026-06-01" }, new Date(2026, 5, 1, 12), "elec");
    const snapshot = buildTodaySnapshot(
      {
        workItems: [
          {
            id: "ds",
            title: "DS 2",
            kind: "ds",
            subject: "Mathématiques",
            estimatedMinutes: 180,
            dueDate: "2026-10-05",
            status: "à faire",
            createdAt: "2026-09-20T08:00:00.000Z",
          },
        ],
        chapterMemory: [chapter],
      },
      [{ id: "a1", created_at: new Date(2026, 9, 1, 15).toISOString(), matiere: "maths", chapitre: "Réduction", resultat: "échec", indices: 2, source: "Mines 2023" }],
      NOW
    );
    expect(snapshot.echeances[0]).toMatchObject({ titre: "DS 2", matiere: "Mathématiques", dans_jours: 3 });
    expect(snapshot.chapitres_qui_s_effacent[0]).toMatchObject({ chapitre: "Électrostatique", matiere: "Physique" });
    expect(snapshot.annales.chapitres_qui_bloquent[0]).toMatchObject({ chapitre: "Réduction", echecs: 1, source: "Mines 2023" });
    expect(snapshot.prochain_mouvement).not.toBeNull();
    expect(snapshot.prochain_mouvement!.pourquoi.length).toBeGreaterThan(0);
  });
});
