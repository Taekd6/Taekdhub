import { normalizeSession, sessionRead, sessionRemove, sessionWrite } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * LA TENTATIVE EN ATTENTE DE VERDICT — le seul moment où du travail réel
 * n'existe que dans la mémoire de React.
 *
 * ## Le trou que ce module ferme
 * Le mode focus fonctionne en deux temps : `endSession` arrête le chrono et
 * construit la `WorkSession`, puis l'écran « Comment s'est passé l'exercice ? »
 * attend un résultat, et `commitResult` sauvegarde enfin. Entre les deux, le
 * chrono a DÉJÀ effacé sa clé de reprise (hooks/use-work-timer.ts#stop, qui
 * nettoie sessionStorage de façon synchrone) et rien n'a encore été écrit :
 * la séance n'existe que dans un `useState`.
 *
 * Un rechargement à cet instant l'effaçait entièrement, sans un message.
 * Reproduit en navigateur avant correctif : 42 minutes de travail réel,
 * touche Échap, rechargement → `prepahub:sessions` contient 0 séance, la clé
 * du chrono est déjà supprimée, plus rien n'est récupérable. Et la fenêtre
 * n'est pas brève : l'écran de résultat attend indéfiniment que l'élève
 * choisisse — c'est même précisément le moment où il s'arrête pour réfléchir,
 * repose son crayon, ou pose son téléphone (dont le navigateur recycle
 * volontiers l'onglet en arrière-plan).
 *
 * ## La règle retenue
 * Le brouillon est écrit en sessionStorage AU MOMENT où le chrono s'arrête,
 * puis relu au montage et effacé à la sauvegarde. sessionStorage et non
 * localStorage, volontairement : c'est un état « séance en cours », de la
 * même famille que le chrono lui-même (voir hooks/use-work-timer.ts) — il
 * doit survivre à un rechargement, pas à la fermeture de l'onglet.
 *
 * Un brouillon n'est JAMAIS une séance enregistrée : il ne compte ni dans
 * l'historique, ni dans l'XP, ni dans aucun moteur tant que l'élève n'a pas
 * répondu (ou explicitement passé). Aucun résultat n'est deviné à sa place —
 * on lui repose simplement la question au lieu de jeter son travail.
 */

/**
 * L'AIDE DÉJÀ UTILISÉE, telle qu'un chrono interrompu la restitue.
 *
 * `hintCount` et `correctionRevealed` voyagent dans le contexte persisté du
 * chrono (voir `FocusTimerContext`, components/exercises/focus-view.tsx) et
 * non dans un état React, sans quoi un rechargement en cours de séance les
 * remettait à zéro : trois indices révélés et la correction lue
 * réapparaissaient en `0` / `false`, c'est-à-dire en PREUVES POSITIVES
 * d'autonomie (voir lib/supabase/types.ts) — le produit affirmait alors que
 * l'élève s'en était sorti seul.
 *
 * Les deux champs sont optionnels : un chrono déjà en cours au moment de la
 * mise à jour ne porte que `exerciseId`. Il retombe alors sur 0 / false,
 * exactement le comportement d'avant — jamais une valeur inventée, et jamais
 * `undefined` qui filtrerait jusque dans la séance enregistrée.
 */
export function resumeAid(context: { hintCount?: number; correctionRevealed?: boolean } | null | undefined): {
  hintCount: number;
  correctionRevealed: boolean;
} {
  return {
    hintCount: typeof context?.hintCount === "number" && Number.isFinite(context.hintCount) && context.hintCount >= 0 ? Math.floor(context.hintCount) : 0,
    correctionRevealed: context?.correctionRevealed === true,
  };
}

/**
 * L'AIDE CONSULTÉE AILLEURS QUE DANS LA SÉANCE.
 *
 * La fiche d'un exercice (components/exercises/exercise-detail.tsx) offre ses
 * propres boutons « Afficher l'indice N » et « Afficher la correction ». Un
 * élève pouvait donc y lire la solution entière, ouvrir ensuite le mode
 * Focus sur le MÊME exercice, travailler, et déclarer « Réussi » : la séance
 * enregistrait `hints_used: 0, correction_viewed: false`. Reproduit en
 * navigateur — correction et trois indices lus sur la fiche, puis 30 minutes
 * de Focus et « Réussi ».
 *
 * Or `0` et `false` ne sont pas des trous : ce sont les preuves POSITIVES
 * d'autonomie du produit (voir lib/supabase/types.ts), celles qui débloquent
 * le plein tarif d'XP, l'état « solide » d'une notion et la montée d'un
 * palier de difficulté. Le mode Focus avait été rendu honnête ; c'était la
 * porte de derrière.
 *
 * ## Ce que ce marqueur fait — et ce qu'il se refuse à faire
 * Il ne prétend PAS que l'élève a triché, et n'enregistre donc pas `true` :
 * lire une correction sur la fiche n'est pas la lire PENDANT la tentative.
 * On ne peut ni affirmer l'autonomie, ni affirmer l'aide. La séance
 * enregistre alors `null` — « on ne sait pas » —, qui par construction ne
 * crédite ni ne sanctionne (voir `isAutonomousSuccess` et
 * `wasAssistedSuccess`, lib/recommendation.ts). Le produit cesse d'affirmer
 * ce qu'il ne sait pas, sans inventer une faute.
 *
 * ## Pourquoi sessionStorage, et pourquoi ce n'est pas une base parallèle
 * Ce marqueur ne duplique aucune donnée du domaine : c'est un fait
 * d'interface, de la même famille que le chrono et le brouillon de séance,
 * et il vit exactement aussi longtemps qu'eux — le temps de l'onglet. Une
 * correction lue il y a trois semaines n'a aucune raison de peser sur la
 * séance d'aujourd'hui ; celle qu'on vient de lire, si.
 */
export const AID_SEEN_PREFIX = "prepahub:aid-seen:";

export function aidSeenKey(exerciseId: string): string {
  return `${AID_SEEN_PREFIX}${exerciseId}`;
}

/** Ce qui a été consulté hors séance pour un exercice donné. */
export interface AidSeenElsewhere {
  hint: boolean;
  correction: boolean;
}

/** Lecture tolérante : une clé absente, illisible ou d'une forme inattendue vaut « rien vu », jamais une exception — cette valeur est lue au montage du mode focus. */
export function parseAidSeen(raw: string | null): AidSeenElsewhere {
  if (!raw) return { hint: false, correction: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { hint: false, correction: false };
    const record = parsed as Record<string, unknown>;
    return { hint: record.hint === true, correction: record.correction === true };
  } catch {
    return { hint: false, correction: false };
  }
}

export function readAidSeen(exerciseId: string): AidSeenElsewhere {
  return parseAidSeen(sessionRead(aidSeenKey(exerciseId)));
}

/** Note qu'une aide a été consultée hors séance. Cumulatif : un indice affiché n'efface pas une correction déjà lue. */
export function markAidSeen(exerciseId: string, kind: keyof AidSeenElsewhere): void {
  const current = readAidSeen(exerciseId);
  if (current[kind]) return;
  sessionWrite(aidSeenKey(exerciseId), JSON.stringify({ ...current, [kind]: true }));
}

/**
 * L'aide à ENREGISTRER pour une tentative, à partir de ce qui a été mesuré
 * pendant la séance et de ce qui avait été consulté ailleurs.
 *
 * Trois règles, dans cet ordre :
 * 1. Une mesure prise pendant la séance prime toujours — trois indices
 *    révélés en Focus valent 3, quoi qu'il se soit passé sur la fiche.
 * 2. À défaut de mesure, une consultation ailleurs rend le verdict inconnu
 *    (`null`) : on ne peut plus affirmer l'autonomie.
 * 3. Sinon seulement, on affirme `0` / `false` — la preuve positive que
 *    l'élève a conclu seul.
 */
export function resolveAttemptAid(
  measured: { hintCount: number; correctionRevealed: boolean },
  seenElsewhere: AidSeenElsewhere
): { hints_used: number | null; correction_viewed: boolean | null } {
  return {
    hints_used: measured.hintCount > 0 ? measured.hintCount : seenElsewhere.hint ? null : 0,
    correction_viewed: measured.correctionRevealed ? true : seenElsewhere.correction ? null : false,
  };
}

/** Une seule tentative en attente par exercice : la clé encode l'exercice concerné, comme celle du chrono (voir `FOCUS_TIMER_PREFIX`). */
export const PENDING_ATTEMPT_PREFIX = "prepahub:attempt:pending:";

export function pendingAttemptKey(exerciseId: string): string {
  return `${PENDING_ATTEMPT_PREFIX}${exerciseId}`;
}

/**
 * Relit un brouillon sérialisé et le refuse s'il ne décrit pas une tentative
 * exploitable sur CET exercice. Pur (aucun accès au stockage) pour être
 * testable directement.
 *
 * Trois refus, chacun protégeant d'une écriture parasite plutôt que d'un cas
 * théorique : JSON illisible, brouillon d'un AUTRE exercice (une clé
 * bricolée à la main ne doit pas pouvoir attribuer du temps à la mauvaise
 * fiche), et durée nulle — sans une seconde enregistrée il n'y a rien à
 * qualifier, exactement la règle que `endSession` applique déjà.
 */
export function parsePendingAttempt(raw: string | null, exerciseId: string): WorkSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const session = normalizeSession(parsed);
  if (session.exercise_id !== exerciseId) return null;
  if (session.duration_seconds <= 0) return null;
  return session;
}

