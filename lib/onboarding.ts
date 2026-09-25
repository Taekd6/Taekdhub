import { MAX_DAILY_CAPACITY_MINUTES, MAX_WEEKLY_SUBJECT_TARGET_MINUTES, normalizePreferences, type Preferences } from "@/lib/storage";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * PREMIER LANCEMENT — « je dois fixer mes objectifs au début ».
 *
 * Un élève qui ouvre TaekdHub pour la première fois tombait sur un accueil
 * rempli de valeurs PAR DÉFAUT : une heure par jour, huit heures de maths,
 * deux heures libres le mardi. Des chiffres qui ne sont pas les siens, qu'il
 * devait aller corriger lui-même dans Réglages — à condition de savoir
 * qu'ils y étaient. L'accueil guidé (app/(app)/bienvenue/page.tsx) lui pose
 * les cinq questions une par une, dès la première visite.
 *
 * Ce module porte la seule décision délicate du chantier : QUI doit voir cet
 * accueil. Envoyer sur /bienvenue un élève qui travaille avec TaekdHub depuis
 * trois mois, au seul motif que son fichier de préférences est antérieur au
 * champ `onboardingCompletedAt`, serait exactement le genre d'irruption qui
 * fait perdre confiance dans un outil. D'où `shouldOnboard`, volontairement
 * prudente : au moindre signe d'usage réel, la réponse est non.
 *
 * Fonctions pures (sauf le petit rappel « Plus tard », isolé en fin de
 * fichier et protégé contre un stockage indisponible) : aucune dépendance à
 * React ni au DOM.
 */

/** Ce que l'accueil guidé permet de régler — un sous-ensemble strict de `Preferences`. */
export type OnboardingDraft = Pick<
  Preferences,
  "displayName" | "dailyGoalMinutes" | "weeklyGoalMinutes" | "weeklySubjectTargets" | "capacityByWeekday" | "contestDate"
>;

/**
 * Ce qui prouve un usage réel. Seules les collections SAISIES par l'élève
 * comptent : les instantanés de semaine et les intentions de planning sont
 * produits automatiquement par l'application et ne disent rien de lui.
 */
export type OnboardingEvidence = {
  sessions: readonly unknown[];
  grades: readonly unknown[];
  workItems: readonly unknown[];
  reviewItems?: readonly unknown[];
  errors?: readonly unknown[];
  checkins?: readonly unknown[];
};

