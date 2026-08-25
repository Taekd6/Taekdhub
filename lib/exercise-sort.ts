import type { Exercise } from "@/lib/supabase/types";

export type ExerciseSort = "recommande" | "recent" | "difficulty" | "mastery" | "alpha";

/**
 * Chaque libellé DIT SON SENS.
 *
 * « Difficulté » ou « Maîtrise » ne disent pas dans quel ordre : l'élève
 * choisissait sans savoir ce qu'il allait obtenir, et « Maîtrise » descendait
 * — donc montrait d'abord ce qu'il maîtrise le mieux, l'inverse exact de ce
 * qu'on cherche en triant par maîtrise.
 *
 * Deux options retirées : « Plus ancien » (l'inverse d'un tri par date de
 * création, qui sur une banque amorcée en une fois n'ordonne rien) et
 * « Temps passé » — la question « où ai-je passé du temps sans avancer ? »
 * est exactement celle à laquelle « Recommandé » répond, en mieux.
 */
export const exerciseSortOptions: { value: ExerciseSort; label: string }[] = [
  { value: "recommande", label: "Recommandé" },
  { value: "mastery", label: "Le moins maîtrisé d'abord" },
  { value: "difficulty", label: "Le plus difficile d'abord" },
  { value: "recent", label: "Ajouté récemment" },
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
 * Trie une liste déjà filtrée. Aucun tri ne recalcule quoi que ce soit : le
 * seul classement de l'application (`recommendExercises`) est passé en
 * paramètre, déjà calculé par l'appelant.
 */
export function sortExercises(
  exercises: Exercise[],
  sort: ExerciseSort,
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
    case "difficulty":
      sorted.sort((a, b) => b.difficulty - a.difficulty);
      break;
    case "mastery":
      // Croissant : trier par maîtrise, c'est chercher ce qui n'est pas acquis.
      sorted.sort((a, b) => a.mastery - b.mastery);
      break;
    case "alpha":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      break;
  }
  return sorted;
}
