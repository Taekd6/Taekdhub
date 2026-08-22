import { DEADLINE_RELEVANCE_HORIZON_DAYS } from "@/lib/deadline-horizon";
import type { ChapterDeadlineSignal } from "@/lib/deadlines";
import { minutesByExerciseMap, totalSeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, ExerciseStatus, Subject, WorkSession } from "@/lib/supabase/types";

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
 * ## Sprint 4 → Sprint répétition espacée : urgence de révision adaptative
 * (voir `revisionUrgencyFromAttempts`)
 * Un exercice non retravaillé depuis longtemps redevient éligible (critère
 * dans `evaluateExercise`) et son score augmente progressivement avec le
 * temps écoulé (terme plafonné dans `urgencyScore`). À l'origine (Sprint 4),
 * le seuil était fixe (`MASTERY_STALE_DAYS`, 21 jours) et ne s'appliquait
 * qu'aux exercices marqués "maîtrisé" à la main. Il est maintenant adaptatif :
 * l'intervalle avant révision dépend de la série de réussites consécutives
 * réelle (`recentSuccessStreak`, inchangée) et de la difficulté de
 * l'exercice — un Leitner léger, jamais persisté (voir `revisionIntervalDays`).
 * Le seuil fixe reste utilisé comme repli (`legacyStaleBonus`) uniquement
 * quand aucune tentative avec résultat n'existe : c'est tout ce qu'on peut
 * savoir dans ce cas. Ni `status` ni `mastery` ne sont jamais modifiés par ce
 * mécanisme : seul le classement (et l'inclusion) en sont influencés.
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
 * Seuil fixe historique (Sprint 4) : nombre de jours sans retravail au-delà
 * duquel un exercice "maîtrisé" redevient éligible. Sert maintenant de repli
 * quand aucun intervalle adaptatif n'est calculable (voir `legacyStaleBonus`)
 * et de plafond à l'intervalle adaptatif (`REVISION_MAX_INTERVAL_DAYS`).
 * Trois semaines : assez long pour ne pas rappeler un exercice tout juste
 * maîtrisé, assez court pour détecter un oubli avant qu'il ne devienne un
 * trou le jour d'un DS.
 */
export const MASTERY_STALE_DAYS = 21;

/** Nombre de jours pleins écoulés entre une date ISO et `now` (toujours ≥ 0 en usage normal). */
function daysBetween(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86400000);
}

