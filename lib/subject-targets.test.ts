import { describe, expect, it } from "vitest";
import { computeSubjectTargets, expectedWeekFraction } from "@/lib/subject-targets";
import { DEFAULT_WEEKLY_SUBJECT_TARGETS, MAX_WEEKLY_SUBJECT_TARGET_MINUTES, normalizePreferences } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

// Semaine du lundi 14 septembre 2026.
const MONDAY = new Date("2026-09-14T08:00:00");
const THURSDAY = new Date("2026-09-17T20:00:00");
const SATURDAY = new Date("2026-09-19T09:00:00");
const CAPACITY = [120, 120, 120, 120, 120, 240, 180];

function session(subject: Subject, startedAt: string, minutes: number): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject,
    exercise_id: null,
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: minutes * 60,
    note: null,
    created_at: startedAt,
    result: null,
    hints_used: null,
    work_item_id: null,
  };
}

function find(rows: ReturnType<typeof computeSubjectTargets>, subject: Subject) {
  const row = rows.find((entry) => entry.subject === subject);
  if (!row) throw new Error(`${subject} absent`);
  return row;
}

describe("expectedWeekFraction — part de la semaine due", () => {
  it("lundi, rien n'est encore dû (le jour en cours ne compte pas)", () => {
    expect(expectedWeekFraction(MONDAY)).toBe(0);
    expect(expectedWeekFraction(MONDAY, CAPACITY)).toBe(0);
  });

  it("sans poids, découpe la semaine en septièmes", () => {
    expect(expectedWeekFraction(THURSDAY)).toBeCloseTo(3 / 7);
  });

  it("pondère par la capacité : un week-end chargé est moins « dû » le samedi matin", () => {
    // Lundi → vendredi : 600 min sur 1020.
    expect(expectedWeekFraction(SATURDAY, CAPACITY)).toBeCloseTo(600 / 1020);
    expect(expectedWeekFraction(SATURDAY, CAPACITY)).toBeLessThan(5 / 7);
  });

  it("des poids inexploitables retombent sur les septièmes, jamais sur 0", () => {
    expect(expectedWeekFraction(THURSDAY, [0, 0, 0, 0, 0, 0, 0])).toBeCloseTo(3 / 7);
    expect(expectedWeekFraction(THURSDAY, [60, 60])).toBeCloseTo(3 / 7);
    expect(expectedWeekFraction(THURSDAY, [60, -1, 60, 60, 60, 60, 60])).toBeCloseTo(3 / 7);
  });
});

describe("computeSubjectTargets — temps de la semaine face au budget", () => {
  it("exclut les matières sans budget (0 ou absentes)", () => {
    const rows = computeSubjectTargets([], { Anglais: 240, Chimie: 0 }, THURSDAY);
    expect(rows.map((row) => row.subject)).toEqual(["Anglais"]);
  });

  it("suit l'ordre de lib/study.ts#subjects", () => {
    const rows = computeSubjectTargets([], DEFAULT_WEEKLY_SUBJECT_TARGETS, THURSDAY);
    expect(rows.map((row) => row.subject)).toEqual(["Mathématiques", "Physique", "Informatique TC", "Informatique Spé", "Français", "Anglais"]);
  });

  it("ne compte que la semaine en cours, et rien de futur (définition de lib/week.ts)", () => {
    const rows = computeSubjectTargets(
      [
        session("Anglais", "2026-09-13T20:00:00", 90), // dimanche précédent
        session("Anglais", "2026-09-15T07:30:00", 30),
        session("Anglais", "2026-09-16T07:30:00", 40),
        session("Anglais", "2026-09-18T07:30:00", 30), // vendredi, donc futur
      ],
      { Anglais: 240 },
      THURSDAY
    );
    const anglais = find(rows, "Anglais");
    expect(anglais.doneSeconds).toBe(70 * 60);
    expect(anglais.doneMinutes).toBe(70);
    expect(anglais.remainingMinutes).toBe(170);
    expect(anglais.percent).toBe(29);
  });

  it("n'affiche 100 % qu'une fois le budget réellement rempli", () => {
    const almost = find(computeSubjectTargets([session("Français", "2026-09-15T18:00:00", 238)], { Français: 240 }, THURSDAY), "Français");
    expect(almost.percent).toBe(99);
    expect(almost.pace).not.toBe("atteint");

    const done = find(computeSubjectTargets([session("Français", "2026-09-15T18:00:00", 300)], { Français: 240 }, THURSDAY), "Français");
    expect(done.percent).toBe(100);
    expect(done.remainingMinutes).toBe(0);
    expect(done.pace).toBe("atteint");
  });
});

