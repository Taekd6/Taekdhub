import type { Exercise } from "@/lib/supabase/types";

export type ExerciseSort = "recent" | "oldest" | "difficulty" | "priority" | "mastery" | "time" | "alpha";

export const exerciseSortOptions: { value: ExerciseSort; label: string }[] = [
  { value: "recent", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "difficulty", label: "Difficulté" },
  { value: "priority", label: "Priorité" },
  { value: "mastery", label: "Maîtrise" },
  { value: "time", label: "Temps passé" },
  { value: "alpha", label: "Ordre alphabétique" },
];

export const defaultExerciseSort: ExerciseSort = "recent";

/**
 * Trie une liste déjà filtrée. `minutesByExercise` (voir
 * lib/study.ts#minutesByExerciseMap) est calculé une seule fois par le
 * composant appelant et réutilisé ici pour le tri "temps passé", plutôt que
 * d'être recalculé à chaque comparaison — important dès que la banque
 * grossit (des centaines d'exercices).
 */
export function sortExercises(exercises: Exercise[], sort: ExerciseSort, minutesByExercise: Map<string, number>): Exercise[] {
  const sorted = [...exercises];
  switch (sort) {
    case "recent":
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case "oldest":
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case "difficulty":
      sorted.sort((a, b) => b.difficulty - a.difficulty);
      break;
    case "priority":
      sorted.sort((a, b) => b.priority - a.priority);
      break;
    case "mastery":
      sorted.sort((a, b) => b.mastery - a.mastery);
      break;
    case "time":
      sorted.sort((a, b) => (minutesByExercise.get(b.id) ?? 0) - (minutesByExercise.get(a.id) ?? 0));
      break;
    case "alpha":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      break;
  }
  return sorted;
}
