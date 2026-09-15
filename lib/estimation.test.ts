import { describe, expect, it } from "vitest";
import { adjustEstimate, computeEstimationBias, ESTIMATION_MIN_SAMPLES, suggestEstimate } from "@/lib/estimation";
import type { WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

function item(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    title: `Travail ${id}`,
    kind: "dm",
    subject: "Physique",
    estimatedMinutes: 60,
    dueDate: null,
    dueTime: null,
    status: "terminé",
    important: false,
    notBeforeDate: null,
    chapterIds: [],
    createdAt: "2026-09-01T08:00:00.000Z",
    completedAt: "2026-09-02T08:00:00.000Z",
    postponements: [],
    ...overrides,
  };
}

function session(workItemId: string, minutes: number): WorkSession {
  return {
    id: crypto.randomUUID(),
    subject: "Physique",
    exercise_id: null,
    started_at: "2026-09-01T09:00:00",
    ended_at: "2026-09-01T10:00:00",
    duration_seconds: minutes * 60,
    note: null,
    created_at: "2026-09-01T09:00:00",
    result: null,
    hints_used: null,
    work_item_id: workItemId,
  };
}

describe("SCÉNARIO 8 — aucune donnée historique, aucune estimation mensongère", () => {
  /**
   * La règle la plus importante de ce module : mieux vaut ne rien proposer
   * qu'une suggestion présentée comme issue d'un historique inexistant. Un
   * élève qui découvre que « d'après ton historique » reposait sur une seule
   * séance cesse de croire l'outil — définitivement.
   */
  it("aucun travail terminé : aucune suggestion", () => {
    expect(suggestEstimate("dm", "Physique", [], [])).toBeNull();
  });

  it("un seul travail terminé ne suffit pas", () => {
    expect(suggestEstimate("dm", "Physique", [item("a")], [session("a", 70)])).toBeNull();
  });

  it("des travaux terminés SANS temps enregistré ne comptent pas", () => {
    expect(suggestEstimate("dm", "Physique", [item("a"), item("b")], [])).toBeNull();
  });

  it("aucun biais mesurable ne produit aucune phrase", () => {
    expect(computeEstimationBias("Physique", [item("a")], [session("a", 70)])).toBeNull();
    expect(adjustEstimate(45, null)).toBeNull();
  });
});

describe("suggestion — la médiane, et elle dit sur quoi elle s'appuie", () => {
  it("suggère dès deux travaux comparables, en nommant la matière", () => {
    const suggestion = suggestEstimate("dm", "Physique", [item("a"), item("b")], [session("a", 60), session("b", 80)])!;
    expect(suggestion.minutes).toBe(70);
    expect(suggestion.samples).toBe(ESTIMATION_MIN_SAMPLES);
    expect(suggestion.sameSubject).toBe(true);
    expect(suggestion.sentence).toContain("en Physique");
  });

  it("une valeur exceptionnelle ne devient pas la norme", () => {
    const items = [item("a"), item("b"), item("c")];
    const sessions = [session("a", 60), session("b", 60), session("c", 400)];
    expect(suggestEstimate("dm", "Physique", items, sessions)!.minutes).toBe(60);
  });

  it("faute de données dans la matière, se rabat sur la nature — et le dit", () => {
    const items = [item("a", { subject: "Mathématiques" }), item("b", { subject: "Chimie" })];
    const suggestion = suggestEstimate("dm", "Physique", items, [session("a", 50), session("b", 70)])!;
    expect(suggestion.sameSubject).toBe(false);
    expect(suggestion.sentence).not.toContain("en Physique");
  });

  it("ne mélange jamais deux natures de travail : un DS n'est pas un DM", () => {
    const items = [item("a", { kind: "ds" }), item("b", { kind: "ds" })];
    expect(suggestEstimate("dm", "Physique", items, [session("a", 60), session("b", 60)])).toBeNull();
  });

  it("ignore les travaux encore en cours — comparer un travail inachevé ne compare rien", () => {
    const items = [item("a", { status: "en cours" }), item("b", { status: "en cours" })];
    expect(suggestEstimate("dm", "Physique", items, [session("a", 60), session("b", 60)])).toBeNull();
  });
});

describe("biais d'estimation — mesuré, jamais supposé", () => {
  it("détecte une sous-estimation systématique et la chiffre", () => {
    const items = [item("a", { estimatedMinutes: 60 }), item("b", { estimatedMinutes: 60 })];
    const bias = computeEstimationBias("Physique", items, [session("a", 72), session("b", 70)])!;
    expect(bias.deviationPercent).toBeGreaterThan(0);
    expect(bias.samples).toBe(2);
    expect(bias.sentence).toContain("sous-estimé");
    expect(bias.sentence).toContain("2 travaux terminés");
  });

  it("détecte aussi une surestimation, sans inverser le vocabulaire", () => {
    const items = [item("a", { estimatedMinutes: 100 }), item("b", { estimatedMinutes: 100 })];
    const bias = computeEstimationBias("Physique", items, [session("a", 60), session("b", 60)])!;
    expect(bias.deviationPercent).toBe(-40);
    expect(bias.sentence).toContain("surestimé");
  });

  it("un écart sous le seuil de bruit n'est PAS présenté comme un biais", () => {
    const items = [item("a", { estimatedMinutes: 60 }), item("b", { estimatedMinutes: 60 })];
    expect(computeEstimationBias("Physique", items, [session("a", 63), session("b", 62)])).toBeNull();
  });

  it("ne mélange pas les matières", () => {
    const items = [item("a", { subject: "Mathématiques", estimatedMinutes: 60 }), item("b", { subject: "Mathématiques", estimatedMinutes: 60 })];
    expect(computeEstimationBias("Physique", items, [session("a", 120), session("b", 120)])).toBeNull();
  });
});

describe("correction d'une estimation saisie — le service du cahier des charges", () => {
  it("« 45 min estimées → environ 1 h 10 d'après tes derniers travaux de Physique »", () => {
    const items = [item("a", { estimatedMinutes: 60 }), item("b", { estimatedMinutes: 60 })];
    const bias = computeEstimationBias("Physique", items, [session("a", 93), session("b", 93)])!;
    const adjusted = adjustEstimate(45, bias)!;
    expect(adjusted.minutes).toBe(70);
    expect(adjusted.sentence).toBe("45 min estimées → environ 1 h 10 d'après tes derniers travaux de Physique.");
  });

  it("ne propose rien quand la correction ne change rien", () => {
    const items = [item("a", { estimatedMinutes: 60 }), item("b", { estimatedMinutes: 60 })];
    const bias = computeEstimationBias("Physique", items, [session("a", 72), session("b", 72)])!;
    expect(adjustEstimate(0, bias)).toBeNull();
  });
});
