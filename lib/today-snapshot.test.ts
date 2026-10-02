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

describe("get_today — diagnostic, à refaire, Anki", () => {
  it("donne le point faible établi, les exercices à refaire et l'âge du relevé Anki", () => {
    const attempts = ["2026-09-20", "2026-09-24", "2026-09-28"].map((day, index) => ({
      id: `t${index}`,
      exerciseKey: `ds:g:q${index}`,
      label: `DS 1 — Q${index}`,
      subject: "Mathématiques",
      chapterId: "m2-reduction",
      origin: "ds",
      day,
      createdAt: `${day}T12:00:00.000Z`,
      updatedAt: `${day}T12:00:00.000Z`,
      result: "échec",
      help: "sans",
      cause: "méthode",
      lackOfTime: false,
    }));
    const snapshot = { day: "2026-10-02", takenAt: new Date(2026, 9, 2, 8).toISOString(), source: "manuel", manual: { due: 37, reviewedToday: 10 } };
    const today = buildTodaySnapshot({ attempts, ankiSnapshots: [snapshot] }, null, NOW);
    // Trois échecs « méthode » d'une seule source : un signal (il en faut 4, ou 2 sources, pour « établi »).
    expect(today.point_faible_principal[0]).toMatchObject({ chapitre: "Réduction des endomorphismes", constat: "Méthode mal assimilée", niveau: "signal" });
    expect(today.a_refaire_sans_aide.length).toBe(3);
    expect(today.anki.cartes_dues).toMatchObject({ nombre: 37, source: "manuel", attention: "chiffre du relevé, pas en temps réel" });
    expect(today.prochain_mouvement?.termine_quand).toBeTruthy();
  });
});
