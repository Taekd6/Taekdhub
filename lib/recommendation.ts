import { minutesByExerciseMap, totalSeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, ExerciseStatus, WorkSession } from "@/lib/supabase/types";

/**
 * Moteur de révision — Sprint 3A, étendu au Sprint 4 (décroissance de
 * maîtrise + sélection bornée par le temps).
 *
 * Toute la logique de "quel exercice proposer, et pourquoi" vit ici, dans ce
 * seul module. Aucune règle de recommandation ne doit exister ailleurs
 * (composants, pages) : ils ne font qu'appeler `recommendExercises` /
 * `computeExerciseBankStats` et afficher le résultat.
 *
 * ## Principe
 * Un exercice est retenu s'il correspond à au moins un critère explicite
 * (`evaluateExercise`), puis les exercices retenus sont ORDONNÉS par un
 * score continu (`urgencyScore`). Séparer "qui est retenu" de "dans quel
 * ordre" rend chaque partie indépendamment lisible et modifiable : ajouter
 * un critère d'inclusion ne touche pas au calcul du score, et inversement.
 *
 * ## Sprint 4 : décroissance de maîtrise (voir `isStaleMastery`/`staleMasteryBonus`)
 * Un exercice "maîtrisé" non retravaillé depuis longtemps redevient éligible
 * (nouveau critère dans `evaluateExercise`) et son score augmente
 * progressivement avec le temps écoulé (nouveau terme, plafonné, dans
 * `urgencyScore`). Ni `status` ni `mastery` ne sont jamais modifiés par ce
 * mécanisme : seul le classement en est influencé.
 *
 * ## Sprint 4 : sélection bornée par le temps (voir `selectWithinBudget`)
 * `recommendExercises` accepte un budget optionnel (`availableMinutes`). Sans
 * lui, comportement inchangé (top N par score). Avec lui, la même liste
 * triée par score est parcourue et remplie gloutonnement dans la limite du
 * budget — jamais d'exercice forcé au-delà du temps disponible, jamais
 * d'arrêt prématuré si un exercice plus loin dans la liste est plus court.
 *
 * ## Extensibilité (pensé pour les sprints futurs)
 * - **Prochaines révisions** : `ExerciseRecommendation` peut recevoir un
 *   champ optionnel supplémentaire (ex. `nextReviewAt`) sans casser les
 *   appelants actuels, qui n'en liraient simplement pas plus.
 * - **Statistiques avancées** : `computeExerciseBankStats` est volontairement
 *   séparée de `recommendExercises` (même s'il réutilise `evaluateExercise`
 *   pour le compte "à revoir") — une future page de stats peut y ajouter des
 *   agrégats sans toucher à la recommandation elle-même.
 */

/**
 * Un exercice jamais travaillé : aucune tentative, aucune minute enregistrée.
 * Exportée (Sprint 3B) pour que lib/progress.ts et ses appelants réutilisent
 * ce critère au lieu de le redéfinir.
 */
export function isNeverWorked(exercise: Exercise, minutesSpent: number): boolean {
  return exercise.attempts === 0 && minutesSpent === 0;
}

/**
 * Nombre de jours sans retravail au-delà duquel un exercice "maîtrisé"
 * redevient éligible à la recommandation (voir `isStaleMastery`). Trois
 * semaines : assez long pour ne pas rappeler un exercice tout juste maîtrisé,
 * assez court pour détecter un oubli avant qu'il ne devienne un trou le jour
 * d'un DS.
 */
export const MASTERY_STALE_DAYS = 21;

/** `null` si l'exercice n'a jamais eu de séance focus achevée dessus (voir `Exercise.last_worked_at`). */
function daysSinceLastWorked(exercise: Exercise, now: Date): number | null {
  if (!exercise.last_worked_at) return null;
  return Math.floor((now.getTime() - new Date(exercise.last_worked_at).getTime()) / 86400000);
}

/**
 * Un exercice "maîtrisé" mais non retravaillé depuis longtemps ne doit jamais
 * rester invisible indéfiniment : sans ce critère, un oubli réel ne serait
 * détecté qu'au moment du DS. Ne modifie jamais `status` ni `mastery` — voir
 * la note Sprint 4 en tête de fichier.
 *
 * `last_worked_at` nul (jamais de séance focus achevée dessus, y compris pour
 * une fiche marquée "maîtrisé" à la main) est traité comme "tout juste au
 * seuil", pas comme "infiniment ancien" : on n'a aucune preuve de fraîcheur,
 * mais on n'invente pas non plus un signal fort à partir d'une donnée absente
 * (même logique que `lib/week.ts#neglectedSubjects`).
 */
function isStaleMastery(exercise: Exercise, now: Date): boolean {
  if (exercise.status !== "maîtrisé") return false;
  const days = daysSinceLastWorked(exercise, now);
  return days === null || days >= MASTERY_STALE_DAYS;
}

