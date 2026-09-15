import { describe, expect, it } from "vitest";
import { computeNextAction, rankOpenTasks, scoreTask } from "@/lib/domain/priority";
import { completeTask, scheduleTask } from "@/lib/domain/tasks";
import { at, makeEntry, makeState, makeTask, NOW, slot } from "./fixtures";

function rankTitles(state: ReturnType<typeof makeState>) {
  return rankOpenTasks(state, NOW).map((item) => item.task.title);
}

describe("score", () => {
  it("une tâche en retard passe devant la même tâche à échéance lointaine", () => {
    const late = makeTask({ title: "retard", dueAt: at(-2), estimatedMinutes: 60 });
    const far = makeTask({ title: "loin", dueAt: at(10), estimatedMinutes: 60 });
    expect(scoreTask(late, [], NOW).score).toBeGreaterThan(scoreTask(far, [], NOW).score);
  });

  it("à échéance égale, la tâche la plus LOURDE est la plus urgente", () => {
    const heavy = makeTask({ title: "DM 3 h", dueAt: at(2), estimatedMinutes: 180 });
    const light = makeTask({ title: "relire 20 min", dueAt: at(2), estimatedMinutes: 20 });
    expect(scoreTask(heavy, [], NOW).score).toBeGreaterThan(scoreTask(light, [], NOW).score);
  });

  it("à charge égale, l'échéance la plus proche gagne", () => {
    const soon = makeTask({ title: "demain", dueAt: at(1), estimatedMinutes: 60 });
    const later = makeTask({ title: "dans 5 jours", dueAt: at(5), estimatedMinutes: 60 });
    expect(scoreTask(soon, [], NOW).score).toBeGreaterThan(scoreTask(later, [], NOW).score);
  });

  it("la priorité déclarée départage deux tâches identiques", () => {
    const high = makeTask({ title: "haute", dueAt: at(3), estimatedMinutes: 60, priority: 4 });
    const low = makeTask({ title: "basse", dueAt: at(3), estimatedMinutes: 60, priority: 1 });
    expect(scoreTask(high, [], NOW).score).toBeGreaterThan(scoreTask(low, [], NOW).score);
  });

  it("une tâche reportée plusieurs fois finit par remonter", () => {
    const base = makeTask({ title: "reportée", estimatedMinutes: 30 });
    const postponed = { ...base, postponedCount: 4 };
    expect(scoreTask(postponed, [], NOW).score).toBeGreaterThan(scoreTask(base, [], NOW).score);
  });

  it("une tâche commencée passe devant une tâche identique pas encore ouverte", () => {
    const started = { ...makeTask({ title: "en cours", dueAt: at(3) }), status: "doing" as const };
    const fresh = makeTask({ title: "pas commencée", dueAt: at(3) });
    expect(scoreTask(started, [], NOW).score).toBeGreaterThan(scoreTask(fresh, [], NOW).score);
  });

  it("explique toujours pourquoi la tâche est là", () => {
    const scored = scoreTask(makeTask({ dueAt: at(-1), priority: 4 }), [], NOW);
    expect(scored.reasons).toContain("Échéance dépassée depuis hier");
    expect(scored.reasons).toContain("Priorité critique");
  });

  it("tient compte du travail déjà fait : une tâche presque finie est moins pressante", () => {
    const task = makeTask({ title: "presque finie", dueAt: at(2), estimatedMinutes: 180 });
    const fresh = makeTask({ title: "intacte", dueAt: at(2), estimatedMinutes: 180 });
    const entries = [makeEntry(150, { taskId: task.id })];
    expect(scoreTask(task, entries, NOW).score).toBeLessThan(scoreTask(fresh, [], NOW).score);
  });
});

describe("classement", () => {
  it("ne classe que les tâches ouvertes", () => {
    const state = makeState({ tasks: [makeTask({ title: "ouverte" }), completeTask(makeTask({ title: "faite" }), NOW)] });
    expect(rankTitles(state)).toEqual(["ouverte"]);
  });

  it("place en tête le retard, puis l'échéance proche, puis le reste", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "fond", estimatedMinutes: 45 }),
        makeTask({ title: "vendredi", dueAt: at(4), estimatedMinutes: 120 }),
        makeTask({ title: "retard", dueAt: at(-1), estimatedMinutes: 60 }),
      ],
    });
    expect(rankTitles(state)[0]).toBe("retard");
    expect(rankTitles(state)[2]).toBe("fond");
  });
});

