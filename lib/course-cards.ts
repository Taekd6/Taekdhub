import data from "@/data/course-cards.json";
import { ANKI_DECK_PREFIX, ANKI_TAG, type AnkiCard } from "@/lib/anki-export";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

/**
 * CARTES DE COURS — un paquet Anki prêt à l'emploi pour la spé maths MP :
 * définitions, théorèmes AVEC leurs hypothèses, et méthodes « Quand je
 * vois… → … ». Rédigées une fois (data/course-cards.json), en notation
 * mathématique Unicode pour s'afficher partout, iPhone compris, sans MathJax.
 *
 * Les paquets s'appellent `TaekdHub::Mathématiques::<titre exact du
 * chapitre>` : le pont Anki (lib/anki-mapping.ts) les associe donc tout
 * seul au bon chapitre, et leurs échecs nourrissent le diagnostic.
 *
 * Deux façons de les verser dans Anki : AnkiConnect (ordinateur), ou le
 * paquet `public/anki/taekdhub-maths-mp.apkg`, régénéré par
 * `python3 scripts/build-course-deck.py` à partir du même fichier.
 */

export type CourseCardKind = "définition" | "théorème" | "méthode";

export interface CourseCard {
  kind: CourseCardKind;
  front: string;
  back: string;
}

export interface CourseChapter {
  chapterId: string;
  title: string;
  cards: CourseCard[];
}

export const COURSE_DECK_URL = "/anki/taekdhub-maths-mp.apkg";

export const COURSE_CHAPTERS: CourseChapter[] = (data.chapters as { chapterId: string; cards: CourseCard[] }[])
  .filter((chapter) => PROGRAMME_BY_ID.has(chapter.chapterId))
  .map((chapter) => ({ chapterId: chapter.chapterId, title: PROGRAMME_BY_ID.get(chapter.chapterId)!.title, cards: chapter.cards }));

export function courseDeckName(chapter: Pick<CourseChapter, "chapterId">): string {
  const entry = PROGRAMME_BY_ID.get(chapter.chapterId)!;
  return `${ANKI_DECK_PREFIX}::${entry.subject}::${entry.title}`;
}

/** Les cartes des chapitres choisis, prêtes pour AnkiConnect ou le fichier texte. */
export function courseAnkiCards(chapterIds: string[]): AnkiCard[] {
  return COURSE_CHAPTERS.filter((chapter) => chapterIds.includes(chapter.chapterId)).flatMap((chapter) =>
    chapter.cards.map((card, index) => ({
      id: `${chapter.chapterId}#${index}`,
      front: card.front,
      back: card.back,
      deck: courseDeckName(chapter),
      tags: [ANKI_TAG, "cours", card.kind],
    }))
  );
}
