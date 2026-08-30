import { computeDailyPlan, type DailyPlan, type StoredPlan } from "@/lib/plan";
import { estimatedDurationMinutes, recommendExercises } from "@/lib/recommendation";
import { isExerciseEngaged } from "@/lib/progress";
import { subjects } from "@/lib/study";
import type { Chapter, Goal, GoalPriority } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Adaptive Planning Engine — "objectif → plan → journée → séance → résultats
 * → adaptation du plan".
 *
 * Ce module ne réévalue RIEN de ce que `lib/recommendation.ts` sait déjà
 * faire (inclusion, score d'urgence, adéquation à la difficulté, décroissance,
 * repos, diversité par chapitre/matière) : il DÉLIMITE un périmètre
 * (`scopeToGoal`) puis appelle `computeDailyPlan` (lib/plan.ts) sur ce
 * périmètre, exactement comme le fait déjà le Dashboard sur la banque
 * entière. La seule logique réellement nouvelle ici est :
 *
 * 1. un VERDICT de préparation qui tient compte du TEMPS restant (`Goal.
 *    targetDate`), ce qu'aucun module existant ne fait (lib/readiness.ts
 *    juge une matière sans jamais regarder une échéance) ;
 * 2. un ARBITRAGE entre plusieurs objectifs actifs pour répartir le budget
 *    d'une même journée, pour ne jamais laisser un seul objectif (ou une
 *    seule matière) monopoliser toute la séance du jour.
 *
 * DÉLIBÉRÉMENT SANS ÉTAT : aucun "plan prévu" n'est jamais persisté jour par
 * jour. Chaque fonction ici est pure et recalculée à la demande à partir de
 * `exercises`/`sessions` À L'INSTANT T — exactement le même principe que
 * `computeDailyPlan` lui-même. C'est ce qui règle, par construction et sans
 * code dédié, toute la Phase "replanification" : une journée manquée, un
 * échec, une série de réussites ne sont jamais "diffés" contre un plan
 * figé — la prochaine consultation recalcule simplement tout depuis l'état
 * réel, qui a déjà changé. Éviter un système à état (plan stocké + logique
 * de réconciliation plan/réalité) est un choix délibéré : plus simple, zéro
 * risque de désynchronisation, zéro donnée supplémentaire à faire survivre à
 * une réconciliation de banque.
 */

/** Exercices actifs (non archivés) qui entrent dans le périmètre d'un objectif — matière ciblée, et chapitre ciblé si l'objectif en précise. */
export function scopeToGoal(goal: Goal, exercises: Exercise[]): Exercise[] {
  const active = exercises.filter((exercise) => !exercise.archived && goal.subjects.includes(exercise.subject));
  if (goal.chapterIds.length === 0) return active;
  const chapterIds = new Set(goal.chapterIds);
  return active.filter((exercise) => exercise.chapter_id !== null && chapterIds.has(exercise.chapter_id));
}

export type GoalReadinessLevel = "prêt" | "bien engagé" | "à consolider" | "en retard" | "pas commencé";

export const GOAL_READINESS_META: Record<GoalReadinessLevel, { label: string; badge: "success" | "warning" | "danger" | "default" }> = {
  "prêt": { label: "Prêt", badge: "success" },
  "bien engagé": { label: "Bien engagé", badge: "success" },
  "à consolider": { label: "À consolider", badge: "warning" },
  "en retard": { label: "En retard", badge: "danger" },
  "pas commencé": { label: "Pas encore commencé", badge: "default" },
};

export interface GoalReadiness {
  goal: Goal;
  /** `false` si le périmètre de l'objectif ne contient aucun exercice actif (chapitre vide/entièrement archivé) — l'objectif ne peut alors produire aucun plan. */
  hasScope: boolean;
  /** Jours restants jusqu'à `targetDate`, `null` si aucune échéance. Négatif si l'échéance est dépassée. */
  daysRemaining: number | null;
  /** Moyenne de `Exercise.mastery` sur le périmètre (0-100) — un chiffre RÉEL, jamais un pourcentage inventé (voir la doc de `Goal`). 0 si le périmètre est vide. */
  coveragePercent: number;
  /** Nombre d'exercices du périmètre encore signalés par `recommendExercises` — le "reste à faire" réel, pas une estimation. */
  flaggedCount: number;
  /** Somme de `estimatedDurationMinutes` (lib/recommendation.ts) sur les exercices signalés — le volume de travail restant, en minutes. */
  estimatedMinutesRemaining: number;
  /** Minutes/jour qu'il faudrait investir pour finir avant l'échéance — `null` sans échéance, ou si l'échéance est déjà dépassée (voir `daysRemaining`). */
  requiredDailyMinutes: number | null;
  level: GoalReadinessLevel;
}