describe("prochaine action", () => {
  it("dit clairement quoi faire, avec une justification chiffrée", () => {
    const state = makeState({ tasks: [makeTask({ title: "DM de physique", dueAt: at(1), estimatedMinutes: 120 })] });
    const action = computeNextAction(state, { now: NOW });
    expect(action.kind).toBe("now");
    expect(action.title).toBe("DM de physique");
    expect(action.rationale).toContain("demain");
  });

  it("distingue « aucune tâche » de « tout est fait »", () => {
    expect(computeNextAction(makeState(), { now: NOW }).kind).toBe("empty");
    const allDone = makeState({ tasks: [completeTask(makeTask(), NOW)] });
    expect(computeNextAction(allDone, { now: NOW }).kind).toBe("done-for-today");
  });

  it("ne propose « ensuite » que ce qui tient dans le temps restant", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "maintenant", dueAt: at(1), estimatedMinutes: 45 }),
        makeTask({ title: "trop longue", dueAt: at(2), estimatedMinutes: 180 }),
        makeTask({ title: "courte", dueAt: at(2), estimatedMinutes: 20 }),
      ],
    });
    const action = computeNextAction(state, { now: NOW, remainingCapacityMinutes: 90 });
    expect(action.title).toBe("maintenant");
    expect(action.next.map((item) => item.task.title)).toEqual(["courte"]);
    // Ce qui ne tient pas dans la soirée n'est pas proposé « ensuite » — il
    // reste visible dans « plus tard », jamais promis pour ce soir.
    expect(action.later.map((item) => item.task.title)).toContain("trop longue");
  });

  it("fait remonter ce qui est prévu aujourd'hui", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "sans créneau", estimatedMinutes: 60 }),
        scheduleTask(makeTask({ title: "prévue ce soir", estimatedMinutes: 60 }), [slot(0, "18:00", 60)]),
      ],
    });
    expect(computeNextAction(state, { now: NOW }).title).toBe("prévue ce soir");
  });
});

describe("évaluations et lisibilité", () => {
  /**
   * L'écran principal proposait « MAINTENANT : DS de maths — environ 80 min
   * par jour si tu l'étales ». On ne commence pas un DS : c'est un rendez-vous.
   */
  it("ne propose JAMAIS une évaluation comme « ce que tu fais maintenant »", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "DS de maths", category: "eval-ds", estimatedMinutes: 240, dueAt: at(3, "08:00"), priority: 4 }),
        makeTask({ title: "Réviser pour le DS", category: "org-preparation", estimatedMinutes: 180, dueAt: at(2) }),
      ],
    });
    const action = computeNextAction(state, { now: NOW });
    expect(action.title).toBe("Réviser pour le DS");
    expect(action.next.some((item) => item.task.category === "eval-ds")).toBe(false);
  });

  it("les fait remonter séparément, comme rendez-vous à venir", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "Khôlle de physique", category: "eval-kholle", dueAt: at(1, "14:00") }),
        makeTask({ title: "DS de maths", category: "eval-ds", dueAt: at(4, "08:00") }),
        makeTask({ title: "TD", estimatedMinutes: 60, dueAt: at(2) }),
      ],
    });
    const action = computeNextAction(state, { now: NOW });
    expect(action.upcomingEvents.map((item) => item.task.title)).toEqual(["Khôlle de physique", "DS de maths"]);
  });

  it("n'affiche « tout est fait » que s'il ne reste vraiment aucun travail", () => {
    const onlyEvents = makeState({ tasks: [makeTask({ title: "DS", category: "eval-ds", dueAt: at(2) })] });
    const action = computeNextAction(onlyEvents, { now: NOW });
    expect(action.kind).toBe("done-for-today");
    expect(action.upcomingEvents).toHaveLength(1);
  });

  it("écrit les durées comme on les dit — jamais « 600 min »", () => {
    const state = makeState({ tasks: [makeTask({ title: "Annales", estimatedMinutes: 600, dueAt: at(1, "23:59") })] });
    const action = computeNextAction(state, { now: NOW });
    expect(action.rationale).toContain("10 h");
    expect(action.rationale).not.toContain("600 min");
  });

  /**
   * L'écran promettait « ensuite, apprendre le chapitre 3 » alors que le
   * calendrier la plaçait demain : deux réponses différentes à la même
   * question, dans la même application.
   */
  it("ne propose pas « ensuite » une tâche déjà posée un autre jour", () => {
    const state = makeState({
      tasks: [
        makeTask({ title: "maintenant", estimatedMinutes: 45, dueAt: at(1) }),
        scheduleTask(makeTask({ title: "prévue demain", estimatedMinutes: 45, dueAt: at(2) }), [slot(1, "18:00", 45)]),
        makeTask({ title: "libre", estimatedMinutes: 30, dueAt: at(3) }),
      ],
    });
    const action = computeNextAction(state, { now: NOW });
    expect(action.next.map((item) => item.task.title)).not.toContain("prévue demain");
    expect(action.next.map((item) => item.task.title)).toContain("libre");
  });
});