/** `null` si l'exercice n'a jamais eu de séance focus achevée dessus (voir `Exercise.last_worked_at`). */
function daysSinceLastWorked(exercise: Exercise, now: Date): number | null {
  if (!exercise.last_worked_at) return null;
  return daysBetween(exercise.last_worked_at, now);
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
 *
 * Sprint système de révision : différencie explicitement "jamais travaillé"
 * (A) de "travaillé mais faible" (B) — une maîtrise basse par défaut sur un
 * exercice jamais tenté n'est pas un signal de difficulté, juste l'absence
 * de donnée (même principe que `hasChapterEngagement`/`hasEngagement`,
 * lib/next-action.ts et lib/plan.ts, appliqué ici à l'échelle de l'exercice) —
 * "Maîtrise faible" ne s'affiche donc que si l'exercice a déjà été engagé.
 */
function evaluateExercise(
  exercise: Exercise,
  minutesSpent: number,
  attempts: WorkSession[],
  now: Date,
  deadlineSignal?: ChapterDeadlineSignal,
  planGapMinutes?: number
): string[] {
  const reasons: string[] = [];
  const neverWorked = isNeverWorked(exercise, minutesSpent);
  if (exercise.mastery <= 25 && !neverWorked) reasons.push("Maîtrise faible");
  if (exercise.priority >= 4) reasons.push("Priorité élevée");
  // `attempts.length === 0` en plus de `neverWorked` (Sprint Study OS Phase 6) :
  // une séance de moins d'une minute ne fait pas passer `exercise.attempts`/
  // `minutesSpent` au-dessus de 0 (voir `commitResult`, lib/session.ts), donc
  // `neverWorked` restait vrai juste après un tel échec — "Jamais travaillé"
  // s'affichait alors CÔTE À CÔTE avec "Échec récent" pour le même exercice,
  // une contradiction visible détectée en direct pendant l'audit de cette
  // phase. `attempts` (séances avec résultat, voir plus bas) est déjà la
  // source de vérité pour "Échec récent" : s'il en existe une, l'exercice a
  // été travaillé, quelle que soit sa durée.
  if (neverWorked && attempts.length === 0) reasons.push("Jamais travaillé");
  if (exercise.status === "en cours") reasons.push("En cours");
  if (exercise.status === "à revoir") reasons.push("Marqué à revoir");
  // Échéance (Sprint Study OS Phase 4 — DS/khôlle) : un chapitre associé à
  // une échéance proche (voir lib/deadlines.ts#chapterDeadlineSignals) suffit
  // à proposer cet exercice, même si aucun autre critère ne le retenait —
  // c'est un critère d'inclusion À PART ENTIÈRE, pas un simple bonus de tri
  // (voir `urgencyScore` pour l'effet sur le score). Exclu pour un exercice
  // déjà "maîtrisé" : rien à regagner d'une simple échéance sur un exercice
  // déjà acquis (le mécanisme de révision adaptative existant couvre déjà
  // "maîtrisé mais pas retravaillé depuis longtemps", plus bas).
  if (deadlineSignal && exercise.status !== "maîtrisé") reasons.push(`Prioritaire : ${deadlineSignal.label}`);
  // "Maîtrisé, jamais retravaillé" : cas particulier conservé tel quel
  // (Sprint 4) — aucune tentative avec résultat, donc aucun intervalle
  // adaptatif calculable ; seule la fiche manuelle "maîtrisé" donne un
  // signal. Le reste du critère est adaptatif (voir
  // `revisionUrgencyFromAttempts`) et ne dépend plus du statut manuel : un
  // exercice "à revoir" ou "en cours" dont la série de réussites est due
  // redevient éligible au même titre qu'un exercice "maîtrisé".
  if (exercise.status === "maîtrisé" && daysSinceLastWorked(exercise, now) === null) {
    reasons.push("Maîtrisé, jamais retravaillé");
  } else if (revisionUrgencyFromAttempts(exercise, attempts, now) > 0) {
    const days = daysSinceLastWorked(exercise, now) ?? daysBetween(attempts[0].started_at, now);
    reasons.push(`Non retravaillé depuis ${days} j`);
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
  // raisons d'un exercice déjà retenu par ailleurs. Distingue une vraie
  // progression (catégorie D : échec récent puis réussite) d'une simple
  // réussite isolée — signal plus informatif pour l'utilisateur qu'un
  // "Réussi récemment" générique.
  if (reasons.length > 0 && attempts[0]?.result === "réussi") {
    const recovered = attempts.slice(1, RECENT_ATTEMPTS_WINDOW).some((attempt) => attempt.result === "échoué");
    reasons.push(recovered ? "Progrès récents" : "Réussi récemment");
  }
  // Le favori n'est jamais un critère d'inclusion à lui seul (un exercice
  // favori déjà maîtrisé et récent n'a aucune raison de revenir) : il ne
  // s'ajoute qu'aux raisons déjà réunies, pour un exercice retenu par
  // ailleurs — voir `urgencyScore` pour son (léger) effet sur le tri.
  if (reasons.length > 0 && exercise.favorite) reasons.push("Favori");
  // Retard sur le plan hebdomadaire (Sprint Study OS Phase 4) : même
  // principe que "Favori" ci-dessus — jamais un critère d'inclusion à lui
  // seul (une matière en retard n'invente pas un exercice à proposer), sert
  // uniquement à expliquer pourquoi CET exercice, déjà retenu par ailleurs,
  // est spécialement pertinent maintenant (voir lib/weekly-plan.ts#planGapMinutesBySubject).
  if (reasons.length > 0 && planGapMinutes && planGapMinutes > 0) reasons.push("En retard sur ton plan de la semaine");
  return reasons;
}

/** Contribution du statut au score d'urgence — un exercice "maîtrisé" est déprioritisé, sans jamais être exclu (voir `evaluateExercise`). */
const STATUS_WEIGHT: Record<ExerciseStatus, number> = {
  "à faire": 10,
  "en cours": 25,
  "à revoir": 40,
  maîtrisé: -30,
};

/** Plafond commun aux deux chemins de `revisionUrgencyFromAttempts` (adaptatif et repli) — comparable en amplitude à `momentumBonus`, jamais dominant. */
const REVISION_URGENCY_CAP = 30;
const REVISION_URGENCY_PER_DAY = 0.5;

/**
 * Intervalle avant révision (jours), pas une valeur stockée : reconstruite à
 * chaque appel à partir de la série de réussites consécutives la plus
 * récente. Double à chaque réussite supplémentaire (Leitner léger : 1
 * réussite → court, 2 → plus long, 3 → plus long encore), plafonné à partir
 * de `REVISION_MAX_STREAK_FOR_INTERVAL` réussites pour ne jamais croître sans
 * limite, et toujours borné par `REVISION_MAX_INTERVAL_DAYS`.
 *
 * `difficultyFactor` ajuste modérément (±20 %, jamais plus) autour de la
 * difficulté 3 comme référence neutre — même convention que
 * `estimatedDurationMinutes`. Un exercice difficile (5) resserre l'intervalle
 * (0.8×) : une réussite n'y vaut pas la même confiance à long terme que sur
 * un exercice facile (1, 1.2×) — sans pour autant lui donner un énorme bonus.
 */
const REVISION_BASE_INTERVAL_DAYS = 3;
const REVISION_MAX_STREAK_FOR_INTERVAL = 4;
const REVISION_MAX_INTERVAL_DAYS = MASTERY_STALE_DAYS;

function revisionIntervalDays(streak: number, difficulty: Exercise["difficulty"]): number {
  const effectiveStreak = Math.min(streak, REVISION_MAX_STREAK_FOR_INTERVAL);
  const difficultyFactor = 1 - (difficulty - 3) * 0.1; // 0.8 (difficile) à 1.2 (facile)
  const raw = REVISION_BASE_INTERVAL_DAYS * 2 ** (effectiveStreak - 1) * difficultyFactor;
  return Math.min(REVISION_MAX_INTERVAL_DAYS, raw);
}

/**
 * Urgence adaptative quand une série de réussites consécutives existe
 * (`streak > 0`) : 0 tant que la dernière réussite est dans l'intervalle
 * théorique (`revisionIntervalDays`), puis croît progressivement au-delà,
 * plafonnée à `REVISION_URGENCY_CAP` — même forme que l'ancien
 * `staleMasteryBonus`, mais avec un seuil désormais adaptatif au lieu de
 * `MASTERY_STALE_DAYS` fixe.
 */
function adaptiveRevisionUrgency(attempts: WorkSession[], streak: number, difficulty: Exercise["difficulty"], now: Date): number {
  const daysSince = daysBetween(attempts[0].started_at, now);
  if (!Number.isFinite(daysSince)) return 0; // `started_at` corrompu : robustesse avant tout, jamais de crash
  const overdueDays = daysSince - revisionIntervalDays(streak, difficulty);
  if (overdueDays <= 0) return 0;
  return Math.min(REVISION_URGENCY_CAP, overdueDays * REVISION_URGENCY_PER_DAY);
}

/**
 * Repli quand aucune tentative avec résultat n'existe pour l'exercice : aucun
 * intervalle adaptatif n'est calculable (Étape 2 — pas d'historique, pas de
 * série). Reprend exactement l'ancien mécanisme fixe (Sprint 4) : seuil de
 * `MASTERY_STALE_DAYS`, gardé par le statut manuel "maîtrisé". `last_worked_at`
 * nul est traité comme "tout juste au seuil" (0), pas comme "infiniment
 * ancien" — même logique que `lib/week.ts#neglectedSubjects`.
 */
function legacyStaleBonus(exercise: Exercise, now: Date): number {
  if (exercise.status !== "maîtrisé") return 0;
  const days = daysSinceLastWorked(exercise, now);
  if (days === null) return 0;
  const overdueDays = days - MASTERY_STALE_DAYS;
  if (overdueDays <= 0) return 0;
  return Math.min(REVISION_URGENCY_CAP, overdueDays * REVISION_URGENCY_PER_DAY);
}

/**
 * Urgence de révision (0 à `REVISION_URGENCY_CAP`) à partir de tentatives
 * déjà filtrées/triées pour un exercice (voir `attemptsWithResult`) — cœur
 * partagé par `computeRevisionUrgency` (export public) et par
 * `evaluateExercise`/`urgencyScore` (qui ont déjà `attempts` sous la main,
 * jamais filtré deux fois).
 *
 * Trois cas, mutuellement exclusifs (jamais de double comptage) :
 * - Série de réussites en cours (`streak > 0`) → chemin adaptatif
 *   (`adaptiveRevisionUrgency`), fondé sur l'historique réel.
 * - Dernière tentative connue ratée/partielle (`streak === 0` mais
 *   `attempts` non vide) → 0 ici : le signal est déjà porté par
 *   `failureBonus`/les raisons "Échec récent" · "Plusieurs échecs" — un
 *   échec récent réduit fortement la confiance sans la recalculer ici en
 *   plus (voir la doc de `urgencyScore`).
 * - Aucune tentative avec résultat → repli sur l'ancien signal fixe
 *   (`legacyStaleBonus`), seule information disponible dans ce cas.
 */
function revisionUrgencyFromAttempts(exercise: Exercise, attempts: WorkSession[], now: Date): number {
  const streak = recentSuccessStreak(attempts);
  if (streak > 0) return adaptiveRevisionUrgency(attempts, streak, exercise.difficulty, now);
  if (attempts.length > 0) return 0;
  return legacyStaleBonus(exercise, now);
}

/**
 * Urgence de révision adaptative pour un exercice, à partir de tout
 * l'historique de séances — export public (Étape 2) pour un usage direct
 * (debug, simulation, futurs consommateurs) sans dupliquer le filtrage déjà
 * fait ici. Fonction pure et déterministe : ne dépend jamais de `new Date()`
 * en interne, uniquement du paramètre `now` (même convention que
 * `computeExerciseBankStats`).
 */
export function computeRevisionUrgency(exercise: Exercise, sessions: WorkSession[], now: Date = new Date()): number {
  return revisionUrgencyFromAttempts(exercise, attemptsWithResult(sessions, exercise.id), now);
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
/** 0-25 : plus l'échéance associée au chapitre est proche, plus le bonus grimpe — même ordre de grandeur que `failureBonus`, jamais dominant à lui seul. Nul sans échéance pertinente. */
const DEADLINE_BONUS_CAP = 25;
function chapterDeadlineBonus(signal: ChapterDeadlineSignal | undefined): number {
  if (!signal) return 0;
  const urgencyFactor = Math.max(0, Math.min(1, 1 - signal.days / DEADLINE_RELEVANCE_HORIZON_DAYS));
  return urgencyFactor * DEADLINE_BONUS_CAP;
}

/** 0-20 : proportionnel au retard (minutes) sur le plan hebdomadaire pour la matière de l'exercice — plafonné pour ne jamais dominer un signal plus direct (échec récent, échéance). Nul sans plan configuré pour cette matière (voir `lib/weekly-plan.ts#planGapMinutesBySubject`, qui n'émet un retard que si un plan existe). */
const PLAN_GAP_BONUS_CAP = 20;
const PLAN_GAP_BONUS_PER_MINUTE = 0.4;
function planGapBonus(minutesBehind: number | undefined): number {
  if (!minutesBehind || minutesBehind <= 0) return 0;
  return Math.min(PLAN_GAP_BONUS_CAP, minutesBehind * PLAN_GAP_BONUS_PER_MINUTE);
}

function urgencyScore(
  exercise: Exercise,
  minutesSpent: number,
  attempts: WorkSession[],
  now: Date,
  deadlineSignal?: ChapterDeadlineSignal,
  planGapMinutes?: number
): number {
  const masteryGap = (100 - exercise.mastery) * 0.6; // 0 (maîtrisé à 100%) à 60 (maîtrisé à 0%)
  const priorityWeight = exercise.priority * 8; // 8 à 40
  const statusWeight = STATUS_WEIGHT[exercise.status]; // -30 à 40
  const neverWorkedBonus = isNeverWorked(exercise, minutesSpent) ? 15 : 0;
  // Temps déjà investi : léger bonus, plafonné pour ne jamais dominer les
  // autres termes — un exercice presque fini mérite d'être terminé, mais pas
  // au point d'éclipser une priorité élevée ou une maîtrise très faible.
  const momentumBonus = Math.min(minutesSpent, 60) * 0.3; // 0 à 18
  // Généralise l'ancien staleBonus fixe (21 jours, uniquement "maîtrisé") :
  // intervalle adaptatif fondé sur la série de réussites réelle (voir
  // `revisionUrgencyFromAttempts`). Remplace `staleMasteryBonus` dans la
  // somme plutôt que de s'y ajouter — les deux mesuraient le même
  // phénomène (retard de révision), les additionner aurait compté ce
  // phénomène deux fois.
  const revisionBonus = revisionUrgencyFromAttempts(exercise, attempts, now); // 0 à 30
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
  // Sprint Study OS Phase 4 : deux signaux additifs de plus, chacun plafonné
  // indépendamment et nul par défaut (voir `chapterDeadlineBonus`/`planGapBonus`) —
  // comportement strictement inchangé pour tout appelant qui ne les fournit pas.
  const deadlineBonus = chapterDeadlineBonus(deadlineSignal); // 0 à 25
  const planBonus = planGapBonus(planGapMinutes); // 0 à 20
  return (
    masteryGap +
    priorityWeight +
    statusWeight +
    neverWorkedBonus +
    momentumBonus +
    revisionBonus +
    favoriteBonus +
    failureBonus -
    successPenalty +
    deadlineBonus +
    planBonus
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
  /**
   * Échéances (DS/khôlle) proches, résolues par chapitre — voir
   * lib/deadlines.ts#chapterDeadlineSignals. Omis : comportement strictement
   * inchangé (aucun chapitre n'est jamais bonifié), pour ne rien casser chez
   * les appelants existants qui n'ont pas connaissance des échéances.
   */
  chapterDeadlines?: Map<string, ChapterDeadlineSignal>;
  /**
   * Retard (minutes) sur le plan hebdomadaire, par matière — voir
   * lib/weekly-plan.ts#planGapMinutesBySubject. Omis : comportement
   * strictement inchangé.
   */
  subjectPlanGap?: Partial<Record<Subject, number>>;
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
    const deadlineSignal = exercise.chapter_id ? options.chapterDeadlines?.get(exercise.chapter_id) : undefined;
    const planGapMinutes = options.subjectPlanGap?.[exercise.subject];
    const reasons = evaluateExercise(exercise, minutesSpent, attempts, now, deadlineSignal, planGapMinutes);
    if (reasons.length === 0) continue;
    candidates.push({ exercise, score: urgencyScore(exercise, minutesSpent, attempts, now, deadlineSignal, planGapMinutes), reasons });
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

/**
 * Tableau de bord de la banque d'exercices — agrégats simples, tous dérivés
 * des mêmes règles que `recommendExercises` (voir `evaluateExercise`).
 * `options` (Sprint Study OS Phase 4, optionnel, `{}` par défaut — comportement
 * strictement inchangé sans lui) : mêmes signaux échéance/plan hebdomadaire
 * que `recommendExercises`, pour que `toReviewCount` ne dise jamais "rien à
 * signaler" alors qu'un DS proche rendrait un exercice éligible.
 */
export function computeExerciseBankStats(
  exercises: Exercise[],
  sessions: WorkSession[],
  now: Date = new Date(),
  options: Pick<RecommendationOptions, "chapterDeadlines" | "subjectPlanGap"> = {}
): ExerciseBankStats {
  const minutesByExercise = minutesByExerciseMap(sessions);
  const active = exercises.filter((exercise) => !exercise.archived);

  let toReviewCount = 0;
  let neverWorkedCount = 0;
  let masterySum = 0;
  let prioritySum = 0;

  for (const exercise of active) {
    const minutesSpent = minutesByExercise.get(exercise.id) ?? 0;
    const attempts = attemptsWithResult(sessions, exercise.id);
    const deadlineSignal = exercise.chapter_id ? options.chapterDeadlines?.get(exercise.chapter_id) : undefined;
    const planGapMinutes = options.subjectPlanGap?.[exercise.subject];
    if (evaluateExercise(exercise, minutesSpent, attempts, now, deadlineSignal, planGapMinutes).length > 0) toReviewCount++;
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