describe("computeSubjectTargets — rythme, sans alarmer trop tôt", () => {
  it("lundi et mardi, un temps nul n'est jamais « en retard »", () => {
    const tuesday = new Date("2026-09-15T21:00:00");
    for (const now of [MONDAY, tuesday]) {
      const rows = computeSubjectTargets([], DEFAULT_WEEKLY_SUBJECT_TARGETS, now);
      expect(rows.every((row) => row.pace !== "en retard")).toBe(true);
    }
  });

  it("mardi soir, un gros écart est dit « trop tôt », pas « en retard »", () => {
    // Uniforme : lundi dû = 1/7 de 2 400 min ≈ 343 min, bien au-delà de la marge.
    const tuesday = new Date("2026-09-15T21:00:00");
    const row = find(computeSubjectTargets([], { Mathématiques: 2400 }, tuesday), "Mathématiques");
    expect(row.pace).toBe("trop tôt");
  });

  it("jeudi soir sans rien fait sur un budget de 4 h : « en retard »", () => {
    const row = find(computeSubjectTargets([], { Français: 240 }, THURSDAY, CAPACITY), "Français");
    expect(row.expectedMinutes).toBe(Math.round(240 * (360 / 1020)));
    expect(row.pace).toBe("en retard");
  });

  it("proche du rythme attendu : « dans le rythme »", () => {
    // Attendu jeudi : 240 × 3/7 ≈ 103 min ; marge 24 min.
    const row = find(computeSubjectTargets([session("Anglais", "2026-09-16T07:30:00", 95)], { Anglais: 240 }, THURSDAY), "Anglais");
    expect(row.pace).toBe("dans le rythme");
  });

  it("nettement au-dessus : « en avance »", () => {
    const row = find(computeSubjectTargets([session("Anglais", "2026-09-16T07:30:00", 180)], { Anglais: 240 }, THURSDAY), "Anglais");
    expect(row.pace).toBe("en avance");
  });

  it("la marge a un plancher de 20 min : un petit budget ne bascule pas pour une séance", () => {
    // Informatique TC, 75 min : attendu jeudi ≈ 32 min. 15 min faites, écart 17 < 20.
    const row = find(
      computeSubjectTargets([session("Informatique TC", "2026-09-16T18:00:00", 15)], { "Informatique TC": 75 }, THURSDAY),
      "Informatique TC"
    );
    expect(row.pace).toBe("dans le rythme");
  });

  it("le samedi matin, un plan tourné vers le week-end n'est pas « en retard » grâce aux poids", () => {
    // Maths 8 h, 4 h faites en semaine. Uniforme → 343 min dus, écart 103 > 48 : retard.
    // Pondéré → 282 min dus, écart 42 < 48 : dans le rythme.
    const sessions = [session("Mathématiques", "2026-09-15T18:00:00", 240)];
    expect(find(computeSubjectTargets(sessions, { Mathématiques: 480 }, SATURDAY), "Mathématiques").pace).toBe("en retard");
    expect(find(computeSubjectTargets(sessions, { Mathématiques: 480 }, SATURDAY, CAPACITY), "Mathématiques").pace).toBe("dans le rythme");
  });
});

describe("normalizePreferences — weeklySubjectTargets", () => {
  it("une préférence d'avant ce chantier reçoit les budgets par défaut", () => {
    const prefs = normalizePreferences({ displayName: "Taekd", dailyGoalMinutes: 90 });
    expect(prefs.weeklySubjectTargets).toEqual(DEFAULT_WEEKLY_SUBJECT_TARGETS);
  });

  it("les défauts reprennent le plan de l'élève", () => {
    expect(DEFAULT_WEEKLY_SUBJECT_TARGETS.Anglais).toBe(240);
    expect(DEFAULT_WEEKLY_SUBJECT_TARGETS.Français).toBe(240);
    expect(DEFAULT_WEEKLY_SUBJECT_TARGETS["Informatique TC"] + DEFAULT_WEEKLY_SUBJECT_TARGETS["Informatique Spé"]).toBe(150);
    expect(DEFAULT_WEEKLY_SUBJECT_TARGETS.Chimie).toBe(0);
  });

  it("un 0 explicite est un choix et survit ; une matière absente retombe sur son défaut", () => {
    const prefs = normalizePreferences({ weeklySubjectTargets: { Anglais: 0, Français: 300 } });
    expect(prefs.weeklySubjectTargets.Anglais).toBe(0);
    expect(prefs.weeklySubjectTargets.Français).toBe(300);
    expect(prefs.weeklySubjectTargets.Mathématiques).toBe(DEFAULT_WEEKLY_SUBJECT_TARGETS.Mathématiques);
  });

  it("borne, arrondit, et rejette les valeurs aberrantes matière par matière", () => {
    const prefs = normalizePreferences({
      weeklySubjectTargets: { Mathématiques: 99999, Physique: 90.6, Anglais: -30, Français: "4h", Chimie: null, Klingon: 60 },
    });
    expect(prefs.weeklySubjectTargets.Mathématiques).toBe(MAX_WEEKLY_SUBJECT_TARGET_MINUTES);
    expect(prefs.weeklySubjectTargets.Physique).toBe(91);
    expect(prefs.weeklySubjectTargets.Anglais).toBe(DEFAULT_WEEKLY_SUBJECT_TARGETS.Anglais);
    expect(prefs.weeklySubjectTargets.Français).toBe(DEFAULT_WEEKLY_SUBJECT_TARGETS.Français);
    expect(prefs.weeklySubjectTargets.Chimie).toBe(0);
    expect(Object.keys(prefs.weeklySubjectTargets)).not.toContain("Klingon");
  });

  it("un champ qui n'est pas un objet retombe entièrement sur les défauts", () => {
    expect(normalizePreferences({ weeklySubjectTargets: "beaucoup" }).weeklySubjectTargets).toEqual(DEFAULT_WEEKLY_SUBJECT_TARGETS);
    expect(normalizePreferences({ weeklySubjectTargets: null }).weeklySubjectTargets).toEqual(DEFAULT_WEEKLY_SUBJECT_TARGETS);
  });

  it("survit à un aller-retour JSON (sauvegarde → restauration)", () => {
    const prefs = normalizePreferences({ weeklySubjectTargets: { Anglais: 280, Chimie: 60 } });
    const back = normalizePreferences(JSON.parse(JSON.stringify(prefs)));
    expect(back.weeklySubjectTargets).toEqual(prefs.weeklySubjectTargets);
  });
});
