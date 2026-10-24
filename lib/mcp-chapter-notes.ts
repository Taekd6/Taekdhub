import { foldText } from "@/lib/annales";
import { createErrorEntry, ERROR_TEXT_MAX } from "@/lib/error-log";
import { chapterErrors, type ChapterNotes } from "@/lib/chapter-notes";
import type { ProgrammeChapter } from "@/lib/programme-data";
import { normalizeErrorEntry, type ErrorEntry, type ErrorSource, type ErrorType } from "@/lib/storage";

/**
 * CE QUE LE CONNECTEUR FAIT DES CHAPITRES — la partie pure des outils
 * `get_chapter`, `save_course`, `add_methods` et `add_errors`
 * (app/api/mcp/[key]/route.ts). Les erreurs vont dans le carnet existant
 * (`errors`) avec leur chapitre du programme ; cours et méthodes dans
 * `chapterNotes` (lib/chapter-notes.ts).
 */

export interface NewChapterError {
  description: string;
  fix?: string;
  type: ErrorType;
  source: ErrorSource;
  /** AAAA-MM-JJ ; par défaut aujourd'hui. */
  date?: string;
}

export type AddErrorsResult = { ok: true; items: ErrorEntry[]; value: { added: number; skipped: number; total: number } } | { ok: false; error: string };

/**
 * Ajoute des erreurs au carnet, rattachées au chapitre. Une erreur déjà
 * notée (même chapitre, même jour, même description sans casse ni accents)
 * n'est pas dupliquée : relancer l'outil ne crée rien de plus.
 */
export function addChapterErrors(current: unknown, chapter: ProgrammeChapter, inputs: NewChapterError[], now: Date): AddErrorsResult {
  const items = (Array.isArray(current) ? current : []).map(normalizeErrorEntry).filter((entry): entry is ErrorEntry => entry !== null);
  const seen = new Set(items.filter((entry) => entry.programmeChapterId === chapter.id).map((entry) => `${entry.date}|${foldText(entry.description)}`));
  const created: ErrorEntry[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const entry = createErrorEntry({ subject: chapter.subject, date: input.date, source: input.source, type: input.type, description: input.description, fix: input.fix }, now);
    if (!entry) return { ok: false, error: `Erreur refusée (vide ou de plus de ${ERROR_TEXT_MAX} caractères) : « ${input.description.slice(0, 60)} ». Reformule en une ligne.` };
    const key = `${entry.date}|${foldText(entry.description)}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    created.push({ ...entry, programmeChapterId: chapter.id });
  }
  const merged = [...created, ...items];
  return { ok: true, items: merged, value: { added: created.length, skipped, total: chapterErrors(merged, chapter.id).length } };
}

/** Ce que `get_chapter` rend : le chapitre tel que TaekdHub le garde, pour vérifier une notion avant de proposer un exercice. */
export function describeChapter(chapter: ProgrammeChapter, notes: ChapterNotes | null, errors: ErrorEntry[], withCourse: boolean): string {
  const lines: string[] = [`CHAPITRE : ${chapter.title} (${chapter.id}, ${chapter.subject})`];
  if (notes?.cours) {
    lines.push(withCourse ? `\nCOURS RETAPÉ (${notes.cours.length} caractères) :\n${notes.cours}` : `\nCOURS : ${notes.cours.length} caractères rangés (non inclus ; redemande avec avec_cours: true).`);
  } else {
    lines.push("\nCOURS : aucun cours rangé pour ce chapitre. NE PRÉTENDS PAS savoir ce qui a été vu en cours : demande à l'élève ou propose-lui d'envoyer le PDF de son prof.");
  }
  const methodes = notes?.methodes ?? [];
  lines.push(`\nMÉTHODES (${methodes.length}) :`);
  for (const methode of methodes) {
    lines.push(`- ${methode.titre} — Quand : ${methode.quand} — Étapes : ${methode.etapes.map((etape, index) => `${index + 1}. ${etape}`).join(" ")}${methode.piege ? ` — Piège : ${methode.piege}` : ""}`);
  }
  const list = chapterErrors(errors, chapter.id);
  lines.push(`\nERREURS NOTÉES (${list.length}) :`);
  for (const entry of list) {
    lines.push(`- ${entry.date} [${entry.type}, ${entry.source}] ${entry.description}${entry.fix ? ` → À retenir : ${entry.fix}` : ""}`);
  }
  return lines.join("\n");
}