export function readPendingAttempt(exerciseId: string): WorkSession | null {
  return parsePendingAttempt(sessionRead(pendingAttemptKey(exerciseId)), exerciseId);
}

export function writePendingAttempt(draft: WorkSession): void {
  if (!draft.exercise_id) return;
  sessionWrite(pendingAttemptKey(draft.exercise_id), JSON.stringify(draft));
}

export function clearPendingAttempt(exerciseId: string): void {
  sessionRemove(pendingAttemptKey(exerciseId));
}

/**
 * Ajoute une tentative à l'historique, sans jamais l'ajouter deux fois.
 *
 * L'idempotence tenait jusqu'ici à une coïncidence heureuse : deux
 * validations dans le même tour de boucle reconstruisaient toutes deux
 * `[brouillon, ...sessions]` à partir du même tableau périmé, donc le même
 * résultat. Vérifié en navigateur, aucune double écriture n'est aujourd'hui
 * atteignable (double-clic, double frappe clavier, deux évènements dans le
 * même tour : une seule séance enregistrée à chaque fois).
 *
 * Elle est désormais garantie plutôt que constatée : la reprise après
 * rechargement introduite ci-dessus fait qu'un même brouillon peut être
 * chargé par deux montages successifs, et l'identifiant est justement ce qui
 * reste stable entre eux.
 */
export function appendAttempt(session: WorkSession, sessions: WorkSession[]): WorkSession[] {
  if (sessions.some((existing) => existing.id === session.id)) return sessions;
  return [session, ...sessions];
}
