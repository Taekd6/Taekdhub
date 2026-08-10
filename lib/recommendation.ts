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
 * Tentatives avec résultat renseigné pour un exercice donné, les plus
 * récentes en premier — Sprint 5 (suivi réel des résultats). Les séances sans
 * résultat (`result === null`, séance libre ou antérieure à ce champ) sont
 * ignorées : on ne sait rien de leur issue, donc elles ne doivent influencer
 * ni les raisons ni le score (voir la doc de `WorkSession.result`).
 */
function attemptsWithResult(sessions: WorkSession[], exerciseId: string): WorkSession[] {
  return sessions
    .filter((session) => session.exercise_id === exerciseId && session.result)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

/** Fenêtre d'analyse pour détecter des échecs répétés — les 3 tentatives les plus récentes, pas tout l'historique. */
const RECENT_ATTEMPTS_WINDOW = 3;

/** Nombre d'échecs parmi les tentatives récentes (déjà triées, plus récentes en premier). */
function recentFailureCount(attempts: WorkSession[]): number {
  return attempts.slice(0, RECENT_ATTEMPTS_WINDOW).filter((attempt) => attempt.result === "échoué").length;
}

/** Longueur de la série de réussites consécutives la plus récente (s'arrête à la première tentative non réussie). */
function recentSuccessStreak(attempts: WorkSession[]): number {
  let streak = 0;
  for (const attempt of attempts) {
    if (attempt.result !== "réussi") break;
    streak++;
  }
  return streak;
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
 *
 * `attempts` (Sprint 5) : tentatives avec résultat, déjà filtrées pour cet
 * exercice et triées par récence (voir `attemptsWithResult`). Un exercice
 * sans tentative avec résultat (tableau vide — jamais tenté, ou seulement des
 * séances sans résultat renseigné) n'obtient aucune raison ni bonus
 * supplémentaire de cette section : le comportement "jamais tenté" / "à
 * revoir" existant reste strictement inchangé.
 */
function evaluateExercise(exercise: Exercise, minutesSpent: number, attempts: WorkSession[], now: Date): string[] {
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
  // Échec récent : signal fort, exprimé comme un critère d'inclusion à part
  // entière (un échec suffit à justifier de revoir l'exercice, même si aucun
  // autre critère n'est réuni). Deux raisons mutuellement exclusives : la
  // plus forte ("Plusieurs échecs") remplace la plus faible.
  const failures = recentFailureCount(attempts);
  if (failures >= 2) reasons.push("Plusieurs échecs");
  else if (attempts[0]?.result === "échoué") reasons.push("Échec récent");
  // Une réussite récente n'est jamais, à elle seule, un critère d'inclusion
  // (même logique que "Favori" ci-dessous) : elle ne fait que compléter les
  // raisons d'un exercice déjà retenu par ailleurs.
  if (reasons.length > 0 && attempts[0]?.result === "réussi") reasons.push("Réussi récemment");
  // Le favori n'est jamais un critère d'inclusion à lui seul (un exercice
  // favori déjà maîtrisé et récent n'a aucune raison de revenir) : il ne
  // s'ajoute qu'aux raisons déjà réunies, pour un exercice retenu par
  // ailleurs — voir `urgencyScore` pour son (léger) effet sur le tri.
  if (reasons.length > 0 && exercise.favorite) reasons.push("Favori");
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
 *
 * `attempts` (Sprint 5) : voir la doc de `evaluateExercise` — sans tentative
 * avec résultat, `failureBonus` et `successPenalty` valent 0 et le score est
 * strictement identique à avant ce sprint.
 */
function urgencyScore(exercise: Exercise, minutesSpent: number, attempts: WorkSession[], now: Date): number {
  const masteryGap = (100 - exercise.mastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const priorityWeight = exercise.priority * 8; // 8 à 40
  const statusWeight = STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une priorité élevée ou une maîtrise très faible.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  const staleBonus = staleMasteryBonus(exercise, now); // 0 à 30, voir staleMasteryBonus
  // Léger coup de pouce, jamais déterminant seul (comparable à neverWorkedBonus) :
  // entre deux exercices par ailleurs comparables, celui marqué favori remonte
  // légèrement — mais un favori ne devient jamais éligible que par ce bonus
  // (voir la garde `reasons.length > 0` dans `evaluateExercise`).
  const favoriteBonus = exercise.favorite ? 10 : 0;
  // Un échec récent doit remonter fortement l'exercice — comparable en
  // amplitude à masteryGap/statusWeight, deux échecs récents pèsent plus
  // qu'une simple priorité élevée. Plafonné pour ne jamais, à lui seul,
  // écraser tous les autres signaux.
  const failureBonus = Math.min(45, recentFailureCount(attempts) * 20); // 0 à 45
  // À l'inverse, une série de réussites récentes fait progressivement
  // redescendre l'exercice — jamais jusqu'à l'exclure (ce n'est pas un
  // critère d'exclusion, seulement un effet sur le tri), et d'une amplitude
  // comparable à favoriteBonus/momentumBonus, pas dominante.
  const successPenalty = Math.min(24, recentSuccessStreak(attempts) * 8); // 0 à 24
  return (
    masteryGap +
    priorityWeight +
    statusWeight +
    neverWorkedBonus +
    momentumBonus +
    staleBonus +
    favoriteBonus +
    failureBonus -
    successPenalty
  );
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
/**
 * Réordonne les candidats (déjà triés par score décroissant) pour éviter que
 * les premiers de la liste s'entassent sur un seul chapitre : un exercice
 * sans `chapter_id` compte comme son propre groupe par matière (jamais
 * mélangé à un autre chapitre, ni traité comme "diversifié" à tort).
 *
 * Round-robin déterministe, pas une pénalité numérique de plus à calibrer :
 * on prend le meilleur candidat de chaque chapitre représenté, dans l'ordre
 * où ces chapitres sont apparus (donc le chapitre le plus urgent d'abord),
 * puis on recommence un tour pour le deuxième meilleur de chaque chapitre,
 * etc. Le score d'origine décide QUELS chapitres passent en premier ; le
 * round-robin décide seulement de ne jamais répéter un chapitre tant qu'une
 * alternative existe. Aucun candidat n'est perdu — un chapitre épuisé est
 * simplement sauté aux tours suivants, jamais remplacé par du bourrage.
 */
function diversifyByChapter(candidates: ExerciseRecommendation[]): ExerciseRecommendation[] {
  const byGroup = new Map<string, ExerciseRecommendation[]>();
  const groupOrder: string[] = [];
  for (const candidate of candidates) {
    const key = candidate.exercise.chapter_id ?? `subject:${candidate.exercise.subject}`;
    let group = byGroup.get(key);
    if (!group) {
      group = [];
      byGroup.set(key, group);
      groupOrder.push(key);
    }
    group.push(candidate);
  }

  const result: ExerciseRecommendation[] = [];
  for (let round = 0; result.length < candidates.length; round++) {
    let addedThisRound = false;
    for (const key of groupOrder) {
      const group = byGroup.get(key)!;
      if (round < group.length) {
        result.push(group[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  return result;
}

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
    const attempts = attemptsWithResult(sessions, exercise.id);
    const reasons = evaluateExercise(exercise, minutesSpent, attempts, now);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent, attempts, now), reasons });
  }
  candidates.sort((a, b) => b.score - a.score);
  const diversified = diversifyByChapter(candidates);

  if (options.availableMinutes === undefined) return diversified.slice(0, limit);
  return selectWithinBudget(diversified, sessions, limit, options.availableMinutes);
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
    const attempts = attemptsWithResult(sessions, exercise.id);
    if (evaluateExercise(exercise, minutesSpent, attempts, now).length > 0) toReviewCount++;
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
