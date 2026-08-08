import type { Chapter } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

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

export function renameChapter(chapters: Chapter[], id: string, label: string): Chapter[] {
  const trimmed = label.trim();
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
