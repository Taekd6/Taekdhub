import { describe, expect, it } from "vitest";
import { buildSnapshot } from "@/lib/agent/snapshot";
import { completeTask, scheduleTask } from "@/lib/domain/tasks";
import { computeWorkload } from "@/lib/domain/workload";
import { rankOpenTasks } from "@/lib/domain/priority";
import { at, makeEntry, makeState, makeTask, NOW, slot } from "@/lib/domain/__tests__/fixtures";

/**
 * L'instantané agent n'a qu'une seule obligation, mais elle est absolue : dire
 * EXACTEMENT ce que l'écran dit. Un agent qui annonce une charge différente de
 * celle affichée rend les deux inutilisables.
 */
describe("instantané pour un agent", () => {
  const task = scheduleTask(makeTask({ title: "DM de physique", subjectId: "physique", estimatedMinutes: 180, dueAt: at(3) }), [
    slot(1, "18:00", 90),
  ]);
  const state = makeState({ tasks: [task], timeEntries: [makeEntry(60, { taskId: task.id, subjectId: "physique" })] });

  it("reprend les chiffres de charge SANS les recalculer autrement", () => {
    const snapshot = buildSnapshot(state, NOW);
    const workload = computeWorkload(state, NOW, 7, NOW);
    expect(snapshot.workload.days.map((day) => day.plannedMinutes)).toEqual(workload.days.map((day) => day.plannedMinutes));
    expect(snapshot.workload.overdueMinutes).toBe(workload.overdueMinutes);
  });

  it("reprend le classement de priorisation, rang et raisons compris", () => {
    const snapshot = buildSnapshot(state, NOW);
    const ranked = rankOpenTasks(state, NOW);
    const first = snapshot.tasks.find((item) => item.rank === 1);
    expect(first?.id).toBe(ranked[0].task.id);
    expect(first?.reasons).toEqual(ranked[0].reasons);
  });

  it("donne le travail RESTANT, pas l'estimation brute", () => {
    const snapshot = buildSnapshot(state, NOW);
    const entry = snapshot.tasks.find((item) => item.id === task.id);
    expect(entry?.estimatedMinutes).toBe(180);
    expect(entry?.workedMinutes).toBe(60);
    expect(entry?.remainingMinutes).toBe(120);
  });

  it("embarque son propre schéma, pour être exploitable hors de l'application", () => {
    const snapshot = buildSnapshot(state, NOW);
    expect(Object.keys(snapshot.schema).length).toBeGreaterThan(5);
    expect(snapshot.schema["unités.durées"]).toContain("MINUTES");
    expect(snapshot.schema.principe).toContain("n'héberge aucun contenu");
  });

  it("n'emporte AUCUN champ intime : ni note, ni description, ni lien", () => {
    const personal = makeTask({
      title: "Revoir le chapitre 2",
      description: "je n'ai rien compris au cours de mardi",
      notes: "en parler au prof",
      sourceUrl: "https://exemple.test/fiche",
    });
    const serialized = JSON.stringify(buildSnapshot(makeState({ tasks: [personal] }), NOW));
    expect(serialized).toContain("Revoir le chapitre 2");
    expect(serialized).not.toContain("rien compris");
    expect(serialized).not.toContain("en parler au prof");
    expect(serialized).not.toContain("exemple.test");
  });

  it("garde les tâches ouvertes et le récemment terminé, pas l'historique entier", () => {
    const old = { ...completeTask(makeTask({ title: "vieille" }), NOW), completedAt: at(-90) };
    const recent = { ...completeTask(makeTask({ title: "récente" }), NOW), completedAt: at(-3) };
    const titles = buildSnapshot(makeState({ tasks: [old, recent] }), NOW).tasks.map((item) => item.title);
    expect(titles).toContain("récente");
    expect(titles).not.toContain("vieille");
  });

  it("décrit la capacité déclarée jour par jour", () => {
    const snapshot = buildSnapshot(state, NOW);
    expect(snapshot.capacity.weeklyPattern).toHaveLength(7);
    expect(snapshot.capacity.todayMinutes).toBe(240);
    expect(snapshot.capacity.weeklyPattern[0].ranges).toEqual(["18:00-22:00"]);
  });

  it("propose toujours une prochaine action, même quand il n'y a rien à faire", () => {
    const empty = buildSnapshot(makeState(), NOW);
    expect(empty.nextAction).not.toBeNull();
    expect(empty.nextAction?.rationale.length).toBeGreaterThan(0);
  });

  it("reste raisonnable en taille même avec beaucoup de tâches", () => {
    const many = makeState({
      tasks: Array.from({ length: 300 }, (_, index) => makeTask({ title: `Tâche ${index}`, dueAt: at(index % 30) })),
    });
    expect(JSON.stringify(buildSnapshot(many, NOW)).length).toBeLessThan(400_000);
  });
});

describe("ce dont un agent a besoin pour les questions réelles", () => {
  it("donne le temps encore utilisable AUJOURD'HUI, pas la journée entière", () => {
    // 20 h 00 un lundi : la soirée déclarée va de 18 h à 22 h.
    const evening = new Date(new Date(NOW).setHours(20, 0, 0, 0));
    const snapshot = buildSnapshot(makeState(), evening);
    expect(snapshot.capacity.todayMinutes).toBe(240);
    expect(snapshot.capacity.remainingTodayMinutes).toBe(120);
  });

  it("déduit les créneaux déjà posés du temps restant", () => {
    const state = makeState({ tasks: [scheduleTask(makeTask({ title: "prévu" }), [slot(0, "18:00", 60)])] });
    expect(buildSnapshot(state, NOW).capacity.remainingTodayMinutes).toBe(180);
  });

  it("sépare les rendez-vous du travail", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "DS de maths", category: "eval-ds", dueAt: at(3, "08:00") }),
        makeTask({ title: "TD", estimatedMinutes: 60, dueAt: at(2) }),
      ],
    });
    const snapshot = buildSnapshot(state, NOW);
    expect(snapshot.upcomingEvents.map((item) => item.title)).toEqual(["DS de maths"]);
    expect(snapshot.nextAction?.title).toBe("TD");
  });

  it("signale ce qui ne rentre pas, pour qu'un agent arbitre au lieu de planifier", () => {
    const state = makeState({ tasks: [makeTask({ title: "Annales", estimatedMinutes: 600, dueAt: at(1, "23:59") })] });
    const [item] = buildSnapshot(state, NOW).impossible;
    expect(item.title).toBe("Annales");
    expect(item.missingMinutes).toBeGreaterThan(0);
  });

  it("expose les routines", () => {
    const state = makeState({
      routines: [
        {
          id: "r1",
          title: "Bilan du dimanche",
          category: "org-bilan",
          priority: 2,
          rule: { kind: "weekly", weekdays: [6] },
          horizonDays: 7,
          active: true,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ],
    });
    expect(buildSnapshot(state, NOW).routines).toEqual([
      { title: "Bilan du dimanche", rule: "Dim", estimatedMinutes: undefined, active: true },
    ]);
  });
});
