import { describe, expect, it } from "vitest";
import {
  applyOnboarding,
  draftFromPreferences,
  exceedsCapacity,
  hasCustomizedPreferences,
  shouldOnboard,
  stepMinutes,
  suggestedWeeklyGoal,
  weeklyPlannableCapacity,
} from "@/lib/onboarding";
import { DEFAULT_WEEKLY_SUBJECT_TARGETS, normalizePreferences } from "@/lib/storage";

const EMPTY = { sessions: [], grades: [], workItems: [] };
const fresh = () => normalizePreferences({});

describe("shouldOnboard — qui voit l'accueil guidé", () => {
  it("un tout premier lancement : oui", () => {
    expect(shouldOnboard(fresh(), EMPTY)).toBe(true);
  });

  it("déjà terminé : jamais plus", () => {
    const prefs = normalizePreferences({ onboardingCompletedAt: "2026-09-01T10:00:00.000Z" });
    expect(shouldOnboard(prefs, EMPTY)).toBe(false);
  });

  it("un élève installé avant ce champ, avec des séances : jamais redirigé", () => {
    expect(shouldOnboard(fresh(), { ...EMPTY, sessions: [{}] })).toBe(false);
    expect(shouldOnboard(fresh(), { ...EMPTY, grades: [{}] })).toBe(false);
    expect(shouldOnboard(fresh(), { ...EMPTY, workItems: [{}] })).toBe(false);
    expect(shouldOnboard(fresh(), { ...EMPTY, reviewItems: [{}] })).toBe(false);
    expect(shouldOnboard(fresh(), { ...EMPTY, errors: [{}] })).toBe(false);
    expect(shouldOnboard(fresh(), { ...EMPTY, checkins: [{}] })).toBe(false);
  });

  it("des réglages déjà personnalisés suffisent à ne pas rediriger", () => {
    expect(shouldOnboard(normalizePreferences({ displayName: "Léa" }), EMPTY)).toBe(false);
    expect(shouldOnboard(normalizePreferences({ dailyGoalMinutes: 120 }), EMPTY)).toBe(false);
    expect(shouldOnboard(normalizePreferences({ contestDate: "2027-05-04" }), EMPTY)).toBe(false);
    expect(shouldOnboard(normalizePreferences({ capacityByWeekday: [60, 60, 60, 60, 60, 60, 60] }), EMPTY)).toBe(false);
    expect(shouldOnboard(normalizePreferences({ weeklySubjectTargets: { Chimie: 60 } }), EMPTY)).toBe(false);
  });

  it("l'apparence seule ne compte pas comme une installation", () => {
    const prefs = normalizePreferences({ themeMode: "light" });
    expect(hasCustomizedPreferences(prefs)).toBe(false);
    expect(shouldOnboard(prefs, EMPTY)).toBe(true);
  });

  it("un prénom fait d'espaces n'est pas un prénom", () => {
    expect(hasCustomizedPreferences(normalizePreferences({ displayName: "   " }))).toBe(false);
  });
});

describe("normalizePreferences — onboardingCompletedAt", () => {
  it("absent d'une ancienne préférence : null", () => {
    expect(normalizePreferences({ dailyGoalMinutes: 60 }).onboardingCompletedAt).toBeNull();
  });

  it("illisible : null, jamais propagé", () => {
    expect(normalizePreferences({ onboardingCompletedAt: "hier" }).onboardingCompletedAt).toBeNull();
    expect(normalizePreferences({ onboardingCompletedAt: 42 }).onboardingCompletedAt).toBeNull();
  });

  it("un instant ISO survit à l'aller-retour", () => {
    const at = "2026-09-24T08:00:00.000Z";
    expect(normalizePreferences(JSON.parse(JSON.stringify({ onboardingCompletedAt: at }))).onboardingCompletedAt).toBe(at);
  });
});

describe("ce que proposent les écrans", () => {
  it("objectif hebdo suggéré : la somme des budgets, sinon 5 × le quotidien", () => {
    expect(suggestedWeeklyGoal({ dailyGoalMinutes: 90, weeklySubjectTargets: DEFAULT_WEEKLY_SUBJECT_TARGETS })).toBe(1470);
    const none = Object.fromEntries(Object.keys(DEFAULT_WEEKLY_SUBJECT_TARGETS).map((s) => [s, 0])) as typeof DEFAULT_WEEKLY_SUBJECT_TARGETS;
    expect(suggestedWeeklyGoal({ dailyGoalMinutes: 90, weeklySubjectTargets: none })).toBe(450);
  });

  it("les compteurs restent dans leurs bornes", () => {
    expect(stepMinutes(0, -30, 0, 3000)).toBe(0);
    expect(stepMinutes(2990, 30, 0, 3000)).toBe(3000);
    expect(stepMinutes(60, 30, 0, 3000)).toBe(90);
  });

  it("capacité planifiable : la marge est retirée jour par jour, comme le planning", () => {
    // 7 × floor(125 × 0,8) = 7 × 100
    expect(weeklyPlannableCapacity([125, 125, 125, 125, 125, 125, 125], 20)).toBe(700);
  });

  it("alerte douce quand les budgets dépassent la capacité planifiable", () => {
    const capacity = [60, 60, 60, 60, 60, 60, 60]; // 420 déclarées, 336 planifiables
    expect(exceedsCapacity({ ...DEFAULT_WEEKLY_SUBJECT_TARGETS }, capacity, 20)).toBe(true);
    const small = { ...DEFAULT_WEEKLY_SUBJECT_TARGETS, Mathématiques: 120, Physique: 0, Français: 0, Anglais: 0, "Informatique TC": 0, "Informatique Spé": 0 };
    expect(exceedsCapacity(small, capacity, 20)).toBe(false);
  });
});

describe("applyOnboarding", () => {
  it("pose le brouillon, garde l'apparence et date la fin", () => {
    const current = normalizePreferences({ themeMode: "light", planningMarginPercent: 10 });
    const draft = { ...draftFromPreferences(current), displayName: "  Léa  ", dailyGoalMinutes: 120, contestDate: "2027-05-04" };
    const now = new Date("2026-09-24T08:00:00.000Z");
    const next = applyOnboarding(current, draft, now);
    expect(next.displayName).toBe("Léa");
    expect(next.dailyGoalMinutes).toBe(120);
    expect(next.contestDate).toBe("2027-05-04");
    expect(next.themeMode).toBe("light");
    expect(next.planningMarginPercent).toBe(10);
    expect(next.onboardingCompletedAt).toBe(now.toISOString());
    expect(shouldOnboard(next, EMPTY)).toBe(false);
  });

  it("une date de concours illisible retombe sur « pas de concours »", () => {
    const current = fresh();
    const next = applyOnboarding(current, { ...draftFromPreferences(current), contestDate: "bientôt" });
    expect(next.contestDate).toBe("");
  });
});
