"use client";

import { useCallback, useMemo } from "react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { notesFor, setChapterExos } from "@/lib/chapter-notes";
import { createErrorEntry } from "@/lib/error-log";
import {
  addExos,
  attemptForGrade,
  caseKey,
  caseStates,
  catalogueChapters,
  exoFromUrl,
  intervalFor,
  undoLastAttempt,
  withQuestion,
  addDays,
  type ExoEntry,
  type ExoStatus,
  type NewExo,
} from "@/lib/exos";
import type { ProgrammeChapter } from "@/lib/programme-data";
import { createWorkItem } from "@/lib/work-items";

/** Le jour local (AAAA-MM-JJ). */
export function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * LES EXOS DE L'ÉLÈVE — catalogue (chapterNotes.exos), cases (attempts) et
 * gestes de l'écran Exos. Tout passe par les collections synchronisées
 * existantes : le connecteur de Claude voit exactement la même chose.
 *
 * Cocher « Raté » fait aussi deux choses, pour que l'échec ne se perde pas :
 *   - le piège noté va dans le carnet d'erreurs du chapitre (onglet Erreurs,
 *     PDF, et les cartes Anki que Claude en tire) ;
 *   - une tâche « Refaire : … » est planifiée au jour du retour : elle part
 *     dans Rappels par le raccourci de l'élève.
 */
export function useExos() {
  const data = usePrepahubData();
  const { chapterNotes, attempts, errors, workItems, saveAttempts, saveChapterNotes, saveErrors, saveWorkItems, ready } = data;
  const today = localToday();
  const catalogue = useMemo(() => catalogueChapters(chapterNotes), [chapterNotes]);
  const states = useMemo(() => caseStates(attempts), [attempts]);

  const grade = useCallback(
    (chapter: ProgrammeChapter, entry: ExoEntry, question: string | null, status: ExoStatus, note?: string) => {
      const now = new Date();
      const day = localToday();
      const attempt = attemptForGrade({ chapter, entry, question, status, note }, now, day);
      saveAttempts([...attempts, attempt]);
      if (status === "rate") {
        const label = question ? `${entry.titre} · Q${question}` : entry.titre;
        if (note?.trim()) {
          const error = createErrorEntry({ subject: chapter.subject, source: "exercice", type: "méthode", description: `${label} : ${note.trim()}`.slice(0, 200) }, now);
          if (error) saveErrors([{ ...error, programmeChapterId: chapter.id }, ...errors]);
        }
        const due = addDays(day, intervalFor("rate", 0));
        const task = createWorkItem({ title: `Refaire : ${label}`.slice(0, 120), kind: "exercices", subject: chapter.subject, estimatedMinutes: 20, dueDate: due }, now);
        const linkNote = [chapter.title, entry.url ? entry.url : null, entry.page ? `Manuel ${entry.page}` : null, note?.trim() ? `Piège : ${note.trim()}` : null].filter(Boolean).join("\n");
        saveWorkItems([...workItems, { ...task, note: linkNote }]);
      }
      return attempt;
    },
    [attempts, errors, workItems, saveAttempts, saveErrors, saveWorkItems]
  );

  const undo = useCallback((chapterId: string, entryId: string, question: string | null) => saveAttempts(undoLastAttempt(attempts, caseKey(chapterId, entryId, question))), [attempts, saveAttempts]);

  /** Ajoute des entrées au catalogue d'un chapitre (lien collé ou saisie). Renvoie l'entrée touchée. */
  const addEntries = useCallback(
    (chapter: ProgrammeChapter, inputs: NewExo[]): { ok: true; added: number } | { ok: false; error: string } => {
      const known = notesFor(chapterNotes, chapter.id)?.exos ?? [];
      const result = addExos(known, inputs, new Date());
      if (!result.ok) return result;
      saveChapterNotes(setChapterExos(chapterNotes, chapter.id, result.items, new Date()));
      return { ok: true, added: result.added + result.updated };
    },
    [chapterNotes, saveChapterNotes]
  );

  /** Colle un ou plusieurs liens dans un chapitre ; une question Wikiprepa s'ajoute au sujet s'il existe déjà. */
  const addLinks = useCallback(
    (chapter: ProgrammeChapter, urls: string[]): number => {
      let list = [...(notesFor(chapterNotes, chapter.id)?.exos ?? [])];
      let count = 0;
      for (const url of urls) {
        const parsed = exoFromUrl(url);
        if (!parsed) continue;
        const bare = (url: string) => url.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
        const index = list.findIndex((entry) => entry.url && parsed.exo.url && bare(entry.url) === bare(parsed.exo.url) && (!parsed.question || entry.questions.includes(parsed.question)));
        const sameSubject = index >= 0 ? index : list.findIndex((entry) => entry.url && parsed.exo.url && bare(entry.url) === bare(parsed.exo.url));
        if (sameSubject >= 0) {
          list[sameSubject] = withQuestion(list[sameSubject], parsed.question);
        } else {
          const result = addExos(list, [parsed.exo], new Date());
          if (!result.ok) continue;
          list = result.items;
        }
        count += 1;
      }
      if (count) saveChapterNotes(setChapterExos(chapterNotes, chapter.id, list, new Date()));
      return count;
    },
    [chapterNotes, saveChapterNotes]
  );

  const removeEntry = useCallback(
    (chapter: ProgrammeChapter, entryId: string) => {
      const list = (notesFor(chapterNotes, chapter.id)?.exos ?? []).filter((entry) => entry.id !== entryId);
      saveChapterNotes(setChapterExos(chapterNotes, chapter.id, list, new Date()));
    },
    [chapterNotes, saveChapterNotes]
  );

  return { ready, today, catalogue, states, attempts, grade, undo, addEntries, addLinks, removeEntry };
}
