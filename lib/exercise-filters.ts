import { getChaptersForSubject } from "@/lib/chapters";
import { subjects } from "@/lib/study";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, Exercise, ExerciseStatus, ExerciseType, Mastery, Subject } from "@/lib/supabase/types";

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
  /**
   * Sous-thème (Phase 7 pédagogie) — un des `tags` libres déjà présents sur
   * chaque exercice (ex. "intégration par parties", "changement de variable"),
   * jamais un nouveau champ de schéma : la banque a toujours porté cette
   * granularité, elle n'était simplement pas exposée comme filtre. "Toutes"
   * par défaut. Voir `tagOptionsForFilters` ci-dessous pour les options
   * disponibles (dépendent de la matière/du chapitre déjà choisis).
   */
  tag: string | "Toutes";
  type: ExerciseType | "Tous";
  status: ExerciseStatus | "Tous";
  difficulty: Difficulty | "Toutes";
  mastery: Mastery | "Toutes";
  year: number | "Toutes";
  /**
   * Concours d'origine ("CCINP", "Centrale"…) ou "Tous". Permet le parcours
   * que réclame la révision ciblée : matière → chapitre → concours.
   */
  competition: string | "Tous";
  /**
   * Origine de l'exercice : "Concours" ne retient que ce qui vient réellement
   * d'un concours (provenance vérifiée OU partielle), "TaekdHub" les exercices
   * écrits pour l'app, "Enseignant" les feuilles de cours. Voir
   * lib/supabase/types.ts#Provenance.
   */
  origin: "Toutes" | "Concours" | "TaekdHub" | "Enseignant";
  favoritesOnly: boolean;
}

export const defaultExerciseFilters: ExerciseFilters = {
  query: "",
  subject: "Toutes",
  chapter: "Tous",
  tag: "Toutes",
  type: "Tous",
  status: "Tous",
  difficulty: "Toutes",
  mastery: "Toutes",
  year: "Toutes",
  competition: "Tous",
  origin: "Toutes",
  favoritesOnly: false,
};

/** Recherche instantanée sur le titre, la source, les tags, l'année et le type — un seul passage, pas de logique séparée par champ. */
function matchesSearch(exercise: Exercise, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  // Le concours et l'épreuve entrent dans la recherche : taper « mines » ou
  // « oral » doit ramener les exercices correspondants sans passer par les
  // sélecteurs.
  const haystack = [
    exercise.title,
    exercise.source,
    ...exercise.tags,
    exercise.year ? String(exercise.year) : "",
    exercise.type,
    exercise.competition ?? "",
    exercise.epreuve ?? "",
  ]
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
    .filter((item) => filters.tag === "Toutes" || item.tags.includes(filters.tag))
    .filter((item) => filters.type === "Tous" || item.type === filters.type)
    .filter((item) => filters.status === "Tous" || item.status === filters.status)
    .filter((item) => filters.difficulty === "Toutes" || item.difficulty === filters.difficulty)
    .filter((item) => filters.mastery === "Toutes" || item.mastery === filters.mastery)
    .filter((item) => filters.year === "Toutes" || item.year === filters.year)
    .filter((item) => filters.competition === "Tous" || item.competition === filters.competition)
    .filter((item) => filters.origin === "Toutes" || originOf(item) === filters.origin)
    .filter((item) => !filters.favoritesOnly || item.favorite)
    .filter((item) => matchesSearch(item, filters.query));
}

/** Regroupe les quatre niveaux de provenance dans les trois origines que l'élève distingue réellement. */
export function originOf(exercise: Exercise): "Concours" | "TaekdHub" | "Enseignant" {
  if (exercise.provenance === "concours-verifie" || exercise.provenance === "concours-partiel") return "Concours";
  if (exercise.provenance === "enseignant") return "Enseignant";
  return "TaekdHub";
}

