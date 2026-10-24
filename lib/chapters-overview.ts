import { COURSE_CHAPTERS } from "@/lib/course-cards";
import { chapterErrors, notesFor, type ChapterNotes } from "@/lib/chapter-notes";
import { PROGRAMME, type ProgrammeChapter } from "@/lib/programme-data";
import type { ErrorEntry } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LA LISTE DES CHAPITRES (`/chapitres`) — pour chaque chapitre du programme,
 * ce que TaekdHub en garde : le cours rangé ou non, le nombre de méthodes,
 * d'erreurs et de cartes Anki. Une vue, aucune donnée de plus : tout vient
 * de `chapterNotes`, de `errors` et des cartes de cours.
 *
 * Fonction pure.
 */

export interface ChapterSummary {
  chapter: ProgrammeChapter;
  hasCourse: boolean;
  /** Taille du cours rangé, en caractères (0 sans cours). */
  courseLength: number;
  methodes: number;
  erreurs: number;
  cartes: number;
}

/** Vrai dès qu'il y a quelque chose à voir sur la page du chapitre. */
export function hasContent(summary: ChapterSummary): boolean {
  return summary.hasCourse || summary.methodes > 0 || summary.erreurs > 0;
}

/** Les chapitres d'une matière (et d'une année si on la donne), dans l'ordre du programme. */
export function summarizeChapters(notes: ChapterNotes[], errors: ErrorEntry[], subject: Subject, year?: 1 | 2): ChapterSummary[] {
  const cards = new Map(COURSE_CHAPTERS.map((entry) => [entry.chapterId, entry.cards.length]));
  return PROGRAMME.filter((chapter) => chapter.subject === subject && (year === undefined || chapter.year === year)).map((chapter) => {
    const entry = notesFor(notes, chapter.id);
    return {
      chapter,
      hasCourse: Boolean(entry?.cours),
      courseLength: entry?.cours?.length ?? 0,
      methodes: entry?.methodes.length ?? 0,
      erreurs: chapterErrors(errors, chapter.id).length,
      cartes: cards.get(chapter.id) ?? 0,
    };
  });
}
