import { COVERAGE_REASON_PREFIX } from "@/lib/coverage";
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

/**
 * `null` si l'exercice n'a jamais eu de séance focus achevée dessus (voir
 * `Exercise.last_worked_at`) — OU si la date stockée est illisible.
 *
 * `normalizeExercise` (lib/storage.ts) garantit qu'aucune date invalide ne
 * sort jamais du stockage réel, exactement pour cette raison (voir sa doc :
 * "une seule chaîne quelconque... faisait lever RangeError... contaminant
 * tout le rendu"). Cette garde ici est une SECONDE ligne de défense, pas une
 * redite inutile : `recommendExercises` est appelée directement dans les
 * tests et pourrait un jour recevoir un `Exercise` construit à la main plutôt
 * que passé par `normalizeExercise`. Sans elle, `new Date("invalide").getTime()`
 * vaut `NaN`, qui se propage silencieusement à travers `isStaleMastery`,
 * `staleMasteryBonus` et `recentAttemptPenalty` jusqu'au score final — un
 * SEUL exercice corrompu suffit alors à rendre `NaN` le résultat de
 * `.sort()` pour TOUTE la banque (le comparateur `(a,b) => b.score - a.score`
 * renvoie `NaN`, un ordre indéfini par la spec JS), pas seulement le
 * classement de cet exercice précis.
 */
function daysSinceLastWorked(exercise: Exercise, now: Date): number | null {
  if (!exercise.last_worked_at) return null;
  const time = new Date(exercise.last_worked_at).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now.getTime() - time) / 86400000);
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
 * Tentatives QUALIFIÉES par exercice, les plus récentes d'abord — calculées
 * UNE fois pour toute la banque.
 *
 * Les séances sans résultat (`result === null` : séance libre, ou antérieure
 * à ce champ) sont ignorées — on ne sait rien de leur issue, elles ne doivent
 * donc influencer ni les raisons ni le score (voir la doc de
 * `WorkSession.result`).
 *
 * La version précédente refiltrait et retriait l'historique ENTIER pour
 * chaque exercice : sur une banque de 434 fiches, un historique de 5 000
 * séances était parcouru 434 fois. Mesuré avant/après sur la vraie banque
 * (médiane sur 5 exécutions) :
 *
 *   5 000 séances   `computeDailyPlan`        49,0 ms → 21,6 ms
 *  10 000 séances   `computeDailyPlan`       106,8 ms → 45,6 ms
 *   5 000 séances   4 objectifs actifs       153,8 ms → 86,0 ms
 *
 * Le cas à quatre objectifs est celui qui comptait : `computeGoalsDailyPlan`
 * appelle le plan une fois par objectif, et dépassait donc 150 ms — une
 * latence perceptible au chargement du Dashboard. Il repasse sous 100 ms.
 *
 * Résultat strictement identique à l'ancien filtrage par exercice : même
 * filtre, même ordre. Aucune règle de recommandation ne change.
 */
function attemptsByExercise(sessions: WorkSession[]): Map<string, WorkSession[]> {
  const byExercise = new Map<string, WorkSession[]>();
  for (const session of sessions) {
    if (!session.exercise_id || !session.result) continue;
    const bucket = byExercise.get(session.exercise_id);
    if (bucket) bucket.push(session);
    else byExercise.set(session.exercise_id, [session]);
  }
  for (const bucket of byExercise.values()) {
    bucket.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }
  return byExercise;
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
 * Longueur de la série de réussites AUTONOMES (sans aide décisive — voir
 * `ASSISTED_HINTS_THRESHOLD`) la plus récente sur CET exercice — s'arrête à
 * la première tentative non réussie OU à la première réussite assistée.
 *
 * Distinct de `recentSuccessStreak` (qui compte toute réussite, aidée ou
 * non) : sert uniquement à détecter une maîtrise réelle jamais déclarée —
 * voir `urgencyScore`, où ce signal corrige `mastery`/`status` à la baisse
 * de priorité, le pendant exact de ce que `lastAttemptWasAssisted` fait déjà
 * dans l'autre sens (une réussite assistée contredit une maîtrise déclarée
 * trop haute ; une série autonome contredit une maîtrise déclarée trop basse).
 */
