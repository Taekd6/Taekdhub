import { describe, expect, it } from "vitest";
import { computeWeeklyReview } from "@/lib/weekly-review";
import { normalizePreferences, type Preferences, type WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/** Vendredi 18 septembre 2026 — en milieu de semaine, pour que lundi→jeudi soient déjà écoulés. */
const NOW = new Date("2026-09-18T18:00:00");

function prefs(overrides: Partial<Preferences> = {}): Preferences {
  return normalizePreferences({ capacityByWeekday: [60, 60, 60, 60, 60, 120, 120], planningMarginPercent: 0, ...overrides });
}

function item(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    title: `Travail ${id}`,
    kind: "dm",
    subject: "Physique",
    estimatedMinutes: 60,
    dueDate: null,
    dueTime: null,
    status: "à faire",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-14T08:00:00.000Z",
    completedAt: null,
    postponements: [],
    ...overrides,
  };
}

function session(startedAt: string, minutes: number, subject: Subject = "Mathématiques", workItemId: string | null = null): WorkSession {
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
    work_item_id: workItemId,
  };
}

describe("les chiffres du bilan", () => {
  it("additionne le temps de la semaine en cours, et lui seul", () => {
    const sessions = [session("2026-09-15T09:00:00", 60), session("2026-09-16T09:00:00", 90), session("2026-09-07T09:00:00", 300)];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).totalMinutes).toBe(150);
  });

  it("ventile par matière, les plus travaillées d'abord", () => {
    const sessions = [session("2026-09-15T09:00:00", 60, "Mathématiques"), session("2026-09-16T09:00:00", 90, "Physique")];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).bySubject).toEqual([
      { subject: "Physique", minutes: 90 },
      { subject: "Mathématiques", minutes: 60 },
    ]);
  });
});

describe("FAUSSE INTELLIGENCE INTERDITE — chaque constat doit être prouvable", () => {
  /**
   * Le cahier des charges en fait une règle absolue : « Mardi était ton jour
   * le plus chargé » ne doit jamais s'écrire si le calcul ne compare pas les
   * jours. Ces tests verrouillent les cas où le module doit se TAIRE.
   */
  it("aucune séance : aucun constat, aucun conseil", () => {
    const review = computeWeeklyReview([], [], prefs(), NOW);
    expect(review.findings).toEqual([]);
    expect(review.advice).toBeNull();
    expect(review.busiestDay).toBeNull();
  });

  it("une seule journée travaillée ne désigne aucune « journée la plus chargée »", () => {
    const review = computeWeeklyReview([], [session("2026-09-15T09:00:00", 120)], prefs(), NOW);
    expect(review.busiestDay).toBeNull();
    expect(review.findings.some((finding) => finding.key === "jour-le-plus-charge")).toBe(false);
  });

  it("deux journées à égalité non plus — l'ordre du fichier ne fait pas un verdict", () => {
    const sessions = [session("2026-09-15T09:00:00", 90), session("2026-09-16T09:00:00", 90)];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).busiestDay).toBeNull();
  });

  it("une journée strictement plus chargée est nommée, avec son temps", () => {
    const sessions = [session("2026-09-15T09:00:00", 160), session("2026-09-16T09:00:00", 60)];
    const review = computeWeeklyReview([], sessions, prefs(), NOW);
    expect(review.busiestDay?.date).toBe("2026-09-15");
    expect(review.findings.find((finding) => finding.key === "jour-le-plus-charge")?.sentence).toBe(
      "Mardi était ta journée la plus chargée : 2 h 40."
    );
  });

  it("aucun report enregistré : aucune phrase sur les reports", () => {
    const review = computeWeeklyReview([item("a")], [session("2026-09-15T09:00:00", 60)], prefs(), NOW);
    expect(review.findings.some((finding) => finding.key === "reports")).toBe(false);
  });
});

describe("constats réellement calculés", () => {
  it("compte les reports de la semaine et nomme la matière quand ils la partagent tous", () => {
    const items = [
      item("a", {
        postponements: [
          { at: "2026-09-15T09:00:00.000Z", fromDate: "2026-09-15", toDate: "2026-09-16" },
          { at: "2026-09-16T09:00:00.000Z", fromDate: "2026-09-16", toDate: "2026-09-17" },
        ],
      }),
    ];
    const review = computeWeeklyReview(items, [], prefs(), NOW);
    expect(review.postponedCount).toBe(2);
    expect(review.findings.find((finding) => finding.key === "reports")?.sentence).toBe(
      "Tu as reporté ton travail de Physique deux fois cette semaine."
    );
  });

  it("ignore un report d'une semaine antérieure", () => {
    const items = [item("a", { postponements: [{ at: "2026-09-07T09:00:00.000Z", fromDate: "2026-09-07", toDate: "2026-09-08" }] })];
    expect(computeWeeklyReview(items, [], prefs(), NOW).postponedCount).toBe(0);
  });

  it("compte les travaux terminés dans la semaine, pas ceux d'avant", () => {
    const items = [
      item("a", { status: "terminé", completedAt: "2026-09-16T09:00:00.000Z" }),
      item("b", { status: "terminé", completedAt: "2026-09-07T09:00:00.000Z" }),
    ];
    expect(computeWeeklyReview(items, [], prefs(), NOW).completedCount).toBe(1);
  });

  it("signale l'échéance qui ne tient plus, avec le temps qui reste", () => {
    // 3 h à faire pour lundi prochain, 60 min planifiables par jour.
    const items = [item("ds", { title: "DS de physique", kind: "ds", dueDate: "2026-09-19", estimatedMinutes: 300 })];
    const review = computeWeeklyReview(items, [], prefs(), NOW);
    expect(review.atRisk).toHaveLength(1);
    expect(review.findings.find((finding) => finding.key === "echeance-a-risque")?.sentence).toContain("DS de physique");
    expect(review.findings.find((finding) => finding.key === "echeance-a-risque")?.sentence).toContain("5 h");
  });
});

