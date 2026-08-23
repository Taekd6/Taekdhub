import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * Chapitres/thèmes (Sprint 3D) — créés et gérés par l'utilisateur au fil de
 * ses exercices, jamais pré-remplis : un catalogue officiel par matière
 * risquerait d'imposer un chapitre incomplet ou erroné (en particulier pour
 * une filière comme MP). Voir components/exercises/chapter-picker.tsx pour
 * le seul point de création (inline, depuis un exercice).
 *
 * Module purement fonctionnel — comme lib/study.ts et lib/exercise-filters.ts,
 * aucun accès à localStorage ici : la persistance vit dans lib/storage.ts
 * (`localData.chapters`/`saveChapters`), la réactivité dans
 * hooks/use-prepahub-data.ts. Les appelants (exercise-manager.tsx) combinent
 * ces fonctions pures avec `saveChapters`.
 */

export function getChaptersForSubject(chapters: Chapter[], subject: Subject): Chapter[] {
  return chapters.filter((chapter) => chapter.subject === subject).sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export function addChapter(chapters: Chapter[], subject: Subject, label: string): { chapters: Chapter[]; chapter: Chapter } {
  const chapter: Chapter = { id: crypto.randomUUID(), subject, label: label.trim() };
  return { chapters: [...chapters, chapter], chapter };
}

/**
 * `label` vide/blanc après trim : no-op, le libellé existant reste inchangé
 * — sans cette garde, renommer avec un champ vidé créait silencieusement un
 * chapitre sans nom (aucune validation n'existait jusqu'ici sur ce chemin,
 * contrairement à `ChapterPicker#confirmCreate` qui garde déjà la création).
 */
export function renameChapter(chapters: Chapter[], id: string, label: string): Chapter[] {
  const trimmed = label.trim();
  if (!trimmed) return chapters;
  return chapters.map((chapter) => (chapter.id === id ? { ...chapter, label: trimmed } : chapter));
}

/**
 * Retire le chapitre de la liste — ne touche jamais aux exercices qui le
 * référençaient : c'est à l'appelant de réassigner `chapter_id` à `null` sur
 * ces exercices (voir exercise-manager.tsx#handleRemoveChapter), pour ne
 * jamais supprimer un exercice suite à la suppression d'un chapitre.
 */
export function removeChapter(chapters: Chapter[], id: string): Chapter[] {
  return chapters.filter((chapter) => chapter.id !== id);
}

/**
 * Détache tout exercice dont `chapter_id` ne correspond à AUCUN chapitre
 * réellement présent pour SA matière — chapitre inexistant, ou catalogue de
 * chapitres appartenant à une autre matière (incohérence qui ne peut pas
 * survenir via l'UI elle-même : `ExerciseForm` réinitialise `chapterId` à
 * chaque changement de matière, `handleRemoveChapter` détache déjà les
 * exercices d'un chapitre supprimé — voir exercise-manager.tsx). Réservée
 * aux données arrivant de l'EXTÉRIEUR de l'app (voir
 * components/data-backup.tsx#confirmImport, seul point où des exercices et
 * des chapitres externes, potentiellement désynchronisés — sauvegarde
 * tronquée ou modifiée à la main — sont restaurés ensemble).
 *
 * Sans ce nettoyage, l'exercice garde une référence fantôme : le sélecteur
 * de chapitre l'affiche comme "Sans chapitre" (aucune option ne correspond
 * à l'identifiant stocké) alors que la donnée réelle pointe encore vers un
 * chapitre qui n'existe plus — et l'exercice devient invisible de toute vue
 * "par chapitre" (lib/progress.ts#progressByChapter) sans jamais apparaître
 * non plus dans "sans chapitre". Fonction pure : n'écrit rien elle-même.
 */
export function reconcileExerciseChapters(exercises: Exercise[], chapters: Chapter[]): Exercise[] {
  return exercises.map((exercise) => {
    if (exercise.chapter_id === null) return exercise;
    const chapter = chapters.find((item) => item.id === exercise.chapter_id);
    if (!chapter || chapter.subject !== exercise.subject) return { ...exercise, chapter_id: null };
    return exercise;
  });
}
