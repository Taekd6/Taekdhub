/**
 * Mini-onboarding premier lancement (Micro-sprint « Ah ouais »).
 *
 * Logique PURE uniquement — la détection du premier lancement elle-même
 * (localStorage, timing d'effets React) vit dans le composant
 * `components/onboarding-flow.tsx`, non testable en Node sans DOM (voir
 * vitest.config.ts) ; ce module ne contient que ce qui peut l'être :
 * les choix proposés et leur traduction en données déjà existantes.
 *
 * Aucune nouvelle donnée persistée : le choix de durée alimente
 * `Preferences.dailyGoalMinutes` (déjà existant, lib/storage.ts) via
 * exactement le même mécanisme que Réglages. Le choix de filière
 * (MPSI → MP / PCSI → PC / Autre) n'a d'équivalent nulle part dans le modèle
 * actuel et n'est utilisé par AUCUN moteur (aucun filtrage de matières par
 * filière n'existe) — conformément à la consigne « privilégier l'absence de
 * nouveau champ si possible », il n'est PAS persisté : gardé en état local le
 * temps de l'onboarding, pour personnaliser uniquement le dernier écran.
 */

export interface OnboardingTimeChoice {
  label: string;
  minutes: number;
}

/** Mêmes ordres de grandeur que `PLAN_DURATION_PRESETS`/`dailyGoalMinutes` par défaut (lib/plan.ts, lib/storage.ts) — jamais une nouvelle échelle. */
export const ONBOARDING_TIME_CHOICES: OnboardingTimeChoice[] = [
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
  { label: "3 h", minutes: 180 },
  { label: "4 h+", minutes: 240 },
];

export type OnboardingTrack = "MP" | "PC" | "autre";

export interface OnboardingTrackChoice {
  label: string;
  value: OnboardingTrack;
}

export const ONBOARDING_TRACK_CHOICES: OnboardingTrackChoice[] = [
  { label: "MPSI → MP", value: "MP" },
  { label: "PCSI → PC", value: "PC" },
  { label: "Autre", value: "autre" },
];

/**
 * Message de l'écran final — personnalisé UNIQUEMENT si une filière a été
 * choisie (jamais "Autre" ni aucune sélection, qui restent génériques :
 * mentionner "Autre" ne donne aucune information réelle).
 */
export function onboardingReadyMessage(track: OnboardingTrack | null): string {
  if (track === "MP" || track === "PC") return `Parfait. Ton espace de prépa ${track} est prêt.`;
  return "Parfait. Ton espace est prêt.";
}
