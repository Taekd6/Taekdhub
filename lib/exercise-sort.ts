import type { Exercise } from "@/lib/supabase/types";

export type ExerciseSort = "recommande" | "recent" | "oldest" | "difficulty" | "mastery" | "time" | "alpha";

export const exerciseSortOptions: { value: ExerciseSort; label: string }[] = [
  { value: "recommande", label: "Recommandé" },
  { value: "recent", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "difficulty", label: "Difficulté" },
  { value: "mastery", label: "Maîtrise" },
  { value: "time", label: "Temps passé" },
  { value: "alpha", label: "Ordre alphabétique" },
];

/**
 * Ordre par défaut de la banque : celui du moteur.
 *
 * L'ancien défaut, "Plus récent", triait par `created_at` — or la banque
 * entière est amorcée en une seule fois (lib/seed.ts), donc les 402 exercices
 * partagent la même date à quelques millisecondes près. Concrètement, l'ordre
 * par défaut d'un chapitre ne répondait à AUCUNE question de l'élève : ni
 * « par où je commence ? », ni « qu'est-ce qui est urgent ? ». Un tri qui
 * n'ordonne rien est pire qu'absent, parce qu'il a l'air d'ordonner.
 */
export const defaultExerciseSort: ExerciseSort = "recommande";

/**
 * Trie une liste déjà filtrée. `minutesByExercise` (voir
 * lib/study.ts#minutesByExerciseMap) est calculé une seule fois par le
 * composant appelant et réutilisé ici pour le tri "temps passé", plutôt que
 * d'être recalculé à chaque comparaison — important dès que la banque
 * grossit (des centaines d'exercices).
 */
export function sortExercises(
  exercises: Exercise[],
  sort: ExerciseSort,
  minutesByExercise: Map<string, number>,
  /**
   * Rang de chaque exercice dans `recommendExercises` (lib/recommendation.ts),
   * calculé UNE fois par l'appelant sur toute la banque — jamais un second
   * classement défini ici. Un exercice absent de la carte n'est pas signalé
   * par le moteur : il passe après tous ceux qui le sont.
   */
  recommendationRank: Map<string, number> = new Map()
): Exercise[] {
  const sorted = [...exercises];
  switch (sort) {
    case "recommande": {
      const NO_RANK = Number.MAX_SAFE_INTEGER;
      sorted.sort((a, b) => {
        const rankA = recommendationRank.get(a.id) ?? NO_RANK;
        const rankB = recommendationRank.get(b.id) ?? NO_RANK;
        if (rankA !== rankB) return rankA - rankB;
        // Aucun des deux n'est signalé : rien d'urgent à départager, on
        // répond alors à l'autre question de l'élève — « par où je
        // commence ? » — du plus accessible au plus dur. C'est un ordre
        // d'AFFICHAGE dérivé d'un champ existant, pas un score.
        return a.difficulty - b.difficulty;
      });
      break;
    }
    case "recent":
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case "oldest":
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case "difficulty":
      sorted.sort((a, b) => b.difficulty - a.difficulty);
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
