import { attemptsWithResult } from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Mastery Engine / Knowledge State (Sprint « Mastery Engine ») — couche
 * d'ÉTAT ACADÉMIQUE, jamais un moteur de décision. Répond à UNE question :
 * « Quelle est la confiance actuelle de TaekdHub dans la maîtrise de ce
 * groupe d'exercices ? », à partir des preuves déjà existantes (sessions
 * avec résultat, difficulté, historique). Les systèmes existants
 * (`lib/recommendation.ts`, `lib/next-action.ts`, `lib/mp-readiness.ts`)
 * restent seuls responsables de la décision — ce module ne choisit jamais
 * quoi proposer, ne trie jamais d'exercices, ne remplace ni
 * `computeNextAction` ni `recommendExercises`.
 *
 * ## Unité académique (voir l'audit du chantier)
 * Il n'existe aucune entité « notion » stockée dans l'app — l'unité la plus
 * fine réellement évaluable est l'EXERCICE, et le seul regroupement stable
 * au-dessus est le CHAPITRE (créé par l'utilisateur) ou un ensemble
 * d'exercices assemblé ailleurs (ex. correspondance par mots-clés de
 * `lib/mp-readiness.ts`). `computeKnowledgeState` est donc volontairement
 * AGNOSTIQUE du regroupement : il prend n'importe quelle liste d'exercices
 * déjà choisie par l'appelant (un chapitre entier, un sous-ensemble matché)
 * et ne connaît jamais la raison de ce regroupement.
 *
 * ## Pourquoi aucune nouvelle donnée persistante
 * Toutes les preuves utilisées ici existent déjà : `WorkSession.result`
 * (réussi/partiel/échoué/`null`), `WorkSession.started_at`,
 * `Exercise.difficulty` (1 à 5, déjà utilisé ailleurs — jamais un nouveau
 * système de difficulté). Une séance sans résultat (`result: null` —
 * interruption, séance libre, fermeture brutale) est déjà exclue par
 * `attemptsWithResult` (lib/recommendation.ts) : une interruption ne
 * dégrade donc JAMAIS le Knowledge State, par construction, sans code
 * dédié — voir la Phase 6 (comportement de reprise), jamais remis en cause
 * ici.
 */

export type KnowledgeState = "inconnu" | "en_acquisition" | "fragile" | "solide" | "maitrise";

export interface KnowledgeAssessment {
  state: KnowledgeState;
  /** Explication courte, sans jargon ni chiffre — la SEULE chose jamais montrée à l'élève (voir la doc de tête : aucun score n'est exposé). */
  reason: string;
  /** Nombre de tentatives AVEC résultat prises en compte — 0 si `state === "inconnu"`. Utile aux appelants pour décider d'afficher ou non l'état (« l'information doit apparaître seulement lorsqu'elle est utile »). */
  evidenceCount: number;
}

/** Une tentative avec résultat, réattachée à son exercice — pour pondérer par la difficulté sans reperdre le lien exercice ↔ tentative une fois les tentatives de plusieurs exercices fusionnées. */
interface PoolAttempt {
  exercise: Exercise;
  session: WorkSession;
}

/**
 * Fusionne les tentatives avec résultat de TOUS les exercices du pool,
 * triées de la plus récente à la plus ancienne — réutilise
 * `attemptsWithResult` exercice par exercice (même définition d'« échec
 * récent » que `lib/recommendation.ts`), jamais un second filtre.
 */
function poolAttempts(exercises: Exercise[], sessions: WorkSession[]): PoolAttempt[] {
  const attempts: PoolAttempt[] = [];
  for (const exercise of exercises) {
    for (const session of attemptsWithResult(sessions, exercise.id)) {
      attempts.push({ exercise, session });
    }
  }
  attempts.sort((a, b) => new Date(b.session.started_at).getTime() - new Date(a.session.started_at).getTime());
  return attempts;
}

/** Valeur d'une tentative pour le calcul de preuve — réussi = preuve pleine, partiel = moitié, échoué = aucune preuve positive (mais reste une tentative comptée dans l'historique). */
function resultValue(result: WorkSession["result"]): number {
  if (result === "réussi") return 1;
  if (result === "partiel") return 0.5;
  return 0;
}

/**
 * Poids de difficulté — neutre à la difficulté 3 (échelle 1-5 déjà
 * existante sur `Exercise.difficulty`, jamais un nouveau système). Une
 * réussite à difficulté 5 compte plus qu'une réussite à difficulté 1, sans
 * pour autant écraser les autres signaux (amplitude ±40 %, même esprit que
 * les pondérations de `lib/recommendation.ts#urgencyScore`).
 */
function difficultyWeight(difficulty: Exercise["difficulty"]): number {
  return 1 + (difficulty - 3) * 0.2; // 0.6 (facile) à 1.4 (difficile)
}

/** Fenêtre « récente » — les 3 dernières tentatives, tous exercices confondus (même largeur que `RECENT_ATTEMPTS_WINDOW`, lib/recommendation.ts, pour rester cohérent avec la définition déjà utilisée d'« échec récent »). */
const RECENT_WINDOW = 3;

/** Nombre de jours entre deux dates — pour la diversité temporelle (Cas B : « plusieurs exercices différents réussis sur plusieurs SESSIONS »), jamais pour une décroissance continue (le brief demande des règles explicables, pas une formule opaque). */
function calendarDay(iso: string): string {
  return iso.slice(0, 10); // yyyy-mm-dd — suffisant pour compter des jours distincts, jamais un vrai fuseau horaire à gérer ici.
}

