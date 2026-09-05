import { minutesByExerciseMap, totalSeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, ExerciseStatus, WorkSession } from "@/lib/supabase/types";

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

/**
 * La dernière tentative a-t-elle réussi MAIS au prix de plusieurs indices ?
 *
 * C'est le cas que ni `result` ni `mastery` ne savaient exprimer : l'élève a
 * coché « Réussi », donc l'exercice sortait du radar — alors qu'il n'a
 * trouvé qu'en se faisant donner la moitié du raisonnement. Un bon
 * professeur le repropose ; l'ancien moteur, lui, le considérait acquis.
 */
function lastAttemptWasAssisted(attempts: WorkSession[]): boolean {
  const last = attempts[0];
  return last?.result === "réussi" && last.hints_used !== null && last.hints_used >= ASSISTED_HINTS_THRESHOLD;
}

/**
 * La dernière tentative s'est-elle arrêtée en chemin ?
 *
 * « Partiel » est le résultat le plus fréquent en prépa (on a trouvé la
 * moitié, on a séché sur la fin) et c'était le SEUL des trois que le moteur
 * n'exploitait pas du tout : ni raison, ni terme de score. Déclarer
 * « Partiel » ne changeait donc strictement rien à ce qui était proposé
 * ensuite — la réponse à « est-ce que mon résultat compte ? » était « non »
 * une fois sur trois.
 */
function lastAttemptWasPartial(attempts: WorkSession[]): boolean {
  return attempts[0]?.result === "partiel";
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
 * NIVEAU DE CONFORT — à quelle difficulté l'élève travaille réellement en ce
 * moment, déduit de ses résultats passés.
 *
 * Comble un manque de fond du moteur : `Exercise.difficulty` ne servait
 * jusqu'ici QU'À estimer une durée (voir `estimatedDurationMinutes`) et
 * n'intervenait nulle part dans le choix des exercices. Autrement dit, un
 * élève ayant réussi vingt exercices de difficulté 1 se voyait proposer un
 * difficulté 5 exactement aussi volontiers qu'un difficulté 1 — le produit
 * ne progressait pas avec lui, alors que toutes les données nécessaires
 * étaient déjà enregistrées.
 *
 * Aucune donnée nouvelle n'est requise : uniquement `WorkSession.result`
 * (déjà saisi en fin de séance focus) et `Exercise.difficulty` (déjà porté
 * par chaque fiche).
 */
const COMFORT_WINDOW = 12;
/** En dessous de ce nombre de tentatives qualifiées, on ne prétend rien savoir du niveau de l'élève — `comfortDifficulty` renvoie `null` et le score reste strictement celui d'avant. */
const COMFORT_MIN_ATTEMPTS = 3;
/** Série de réussites à partir de laquelle on propose un cran au-dessus (le seuil que l'élève voit cité dans la justification). */
const COMFORT_STEP_UP_STREAK = 3;

/**
 * Au-delà de ce nombre d'indices, une réussite cesse d'être une preuve
 * d'autonomie : l'élève a trouvé, mais guidé. Deux indices sur trois, c'est
 * la moitié du raisonnement donnée.
 */
export const ASSISTED_HINTS_THRESHOLD = 2;

/** Difficulté et niveau d'aide de chaque tentative qualifiée, les plus récentes d'abord — l'exercice disparu (archivé/supprimé) est ignoré. */
function attemptsWithDifficulty(
  exercises: Exercise[],
  sessions: WorkSession[]
): { result: AttemptResult; difficulty: number; hintsUsed: number | null }[] {
  const difficultyById = new Map(exercises.map((exercise) => [exercise.id, exercise.difficulty]));
  return sessions
    .filter((session) => session.result && session.exercise_id && difficultyById.has(session.exercise_id))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, COMFORT_WINDOW)
    .map((session) => ({
      result: session.result!,
      difficulty: difficultyById.get(session.exercise_id!)!,
      hintsUsed: session.hints_used,
    }));
}