/**
 * Au-delà de ce multiple du budget quotidien habituel de l'élève
 * (`Preferences.dailyGoalMinutes`), le rythme requis par l'échéance n'est
 * plus réaliste : "en retard", pas "bien engagé". Un multiple du RYTHME
 * PROPRE À L'ÉLÈVE plutôt qu'un seuil absolu (ex. "90 minutes") — un chiffre
 * fixe serait arbitraire ; celui-ci reste défendable ("il te faudrait 1,5×
 * ton rythme habituel").
 */
const SUSTAINABLE_PACE_MULTIPLIER = 1.5;
/** Seuil de couverture (mastery moyenne, périmètre déjà engagé) en dessous duquel un objectif SANS échéance reste "à consolider" plutôt que "bien engagé" — même seuil que `lib/readiness.ts#readinessLevel`, pour ne pas juger différemment deux notions voisines. */
const COVERAGE_ENGAGED_THRESHOLD = 50;

/**
 * Verdict de préparation d'un objectif — un CHIFFRE quand il est défendable
 * (`coveragePercent`, `flaggedCount`, dérivés tels quels de la maîtrise
 * réelle), un VERDICT QUALITATIF pour la question que le chiffre seul ne
 * peut pas trancher honnêtement : "à ce rythme, arriverai-je à temps ?"
 * (voir la doc de la Phase Progression du chantier).
 */
export function computeGoalReadiness(
  goal: Goal,
  exercises: Exercise[],
  sessions: WorkSession[],
  dailyBudgetMinutes: number,
  now: Date = new Date()
): GoalReadiness {
  const scoped = scopeToGoal(goal, exercises);
  const hasScope = scoped.length > 0;
  const coveragePercent = hasScope ? Math.round(scoped.reduce((sum, exercise) => sum + exercise.mastery, 0) / scoped.length) : 0;
  const flagged = recommendExercises(scoped, sessions, scoped.length, { now });
  const flaggedCount = flagged.length;
  const estimatedMinutesRemaining = flagged.reduce((sum, { exercise }) => sum + estimatedDurationMinutes(exercise, sessions), 0);

  const daysRemaining = goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / 86400000) : null;
  const requiredDailyMinutes = daysRemaining !== null && daysRemaining > 0 ? Math.ceil(estimatedMinutesRemaining / daysRemaining) : null;

  const engaged = scoped.some(isExerciseEngaged);

  let level: GoalReadinessLevel;
  if (!hasScope) level = "pas commencé";
  else if (flaggedCount === 0) level = "prêt";
  else if (!engaged) level = "pas commencé";
  else if (daysRemaining !== null && daysRemaining <= 0) level = "en retard";
  else if (requiredDailyMinutes !== null && dailyBudgetMinutes > 0 && requiredDailyMinutes > dailyBudgetMinutes * SUSTAINABLE_PACE_MULTIPLIER) level = "en retard";
  else if (coveragePercent >= COVERAGE_ENGAGED_THRESHOLD || daysRemaining !== null) level = "bien engagé";
  else level = "à consolider";

  return { goal, hasScope, daysRemaining, coveragePercent, flaggedCount, estimatedMinutesRemaining, requiredDailyMinutes, level };
}

/** Poids relatif de la priorité manuelle de l'élève — un levier volontairement modeste (voir `lib/recommendation.ts#favoriteBonus`, même philosophie : oriente, ne domine jamais l'urgence réelle). */
const PRIORITY_WEIGHT: Record<GoalPriority, number> = { 1: 0.7, 2: 1, 3: 1.4 };
/** Au-delà de cet horizon, une échéance lointaine ne rend pas un objectif plus urgent qu'un autre — voir Cas 2 du chantier : "objectif dans 30 jours + chapitre faible mais récemment travaillé → ne pas sur-prioriser artificiellement". La sur-priorisation par échéance ne s'active qu'à l'approche réelle. */
const DEADLINE_URGENCY_HORIZON_DAYS = 14;