/**
 * Score de preuve globale (0 à 1), pondéré par la difficulté — mesure
 * interne SEULE (jamais montrée à l'élève, voir la doc de tête). Simple,
 * borné, stable : une moyenne pondérée, rien de plus.
 */
function weightedEvidenceScore(attempts: PoolAttempt[]): number {
  if (attempts.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const { exercise, session } of attempts) {
    const weight = difficultyWeight(exercise.difficulty);
    weightedSum += resultValue(session.result) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Détecte une progression explicite : la séquence CHRONOLOGIQUE (la plus
 * ancienne d'abord) se termine par au moins une réussite alors qu'un échec
 * existe plus tôt dans l'historique — Cas F du brief (« réussite après
 * échecs → progression »), jamais réduit à une simple moyenne (brief :
 * « une série échec → échec → réussite → réussite ne doit pas être
 * interprétée comme une simple moyenne, elle raconte une progression »).
 */
function hasRecentProgression(attempts: PoolAttempt[]): boolean {
  if (attempts.length < 2) return false;
  const chronological = [...attempts].reverse();
  const hadEarlierFailure = chronological.slice(0, -1).some((a) => a.session.result === "échoué");
  const lastIsSuccess = chronological[chronological.length - 1].session.result === "réussi";
  return hadEarlierFailure && lastIsSuccess;
}

/**
 * État académique d'un ensemble d'exercices — pure, déterministe (jamais
 * `new Date()` en interne). `exercises` : n'importe quel regroupement déjà
 * choisi par l'appelant (chapitre, pool matché par mots-clés…) ; ce module
 * ignore délibérément d'où vient ce regroupement.
 *
 * Règles de transition (dans cet ordre — jamais de seuil implicite) :
 * 1. Aucune tentative avec résultat → `"inconnu"` (Cas A : rien à évaluer,
 *    jamais confondu avec « faible »).
 * 2. ≥ 2 échecs parmi les 3 tentatives les plus récentes → `"fragile"`,
 *    QUEL QUE SOIT l'historique — mais la RAISON distingue explicitement
 *    une fragilité récente sur un historique par ailleurs solide (Cas E :
 *    « ne pas effacer brutalement la maîtrise ») d'une fragilité sans passé
 *    positif (Cas D).
 * 3. Une seule preuve, sur un seul exercice → `"en_acquisition"`, jamais
 *    `"maitrise"` même si réussie (Cas B, Cas I : une répétition du même
 *    exercice ne compte jamais comme des preuves indépendantes — la
 *    diversité EXIGE plusieurs exercices distincts, jamais plusieurs
 *    passages sur le même).
 * 4. Preuve globale forte (score pondéré ≥ 0.85), sur au moins 3 exercices
 *    distincts, au moins 2 jours distincts, au moins 4 tentatives →
 *    `"maitrise"` (Cas C : diversité + volume + temps).
 * 5. Preuve globale correcte (≥ 0.6) sur au moins 2 exercices distincts →
 *    `"solide"`.
 * 6. Sinon → `"en_acquisition"` (progression en cours, pas encore assez
 *    établie dans un sens ou dans l'autre).
 */
export function computeKnowledgeState(exercises: Exercise[], sessions: WorkSession[]): KnowledgeAssessment {
  const attempts = poolAttempts(exercises, sessions);
  const evidenceCount = attempts.length;

  if (evidenceCount === 0) {
    return { state: "inconnu", reason: "Pas encore assez de données pour évaluer cette notion.", evidenceCount: 0 };
  }

  const distinctExercises = new Set(attempts.map((a) => a.exercise.id)).size;
  const distinctDays = new Set(attempts.map((a) => calendarDay(a.session.started_at))).size;
  const recentWindow = attempts.slice(0, RECENT_WINDOW);
  const recentFailures = recentWindow.filter((a) => a.session.result === "échoué").length;
  const olderAttempts = attempts.slice(RECENT_WINDOW);
  const historicalScore = weightedEvidenceScore(olderAttempts);
  const historicalIsSolid = olderAttempts.length >= 2 && historicalScore >= 0.7;

  // Règle 2 — fragilité récente, prioritaire sur tout calcul d'ensemble.
  if (recentFailures >= 2) {
    return {
      state: "fragile",
      reason: historicalIsSolid
        ? "Bonne maîtrise jusqu'ici, mais difficulté récente."
        : "Plusieurs difficultés récentes sur cette notion.",
      evidenceCount,
    };
  }

  // Règle 3 — une preuve unique sur un seul exercice ne suffit jamais.
  if (distinctExercises === 1 && evidenceCount <= 2) {
    return { state: "en_acquisition", reason: "Une seule preuve pour l'instant — encore tôt pour conclure.", evidenceCount };
  }

  const overallScore = weightedEvidenceScore(attempts);
  const progression = hasRecentProgression(attempts);

  // Règle 4 — preuve forte, diverse et étalée dans le temps.
  if (overallScore >= 0.85 && distinctExercises >= 3 && distinctDays >= 2 && evidenceCount >= 4) {
    return { state: "maitrise", reason: "Preuves nombreuses, variées et cohérentes dans le temps.", evidenceCount };
  }

  // Règle 5 — preuve correcte sur plusieurs exercices distincts.
  if (overallScore >= 0.6 && distinctExercises >= 2) {
    return {
      state: "solide",
      reason: progression ? "Progrès net après une période plus difficile." : "Plusieurs exercices différents réussis récemment.",
      evidenceCount,
    };
  }

  // Règle 6 — repli : des preuves existent mais rien d'assez établi.
  return {
    state: "en_acquisition",
    reason: progression ? "Progrès après une période plus difficile." : "Quelques réussites, encore à confirmer.",
    evidenceCount,
  };
}