/**
 * CE QUE LE MOTEUR SAIT DE L'ÉLÈVE, rendu lisible — même fenêtre, mêmes
 * seuils et mêmes tentatives que `comfortDifficulty` ci-dessous : c'est la
 * lecture publique de son entrée, jamais un second calcul.
 *
 * Ces deux faits pilotent déjà les recommandations (le cran de difficulté
 * visé, et la façon dont une réussite assistée est décomptée) sans avoir
 * jamais été montrés nulle part. L'élève — et le professeur qui regarde
 * l'écran — ne pouvaient donc ni les vérifier ni les contester.
 *
 * `null` tant que la fenêtre ne contient pas assez de tentatives qualifiées :
 * on ne publie pas un pourcentage calculé sur deux séances.
 */
export interface WorkingLevel {
  /** Nombre de tentatives qualifiées dans la fenêtre — l'assise du reste. */
  attempts: number;
  /** Difficulté moyenne des tentatives récentes, une décimale. */
  averageDifficulty: number;
  /** Réussites de la fenêtre (toutes, assistées comprises). */
  successes: number;
  /** Réussites obtenues SANS aide décisive (voir `ASSISTED_HINTS_THRESHOLD`) — une séance sans compteur d'indices n'est jamais comptée comme autonome. */
  autonomousSuccesses: number;
}

export function computeWorkingLevel(exercises: Exercise[], sessions: WorkSession[]): WorkingLevel | null {
  const recent = attemptsWithDifficulty(exercises, sessions);
  if (recent.length < COMFORT_MIN_ATTEMPTS) return null;
  const successes = recent.filter((attempt) => attempt.result === "réussi");
  return {
    attempts: recent.length,
    averageDifficulty: Math.round((recent.reduce((sum, a) => sum + a.difficulty, 0) / recent.length) * 10) / 10,
    successes: successes.length,
    autonomousSuccesses: successes.filter((a) => a.hintsUsed !== null && a.hintsUsed < ASSISTED_HINTS_THRESHOLD).length,
  };
}

export interface ComfortLevel {
  /** Difficulté visée maintenant (1-5, non entière possible : une cible à 2.5 tire autant vers 2 que vers 3). */
  target: number;
  /** `true` quand la cible a été relevée par une série de réussites — sert à formuler une justification honnête ("tu as réussi N exercices de ce niveau"). */
  steppedUp: boolean;
  /** Longueur de la série de réussites qui a déclenché la montée, pour la citer telle quelle. */
  successStreak: number;
}

/**
 * Renvoie `null` tant que l'élève n'a pas assez d'historique qualifié : sans
 * preuve, on n'invente pas un niveau — le classement reste alors exactement
 * celui d'avant l'introduction de ce mécanisme (garanti par les tests).
 */
export function comfortDifficulty(exercises: Exercise[], sessions: WorkSession[]): ComfortLevel | null {
  const recent = attemptsWithDifficulty(exercises, sessions);
  if (recent.length < COMFORT_MIN_ATTEMPTS) return null;

  const succeeded = recent.filter((attempt) => attempt.result === "réussi");
  const failed = recent.filter((attempt) => attempt.result === "échoué");
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  // Socle : la difficulté que l'élève RÉUSSIT. À défaut de toute réussite,
  // celle où il échoue — auquel cas on visera en dessous, juste après. À
  // défaut des deux (fenêtre entièrement composée de « partiel », cas très
  // banal), la difficulté des tentatives elles-mêmes : `average([])` vaut
  // NaN, et un seul NaN suffisait à contaminer TOUS les scores (`difficultyFit`
  // → `urgencyScore`), rendant le tri inopérant — le moteur reproposait alors
  // les mêmes exercices, dans l'ordre du fichier source, indéfiniment.
  const graded = succeeded.length > 0 ? succeeded : failed.length > 0 ? failed : recent;
  const base = average(graded.map((a) => a.difficulty));

  // La série de réussites qui autorise une montée ne compte QUE les
  // réussites autonomes : réussir trois exercices en révélant tous les
  // indices ne prouve pas qu'on est prêt pour le cran au-dessus — c'est même
  // le contraire. Une réussite assistée n'interrompt pas la série (ce n'est
  // pas un échec), elle ne la fait simplement pas progresser.
  //
  // `hintsUsed === null` (séance antérieure au champ) n'est jamais traité
  // comme "0 indice" : sans preuve d'autonomie, on ne crédite rien.
  let streak = 0;
  for (const attempt of recent) {
    if (attempt.result !== "réussi") break;
    if (attempt.hintsUsed === null || attempt.hintsUsed >= ASSISTED_HINTS_THRESHOLD) break;
    streak++;
  }
  const recentFailures = recent.slice(0, RECENT_ATTEMPTS_WINDOW).filter((a) => a.result === "échoué").length;

  // Un seul cran à la fois, jamais un saut : on accompagne la progression,
  // on ne la devance pas.
  let target = base;
  let steppedUp = false;
  if (streak >= COMFORT_STEP_UP_STREAK) {
    target = base + 1;
    steppedUp = true;
  } else if (recentFailures >= 2) {
    target = base - 1;
  }

  return { target: Math.min(5, Math.max(1, target)), steppedUp, successStreak: streak };
}