function autonomousSuccessStreak(attempts: WorkSession[]): number {
  let streak = 0;
  for (const attempt of attempts) {
    if (attempt.result !== "réussi") break;
    if (attempt.hints_used === null || attempt.hints_used >= ASSISTED_HINTS_THRESHOLD) break;
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
  // celle où il échoue — auquel cas on visera en dessous, juste après.
  const base = succeeded.length > 0 ? average(succeeded.map((a) => a.difficulty)) : average(failed.map((a) => a.difficulty));

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
 * exercice et triées par récence (voir `attemptsByExercise`). Un exercice
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

/** Maîtrise maximale retenue AU CLASSEMENT pour un exercice dont la dernière réussite a demandé des indices — la valeur saisie par l'élève n'est jamais modifiée. */
const ASSISTED_MASTERY_CAP = 50;

/**
 * MAÎTRISE SILENCIEUSE — le pendant exact de la correction ci-dessus, dans
 * l'autre sens.
 *
 * Trouvé en auditant le moteur avec des scénarios réels rejoués (pas
 * seulement lus) : `mastery`/`status` sont des champs saisis À LA MAIN par
 * l'élève (voir components/exercises/focus-view.tsx) — rien ne les met à
 * jour automatiquement après une séance. Un élève qui enchaîne plusieurs
 * réussites AUTONOMES sur un exercice sans jamais revenir cocher « maîtrisé »
 * (cas réel et probablement fréquent : la séance recommandée n'impose pas de
 * repasser par la fiche) voit cet exercice rester DÉCLARÉ à mastery=0,
 * status="à faire" indéfiniment — alors que le même historique, correctement
 * déclaré, l'aurait fait disparaître des recommandations (`evaluateExercise`
 * n'a alors plus aucune raison de l'inclure).
 *
 * Mesuré avant ce correctif : un exercice réussi seul 5 fois d'affilée,
 * jamais déclaré, obtenait un score de classement de 68 — au-dessus de
 * nombreux exercices réellement faibles ou en échec — quand la même
 * performance correctement déclarée l'aurait exclu purement et simplement.
 * `masteryGap` (jusqu'à 60 points, le plus gros terme du score) ignorait
 * entièrement ce signal pourtant déjà disponible.
 *
 * Seuil identique à `COMFORT_STEP_UP_STREAK` (cohérence : c'est déjà, dans ce
 * module, le seuil qui fait foi d'une maîtrise réelle). Plancher choisi
 * symétrique à `ASSISTED_MASTERY_CAP` : une réussite autonome répétée mérite
 * au moins autant de crédit qu'une réussite assistée en perd.
 */
const SILENT_MASTERY_STREAK = 3;
const SILENT_MASTERY_FLOOR = 75;

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
const RECENT_ATTEMPT_PENALTY = 50;
const RECENT_ATTEMPT_COOLDOWN_DAYS = 3;

/**
 * REPOS PROPORTIONNÉ À L'ENLISEMENT — le premier échec dit « retente », le
 * cinquième dit « ce n'est pas cet exercice le problème ».
 *
 * Le repos ci-dessus était FORFAITAIRE : trois jours et 50 points, que
 * l'exercice ait été raté une fois ou quinze. Or 50 points ne suffisent pas.
 * Mesuré sur la vraie banque, un exercice échoué dix fois d'affilée et tenté
 * la veille score 144 quand ses poursuivants sont à 99 : la pénalité déjà
 * appliquée (33 au jour 1) le laisse mener de 45 points. Il revient donc en
 * tête le lendemain, indéfiniment.
 *
 * Conséquence mesurée par rejeu de 90 jours sur la banque livrée, avec un
 * élève qui échoue ce qu'on lui propose :
 *
 *   budget 20 min →   1 exercice distinct pour  90 propositions
 *   budget 30 min →   2 exercices  pour 180 propositions
 *   budget 90 min →   7 exercices  pour 630 propositions
 *
 * (le même élève, s'il réussit, en voit 57 à 303 — le moteur est sain, c'est
 * l'enlisement qu'il ne savait pas voir.)
 *
 * La correction garde EXACTEMENT le comportement d'avant pour un échec isolé
 * — un seul échec consécutif donne toujours 3 jours et 50 points — et ne fait
 * croître le repos, en durée comme en profondeur, que sur des échecs qui se
 * répètent. Ce n'est pas un nouveau terme dans `urgencyScore` : c'est le même
 * mécanisme, enfin dimensionné sur ce qu'il prétendait traiter.
 *
 * Pédagogiquement, c'est aussi la seule lecture honnête : refaire demain, avec
 * la même fatigue mentale, un exercice raté cinq fois n'apprend rien. Ce qui
 * manque est en dessous — et c'est la Radiographie (lib/notions.ts) qui sait
 * nommer la notion commune à ces échecs.
 */
const MAX_CONSECUTIVE_FAILURES_CONSIDERED = 4;
/** Points ajoutés au repos par échec consécutif au-delà du premier. */
const REPEATED_FAILURE_PENALTY_STEP = 30;

/** Échecs consécutifs les plus récents — s'arrête à la première tentative non échouée (une réussite, même assistée, remet le compteur à zéro). */
function consecutiveFailureCount(attempts: WorkSession[]): number {
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.result !== "échoué") break;
    count++;
  }
  return count;
}

