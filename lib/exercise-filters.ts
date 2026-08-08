import { getChaptersForSubject } from "@/lib/chapters";
import { subjects } from "@/lib/study";
import type { Difficulty, Exercise, ExerciseStatus, ExerciseType, Mastery, Priority, Subject } from "@/lib/supabase/types";

/**
 * État complet des filtres + recherche de la banque d'exercices.
 * Ajouter un filtre = ajouter un champ ici, sa valeur "toutes" par défaut
 * dans `defaultExerciseFilters`, et une condition dans `filterExercises` —
 * aucun autre fichier de logique à toucher.
 */
export interface ExerciseFilters {
  query: string;
  subject: Subject | "Toutes";
  /** Identifiant de chapitre (voir lib/chapters.ts) ou "Tous". */
  chapter: string | "Tous";
  type: ExerciseType | "Tous";
  status: ExerciseStatus | "Tous";
  difficulty: Difficulty | "Toutes";
  priority: Priority | "Toutes";
  mastery: Mastery | "Toutes";
  year: number | "Toutes";
  favoritesOnly: boolean;
}

export const defaultExerciseFilters: ExerciseFilters = {
  query: "",
  subject: "Toutes",
  chapter: "Tous",
  type: "Tous",
  status: "Tous",
  difficulty: "Toutes",
  priority: "Toutes",
  mastery: "Toutes",
  year: "Toutes",
  favoritesOnly: false,
};

/** Recherche instantanée sur le titre, la source, les tags, l'année et le type — un seul passage, pas de logique séparée par champ. */
function matchesSearch(exercise: Exercise, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [exercise.title, exercise.source, ...exercise.tags, exercise.year ? String(exercise.year) : "", exercise.type]
    .join(" ")
    .toLowerCase();
  return haystack.includes(trimmed);
}

/**
 * Filtre + recherche des exercices actifs (non archivés), point d'entrée
 * unique utilisé par la page Exercices. Les filtres sont combinables par
 * construction (chaque `.filter()` restreint le résultat du précédent).
 */
export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  return exercises
    .filter((item) => !item.archived)
    .filter((item) => filters.subject === "Toutes" || item.subject === filters.subject)
    .filter((item) => filters.chapter === "Tous" || item.chapter_id === filters.chapter)
    .filter((item) => filters.type === "Tous" || item.type === filters.type)
    .filter((item) => filters.status === "Tous" || item.status === filters.status)
    .filter((item) => filters.difficulty === "Toutes" || item.difficulty === filters.difficulty)
    .filter((item) => filters.priority === "Toutes" || item.priority === filters.priority)
    .filter((item) => filters.mastery === "Toutes" || item.mastery === filters.mastery)
    .filter((item) => filters.year === "Toutes" || item.year === filters.year)
    .filter((item) => !filters.favoritesOnly || item.favorite)
    .filter((item) => matchesSearch(item, filters.query));
}

/**
 * Identifiants de chapitres disponibles pour le filtre "chapitre", pour une
 * matière donnée (ou toutes) — lus depuis le catalogue lib/chapters.ts.
 * Ce catalogue est vide aujourd'hui pour chaque matière (voir ce fichier) :
 * ce filtre n'aura donc aucune option tant qu'il n'aura pas été peuplé dans
 * un sprint dédié — comportement attendu, pas une régression.
 */
export function chapterOptionsForSubject(subject: Subject | "Toutes"): string[] {
  if (subject === "Toutes") {
    return Array.from(new Set(subjects.flatMap((item) => getChaptersForSubject(item).map((chapter) => chapter.id))));
  }
  return getChaptersForSubject(subject).map((chapter) => chapter.id);
}

/** Années réellement présentes dans les exercices actifs, les plus récentes en premier — source du filtre "année" (pas de liste inventée, contrairement aux chapitres il n'y a pas de catalogue à respecter ici). */
export function distinctYears(exercises: Exercise[]): number[] {
  return Array.from(new Set(exercises.filter((item) => !item.archived && item.year !== null).map((item) => item.year as number))).sort(
    (a, b) => b - a
  );
}