/**
 * Concours réellement présents dans le périmètre déjà filtré (matière,
 * chapitre) — mêmes conventions que `chapterOptionsForSubject` : on ne
 * propose jamais un concours qui ne ramènerait aucun exercice.
 */
export function competitionOptionsForFilters(exercises: Exercise[], filters: ExerciseFilters): string[] {
  const scoped = exercises
    .filter((item) => !item.archived)
    .filter((item) => filters.subject === "Toutes" || item.subject === filters.subject)
    .filter((item) => filters.chapter === "Tous" || item.chapter_id === filters.chapter);
  return [...new Set(scoped.map((item) => item.competition).filter((value): value is string => Boolean(value)))].sort();
}

/**
 * Chapitres disponibles pour le filtre "chapitre", pour une matière donnée
 * (ou toutes) — créés par l'utilisateur (Sprint 3D, voir lib/chapters.ts).
 * Retourne les chapitres complets (pas seulement leurs id) pour que l'UI
 * puisse afficher le libellé plutôt que l'identifiant.
 */
export function chapterOptionsForSubject(chapters: Chapter[], subject: Subject | "Toutes"): Chapter[] {
  if (subject === "Toutes") return subjects.flatMap((item) => getChaptersForSubject(chapters, item));
  return getChaptersForSubject(chapters, subject);
}

/** Années réellement présentes dans les exercices actifs, les plus récentes en premier — source du filtre "année" (pas de liste inventée, contrairement aux chapitres il n'y a pas de catalogue à respecter ici). */
export function distinctYears(exercises: Exercise[]): number[] {
  return Array.from(new Set(exercises.filter((item) => !item.archived && item.year !== null).map((item) => item.year as number))).sort(
    (a, b) => b - a
  );
}

/**
 * Sous-thèmes ("tags") disponibles pour le filtre, restreints au périmètre déjà
 * choisi par matière/chapitre (`filters.subject`/`filters.chapter`) — mêmes
 * conventions que `chapterOptionsForSubject` : jamais un catalogue inventé,
 * seulement ce qui existe réellement dans la banque active. Ignore
 * volontairement `filters.tag` lui-même (sinon changer de chapitre ne
 * réduirait jamais la liste une fois un tag choisi) et les autres filtres
 * secondaires (difficulté, statut…) — le sous-thème reste une propriété de
 * l'exercice, pas de son état d'avancement.
 */
/**
 * Difficultés RÉELLEMENT présentes dans le périmètre déjà choisi
 * (matière/chapitre), croissantes — même convention que `distinctYears` et
 * `tagOptionsForFilters` ci-dessous : jamais un catalogue inventé.
 *
 * Le sélecteur proposait les cinq crans partout. Sur un chapitre qui n'en
 * contient aucun de niveau 5, choisir « Difficulté 5/5 » ne pouvait rendre
 * qu'un écran vide — l'élève découvrait après coup que son clic n'avait
 * jamais eu de chance d'aboutir.
 */
export function difficultyOptionsForFilters(exercises: Exercise[], filters: Pick<ExerciseFilters, "subject" | "chapter">): Difficulty[] {
  const scoped = exercises
    .filter((item) => !item.archived)
    .filter((item) => filters.subject === "Toutes" || item.subject === filters.subject)
    .filter((item) => filters.chapter === "Tous" || item.chapter_id === filters.chapter);
  return Array.from(new Set(scoped.map((item) => item.difficulty))).sort((a, b) => a - b);
}

export function tagOptionsForFilters(exercises: Exercise[], filters: Pick<ExerciseFilters, "subject" | "chapter">): string[] {
  const scoped = exercises
    .filter((item) => !item.archived)
    .filter((item) => filters.subject === "Toutes" || item.subject === filters.subject)
    .filter((item) => filters.chapter === "Tous" || item.chapter_id === filters.chapter);
  return Array.from(new Set(scoped.flatMap((item) => item.tags))).sort((a, b) => a.localeCompare(b, "fr"));
}