describe("le conseil découle d'un constat, ou n'existe pas", () => {
  it("une échéance à risque produit un conseil daté et chiffré", () => {
    const items = [item("ds", { title: "DS de physique", kind: "ds", dueDate: "2026-09-19", estimatedMinutes: 300 })];
    const advice = computeWeeklyReview(items, [], prefs(), NOW).advice!;
    expect(advice).toContain("DS de physique");
    expect(advice).toContain("samedi");
  });

  it("la journée la plus chargée reste un CONSTAT, mais ne produit plus de conseil", () => {
    const sessions = [session("2026-09-15T09:00:00", 160), session("2026-09-16T09:00:00", 60)];
    const review = computeWeeklyReview([], sessions, prefs(), NOW);
    // Le fait est mesuré, daté, et reste affiché.
    expect(review.findings.map((finding) => finding.key)).toContain("jour-le-plus-charge");
    // Mais « prévois davantage de marge le mardi » érigeait UNE semaine, et
    // deux journées comparables, en habitude à corriger — et désignait un
    // jour déjà passé. Aucun conseil vaut mieux qu'un conseil non fondé.
    expect(review.advice).toBeNull();
  });

  it("une semaine sans rien de notable ne produit AUCUN conseil plutôt qu'un conseil générique", () => {
    expect(computeWeeklyReview([], [session("2026-09-15T09:00:00", 60)], prefs(), NOW).advice).toBeNull();
  });
});

describe("enrichissement analytique du bilan", () => {
  it("annonce le volume de la semaine et son écart, « à ce stade »", () => {
    const sessions = [session("2026-09-15T09:00:00", 180), session("2026-09-08T09:00:00", 120)];
    const finding = computeWeeklyReview([], sessions, prefs(), NOW).findings.find((entry) => entry.key === "volume")!;
    expect(finding.sentence).toContain("3 h");
    expect(finding.sentence).toContain("+1 h");
    expect(finding.sentence).toContain("à ce stade");
  });

  it("dit « première semaine mesurée » plutôt qu'un écart inventé", () => {
    const finding = computeWeeklyReview([], [session("2026-09-15T09:00:00", 60)], prefs(), NOW).findings.find((entry) => entry.key === "volume")!;
    expect(finding.sentence).toContain("première semaine mesurée");
  });

  it("aucune séance des deux semaines : aucun constat de volume", () => {
    expect(computeWeeklyReview([], [], prefs(), NOW).findings.some((entry) => entry.key === "volume")).toBe(false);
  });

  it("signale une matière qui porte une échéance ouverte mais reçoit peu de temps", () => {
    const items = [item("ds", { title: "DS de physique", kind: "ds", subject: "Physique", dueDate: "2026-09-25", estimatedMinutes: 60 })];
    const sessions = [
      session("2026-09-15T09:00:00", 240, "Mathématiques"),
      session("2026-09-16T09:00:00", 30, "Physique"),
    ];
    const review = computeWeeklyReview(items, sessions, prefs(), NOW);
    const finding = review.findings.find((entry) => entry.key === "matiere-sous-servie")!;
    expect(finding.sentence).toContain("Physique");
    expect(finding.sentence).toContain("11 %");
  });

  it("ne signale RIEN quand la matière reçoit une part normale du temps", () => {
    const items = [item("ds", { kind: "ds", subject: "Physique", dueDate: "2026-09-25", estimatedMinutes: 60 })];
    const sessions = [
      session("2026-09-15T09:00:00", 120, "Mathématiques"),
      session("2026-09-16T09:00:00", 120, "Physique"),
    ];
    expect(computeWeeklyReview(items, sessions, prefs(), NOW).findings.some((entry) => entry.key === "matiere-sous-servie")).toBe(false);
  });

  it("ne signale rien non plus quand la matière n'a aucune échéance ouverte", () => {
    const sessions = [
      session("2026-09-15T09:00:00", 240, "Mathématiques"),
      session("2026-09-16T09:00:00", 30, "Physique"),
    ];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).findings.some((entry) => entry.key === "matiere-sous-servie")).toBe(false);
  });
});

describe("cohérence des chiffres affichés ensemble", () => {
  /**
   * DÉFAUT CONSTATÉ À L'ÉCRAN : le bandeau du bilan annonçait « 15 h 40
   * travaillées » pendant que la courbe du rythme, juste en dessous, en
   * affichait 3 h 55 — parce que le bilan retenait toute la semaine
   * calendaire quand les séries s'arrêtent à maintenant. Deux nombres
   * contradictoires sur le même écran suffisent à discréditer les deux.
   */
  it("le total de la semaine s'arrête à maintenant, comme les séries temporelles", () => {
    const sessions = [session("2026-09-15T09:00:00", 60), session("2026-09-19T09:00:00", 300)];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).totalMinutes).toBe(60);
  });

  it("la ventilation par matière suit la même borne", () => {
    const sessions = [
      session("2026-09-15T09:00:00", 60, "Mathématiques"),
      session("2026-09-19T09:00:00", 300, "Physique"),
    ];
    expect(computeWeeklyReview([], sessions, prefs(), NOW).bySubject).toEqual([{ subject: "Mathématiques", minutes: 60 }]);
  });
});