/**
 * Poids d'un objectif pour l'arbitrage du budget d'une journée (voir
 * `computeGoalsDailyPlan`) — 0 si l'objectif n'a rien à proposer (déjà
 * "prêt", ou périmètre vide) : il ne consomme alors aucune part du budget,
 * laissée aux autres objectifs actifs.
 *
 * Trois facteurs, tous déjà présents dans `GoalReadiness` — aucun nouveau
 * signal inventé :
 * - l'échéance (`daysRemaining`), qui ne pèse qu'à l'approche réelle ;
 * - la faiblesse (`coveragePercent`) — plus la couverture réelle est basse,
 *   plus le poids monte (jusqu'à ×2) ;
 * - la priorité manuelle de l'élève (`PRIORITY_WEIGHT`).
 */
export function goalUrgencyWeight(readiness: GoalReadiness): number {
  if (!readiness.hasScope || readiness.flaggedCount === 0) return 0;
  const deadlineFactor =
    readiness.daysRemaining === null
      ? 1
      : DEADLINE_URGENCY_HORIZON_DAYS / Math.max(1, Math.min(DEADLINE_URGENCY_HORIZON_DAYS, readiness.daysRemaining));
  const weaknessFactor = 1 + (100 - readiness.coveragePercent) / 100; // 1 (100% couvert) à 2 (0% couvert)
  return deadlineFactor * weaknessFactor * PRIORITY_WEIGHT[readiness.goal.priority];
}

/** Un plan du jour rattaché à l'objectif dont il provient — mêmes `PlanBlock` que `lib/plan.ts`, jamais une seconde structure. */
export interface GoalDailyPlan {
  goal: Goal;
  readiness: GoalReadiness;
  plan: DailyPlan;
}

/**
 * RÉPARTIT le budget d'une journée entre les objectifs actifs, au prorata de
 * leur urgence (`goalUrgencyWeight`), puis appelle `computeDailyPlan`
 * (lib/plan.ts) — inchangée — sur le périmètre de CHAQUE objectif avec sa
 * part. Aucune recommandation n'est recalculée ici : ce module choisit
 * seulement QUI reçoit COMBIEN de minutes, exactement le rôle que
 * `lib/plan.ts` joue déjà pour les intentions (consolider/réviser/
 * progresser) à l'intérieur d'UN objectif.
 *
 * Traité par urgence décroissante et en retirant au fur et à mesure les
 * exercices déjà retenus (`usedIds`) : deux objectifs qui partagent un même
 * chapitre ne se voient jamais proposer deux fois le même exercice le même
 * jour — l'objectif le plus urgent choisit en premier.
 *
 * Un objectif déjà "prêt" (voir `goalUrgencyWeight`) ne consomme aucune part
 * du budget : tout le temps disponible revient aux objectifs qui en ont
 * encore besoin, sans qu'il faille l'exclure explicitement en amont.
 */
export function computeGoalsDailyPlan(goals: Goal[], exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], totalMinutes: number, dailyBudgetMinutes: number, now: Date = new Date()): GoalDailyPlan[] {
  const active = goals.filter((goal) => goal.status === "active");
  if (active.length === 0 || totalMinutes <= 0) return [];

  const weighted = active
    .map((goal) => ({ goal, readiness: computeGoalReadiness(goal, exercises, sessions, dailyBudgetMinutes, now) }))
    .map(({ goal, readiness }) => ({ goal, readiness, weight: goalUrgencyWeight(readiness) }))
    .filter(({ weight }) => weight > 0)
    // Le plus urgent choisit en premier (voir la doc ci-dessus) — à poids
    // égal, l'échéance la plus proche puis la création la plus ancienne
    // décident, pour un ordre déterministe qui ne dépend jamais de l'ordre
    // incident du tableau `goals`.
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const aDays = a.readiness.daysRemaining ?? Number.POSITIVE_INFINITY;
      const bDays = b.readiness.daysRemaining ?? Number.POSITIVE_INFINITY;
      if (aDays !== bDays) return aDays - bDays;
      return new Date(a.goal.createdAt).getTime() - new Date(b.goal.createdAt).getTime();
    });

  if (weighted.length === 0) return [];
  const totalWeight = weighted.reduce((sum, { weight }) => sum + weight, 0);

  const usedIds = new Set<string>();
  const results: GoalDailyPlan[] = [];
  for (const { goal, readiness, weight } of weighted) {
    const share = Math.round(totalMinutes * (weight / totalWeight));
    if (share <= 0) continue;
    const scoped = scopeToGoal(goal, exercises).filter((exercise) => !usedIds.has(exercise.id));
    // `null` : la couverture ne se mesure jamais sur un périmètre scopé —
    // elle y verrait un silence là où l'élève a travaillé hier (voir la doc
    // du paramètre `coverageBank`, lib/plan.ts).
    const plan = computeDailyPlan(scoped, sessions, chapters, share, now, null);
    if (plan.blocks.length === 0) continue;
    plan.blocks.forEach((block) => block.picks.forEach(({ exercise }) => usedIds.add(exercise.id)));
    results.push({ goal, readiness, plan });
  }
  return results;
}

