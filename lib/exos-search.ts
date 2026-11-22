import { EXO_SOURCE_LABEL, type CatalogueChapter, type ExoEntry } from "@/lib/exos";
import type { ProgrammeChapter } from "@/lib/programme-data";

export interface ExoHit {
  chapter: ProgrammeChapter;
  entry: ExoEntry;
  /** Libellé de la question visée (« 46 ») quand la recherche porte sur une question (« q46 »). */
  question: string | null;
}

/** Minuscules, sans accents, ponctuation → espaces : « Physique-Chimie · MP 2023 » → « physique chimie mp 2023 ». */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Cherche dans tout le catalogue : concours, année, filière, chapitre, mots du titre ou du détail, source, numéro de question (« q46 »).
 * Tous les mots doivent être trouvés (« ccinp 2023 machines » ne garde que les sujets qui les ont tous). Les titres qui commencent par le mot passent devant.
 */
export function searchExos(catalogue: CatalogueChapter[], query: string, limit = 40): ExoHit[] {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const scored: Array<{ hit: ExoHit; score: number }> = [];
  for (const { chapter, entries } of catalogue) {
    const chapterText = fold(`${chapter.title} ${chapter.subject} ${chapter.aliases.join(" ")}`);
    for (const entry of entries) {
      const body = fold(`${entry.titre} ${entry.detail ?? ""} ${entry.concours ?? ""} ${entry.annee ?? ""} ${EXO_SOURCE_LABEL[entry.source]} ${entry.page ?? ""}`);
      const questions = new Set(entry.questions.map((q) => `q${fold(q)}`));
      let question: string | null = null;
      let score = 0;
      let all = true;
      for (const word of words) {
        if (body.includes(word)) score += fold(entry.titre).includes(word) ? 3 : 2;
        else if (chapterText.includes(word)) score += 1;
        else if (questions.has(word)) {
          question = entry.questions.find((q) => `q${fold(q)}` === word) ?? null;
          score += 3;
        } else {
          all = false;
          break;
        }
      }
      if (all) scored.push({ hit: { chapter, entry, question }, score });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || (b.hit.entry.annee ?? 0) - (a.hit.entry.annee ?? 0))
    .slice(0, limit)
    .map((item) => item.hit);
}
