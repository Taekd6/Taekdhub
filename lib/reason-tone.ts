/**
 * Tonalité visuelle d'une raison de recommandation (Micro-sprint « Ah ouais »
 * — micro-amélioration « Pourquoi cet exercice ? »).
 *
 * Classe une raison DÉJÀ produite par `lib/recommendation.ts#evaluateExercise`
 * (le texte exact affiché en Badge un peu partout dans l'app) en une des
 * quatre tonalités déjà utilisées ailleurs dans le produit (voir
 * `PRIORITY_META`/`TRAJECTORY_META`, components/dashboard-overview.tsx) —
 * jamais une nouvelle raison, jamais un nouveau critère de décision. Ce
 * module ne fait qu'INTERPRÉTER un texte déjà décidé par le moteur, pour lui
 * donner une couleur cohérente dans une petite liste ("Pourquoi cet exercice
 * ?") — exactement le même principe que `computeSubjectTrajectory`
 * (lib/plan.ts) : explique, ne décide jamais.
 *
 * Une raison inconnue (évolution future du moteur) retombe sur "neutral"
 * plutôt que de faire planter l'affichage — jamais d'exception ici.
 */
export type ReasonTone = "urgent" | "attention" | "neutral" | "positive";

const URGENT_REASONS = new Set(["Plusieurs échecs", "Échec récent"]);
const ATTENTION_REASONS = new Set(["Maîtrise faible", "Marqué à revoir", "Priorité élevée"]);
const POSITIVE_REASONS = new Set(["Progrès récents", "Réussi récemment", "Favori"]);

/**
 * Tout le reste ("Jamais travaillé", "En cours", "Maîtrisé, jamais
 * retravaillé", "Non retravaillé depuis N j", "Séance reprise"…) : un
 * signal informatif, pas un signal d'urgence ni une félicitation — d'où
 * le repli par défaut ci-dessous plutôt qu'une liste positive exhaustive
 * (certaines raisons contiennent un nombre variable, ex. "Non retravaillé
 * depuis 6 j", donc pas listables dans un `Set` fixe).
 */
export function classifyReason(reason: string): ReasonTone {
  if (URGENT_REASONS.has(reason)) return "urgent";
  if (ATTENTION_REASONS.has(reason)) return "attention";
  if (POSITIVE_REASONS.has(reason)) return "positive";
  return "neutral";
}

/** Même vocabulaire de couleurs que `PRIORITY_META`/`TRAJECTORY_META` (dashboard-overview.tsx) : rose=urgent, ambre=à surveiller, bleu=neutre/info, émeraude=positif. Jamais une nouvelle palette. */
export const REASON_TONE_META: Record<ReasonTone, { dot: string }> = {
  urgent: { dot: "bg-rose-400" },
  attention: { dot: "bg-amber-400" },
  neutral: { dot: "bg-sky-400" },
  positive: { dot: "bg-emerald-400" },
};
