import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/** Un chapitre défini pour une matière donnée. */
export interface ChapterDefinition {
  /** Identifiant stable — ne doit jamais changer une fois des exercices créés avec ce chapitre. */
  id: string;
  label: string;
}

/**
 * Catalogue des chapitres par matière.
 *
 * Volontairement vide pour l'instant, matière par matière : ces listes
 * seront définies dans un sprint dédié, pour éviter tout chapitre inventé,
 * incomplet ou erroné (en particulier pour MP). Tant qu'une matière n'a pas
 * de chapitres définis ici, la banque d'exercices utilise en secours les
 * intitulés de chapitre déjà saisis librement par l'utilisateur — voir
 * `distinctChapters` dans lib/exercise-filters.ts.
 *
 * Pour ajouter les chapitres d'une matière : compléter le tableau
 * correspondant ci-dessous avec des `{ id, label }`. Le reste de
 * l'application (filtres, formulaire) est déjà prêt à les consommer via
 * `getChaptersForSubject`.
 */
export const chaptersBySubject: Record<Subject, ChapterDefinition[]> = subjects.reduce(
  (registry, subject) => ({ ...registry, [subject]: [] }),
  {} as Record<Subject, ChapterDefinition[]>
);

export function getChaptersForSubject(subject: Subject): ChapterDefinition[] {
  return chaptersBySubject[subject];
}
