import { normalizeAttempts, type ExerciseAttempt } from "@/lib/attempts";
import { notesFor, setChapterExos, type ChapterNotes } from "@/lib/chapter-notes";
import {
  addExos,
  attemptForGrade,
  catalogueChapters,
  caseStates,
  chapterStats,
  dueCases,
  entryCases,
  EXO_SOURCE_LABEL,
  EXO_STATUS_LABEL,
  findExo,
  weakChapters,
  type ExoStatus,
  type NewExo,
} from "@/lib/exos";
import type { ProgrammeChapter } from "@/lib/programme-data";

/**
 * CE QUE LE CONNECTEUR FAIT DES EXOS — la partie pure des outils `get_exos`,
 * `add_exos` et `log_exos` (app/api/mcp/[key]/route.ts). Le catalogue va dans
 * `chapterNotes` (champ `exos`), les cases cochées dans `attempts`.
 */

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);

/** Vue d'ensemble : chapitres, cases dues, points faibles. */
export function describeExosOverview(notes: ChapterNotes[], attempts: ExerciseAttempt[], today: string): string {
  const catalogue = catalogueChapters(notes);
  const states = caseStates(attempts);
  if (!catalogue.length) return "EXOS : aucun catalogue rangé pour l'instant. Ajoute des références avec add_exos (chapitre par chapitre).";
  const lines = [`EXOS au ${today}`];
  const due = dueCases(catalogue, states, today);
  lines.push(`\nÀ REVOIR AUJOURD'HUI (${due.length}) :`);
  for (const item of due.slice(0, 30)) lines.push(`- ${item.chapter.title} · ${item.entry.titre}${item.question ? ` · Q${item.question}` : ""} — dernier : ${EXO_STATUS_LABEL[item.state.status]} le ${item.state.lastDay}${item.state.note ? ` — piège : ${item.state.note}` : ""}`);
  lines.push("\nCHAPITRES :");
  for (const item of catalogue) {
    const stats = chapterStats(item, states, today);
    lines.push(`- ${item.chapter.title} (${item.chapter.id}) : ${stats.done}/${stats.cases} cases faites, maîtrise ${pct(stats.mastery)}, ${stats.seul} seul, ${stats.indices} indices, ${stats.rate} ratées, ${stats.due} à revoir`);
  }
  const weak = weakChapters(catalogue, states, today);
  if (weak.length) {
    lines.push("\nPOINTS FAIBLES :");
    for (const item of weak) lines.push(`- ${item.stats.chapter.title} (${pct(item.stats.mastery)}) : ${item.tip}${item.lastNote ? ` Dernier piège : ${item.lastNote}` : ""}`);
  }
  return lines.join("\n");
}

/** Un chapitre : chaque entrée du catalogue et l'état de ses cases. */
export function describeChapterExos(chapter: ProgrammeChapter, notes: ChapterNotes[], attempts: ExerciseAttempt[], today: string): string {
  const entries = notesFor(notes, chapter.id)?.exos ?? [];
  if (!entries.length) return `EXOS · ${chapter.title} : catalogue vide. Ajoute des références avec add_exos.`;
  const states = caseStates(attempts);
  const stats = chapterStats({ chapter, entries }, states, today);
  const lines = [`EXOS · ${chapter.title} (${chapter.id}) — ${stats.done}/${stats.cases} cases faites, maîtrise ${pct(stats.mastery)}, ${stats.due} à revoir`];
  for (const entry of entries) {
    const cases = entryCases(chapter.id, entry).map(({ key, question }) => {
      const state = states.get(key);
      const label = question ? `Q${question}` : "exo";
      if (!state) return `${label}: pas fait`;
      return `${label}: ${EXO_STATUS_LABEL[state.status]}${state.next <= today ? " (à revoir)" : ` (revient le ${state.next})`}`;
    });
    lines.push(`- [${EXO_SOURCE_LABEL[entry.source]}] ${entry.titre} (id ${entry.id})${entry.detail ? ` — ${entry.detail}` : ""}${entry.url ? ` — ${entry.url}` : ""}${entry.page ? ` — ${entry.page}` : ""}\n    ${cases.join(" · ")}`);
  }
  return lines.join("\n");
}

export type AddExosOutcome = { ok: true; items: ChapterNotes[]; value: { added: number; updated: number; total: number } } | { ok: false; error: string };

export function addChapterExos(current: ChapterNotes[], chapter: ProgrammeChapter, inputs: NewExo[], now: Date): AddExosOutcome {
  const known = notesFor(current, chapter.id)?.exos ?? [];
  const result = addExos(known, inputs, now);
  if (!result.ok) return result;
  return { ok: true, items: setChapterExos(current, chapter.id, result.items, now), value: { added: result.added, updated: result.updated, total: result.items.length } };
}

export interface LogExoInput {
  exo: string;
  questions?: string[];
  statut: ExoStatus;
  piege?: string;
}

export type LogExosOutcome = { ok: true; items: ExerciseAttempt[]; value: { logged: string[] } } | { ok: false; error: string };

/** Coche des cases : une tentative par case. L'entrée se donne par identifiant ou par titre. */
export function logChapterExos(currentAttempts: unknown, notes: ChapterNotes[], chapter: ProgrammeChapter, inputs: LogExoInput[], now: Date, today: string): LogExosOutcome {
  const entries = notesFor(notes, chapter.id)?.exos ?? [];
  const attempts = normalizeAttempts(currentAttempts);
  const created: ExerciseAttempt[] = [];
  const logged: string[] = [];
  for (const input of inputs) {
    const entry = findExo(entries, input.exo);
    if (!entry) return { ok: false, error: `Entrée « ${input.exo} » introuvable dans le catalogue de ${chapter.title} : lis get_exos pour son identifiant, ou ajoute-la avec add_exos.` };
    const questions = input.questions?.length ? input.questions : entry.questions.length ? null : [null];
    if (!questions) return { ok: false, error: `« ${entry.titre} » a des questions (${entry.questions.join(", ")}) : dis lesquelles cocher.` };
    for (const question of questions) {
      if (question !== null && !entry.questions.includes(question)) return { ok: false, error: `Question « ${question} » absente de « ${entry.titre} » (${entry.questions.join(", ") || "aucune"}).` };
      created.push(attemptForGrade({ chapter, entry, question, status: input.statut, note: input.piege }, now, today));
      logged.push(`${entry.titre}${question ? ` · Q${question}` : ""} → ${EXO_STATUS_LABEL[input.statut]}`);
    }
  }
  return { ok: true, items: [...attempts, ...created], value: { logged } };
}
