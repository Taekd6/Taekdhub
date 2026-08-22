import type { WorkQueueItem } from "@/lib/storage";
import type { Exercise } from "@/lib/supabase/types";

/**
 * File de travail (Study OS) — une liste ordonnée d'exercices que
 * l'utilisateur constitue lui-même ("1. Maths Ex 42, 2. Physique Ex 17…")
 * avant de cliquer "Commencer". Ce module ne fait que manipuler la liste
 * elle-même : le Focus reste le moteur d'exécution (voir lib/plan.ts,
 * réutilisé tel quel pour transporter la file vers /session).
 */

/** Ajoute un exercice en fin de file — sans doublon (déplace en fin si déjà présent). */
export function addToQueue(queue: WorkQueueItem[], exerciseId: string): WorkQueueItem[] {
  return [...queue.filter((item) => item.exerciseId !== exerciseId), { exerciseId }];
}

/** Retire un exercice de la file, quelle que soit sa position. */
export function removeFromQueue(queue: WorkQueueItem[], exerciseId: string): WorkQueueItem[] {
  return queue.filter((item) => item.exerciseId !== exerciseId);
}

/** Déplace un exercice d'une position vers une autre (réordonnancement manuel). */
export function reorderQueue(queue: WorkQueueItem[], fromIndex: number, toIndex: number): WorkQueueItem[] {
  if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length || fromIndex === toIndex) {
    return queue;
  }
  const next = [...queue];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export interface UsableQueueEntry {
  item: WorkQueueItem;
  exercise: Exercise;
}

/**
 * Résout la file stockée (simples références `exerciseId`) contre la banque
 * actuelle, en ignorant silencieusement les exercices supprimés ou archivés
 * depuis leur ajout — jamais d'erreur, jamais d'entrée fantôme affichée.
 */
export function usableQueueEntries(queue: WorkQueueItem[], exercises: Exercise[]): UsableQueueEntry[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const entries: UsableQueueEntry[] = [];
  for (const item of queue) {
    const exercise = byId.get(item.exerciseId);
    if (exercise && !exercise.archived) entries.push({ item, exercise });
  }
  return entries;
}