/** Plafond du terme d'adéquation en difficulté — volontairement du même ordre que `neverWorkedBonus` : il oriente le classement à signaux comparables, il ne l'écrase jamais (un échec récent, plus urgent, continue de primer). */
const DIFFICULTY_FIT_BONUS = 14;
/** Pénalité par cran d'écart à la cible — au-delà de ~2 crans le bonus est nul, jamais négatif : un exercice mal calibré est déprioritisé, jamais exclu (l'élève garde accès à toute la banque). */
const DIFFICULTY_FIT_DECAY = 7;

/** Récompense les exercices proches du niveau de confort (voir `comfortDifficulty`). Sans niveau établi, vaut 0 — le score est alors identique à celui d'avant. */
function difficultyFitBonus(exercise: Exercise, comfort: ComfortLevel | null): number {
  if (!comfort) return 0;
  return Math.max(0, DIFFICULTY_FIT_BONUS - Math.abs(exercise.difficulty - comfort.target) * DIFFICULTY_FIT_DECAY);
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
function evaluateExercise(exercise: Exercise, minutesSpent: number, attempts: WorkSession[], now: Date, comfort: ComfortLevel | null = null): string[] {
  const reasons: string[] = [];
  if (exercise.mastery <= 25) reasons.push("Maîtrise faible");
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
  // Critère d'inclusion À PART ENTIÈRE, au même titre qu'un échec : « j'ai
  // fait la moitié » est la preuve directe que l'exercice n'est pas acquis,
  // quoi qu'en disent `status` et `mastery` (saisis à la main, souvent
  // périmés). Sans cette ligne, un exercice coché « maîtrisé » puis rendu à
  // moitié ne revenait jamais.
  else if (lastAttemptWasPartial(attempts)) reasons.push("Réussi à moitié");
  // Critère d'inclusion À PART ENTIÈRE : une réussite très assistée suffit à
  // reproposer l'exercice, même si tous les autres signaux sont au vert
  // (statut "maîtrisé", maîtrise à 100, travaillé hier). C'est précisément
  // le trou que `result` seul laissait — voir `lastAttemptWasAssisted`.
  else if (lastAttemptWasAssisted(attempts)) reasons.push("Réussi avec aide");
  // Une réussite récente n'est jamais, à elle seule, un critère d'inclusion
  // (même logique que "Favori" ci-dessous) : elle ne fait que compléter les
  // raisons d'un exercice déjà retenu par ailleurs.
  if (reasons.length > 0 && attempts[0]?.result === "réussi") reasons.push("Réussi récemment");
  // Le favori n'est jamais un critère d'inclusion à lui seul (un exercice
  // favori déjà maîtrisé et récent n'a aucune raison de revenir) : il ne
  // s'ajoute qu'aux raisons déjà réunies, pour un exercice retenu par
  // ailleurs — voir `urgencyScore` pour son (léger) effet sur le tri.
  if (reasons.length > 0 && exercise.favorite) reasons.push("Favori");
  // Montée de difficulté : jamais un critère d'inclusion à elle seule (même
  // logique que "Favori"), et ajoutée UNIQUEMENT quand l'exercice est
  // effectivement au cran visé — sinon la phrase promettrait une montée que
  // le classement ne produit pas. C'est la seule raison qui cite un fait
  // chiffré de l'historique ; elle doit donc rester exacte.
  if (reasons.length > 0 && comfort?.steppedUp && exercise.difficulty >= comfort.target) {
    reasons.push(`Palier suivant (${comfort.successStreak} réussites d'affilée)`);
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

/**
 * Maîtrise maximale retenue AU CLASSEMENT quand la dernière tentative
 * CONTREDIT la maîtrise déclarée — la valeur saisie par l'élève n'est jamais
 * modifiée (voir la note en tête de fichier : le moteur ne réécrit jamais
 * `status`/`mastery`).
 *
 * Sans ce plafond, un exercice passé en « maîtrisé / 100 % » un jour puis
 * échoué le lendemain tombait autour de -40 au classement (masteryGap nul +
 * statut « maîtrisé » à -30) : il était bien RETENU (raison « Échec récent »)
 * mais arrivait derrière absolument tout le reste, donc jamais proposé. Le
 * cas de la réussite arrachée aux indices avait déjà été corrigé ainsi ;
 * l'échec et le partiel, non — alors que ce sont les deux contradictions les
 * plus fortes.
 *
 * Trois valeurs distinctes, dans l'ordre de ce que la tentative prouve : un
 * échec contredit le plus (25), un exercice à moitié traité un peu moins
 * (50), une réussite obtenue avec les indices reste une réussite (50).
 */
const FAILED_MASTERY_CAP = 25;
const PARTIAL_MASTERY_CAP = 50;
const ASSISTED_MASTERY_CAP = 50;

/** `null` quand la dernière tentative ne contredit rien (réussite autonome, aucune tentative qualifiée) — le score est alors strictement celui de la maîtrise déclarée. */
function contradictedMasteryCap(attempts: WorkSession[]): number | null {
  if (attempts[0]?.result === "échoué") return FAILED_MASTERY_CAP;
  if (lastAttemptWasPartial(attempts)) return PARTIAL_MASTERY_CAP;
  if (lastAttemptWasAssisted(attempts)) return ASSISTED_MASTERY_CAP;
  return null;
}

/**
 * REPOS APRÈS UNE TENTATIVE — le pendant de `staleMasteryBonus`.
 *
 * Le moteur n'avait aucune notion de « je viens de le faire ». Un exercice
 * échoué cumule `masteryGap`, le poids du statut « à revoir » et
 * `failureBonus` : il repassait donc en tête le lendemain, l'après-demain, et
 * indéfiniment. Mesuré en rejouant 14 jours sur la vraie banque, avec un élève
 * qui fait ce qu'on lui propose : un élève qui échoue recevait 42 propositions
 * pour **3 exercices distincts** — exactement les mêmes trois, chaque jour,
 * pendant deux semaines. (Un élève qui réussit seul, lui, en voyait 41 sur 41.)
 *
 * Ce n'est PAS de la répétition espacée : aucune courbe d'oubli, aucun
 * intervalle calculé par exercice. C'est la règle minimale sans laquelle le
 * produit se répète — se remettre à un exercice raté le lendemain avec la même
 * fatigue mentale n'apprend rien, et lisser sur deux ou trois jours suffit à
 * rendre la banque vivante.
 *
 * Pénalité DE CLASSEMENT uniquement : jamais un critère d'exclusion. Un
 * exercice écarté aujourd'hui reste accessible dans la banque, et remonte de
 * lui-même à la fin du repos.
 */
/**
 * 70, et non 50 : à 50, le repos ne tenait pas contre le signal qu'il doit
 * justement tempérer. Un exercice échoué DEUX fois cumule `masteryGap` (60),
 * le statut (10) et `failureBonus` (40) — il repassait donc devant un
 * exercice jamais ouvert dès le lendemain, exactement le cas que le repos
 * existe pour éviter. Mesuré sur 14 jours de la vraie banque avec un élève
 * aux résultats mélangés : un même exercice proposé 10 jours sur 14. À 70, il
 * revient au deuxième jour, jamais au premier.
 */
const RECENT_ATTEMPT_PENALTY = 70;
const RECENT_ATTEMPT_COOLDOWN_DAYS = 3;

function recentAttemptPenalty(exercise: Exercise, now: Date): number {
  const days = daysSinceLastWorked(exercise, now);
  if (days === null || days >= RECENT_ATTEMPT_COOLDOWN_DAYS) return 0;
  return RECENT_ATTEMPT_PENALTY * (1 - Math.max(0, days) / RECENT_ATTEMPT_COOLDOWN_DAYS);
}

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
function urgencyScore(exercise: Exercise, minutesSpent: number, attempts: WorkSession[], now: Date, comfort: ComfortLevel | null = null): number {
  // Un échec, un exercice traité à moitié ou une réussite arrachée aux
  // indices CONTREDISENT la maîtrise déclarée. Pour le classement seulement
  // (jamais dans les données de l'élève, qui restent les siennes), on ne leur
  // accorde donc ni le crédit de `mastery` au-delà du plafond correspondant,
  // ni celui du statut « maîtrisé » — l'exercice est traité comme « à
  // revoir », ce qu'il est en réalité.
  const assisted = lastAttemptWasAssisted(attempts);
  const masteryCap = contradictedMasteryCap(attempts);
  const effectiveMastery = masteryCap === null ? exercise.mastery : Math.min(exercise.mastery, masteryCap);
  const masteryGap = (100 - effectiveMastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const statusWeight = masteryCap !== null && exercise.status === "maîtrisé" ? STATUS_WEIGHT["à revoir"] : STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une maîtrise très faible ou un échec récent.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  const staleBonus = staleMasteryBonus(exercise, now); // 0 à 30, voir staleMasteryBonus
  const restPenalty = recentAttemptPenalty(exercise, now); // 0 à 50, voir recentAttemptPenalty
  // SEUL levier manuel de l'élève depuis la suppression de `priority` : une
  // étoile vaut désormais 20, à mi-chemin de l'ancienne échelle 8-40 qu'elle
  // remplace. Volontairement en dessous de `failureBonus` (jusqu'à 45) : un
  // souhait explicite oriente le classement, un échec mesuré prime. Un favori
  // ne devient jamais éligible par ce seul bonus (voir la garde
  // `reasons.length > 0` dans `evaluateExercise`).
  const favoriteBonus = exercise.favorite ? 20 : 0;
  // Un échec récent doit remonter fortement l'exercice — comparable en
  // amplitude à masteryGap/statusWeight, et au-dessus du seul levier manuel
  // (`favoriteBonus`). Plafonné pour ne jamais, à lui seul, écraser tous les
  // autres signaux.
  const failureBonus = Math.min(45, recentFailureCount(attempts) * 20); // 0 à 45
  // Complément au retrait de crédit ci-dessus, dimensionné pour que
  // l'exercice repasse devant un exercice JAMAIS OUVERT (~85) sans jamais
  // atteindre un échec constaté (~105). Mesuré avant ce correctif sur un
  // profil « ne réussit qu'aidé » : ses 15 réussites assistées tombaient
  // autour de -30 et n'apparaissaient nulle part — le signal était collecté,
  // affiché en raison, et sans le moindre effet sur ce qui était proposé.
  // Ramené de 25 à 15 en même temps que l'introduction du plafond de maîtrise
  // pour l'échec : l'intention documentée ci-dessus est conservée (repasse
  // devant un exercice jamais ouvert, n'atteint jamais un échec constaté),
  // mais les trois signaux « la maîtrise déclarée est démentie » doivent
  // rester dans l'ordre de ce qu'ils prouvent — voir `partialBonus`.
  const assistedBonus = assisted ? 15 : 0;
  // Un exercice traité à moitié n'est pas acquis : il doit revenir. Entre les
  // deux signaux voisins, et dans cet ordre à profil égal : échoué (20, rien
  // n'a abouti) > partiel (18, la moitié a abouti, seul) > réussi avec aide
  // (15, tout a abouti, mais guidé). Comme pour l'échec, c'est un effet de
  // CLASSEMENT : jamais une exclusion.
  const partialBonus = lastAttemptWasPartial(attempts) ? 18 : 0;
  // À l'inverse, une série de réussites récentes fait progressivement
  // redescendre l'exercice — jamais jusqu'à l'exclure (ce n'est pas un
  // critère d'exclusion, seulement un effet sur le tri), et d'une amplitude
  // comparable à momentumBonus, pas dominante.
  // Une réussite assistée ne doit PAS bénéficier de la décote accordée aux
  // réussites autonomes : sans cette garde, l'exercice ressorti par
  // "Réussi avec aide" serait aussitôt renvoyé en fin de liste par le
  // `successPenalty` de sa propre réussite — inclus mais jamais proposé.
  const successPenalty = lastAttemptWasAssisted(attempts) ? 0 : Math.min(24, recentSuccessStreak(attempts) * 8); // 0 à 24
  // Adéquation au niveau réel de l'élève — 0 tant qu'il n'a pas assez
  // d'historique (voir `comfortDifficulty`), donc score inchangé au démarrage.
  const difficultyFit = difficultyFitBonus(exercise, comfort); // 0 à 14
  return (
    masteryGap +
    statusWeight +
    neverWorkedBonus +
    momentumBonus +
    staleBonus +
    favoriteBonus +
    failureBonus +
    assistedBonus +
    partialBonus +
    difficultyFit -
    successPenalty -
    restPenalty
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
 * Écart de score au-delà duquel la diversification cède le pas — payé une
 * fois par exercice DÉJÀ retenu dans le même chapitre, et une fois par
 * exercice déjà retenu dans la même matière. Répéter un chapitre coûte donc
 * 20 points, changer de chapitre à l'intérieur d'une matière 10.
 *
 * Calibré au niveau des signaux qu'il doit pouvoir laisser passer : 20, c'est
 * l'ordre de grandeur d'un échec constaté ou d'un favori. En dessous de cet
 * écart, deux exercices se valent et on alterne ; au-dessus, l'exercice
 * nettement plus urgent passe quand même.
 */
const DIVERSITY_REPEAT_PENALTY = 10;

/**
 * Réordonne les candidats (déjà triés par score décroissant) pour éviter que
 * les premiers de la liste s'entassent sur un seul chapitre — ET, niveau
 * au-dessus, sur une seule matière. Un exercice sans `chapter_id` compte
 * comme son propre groupe par matière (jamais mélangé à un autre chapitre,
 * ni traité comme "diversifié" à tort).
 *
 * Sélection gloutonne : à chaque tour on retient le meilleur score DIMINUÉ
 * d'une pénalité par exercice déjà retenu dans le même chapitre et dans la
 * même matière. Aucun candidat n'est perdu (la liste retournée est une
 * permutation de l'entrée) et, à scores strictement égaux — l'état réel au
 * tout premier lancement, où toute la banque est à la même maîtrise —, la
 * pénalité produit exactement une rotation chapitre/matière : sans elle, le
 * tri stable dégénérerait en "ordre du fichier source", structurellement
 * dominé par la matière la plus fournie (Mathématiques), un artefact
 * d'implémentation et non un signal de pertinence.
 *
 * La pénalité remplace un round-robin strict à deux niveaux, qui ignorait
 * l'ampleur des écarts de score : avec sept matières, il repoussait le
 * deuxième exercice le plus urgent derrière le meilleur de CHACUNE des six
 * autres matières. Un élève qui venait d'échouer sur trois exercices de maths
 * n'en revoyait qu'un seul dans une séance de cinq — la diversité passait
 * avant l'urgence au lieu de la départager.
 */
export function diversifyByChapter(candidates: ExerciseRecommendation[]): ExerciseRecommendation[] {
  // Les groupes sont convertis en entiers UNE fois : la boucle ci-dessous
  // est quadratique (chaque tour réexamine les candidats restants) et tourne
  // sur toute la banque à chaque rendu — comparer des chaînes ou interroger
  // des `Map` à chaque itération y coûtait plusieurs millisecondes.
  const chapterIds = new Map<string, number>();
  const subjectIds = new Map<string, number>();
  const idOf = (registry: Map<string, number>, key: string): number => {
    const existing = registry.get(key);
    if (existing !== undefined) return existing;
    registry.set(key, registry.size);
    return registry.size - 1;
  };
  const remaining = candidates.map((candidate) => ({
    candidate,
    // Un chapitre est toujours qualifié par sa matière : deux matières ne
    // partagent jamais un `chapter_id`, et "sans chapitre" reste un groupe
    // par matière.
    chapter: idOf(chapterIds, `${candidate.exercise.subject}::${candidate.exercise.chapter_id ?? "sans-chapitre"}`),
    subject: idOf(subjectIds, candidate.exercise.subject),
  }));
  const pickedByChapter = new Array<number>(chapterIds.size).fill(0);
  const pickedBySubject = new Array<number>(subjectIds.size).fill(0);
  const result: ExerciseRecommendation[] = [];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let index = 0; index < remaining.length; index++) {
      const entry = remaining[index];
      const value =
        entry.candidate.score - (pickedByChapter[entry.chapter] + pickedBySubject[entry.subject]) * DIVERSITY_REPEAT_PENALTY;
      // Strictement supérieur : à valeur égale, l'ordre d'entrée tranche —
      // le score pour `recommendExercises`, la priorité de chapitre pour
      // lib/plan.ts, qui passe une liste déjà ordonnée par ses soins.
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    const [picked] = remaining.splice(bestIndex, 1);
    pickedByChapter[picked.chapter]++;
    pickedBySubject[picked.subject]++;
    result.push(picked.candidate);
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
  // Calculé UNE fois pour toute la banque (et non par exercice) : le niveau
  // de confort est une propriété de l'élève, pas de l'exercice évalué.
  const comfort = comfortDifficulty(exercises, sessions);
  const candidates: ExerciseRecommendation[] = [];
  for (const exercise of exercises) {
    if (exercise.archived) continue;
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const attempts = attemptsWithResult(sessions, exercise.id);
    const reasons = evaluateExercise(exercise, minutesSpent, attempts, now, comfort);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent, attempts, now, comfort), reasons });
  }
  candidates.sort((a, b) => b.score - a.score);
  const diversified = diversifyByChapter(candidates);

  if (options.availableMinutes === undefined) return diversified.slice(0, limit);
  return selectWithinBudget(diversified, sessions, limit, options.availableMinutes);
}

/**
 * Une règle candidate pour `explainReasons` : `test` décide si elle
 * s'applique à un jeu de raisons donné, `sentence` construit le texte à
 * partir de ces mêmes raisons (utile pour la seule règle dynamique, celle
 * de la maîtrise qui redevient obsolète, qui a besoin d'en extraire le
 * nombre de jours).
 */
interface ReasonRule {
  test: (reasons: string[]) => boolean;
  sentence: (reasons: string[]) => string;
}

/**
 * Ordre de priorité d'affichage quand plusieurs raisons sont réunies pour un
 * même exercice — la plus décisive (celle qui explique le mieux "pourquoi
 * maintenant") passe en premier. `Séance reprise`/`Séance libre` sont des
 * raisons SYNTHÉTIQUES injectées ailleurs (SessionRunner à la reprise d'un
 * focus interrompu ; lib/plan.ts#buildFreeSessionPlan pour une sélection
 * filtrée à la main) — elles voyagent dans le même tableau `reasons` que
 * celles d'`evaluateExercise`, donc `explainReasons` doit aussi les
 * reconnaître pour ne jamais retomber sur le texte brut en dernier recours.
 */
const REASON_RULES: ReasonRule[] = [
  { test: (r) => r.includes("Séance reprise"), sentence: () => "Tu avais laissé cette séance en cours — on reprend là où tu t'étais arrêté." },
  { test: (r) => r.includes("Plusieurs échecs"), sentence: () => "Tu as échoué plusieurs fois récemment dessus — ça mérite une nouvelle tentative." },
  { test: (r) => r.includes("Échec récent"), sentence: () => "Ta dernière tentative n'a pas abouti — on retente." },
  { test: (r) => r.includes("Réussi à moitié"), sentence: () => "Tu ne l'avais traité qu'à moitié — on le reprend en entier." },
  { test: (r) => r.includes("Réussi avec aide"), sentence: () => "Tu l'avais réussi, mais avec les indices — on vérifie que c'est acquis." },
  // Avant les raisons "difficulté/maîtrise" : quand l'élève vient
  // d'enchaîner des réussites, la montée de palier est LE fait nouveau qui
  // explique le choix — et c'est la seule justification qui cite un chiffre
  // vérifiable de son historique.
  {
    test: (r) => r.some((reason) => reason.startsWith("Palier suivant")),
    sentence: (r) => {
      const count = r.find((reason) => reason.startsWith("Palier suivant"))?.match(/\d+/)?.[0];
      return count
        ? `Tu as réussi ${count} exercices d'affilée : on monte d'un cran de difficulté.`
        : "Tes dernières réussites permettent de monter d'un cran de difficulté.";
    },
  },
  { test: (r) => r.includes("Marqué à revoir"), sentence: () => "Tu l'as toi-même marqué à revoir." },
  // Avant "Maîtrise faible" : un exercice jamais travaillé a par construction
  // une maîtrise à 0 (voir isNeverWorked/evaluateExercise), donc les deux
  // raisons coexistent presque toujours pour une fiche neuve — mais "jamais
  // travaillé" est l'explication réellement première, pas une conséquence
  // ("maîtrise faible" laisserait croire, à tort, que l'élève a déjà tenté
  // et raté).
  { test: (r) => r.includes("Jamais travaillé"), sentence: () => "Tu n'as pas encore travaillé cet exercice." },
  { test: (r) => r.includes("Maîtrise faible"), sentence: () => "Ta maîtrise est encore faible sur cet exercice." },
  { test: (r) => r.includes("En cours"), sentence: () => "Tu l'avais laissé en cours — autant le terminer." },
  {
    test: (r) => r.some((reason) => reason.startsWith("Non retravaillé depuis")),
    sentence: (r) => {
      const match = r.find((reason) => reason.startsWith("Non retravaillé depuis"));
      const days = match?.match(/\d+/)?.[0];
      return days
        ? `Tu ne l'as pas retravaillé depuis ${days} jour${days === "1" ? "" : "s"}, alors qu'il était maîtrisé.`
        : "Il n'a pas été retravaillé depuis un moment, alors qu'il était maîtrisé.";
    },
  },
  { test: (r) => r.includes("Maîtrisé, jamais retravaillé"), sentence: () => "Marqué maîtrisé, mais jamais retravaillé depuis — un rappel ne fait pas de mal." },
  { test: (r) => r.includes("Séance libre"), sentence: () => "Choisi par toi dans la banque d'exercices." },
];

/**
 * Traduit les raisons brutes d'`ExerciseRecommendation.reasons` (déjà
 * utilisées comme badges partout dans l'app) en UNE phrase de contexte
 * lisible — "pourquoi CET exercice, maintenant ?". Ne fabrique jamais de
 * justification : dérivée exclusivement des raisons réellement produites par
 * `evaluateExercise` (ou des raisons synthétiques ci-dessus) ; `null` si
 * `reasons` est vide, jamais un texte générique inventé pour combler le vide.
 *
 * Une seule raison est retenue (la plus décisive selon `REASON_RULES`)
 * plutôt que toutes concaténées : "tu as échoué plusieurs fois récemment
 * dessus" se comprend en un coup d'œil, contrairement à "Plusieurs échecs ·
 * Maîtrise faible · Favori" (l'ancien comportement, un simple
 * `.join(" · ")` des raisons brutes).
 */
export function explainReasons(reasons: string[]): string | null {
  if (reasons.length === 0) return null;
  const rule = REASON_RULES.find(({ test }) => test(reasons));
  return rule ? rule.sentence(reasons) : reasons[0];
}

export interface ExerciseBankStats {
  /** Nombre total d'exercices qui apparaîtraient dans le tableau "À revoir" (pas seulement ceux affichés). */
  toReviewCount: number;
  /** Maîtrise moyenne sur les exercices actifs (non archivés), arrondie à l'entier. */
  averageMastery: number;
  neverWorkedCount: number;
}

/** Tableau de bord de la banque d'exercices — agrégats simples, tous dérivés des mêmes règles que `recommendExercises` (voir `evaluateExercise`). */
export function computeExerciseBankStats(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): ExerciseBankStats {
  const minutesByExercise = minutesByExerciseMap(sessions);
  const active = exercises.filter((exercise) => !exercise.archived);

  let toReviewCount = 0;
  let neverWorkedCount = 0;
  let masterySum = 0;

  for (const exercise of active) {
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const attempts = attemptsWithResult(sessions, exercise.id);
    if (evaluateExercise(exercise, minutesSpent, attempts, now).length > 0) toReviewCount++;
    if (isNeverWorked(exercise, minutesSpent)) neverWorkedCount++;
    masterySum += exercise.mastery;
  }

  return {
    toReviewCount,
    averageMastery: active.length ? Math.round(masterySum / active.length) : 0,
    neverWorkedCount,
  };
}