/**
 * Décide si un exercice mérite d'être proposé pour révision, et pourquoi.
 * Chaque critère est indépendant et lisible en une ligne — c'est ici, et
 * uniquement ici, qu'on ajoute un nouveau critère d'inclusion.
 *
 * Volontairement PAS de règle "exclure si status = maîtrisé" : status et
 * mastery sont deux champs distincts (décision Sprint 2.5, jamais mélangés).
 * Un exercice marqué "maîtrisé" mais dont la maîtrise réelle est basse doit
 * pouvoir remonter — c'est une incohérence réelle que l'utilisateur a
 * intérêt à voir, pas un bug à masquer.
 */
function evaluateExercise(exercise: Exercise, minutesSpent: number, now: Date): string[] {
  const reasons: string[] = [];
  if (exercise.mastery <= 25) reasons.push("Maîtrise faible");
  if (exercise.priority >= 4) reasons.push("Priorité élevée");
  if (isNeverWorked(exercise, minutesSpent)) reasons.push("Jamais travaillé");
  if (exercise.status === "en cours") reasons.push("En cours");
  if (exercise.status === "à revoir") reasons.push("Marqué à revoir");
  if (isStaleMastery(exercise, now)) {
    const days = daysSinceLastWorked(exercise, now);
    reasons.push(days === null ? "Maîtrisé, jamais retravaillé" : `Non retravaillé depuis ${days} j`);
  }
  return reasons;
}

/** Contribution du statut au score d'urgence — un exercice "maîtrisé" est déprioritisé, sans jamais être exclu (voir `evaluateExercise`). */
const STATUS_WEIGHT: Record<ExerciseStatus, number> = {
  "à faire": 10,
  "en cours": 25,
  "à revoir": 40,
  maîtrisé: -30,
};

/** Plafond du bonus de décroissance (voir `staleMasteryBonus`) — comparable en amplitude à `momentumBonus`, jamais dominant. */
const MASTERY_STALE_BONUS_CAP = 30;
const MASTERY_STALE_BONUS_PER_DAY = 0.5;

/**
 * Contribution continue de la décroissance au score — 0 avant le seuil de
 * `MASTERY_STALE_DAYS`, puis croît progressivement (jamais un saut) avec le
 * nombre de jours de retard, plafonnée pour ne jamais dominer les autres
 * termes (même logique que `momentumBonus`). `last_worked_at` nul est traité
 * comme "tout juste au seuil" (bonus nul) — voir `isStaleMastery`.
 */
function staleMasteryBonus(exercise: Exercise, now: Date): number {
  if (exercise.status !== "maîtrisé") return 0;
  const days = daysSinceLastWorked(exercise, now);
  const effectiveDays = days ?? MASTERY_STALE_DAYS;
  if (effectiveDays < MASTERY_STALE_DAYS) return 0;
  const overdueDays = effectiveDays - MASTERY_STALE_DAYS;
  return Math.min(MASTERY_STALE_BONUS_CAP, overdueDays * MASTERY_STALE_BONUS_PER_DAY);
}

/**
 * Score d'urgence continu, utilisé UNIQUEMENT pour ordonner les exercices
 * déjà retenus par `evaluateExercise` (pas pour décider de leur inclusion).
 * Chaque terme est indépendant et pondéré séparément — ajuster un poids ou
 * ajouter un terme n'affecte pas les autres.
 */