/** Les valeurs de départ, telles que les produit la normalisation d'une préférence vide. */
function pristine(): Preferences {
  return normalizePreferences({});
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * L'élève a-t-il déjà touché à SES réglages ?
 *
 * Seuls les champs que l'accueil guidé pose sont examinés, plus la marge de
 * planification (réglée dans le même écran que la capacité). L'apparence
 * (`accent`, `themeMode`) est volontairement ignorée : choisir une couleur
 * par curiosité avant d'avoir fixé le moindre objectif ne fait pas de
 * quelqu'un un utilisateur installé — et ses objectifs restent à poser.
 */
export function hasCustomizedPreferences(preferences: Preferences): boolean {
  const base = pristine();
  if (preferences.displayName.trim() !== "") return true;
  if (preferences.contestDate !== base.contestDate) return true;
  if (preferences.dailyGoalMinutes !== base.dailyGoalMinutes) return true;
  if (preferences.weeklyGoalMinutes !== base.weeklyGoalMinutes) return true;
  if (preferences.planningMarginPercent !== base.planningMarginPercent) return true;
  if (!sameNumbers(preferences.capacityByWeekday, base.capacityByWeekday)) return true;
  return subjects.some((subject) => preferences.weeklySubjectTargets[subject] !== base.weeklySubjectTargets[subject]);
}

/** Au moins une donnée saisie par l'élève, dans n'importe quel carnet. */
export function hasRealData(evidence: OnboardingEvidence): boolean {
  return [evidence.sessions, evidence.grades, evidence.workItems, evidence.reviewItems, evidence.errors, evidence.checkins].some(
    (list) => Array.isArray(list) && list.length > 0
  );
}

/**
 * Faut-il proposer l'accueil guidé ? Oui SEULEMENT si les trois conditions
 * sont réunies :
 *
 *   1. il n'a jamais été terminé (`onboardingCompletedAt` nul) ;
 *   2. aucune donnée n'a été saisie (séance, note, échéance, carnet…) ;
 *   3. aucun réglage d'objectif ou de capacité n'a été personnalisé.
 *
 * Les conditions 2 et 3 protègent les élèves installés AVANT ce chantier :
 * leur `onboardingCompletedAt` vaut `null` (le champ n'existait pas), mais
 * ils ont des séances ou des réglages — ils ne seront jamais redirigés.
 * Le prix de cette prudence est connu : un élève qui n'a rien saisi ni rien
 * réglé en trois mois reverra l'accueil. C'est précisément celui à qui il
 * servira.
 */
export function shouldOnboard(preferences: Preferences, evidence: OnboardingEvidence): boolean {
  if (preferences.onboardingCompletedAt) return false;
  if (hasRealData(evidence)) return false;
  return !hasCustomizedPreferences(preferences);
}

/* ══════════════════════════════════════════════════════════════════
   CE QUE PROPOSENT LES ÉCRANS
   ══════════════════════════════════════════════════════════════════ */

/** Préréglages de l'objectif du jour, en minutes — 1 h, 1 h 30, 2 h, 3 h : l'ordre de grandeur d'une journée de prépa, pas d'une séance. */
export const ONBOARDING_DAILY_PRESETS = [60, 90, 120, 180] as const;
/** Pas des compteurs « + / − » : une demi-heure. Assez fin pour dire 1 h 30, assez gros pour ne pas taper dix fois. */
export const ONBOARDING_STEP_MINUTES = 30;
/** Objectif du jour : de 15 min à 12 h. Au-delà, ce n'est plus un objectif mais une faute de frappe. */
export const MAX_DAILY_GOAL_MINUTES = 720;
/** Objectif de la semaine : jusqu'à 70 h — même raisonnement. */
export const MAX_WEEKLY_GOAL_MINUTES = 4200;

/**
 * Deux profils de semaine à un clic, pour ne pas imposer sept réglages à
 * quelqu'un qui découvre l'application. Des POINTS DE DÉPART que chaque
 * curseur corrige ensuite :
 *
 *   « Semaine chargée »  cours tard et colles : peu de temps du lundi au
 *                        vendredi, l'essentiel se fait le week-end.
 *   « Week-end libre »   on travaille davantage en semaine pour garder le
 *                        samedi soir et le dimanche.
 */
export const CAPACITY_PRESETS: readonly { id: string; label: string; hint: string; minutes: readonly number[] }[] = [
  { id: "chargee", label: "Semaine chargée", hint: "Peu en semaine, beaucoup le week-end", minutes: [60, 60, 90, 60, 60, 240, 180] },
  { id: "weekend", label: "Week-end libre", hint: "Plus en semaine, dimanche au repos", minutes: [150, 150, 150, 150, 120, 90, 0] },
];

/** Ajoute `delta` à `value` et borne le résultat — les compteurs « + / − » de chaque écran. */
export function stepMinutes(value: number, delta: number, min: number, max: number): number {
  const next = Math.round(value + delta);
  return Math.min(max, Math.max(min, next));
}

/** Somme des budgets par matière, en minutes par semaine. */
export function subjectTargetsTotal(targets: Record<Subject, number>): number {
  return subjects.reduce((sum, subject) => sum + (targets[subject] ?? 0), 0);
}

/**
 * Objectif hebdomadaire SUGGÉRÉ : la somme des budgets par matière si
 * l'élève en a posé, sinon cinq fois l'objectif du jour (une semaine de
 * cours). Une suggestion seulement — le champ reste modifiable.
 */
export function suggestedWeeklyGoal(draft: Pick<OnboardingDraft, "dailyGoalMinutes" | "weeklySubjectTargets">): number {
  const fromSubjects = subjectTargetsTotal(draft.weeklySubjectTargets);
  return Math.min(MAX_WEEKLY_GOAL_MINUTES, fromSubjects > 0 ? fromSubjects : draft.dailyGoalMinutes * 5);
}

/** Capacité DÉCLARÉE sur la semaine, en minutes (voir `Preferences.capacityByWeekday`). */
export function weeklyDeclaredCapacity(capacity: readonly number[]): number {
  return capacity.reduce((sum, value) => sum + value, 0);
}

/**
 * Capacité PLANIFIABLE sur la semaine : chaque jour diminué de la marge,
 * arrondi à l'inférieur jour par jour — exactement le calcul de
 * lib/capacity.ts#plannableMinutes, sommé sur les sept jours, pour que le
 * total annoncé ici soit celui que le planning utilisera.
 */
export function weeklyPlannableCapacity(capacity: readonly number[], marginPercent: number): number {
  const kept = Math.max(0, 100 - marginPercent) / 100;
  return capacity.reduce((sum, value) => sum + Math.floor(value * kept), 0);
}

/**
 * Les budgets dépassent-ils ce que la semaine peut absorber ? Comparé à la
 * capacité PLANIFIABLE, pas à la déclarée : c'est elle que le planning
 * remplira. Le message qui en découle reste doux — un budget ambitieux est
 * un choix, pas une erreur.
 */
export function exceedsCapacity(targets: Record<Subject, number>, capacity: readonly number[], marginPercent: number): boolean {
  const plannable = weeklyPlannableCapacity(capacity, marginPercent);
  return plannable > 0 && subjectTargetsTotal(targets) > plannable;
}

/** Brouillon de départ : les préférences actuelles, telles quelles — chaque écran s'ouvre pré-rempli. */
export function draftFromPreferences(preferences: Preferences): OnboardingDraft {
  return {
    displayName: preferences.displayName,
    dailyGoalMinutes: preferences.dailyGoalMinutes,
    weeklyGoalMinutes: preferences.weeklyGoalMinutes,
    weeklySubjectTargets: { ...preferences.weeklySubjectTargets },
    capacityByWeekday: [...preferences.capacityByWeekday],
    contestDate: preferences.contestDate,
  };
}

/**
 * Préférences finales : le brouillon posé par-dessus ce qui est RÉELLEMENT
 * enregistré (`current`), puis repassé par `normalizePreferences` — la même
 * frontière de confiance que tout le reste. Un prénom avec des espaces de
 * bord, une capacité hors bornes ou une date illisible ne peuvent donc pas
 * entrer par ce chemin plus que par un autre.
 *
 * Les champs que l'accueil ne règle pas (apparence, marge) sont conservés.
 */
export function applyOnboarding(current: Preferences, draft: OnboardingDraft, now: Date = new Date()): Preferences {
  return normalizePreferences({
    ...current,
    displayName: draft.displayName.trim(),
    dailyGoalMinutes: stepMinutes(draft.dailyGoalMinutes, 0, 15, MAX_DAILY_GOAL_MINUTES),
    weeklyGoalMinutes: stepMinutes(draft.weeklyGoalMinutes, 0, 30, MAX_WEEKLY_GOAL_MINUTES),
    weeklySubjectTargets: Object.fromEntries(
      subjects.map((subject) => [subject, stepMinutes(draft.weeklySubjectTargets[subject] ?? 0, 0, 0, MAX_WEEKLY_SUBJECT_TARGET_MINUTES)])
    ),
    capacityByWeekday: draft.capacityByWeekday.map((value) => stepMinutes(value, 0, 0, MAX_DAILY_CAPACITY_MINUTES)),
    contestDate: draft.contestDate,
    onboardingCompletedAt: now.toISOString(),
  });
}

/* ══════════════════════════════════════════════════════════════════
   « PLUS TARD »
   ══════════════════════════════════════════════════════════════════

   Passer l'accueil ne doit ni le marquer comme fait (l'élève n'a rien
   fixé), ni le faire réapparaître à chaque retour sur l'accueil (ce serait
   un mur). Compromis : un rappel dans `sessionStorage`, qui dure le temps
   de l'onglet. À la prochaine ouverture de l'application, si rien n'a été
   saisi ni réglé entre-temps, l'accueil guidé sera reproposé une fois.

   Toute lecture ou écriture est protégée : navigation privée, stockage
   bloqué ou rendu serveur ne doivent jamais rien casser — au pire, la
   redirection se refait.
*/

const SNOOZE_KEY = "prepahub:onboarding-snoozed";

export function snoozeOnboarding(): void {
  try {
    window.sessionStorage.setItem(SNOOZE_KEY, "1");
  } catch {
    // Stockage indisponible : l'accueil guidé sera simplement reproposé.
  }
}

export function isOnboardingSnoozed(): boolean {
  try {
    return window.sessionStorage.getItem(SNOOZE_KEY) === "1";
  } catch {
    return false;
  }
}