/** Sérialise un plan multi-objectifs pour la traversée Dashboard → /session — même mécanisme EXACT que `serializePlan`/`buildFreeSessionPlan` (lib/plan.ts, `PLAN_STORAGE_KEY`) : `SessionRunner` n'a besoin d'aucune modification, un plan d'objectif n'est qu'un `StoredPlan` de plus. */
export function serializeGoalsDailyPlan(goalPlans: GoalDailyPlan[]): StoredPlan {
  return {
    items: goalPlans.flatMap(({ goal, plan }) =>
      plan.blocks.flatMap((block) =>
        block.picks.map(({ exercise, reasons }) => ({
          exerciseId: exercise.id,
          // La raison du moteur reste en tête (déjà explicable telle
          // quelle) ; le contexte d'objectif s'ajoute, jamais ne la remplace.
          reasons: [...reasons, `Objectif : ${goal.title}`],
        }))
      )
    ),
    requestedMinutes: goalPlans.reduce((sum, { plan }) => sum + plan.totalMinutes, 0),
    source: "plan-du-jour",
  };
}

/**
 * Aperçu HONNÊTE des prochaines séances sur UN objectif — délibérément PAS
 * daté ("Lundi", "Mardi") : personne ne peut prédire aujourd'hui la
 * performance réelle de demain, un plan à J+2 daté serait déjà une fiction
 * au moment où il s'affiche. `count` séances successives de `sessionMinutes`
 * sont projetées à partir de l'état ACTUEL, en retirant à chaque tour les
 * exercices déjà utilisés par la séance précédente — la même mécanique que
 * `computeGoalsDailyPlan` entre objectifs, appliquée ici entre séances
 * successives d'un même objectif. S'arrête dès qu'une séance ne peut plus
 * rien proposer (périmètre épuisé) plutôt que de forcer `count` résultats.
 */
export function computeUpcomingGoalSessions(
  goal: Goal,
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  sessionMinutes: number,
  count: number,
  now: Date = new Date()
): DailyPlan[] {
  const scoped = scopeToGoal(goal, exercises);
  const usedIds = new Set<string>();
  const plans: DailyPlan[] = [];
  for (let i = 0; i < count; i++) {
    const remaining = scoped.filter((exercise) => !usedIds.has(exercise.id));
    const plan = computeDailyPlan(remaining, sessions, chapters, sessionMinutes, now, null);
    if (plan.blocks.length === 0) break;
    plan.blocks.forEach((block) => block.picks.forEach(({ exercise }) => usedIds.add(exercise.id)));
    plans.push(plan);
  }
  return plans;
}

/**
 * "Pourquoi ce plan, maintenant ?" au niveau d'un objectif — même principe
 * que `lib/recommendation.ts#explainReasons`, mais pour la raison
 * D'OBJECTIF, pas la raison D'EXERCICE (déjà expliquée par ailleurs). Ne
 * fabrique jamais une urgence qui n'existe pas : sans échéance, la phrase se
 * limite au signal de faiblesse réel.
 */
export function explainGoalPlan(readiness: GoalReadiness): string {
  const { goal, daysRemaining, level } = readiness;
  if (level === "en retard" && daysRemaining !== null && daysRemaining > 0) {
    return `Ton objectif « ${goal.title} » approche (${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}) et demande encore du travail — priorité aujourd'hui.`;
  }
  if (level === "en retard") {
    return `L'échéance de « ${goal.title} » est dépassée, mais il reste du travail — à rattraper en priorité.`;
  }
  if (daysRemaining !== null) {
    return `Tu as un objectif dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} (« ${goal.title} ») — on avance dessus aujourd'hui.`;
  }
  return `« ${goal.title} » reste ton objectif actif le plus prioritaire aujourd'hui.`;
}

/** Nom d'affichage du périmètre d'un objectif — "toutes matières" seulement si les 7 matières y figurent réellement (voir `goalSubjects`, lib/storage.ts), jamais une liste tronquée illisible. */
export function describeGoalScope(goal: Goal): string {
  if (goal.subjects.length >= subjects.length) return "Toutes matières";
  return goal.subjects.join(" · ");
}
