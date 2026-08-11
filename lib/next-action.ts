import { resultCounts, type ResultCounts } from "@/lib/history";
import { progressByChapter } from "@/lib/progress";
import { computeExerciseBankStats, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import type { Chapter } from "@/lib/storage";
import { todaySeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { neglectedSubjects } from "@/lib/week";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Centre de pilotage (Sprint 7) — "quoi faire maintenant", à partir des
 * données réelles déjà produites par les moteurs existants
 * (lib/recommendation.ts, lib/progress.ts, lib/week.ts, lib/history.ts).
 *
 * Ce module n'introduit AUCUNE nouvelle règle de sélection d'exercice : il
 * compose des fonctions déjà éprouvées et les met en forme pour une seule
 * décision affichable. `recommendExercises` reste l'unique source de vérité
 * pour "quel exercice proposer" — ici on l'appelle avec un budget dérivé de
 * l'objectif du jour, exactement comme le fait déjà `/session` (voir
 * components/session/session-runner.tsx#startSession).
 */

export interface DailyObjective {
  goalMinutes: number;
  workedMinutes: number;
  /** Toujours ≥ 0 — jamais négatif même si l'objectif est dépassé. */
  remainingMinutes: number;
  /** 0-100, plafonné. */
  percent: number;
  met: boolean;
}

/** Progression de l'objectif du jour — seule source pour le Dashboard ET le budget par défaut d'une nouvelle séance (voir `computeNextAction`). */
export function computeDailyObjective(sessions: WorkSession[], goalMinutes: number, now: Date = new Date()): DailyObjective {
  const workedMinutes = secondsToWholeMinutes(todaySeconds(sessions, now));
  const remainingMinutes = Math.max(0, goalMinutes - workedMinutes);
  return {
    goalMinutes,
    workedMinutes,
    remainingMinutes,
    percent: goalMinutes > 0 ? Math.min(100, Math.round((workedMinutes / goalMinutes) * 100)) : 0,
    met: goalMinutes > 0 && remainingMinutes === 0,
  };
}

export type NextActionKind = "empty-bank" | "up-to-date" | "start-session";

export interface NextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  /** Budget (minutes) associé au CTA — 0 si non pertinent (`empty-bank`/`up-to-date`). */
  minutes: number;
  /** Jusqu'à 3 exercices concrets à montrer sous le CTA principal — `[]` si non pertinent. */
  picks: ExerciseRecommendation[];
}

/** Bloc de travail par défaut une fois l'objectif du jour déjà atteint — reprend la même estimation que `lib/recommendation.ts#DEFAULT_ESTIMATE_MINUTES`, pour proposer un budget cohérent plutôt que 0 minute. */
const CONTINUE_SESSION_MINUTES = 25;
/** Nombre d'exercices concrets montrés sous le CTA principal — assez pour donner un aperçu réel, assez peu pour rester lisible. */
const NEXT_ACTION_PICKS = 3;

/**
 * Décision centrale "à faire maintenant" — un seul appel, consommé tel quel
 * par le Dashboard. Trois états possibles, mutuellement exclusifs :
 * - `empty-bank` : aucun exercice actif, rien à recommander (pas encore de données).
 * - `up-to-date` : la banque ne signale rien (voir `computeExerciseBankStats`).
 * - `start-session` : au moins un exercice signalé — `picks` en donne un aperçu concret,
 *   dimensionné sur le temps restant de l'objectif du jour (ou un bloc par défaut si l'objectif est déjà atteint).
 */
export function computeNextAction(exercises: Exercise[], sessions: WorkSession[], dailyGoalMinutes: number, now: Date = new Date()): NextAction {
  const active = exercises.filter((exercise) => !exercise.archived);

  if (active.length === 0) {
    return {
      kind: "empty-bank",
      title: "Ajoute tes premiers exercices",
      description: "La banque est vide pour l'instant — ajoute ou importe des exercices pour que TaekdHub puisse te proposer quoi travailler.",
      ctaLabel: "Voir les exercices",
      href: "/exercises",
      minutes: 0,
      picks: [],
    };
  }

  const stats = computeExerciseBankStats(active, sessions, now);
  if (stats.toReviewCount === 0) {
    return {
      kind: "up-to-date",
      title: "Banque à jour",
      description: "Rien n'est signalé pour l'instant. Bon moment pour avancer librement, ou renforcer un exercice déjà maîtrisé.",
      ctaLabel: "Explorer les exercices",
      href: "/exercises",
      minutes: 0,
      picks: [],
    };
  }

  const objective = computeDailyObjective(sessions, dailyGoalMinutes, now);
  const minutes = objective.remainingMinutes > 0 ? objective.remainingMinutes : CONTINUE_SESSION_MINUTES;
  const bounded = recommendExercises(active, sessions, NEXT_ACTION_PICKS, { now, availableMinutes: minutes });
  // Un budget serré peut ne rien retenir (voir `selectWithinBudget`) sans que
  // ça signifie "rien à proposer" — dans ce cas, on montre quand même
  // l'aperçu non borné : la contrainte de temps réelle reste appliquée par
  // `/session` lui-même au moment de démarrer.
  const picks = bounded.length > 0 ? bounded : recommendExercises(active, sessions, NEXT_ACTION_PICKS, { now });
  const top = picks[0];

  return {
    kind: "start-session",
    title: top ? top.exercise.title : "Commencer une séance",
    description: top ? top.reasons.join(" · ") : "Une sélection prête à l'emploi t'attend.",
    ctaLabel: objective.remainingMinutes > 0 ? `Commencer une séance de ${minutes} min` : `Continuer avec une séance de ${minutes} min`,
    href: "/session",
    minutes,
    picks,
  };
}

export interface UpcomingItem {
  key: "chapter" | "subject" | "review";
  label: string;
  detail: string;
  href: string;
}

/** Nombre d'entrées "Prochainement" affichées — une par catégorie (chapitre / matière / révision), jamais plus. */
const MAX_UPCOMING_ITEMS = 3;

/**
 * "Prochainement" — jusqu'à trois signaux distincts, chacun réutilisant un
 * module existant sans le dupliquer : le chapitre le plus faible
 * (lib/progress.ts), la matière délaissée cette semaine (lib/week.ts), et
 * une révision due (lib/recommendation.ts, raisons "Non retravaillé…" /
 * "Maîtrisé, jamais retravaillé"). Une catégorie sans signal n'apparaît pas
 * — jamais de case vide forcée à trois entrées.
 */
export function computeUpcoming(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], now: Date = new Date()): UpcomingItem[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  const items: UpcomingItem[] = [];

  const weakestChapter = progressByChapter(exercises, chapters)
    .filter((entry) => entry.mastered < entry.total)
    .sort((a, b) => a.averageMastery - b.averageMastery)[0];
  if (weakestChapter) {
    const candidate = active.find((exercise) => exercise.chapter_id === weakestChapter.chapter.id && exercise.status !== "maîtrisé");
    const remaining = weakestChapter.total - weakestChapter.mastered;
    items.push({
      key: "chapter",
      label: weakestChapter.chapter.label,
      detail: `${weakestChapter.averageMastery}% de maîtrise · ${remaining} exercice${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`,
      href: candidate ? `/exercises?focus=${candidate.id}` : "/exercises",
    });
  }

  const neglected = neglectedSubjects(exercises, sessions, now)[0];
  if (neglected) {
    items.push({
      key: "subject",
      label: neglected.subject,
      detail: `${neglected.pendingCount} exercice${neglected.pendingCount > 1 ? "s" : ""} en attente, rien cette semaine`,
      href: `/session?subject=${encodeURIComponent(neglected.subject)}`,
    });
  }

  const stale = recommendExercises(active, sessions, active.length, { now }).find((recommendation) =>
    recommendation.reasons.some((reason) => reason.startsWith("Non retravaillé") || reason === "Maîtrisé, jamais retravaillé")
  );
  if (stale) {
    items.push({
      key: "review",
      label: stale.exercise.title,
      detail: stale.reasons.join(" · "),
      href: `/exercises?focus=${stale.exercise.id}`,
    });
  }

  return items.slice(0, MAX_UPCOMING_ITEMS);
}

export interface CommandCenterProgress {
  /** Maîtrise moyenne sur les exercices actifs (0-100) — même calcul que `computeExerciseBankStats`. */
  averageMastery: number;
  /** Résultats des tentatives (réussi/partiel/échoué) sur TOUTES les séances — voir lib/history.ts#resultCounts. */
  results: ResultCounts;
  sessionCount: number;
  totalSeconds: number;
}

/** "Ta progression" — quatre chiffres, tous dérivés de modules existants (lib/recommendation.ts pour la maîtrise moyenne, lib/history.ts pour la réussite). Aucun nouveau calcul de stat ici. */
export function computeCommandCenterProgress(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): CommandCenterProgress {
  const active = exercises.filter((exercise) => !exercise.archived);
  return {
    averageMastery: computeExerciseBankStats(active, sessions, now).averageMastery,
    results: resultCounts(sessions),
    sessionCount: sessions.length,
    totalSeconds: sessions.reduce((sum, session) => sum + session.duration_seconds, 0),
  };
}