function urgencyScore(exercise: Exercise, minutesSpent: number, now: Date): number {
  const masteryGap = (100 - exercise.mastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const priorityWeight = exercise.priority * 8; // 8 à 40
  const statusWeight = STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une priorité élevée ou une maîtrise très faible.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  const staleBonus = staleMasteryBonus(exercise, now); // 0 à 30, voir staleMasteryBonus
  return masteryGap + priorityWeight + statusWeight + neverWorkedBonus + momentumBonus + staleBonus;
}

export interface ExerciseRecommendation {
  exercise: Exercise;
  /** Score d'urgence — sert au tri, n'a pas de signification absolue en dehors de ce classement. */
  score: number;
  /** Raisons lisibles, pour que l'utilisateur comprenne immédiatement pourquoi cet exercice est proposé. */
  reasons: string[];
}

/** Durée moyenne réelle d'une séance déjà enregistrée (toutes matières), en minutes — `null` si aucune séance n'a de durée. */
function averageSessionMinutes(sessions: WorkSession[]): number | null {
  const withDuration = sessions.filter((session) => session.duration_seconds > 0);
  if (withDuration.length === 0) return null;
  return secondsToWholeMinutes(totalSeconds(withDuration)) / withDuration.length;
}

/** Bloc de travail par défaut quand aucune séance n'a jamais été enregistrée — aucune autre donnée disponible pour estimer. */
const DEFAULT_ESTIMATE_MINUTES = 25;
/** Plancher d'estimation, pour ne jamais proposer un budget dérisoire (quelques minutes) qui n'aurait aucun sens en pratique. */
const MIN_ESTIMATE_MINUTES = 10;

/**
 * Durée estimée d'un exercice, en minutes — utilisée par `selectWithinBudget`
 * pour composer une séance qui tient dans le temps disponible.
 *
 * Utilise `Exercise.estimated_minutes` quand l'utilisateur l'a renseigné
 * (source la plus fiable, une estimation explicite). À défaut, dérive un
 * ordre de grandeur de l'historique réel : durée moyenne de toutes les
 * séances déjà enregistrées, mise à l'échelle par la difficulté intrinsèque
 * de l'exercice (3/5 = échelle neutre). Aucune nouvelle donnée requise :
 * uniquement `WorkSession.duration_seconds`, déjà stocké.
 */
export function estimatedDurationMinutes(exercise: Exercise, sessions: WorkSession[]): number {
  if (exercise.estimated_minutes && exercise.estimated_minutes > 0) return exercise.estimated_minutes;
  const base = averageSessionMinutes(sessions) ?? DEFAULT_ESTIMATE_MINUTES;
  const scaled = base * (exercise.difficulty / 3);
  return Math.max(MIN_ESTIMATE_MINUTES, Math.round(scaled));
}

/**
 * Compose une séance qui tient dans `availableMinutes`, à partir de candidats
 * déjà triés par score décroissant. Glouton mais volontairement PAS "premier
 * qui dépasse == arrêt" : un exercice trop long est simplement sauté, la
 * boucle continue vers le suivant (potentiellement plus court, moins urgent)
 * — c'est ce qui rend la sélection "cohérente" plutôt qu'un simple top N
 * tronqué à l'aveugle. Jamais d'exercice forcé au-delà du budget restant.
 */
function selectWithinBudget(
  candidates: ExerciseRecommendation[],
  sessions: WorkSession[],
  limit: number,
  availableMinutes: number
): ExerciseRecommendation[] {
  const selected: ExerciseRecommendation[] = [];
  let remaining = Math.max(0, availableMinutes);
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const duration = estimatedDurationMinutes(candidate.exercise, sessions);
    if (duration > remaining) continue;
    selected.push(candidate);
    remaining -= duration;
  }
  return selected;
}

export interface RecommendationOptions {
  /** Horodatage de référence pour la décroissance de maîtrise — par défaut `new Date()`. Paramétrable pour des tests déterministes. */
  now?: Date;
  /**
   * Si fourni, la sélection est bornée à ce budget (minutes) via
   * `selectWithinBudget` au lieu d'un simple top N. Omis : comportement
   * strictement inchangé (top N par score), pour ne rien casser chez les
   * appelants existants qui n'ont pas de notion de temps disponible
   * (panneau "À revoir" du Dashboard notamment).
   */
  availableMinutes?: number;
}

/**
 * Retourne les meilleurs exercices à retravailler, classés du plus urgent au
 * moins urgent — ou, si `options.availableMinutes` est fourni, la meilleure
 * sélection qui tient dans ce budget de temps (voir `selectWithinBudget`).
 * Fonction pure : aucun effet de bord, aucune dépendance à autre chose que
 * ses arguments.
 */
export function recommendExercises(
  exercises: Exercise[],
  sessions: WorkSession[],
  limit = 6,
  options: RecommendationOptions = {}
): ExerciseRecommendation[] {
  const now = options.now ?? new Date();
  const minutesByExercise = minutesByExerciseMap(sessions);
  const candidates: ExerciseRecommendation[] = [];
  for (const exercise of exercises) {
    if (exercise.archived) continue;
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const reasons = evaluateExercise(exercise, minutesSpent, now);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent, now), reasons });
  }
  candidates.sort((a, b) => b.score - a.score);

  if (options.availableMinutes === undefined) return candidates.slice(0, limit);
  return selectWithinBudget(candidates, sessions, limit, options.availableMinutes);
}

export interface ExerciseBankStats {
  /** Nombre total d'exercices qui apparaîtraient dans le tableau "À revoir" (pas seulement ceux affichés). */
  toReviewCount: number;
  /** Maîtrise moyenne sur les exercices actifs (non archivés), arrondie à l'entier. */
  averageMastery: number;
  /** Priorité moyenne sur les exercices actifs, avec une décimale. */
  averagePriority: number;
  neverWorkedCount: number;
}

/** Tableau de bord de la banque d'exercices — agrégats simples, tous dérivés des mêmes règles que `recommendExercises` (voir `evaluateExercise`). */
export function computeExerciseBankStats(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): ExerciseBankStats {
  const minutesByExercise = minutesByExerciseMap(sessions);
  const active = exercises.filter((exercise) => !exercise.archived);

  let toReviewCount = 0;
  let neverWorkedCount = 0;
  let masterySum = 0;
  let prioritySum = 0;

  for (const exercise of active) {
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    if (evaluateExercise(exercise, minutesSpent, now).length > 0) toReviewCount++;
    if (isNeverWorked(exercise, minutesSpent)) neverWorkedCount++;
    masterySum += exercise.mastery;
    prioritySum += exercise.priority;
  }

  return {
    toReviewCount,
    averageMastery: active.length ? Math.round(masterySum / active.length) : 0,
    averagePriority: active.length ? Math.round((prioritySum / active.length) * 10) / 10 : 0,
    neverWorkedCount,
  };
}
