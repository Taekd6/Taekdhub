/**
 * « Où me suis-je arrêté ? » (Sprint poste de pilotage) — le Dashboard doit
 * pouvoir signaler une séance Focus interrompue (chrono encore actif,
 * checkpoint après fermeture brutale, ou résultat pas encore choisi) sans
 * attendre que l'utilisateur navigue vers /exercises ou /session : ces deux
 * pages détectent déjà ce cas au montage (voir
 * components/exercises/exercise-manager.tsx#resumeChecked), mais rien n'en
 * informait le Dashboard, seul point d'entrée réel de la journée.
 *
 * Ce module ne fait QUE composer trois signaux déjà lus ailleurs (voir
 * hooks/use-resumable-focus.ts, qui les lit réellement depuis
 * sessionStorage/localStorage) — même priorité stricte, dans le même ordre,
 * que le mécanisme existant : draft (chrono déjà arrêté, résultat en
 * attente) > séance active (sessionStorage) > checkpoint de secours
 * (localStorage, après une fermeture brutale). Aucun nouveau signal, aucune
 * nouvelle décision.
 */

export interface ResumeSignal {
  exerciseId: string;
  seconds: number;
}

/**
 * `isUsable` : l'exercice doit encore exister et ne pas être archivé — même
 * garde que `resumeChecked` (un exercice supprimé ou archivé entre-temps ne
 * doit jamais proposer une reprise vers une fiche qui n'existe plus).
 */
export function resolveResumableFocus(
  draft: ResumeSignal | null,
  active: ResumeSignal | null,
  checkpoint: ResumeSignal | null,
  isUsable: (exerciseId: string) => boolean
): ResumeSignal | null {
  if (draft && isUsable(draft.exerciseId)) return draft;
  if (active && isUsable(active.exerciseId)) return active;
  if (checkpoint && isUsable(checkpoint.exerciseId)) return checkpoint;
  return null;
}
