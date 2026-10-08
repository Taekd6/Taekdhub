import { describe, expect, it } from "vitest";
import { computeAlerts, pruneSnoozes, snoozeAlert, visibleAlerts, type AlertInput } from "@/lib/alerts";
import { addLockCards, lockKey } from "@/lib/course-lock";
import { createReviewItem } from "@/lib/review-items";
import { normalizePreferences, normalizeWorkItem, type ReviewItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Lundi 5 octobre 2026, heure locale. */
const at = (hour: number, day = 5) => new Date(2026, 9, day, hour, 0);

function session(subject: Subject, minutes: number, start: Date): WorkSession {
  return { id: `s-${start.getTime()}-${subject}`, subject, exercise_id: null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(), duration_seconds: minutes * 60, note: null, created_at: start.toISOString(), result: null, hints_used: null, work_item_id: null };
}

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    sessions: [session("Physique", 30, at(10, 4))],
    workItems: [],
    reviewItems: [],
    // Aucun minimum du soir, sauf quand un test l'ajoute.
    preferences: normalizePreferences({ eveningMinimums: [{}, {}, {}, {}, {}, {}, {}] }),
    now: at(10),
    ...overrides,
  };
}

const dm = (dueDate: string, extra: Record<string, unknown> = {}) =>
  normalizeWorkItem({ id: "w1", title: "DM 5", subject: "Mathématiques", kind: "dm", dueDate, estimatedMinutes: 120, status: "en cours", createdAt: at(9, 1).toISOString(), ...extra });

describe("computeAlerts — ce qui mérite d'interrompre", () => {
  it("rien à signaler : aucune alerte", () => {
    expect(computeAlerts(input())).toEqual([]);
  });

  it("échéance demain avec du travail restant : urgent, avec le temps restant", () => {
    const [alert] = computeAlerts(input({ workItems: [dm("2026-10-06")] }));
    expect(alert).toMatchObject({ level: "urgent", id: "echeance:w1:2026-10-05", href: "/timer?matiere=Math%C3%A9matiques" });
    expect(alert.title).toBe("DM 5 — à rendre demain");
    expect(alert.body).toContain("2 h");
  });

  it("échéance dépassée : dit le retard ; échéance lointaine ou travail fini : rien", () => {
    expect(computeAlerts(input({ workItems: [dm("2026-10-03")] }))[0].title).toBe("DM 5 — en retard de 2 jours");
    expect(computeAlerts(input({ workItems: [dm("2026-10-09")] }))).toEqual([]);
    expect(computeAlerts(input({ workItems: [dm("2026-10-06", { status: "terminé" })] }))).toEqual([]);
  });

  it("chapitre verrouillé : urgent dès que les fiches sont à retrouver (pas le jour de leur création)", () => {
    const created = addLockCards([], [{ matiere: "maths", chapitre: "Réduction", recto: "Critère de diagonalisabilité ?", verso: "π scindé à racines simples" }], at(18, 4));
    const items = created.ok ? created.items : [];
    expect(computeAlerts(input({ reviewItems: items, now: at(20, 4) })).some((alert) => alert.id.startsWith("verrou:"))).toBe(false);
    const [alert] = computeAlerts(input({ reviewItems: items }));
    expect(alert).toMatchObject({ level: "urgent", title: "Chapitre verrouillé : Réduction", href: `/revoir/session?subject=Math%C3%A9matiques&verrou=${encodeURIComponent(lockKey("Mathématiques", "Réduction"))}` });
  });

  it("minimum du soir : seulement à partir de 18 h, et il dit ce qui manque", () => {
    const preferences = normalizePreferences({ eveningMinimums: [{ Mathématiques: 60 }, {}, {}, {}, {}, {}, {}] });
    const sessions = [session("Mathématiques", 20, at(14))];
    expect(computeAlerts(input({ preferences, sessions, now: at(17) }))).toEqual([]);
    const [alert] = computeAlerts(input({ preferences, sessions, now: at(19) }));
    expect(alert).toMatchObject({ level: "attention", id: "soir:2026-10-05" });
    expect(alert.body).toBe("Il manque Mathématiques : 40 min.");
    expect(computeAlerts(input({ preferences, sessions: [session("Mathématiques", 60, at(14))], now: at(19) }))).toEqual([]);
  });

  it("rien noté de la journée : à partir de 17 h, jamais pour un nouvel inscrit", () => {
    expect(computeAlerts(input({ now: at(16) }))).toEqual([]);
    expect(computeAlerts(input({ now: at(17) }))[0].id).toBe("rien:2026-10-05");
    expect(computeAlerts(input({ sessions: [], now: at(20) }))).toEqual([]);
  });

  it("fiches dues : une info, sans compter celles du verrou ; les urgences passent devant", () => {
    const card = createReviewItem({ subject: "Physique", text: "Gauss", kind: "à revoir" }, at(9, 2)) as ReviewItem;
    const alerts = computeAlerts(input({ reviewItems: [card], workItems: [dm("2026-10-05")] }));
    expect(alerts.map((alert) => alert.level)).toEqual(["urgent", "info"]);
    expect(alerts[1].title).toBe("1 fiche à revoir");
  });
});

describe("« Plus tard »", () => {
  const urgent = computeAlerts(input({ workItems: [dm("2026-10-06")] }))[0];
  const info = computeAlerts(input({ reviewItems: [createReviewItem({ subject: "Physique", text: "Gauss", kind: "à revoir" }, at(9, 2)) as ReviewItem] }))[0];

  it("une info écartée se tait pour la journée ; une urgence revient au bout de 2 h", () => {
    const map = snoozeAlert(snoozeAlert({}, urgent, at(10)), info, at(10));
    expect(visibleAlerts([urgent, info], map, at(11))).toEqual([]);
    expect(visibleAlerts([urgent, info], map, at(12))).toEqual([urgent]);
  });

  it("le lendemain, l'identifiant change : l'alerte revient si le problème demeure, et les vieux écarts sont oubliés", () => {
    const map = snoozeAlert({}, info, at(10));
    expect(Object.keys(pruneSnoozes(map, at(9, 6)))).toEqual([]);
    expect(Object.keys(pruneSnoozes(map, at(22)))).toEqual([info.id]);
  });
});
