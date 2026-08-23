import type { WorkSession } from "@/lib/supabase/types";

/*
 * Draft post-"Terminer" (Sprint résilience Focus + Chronomètre, Task 5) :
 * entre l'arrêt du chrono et le choix d'un résultat, la WorkSession existe
 * déjà (temps, dates) mais n'est pas encore sauvegardée par `saveSessions` —
 * un rechargement à ce moment précis la perdait avant ce sprint. Persisté en
 * localStorage (survit même à une fermeture d'onglet, pas seulement un
 * rechargement) sous une clé par exercice, symétrique de la clé sessionStorage
 * du chrono (`FOCUS_TIMER_PREFIX`, components/exercises/focus-view.tsx).
 *
 * Module séparé de focus-view.tsx (qui reste le seul consommateur) : cette
 * logique ne touche que localStorage, sans dépendance React/DOM, pour rester
 * testable avec l'environnement Vitest par défaut (voir vitest.config.ts —
 * aucun jsdom), au même titre que le reste de lib/.
 */
const FOCUS_DRAFT_PREFIX = "prepahub:timer:focus-draft:";
const focusDraftKey = (exerciseId: string) => `${FOCUS_DRAFT_PREFIX}${exerciseId}`;

export function readFocusDraft(exerciseId: string): WorkSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(focusDraftKey(exerciseId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkSession;
  } catch {
    localStorage.removeItem(focusDraftKey(exerciseId));
    return null;
  }
}

export function writeFocusDraft(exerciseId: string, draft: WorkSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(focusDraftKey(exerciseId), JSON.stringify(draft));
  } catch {
    // Filet de sécurité, jamais bloquant — voir hooks/use-work-timer.ts#writeCheckpoint.
  }
}

export function clearFocusDraft(exerciseId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(focusDraftKey(exerciseId));
  } catch {
    // idem.
  }
}

/**
 * Cherche un draft post-"Terminer" en attente, tous exercices confondus —
 * pendant de `findPersistedSessionSuffix` (hooks/use-work-timer.ts), à
 * vérifier EN PREMIER par les appelants (exercise-manager.tsx,
 * session-runner.tsx) : un draft signifie que le chrono est déjà arrêté et
 * qu'une WorkSession est prête, donc plus prioritaire qu'une simple reprise
 * de chrono ou qu'un checkpoint. Nettoie au passage une entrée corrompue.
 */
export function findPersistedFocusDraft(): WorkSession | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(FOCUS_DRAFT_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as WorkSession;
    } catch {
      localStorage.removeItem(key);
    }
  }
  return null;
}