function recentAttemptPenalty(exercise: Exercise, attempts: WorkSession[], now: Date): number {
  const days = daysSinceLastWorked(exercise, now);
  if (days === null) return 0;
  const streak = Math.min(consecutiveFailureCount(attempts), MAX_CONSECUTIVE_FAILURES_CONSIDERED);
  // 1 échec (ou une simple tentative réussie) → 3 jours / 50 points, comme
  // avant. 2 → 6 j / 80. 3 → 9 j / 110. 4 et au-delà → 12 j / 140, plafonné :
  // au-delà l'exercice reviendrait trop tard pour être encore utile.
  const cooldownDays = RECENT_ATTEMPT_COOLDOWN_DAYS * Math.max(1, streak);
  const penalty = RECENT_ATTEMPT_PENALTY + Math.max(0, streak - 1) * REPEATED_FAILURE_PENALTY_STEP;
  if (days >= cooldownDays) return 0;
  return penalty * (1 - Math.max(0, days) / cooldownDays);
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
  // Une réussite arrachée aux indices CONTREDIT la maîtrise déclarée. Pour le
  // classement seulement (jamais dans les données de l'élève, qui restent les
  // siennes), on ne lui accorde donc ni le crédit de `mastery` au-delà de
  // ASSISTED_MASTERY_CAP, ni celui du statut « maîtrisé » — l'exercice est
  // traité comme « à revoir », ce qu'il est en réalité.
  const assisted = lastAttemptWasAssisted(attempts);
  // Symétrique de la correction ci-dessus : une série de réussites AUTONOMES
  // contredit une maîtrise déclarée trop basse, tout comme une réussite
  // assistée contredit une maîtrise déclarée trop haute — voir la doc de
  // `SILENT_MASTERY_STREAK`. Ne s'applique jamais en même temps que `assisted`
  // (la dernière tentative ne peut pas être À LA FOIS assistée et compter
  // dans une série autonome, `autonomousSuccessStreak` s'arrête déjà dessus).
  const silentlyMastered = autonomousSuccessStreak(attempts) >= SILENT_MASTERY_STREAK;
  const effectiveMastery = assisted
    ? Math.min(exercise.mastery, ASSISTED_MASTERY_CAP)
    : silentlyMastered
      ? Math.max(exercise.mastery, SILENT_MASTERY_FLOOR)
      : exercise.mastery;
  const masteryGap = (100 - effectiveMastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const statusWeight = assisted && exercise.status === "maîtrisé"
    ? STATUS_WEIGHT["à revoir"]
    : silentlyMastered && exercise.status !== "maîtrisé"
      ? STATUS_WEIGHT["maîtrisé"]
      : STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une maîtrise très faible ou un échec récent.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  const staleBonus = staleMasteryBonus(exercise, now); // 0 à 30, voir staleMasteryBonus
  const restPenalty = recentAttemptPenalty(exercise, attempts, now); // 0 à 140 selon l'enlisement, voir recentAttemptPenalty
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
  const assistedBonus = assisted ? 25 : 0;
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
/** Répartit `items` (déjà triés par score décroissant) en groupes, dans l'ordre de leur première apparition — brique commune à `roundRobinFromGroups`/`diversifyByChapter`. */
function groupByKey<T>(items: T[], keyFn: (item: T) => string): { order: string[]; groups: Map<string, T[]> } {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = keyFn(item);
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
      order.push(key);
    }
    group.push(item);
  }
  return { order, groups };
}

