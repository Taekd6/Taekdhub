import { minutesByExerciseMap } from "@/lib/study";
import type { Exercise, ExerciseStatus, WorkSession } from "@/lib/supabase/types";

/**
 * Moteur de révision — Sprint 3A.
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
 * ## Extensibilité (pensé pour les sprints futurs)
 * - **Répétition espacée** : ajouter un critère dans `evaluateExercise` (ex.
 *   "date de prochaine révision dépassée") et un terme dans `urgencyScore`
 *   n'affecte aucun des critères/termes existants — le moteur n'a pas à être
 *   réécrit, juste étendu.
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
function evaluateExercise(exercise: Exercise, minutesSpent: number): string[] {
  const reasons: string[] = [];
  if (exercise.mastery <= 25) reasons.push("Maîtrise faible");
  if (exercise.priority >= 4) reasons.push("Priorité élevée");
  if (isNeverWorked(exercise, minutesSpent)) reasons.push("Jamais travaillé");
  if (exercise.status === "en cours") reasons.push("En cours");
  if (exercise.status === "à revoir") reasons.push("Marqué à revoir");
  return reasons;
}

/** Contribution du statut au score d'urgence — un exercice "maîtrisé" est déprioritisé, sans jamais être exclu (voir `evaluateExercise`). */
const STATUS_WEIGHT: Record<ExerciseStatus, number> = {
  "à faire": 10,
  "en cours": 25,
  "à revoir": 40,
  maîtrisé: -30,
};

/**
 * Score d'urgence continu, utilisé UNIQUEMENT pour ordonner les exercices
 * déjà retenus par `evaluateExercise` (pas pour décider de leur inclusion).
 * Chaque terme est indépendant et pondéré séparément — ajuster un poids ou
 * ajouter un terme n'affecte pas les autres.
 */
function urgencyScore(exercise: Exercise, minutesSpent: number): number {
  const masteryGap = (100 - exercise.mastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const priorityWeight = exercise.priority * 8; // 8 à 40
  const statusWeight = STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une priorité élevée ou une maîtrise très faible.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  return masteryGap + priorityWeight + statusWeight + neverWorkedBonus + momentumBonus;
}

export interface ExerciseRecommendation {
  exercise: Exercise;
  /** Score d'urgence — sert au tri, n'a pas de signification absolue en dehors de ce classement. */
  score: number;
  /** Raisons lisibles, pour que l'utilisateur comprenne immédiatement pourquoi cet exercice est proposé. */
  reasons: string[];
}

/**
 * Retourne les meilleurs exercices à retravailler, classés du plus urgent au
 * moins urgent. Fonction pure : aucun effet de bord, aucune dépendance à
 * autre chose que ses arguments.
 */
export function recommendExercises(exercises: Exercise[], sessions: WorkSession[], limit = 6): ExerciseRecommendation[] {
  const minutesByExercise = minutesByExerciseMap(sessions);
  const candidates: ExerciseRecommendation[] = [];
  for (const exercise of exercises) {
    if (exercise.archived) continue;
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const reasons = evaluateExercise(exercise, minutesSpent);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent), reasons });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
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
export function computeExerciseBankStats(exercises: Exercise[], sessions: WorkSession[]): ExerciseBankStats {
  const minutesByExercise = minutesByExerciseMap(sessions);
  const active = exercises.filter((exercise) => !exercise.archived);

  let toReviewCount = 0;
  let neverWorkedCount = 0;
  let masterySum = 0;
  let prioritySum = 0;

  for (const exercise of active) {
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    if (evaluateExercise(exercise, minutesSpent).length > 0) toReviewCount++;
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