/**
 * Round-robin déterministe sur des groupes déjà constitués (voir
 * `groupByKey`) : le meilleur candidat de chaque groupe d'abord (dans
 * l'ordre où ces groupes sont apparus, donc le plus urgent en premier), puis
 * un deuxième tour pour le deuxième meilleur de chaque groupe, etc. Aucun
 * candidat n'est perdu — un groupe épuisé est simplement sauté aux tours
 * suivants, jamais remplacé par du bourrage.
 */
function roundRobinFromGroups<T>(order: string[], groups: Map<string, T[]>): T[] {
  const total = order.reduce((sum, key) => sum + groups.get(key)!.length, 0);
  const result: T[] = [];
  for (let round = 0; result.length < total; round++) {
    let addedThisRound = false;
    for (const key of order) {
      const group = groups.get(key)!;
      if (round < group.length) {
        result.push(group[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  return result;
}

/** Compose `groupByKey` + `roundRobinFromGroups` pour un seul niveau de diversification. */
function roundRobinByGroup<T>(candidates: T[], keyFn: (item: T) => string): T[] {
  const { order, groups } = groupByKey(candidates, keyFn);
  return roundRobinFromGroups(order, groups);
}

/**
 * Réordonne les candidats (déjà triés par score décroissant) pour éviter que
 * les premiers de la liste s'entassent sur un seul chapitre — ET, niveau
 * au-dessus, sur une seule matière. Un exercice sans `chapter_id` compte
 * comme son propre groupe par matière (jamais mélangé à un autre chapitre,
 * ni traité comme "diversifié" à tort).
 *
 * Deux niveaux de round-robin emboîtés, pas une pénalité numérique de plus à
 * calibrer : d'abord une diversification par CHAPITRE à l'intérieur de
 * chaque matière (comportement historique, inchangé), puis un round-robin
 * par MATIÈRE entre ces listes déjà diversifiées. Le score d'origine décide
 * toujours QUELS chapitres/matières passent en premier ; le round-robin
 * décide seulement de ne jamais répéter un groupe tant qu'une alternative
 * existe.
 *
 * Le niveau matière est nécessaire en plus du niveau chapitre : sans lui, un
 * tri stable dont TOUS les candidats ont exactement le même score (état réel
 * au tout premier lancement — maîtrise, priorité et statut identiques sur
 * toute la banque avant la moindre séance) dégénère silencieusement en
 * "ordre du fichier source", structurellement dominé par la matière la plus
 * fournie (Mathématiques) — un artefact d'implémentation, pas un signal de
 * pertinence. Le round-robin par matière garantit une rotation équitable
 * entre matières même dans ce cas dégénéré, sans rien changer quand les
 * scores différencient réellement les candidats (le tri par score reste
 * l'unique décideur DANS chaque groupe).
 */
export function diversifyByChapter(candidates: ExerciseRecommendation[]): ExerciseRecommendation[] {
  const { order: subjectOrder, groups: bySubject } = groupByKey(candidates, (candidate) => candidate.exercise.subject);
  const diversifiedBySubject = new Map(
    subjectOrder.map((subject) => [
      subject,
      roundRobinByGroup(bySubject.get(subject)!, (candidate) => candidate.exercise.chapter_id ?? `subject:${candidate.exercise.subject}`),
    ])
  );
  return roundRobinFromGroups(subjectOrder, diversifiedBySubject);
}

export function recommendExercises(
  exercises: Exercise[],
  sessions: WorkSession[],
  limit = 6,
  options: RecommendationOptions = {}
): ExerciseRecommendation[] {
  const now = options.now ?? new Date();
  const minutesByExercise = minutesByExerciseMap(sessions);
  const attemptsByExerciseId = attemptsByExercise(sessions);
  // Calculé UNE fois pour toute la banque (et non par exercice) : le niveau
  // de confort est une propriété de l'élève, pas de l'exercice évalué.
  const comfort = comfortDifficulty(exercises, sessions);
  const candidates: ExerciseRecommendation[] = [];
  for (const exercise of exercises) {
    if (exercise.archived) continue;
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const attempts = attemptsByExerciseId.get(exercise.id) ?? [];
    const reasons = evaluateExercise(exercise, minutesSpent, attempts, now, comfort);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent, attempts, now, comfort), reasons });
  }
  // À score strictement égal, la difficulté la plus basse passe devant —
  // jamais l'inverse, jamais un troisième critère. Sans ce départage, deux
  // exercices "jamais travaillé" du même chapitre ont EXACTEMENT le même
  // score tant que `comfort` n'existe pas (moins de 3 tentatives qualifiées
  // dans toute la banque — le cas de tout nouvel élève), et l'ordre ne
  // dépend alors que de la position dans le fichier source. Mesuré sur la
  // vraie banque : 27 des 51 chapitres n'ont PAS leur exercice le plus
  // facile en premier (ex. "Suites numériques" commence par 2, 4, 5) — un
  // élève découvrant un chapitre pouvait donc se voir proposer une
  // difficulté 5 avant toute difficulté 1, sans aucune justification
  // pédagogique, uniquement par artefact d'ordre de fichier. Une fois
  // `comfort` établi, `difficultyFitBonus` différencie déjà la plupart des
  // égalités : ce départage ne joue alors presque jamais, et ne contredit
  // jamais un score réellement différent (comparé EN PREMIER, toujours).
  candidates.sort((a, b) => b.score - a.score || a.exercise.difficulty - b.exercise.difficulty);
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
  // Avant "Jamais travaillé"/"Maîtrise faible" : quand un exercice est retenu
  // parce que sa MATIÈRE n'a plus été touchée depuis longtemps, c'est ce fait
  // daté qui explique réellement sa présence — bien mieux que l'état de
  // l'exercice lui-même, qui n'a pas changé depuis hier. Placée APRÈS les
  // raisons d'échec : un échec avéré explique toujours mieux qu'un silence.
  {
    test: (r) => r.some((reason) => reason.startsWith(COVERAGE_REASON_PREFIX)),
    sentence: (r) => {
      const raw = r.find((reason) => reason.startsWith(COVERAGE_REASON_PREFIX))!.slice(COVERAGE_REASON_PREFIX.length);
      const match = raw.match(/^(.*) \((\d+) j\)$/);
      if (!match) return `Tu n'as rien travaillé en ${raw} depuis un moment — on y repasse aujourd'hui.`;
      const [, subject, days] = match;
      return `Tu n'as rien travaillé en ${subject} depuis ${days} jours — on y repasse avant que ça décroche.`;
    },
  },
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

/**
 * Vrai si les seules raisons de proposer cet exercice sont "Jamais
 * travaillé" (systématiquement accompagné de "Maîtrise faible", puisque tout
 * exercice neuf a une maîtrise nulle) — aucun signal d'échec ni de statut
 * signalé à la main. Sert à distinguer "à découvrir" (rien n'a encore été
 * tenté) de "à revoir" (quelque chose a déjà été tenté et n'a pas tenu) :
 * appeler le premier cas "à revoir" serait faux — on ne revoit pas ce qu'on
 * n'a jamais vu. Utilisé par le Dashboard (libellé du plan du jour) et
 * `ExerciseReviewPanel` (titre du panneau) : même critère, jamais recalculé
 * différemment d'un écran à l'autre.
 */
export function isPureDiscovery(reasons: string[]): boolean {
  return reasons.includes("Jamais travaillé") && !reasons.includes("Marqué à revoir") && !reasons.includes("En cours");
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
  const attemptsByExerciseId = attemptsByExercise(sessions);
  const active = exercises.filter((exercise) => !exercise.archived);

  let toReviewCount = 0;
  let neverWorkedCount = 0;
  let masterySum = 0;

  for (const exercise of active) {
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const attempts = attemptsByExerciseId.get(exercise.id) ?? [];
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
