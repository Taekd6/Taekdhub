import type { Exercise } from "@/lib/supabase/types";

/**
 * DÉTECTION DES DOUBLONS À L'IMPORT D'UNE FEUILLE.
 *
 * `lib/exercise-import.ts` sait déjà refuser un exercice dont l'IDENTIFIANT ou
 * le titre existe déjà. Cela ne suffit pas ici : une même feuille réimportée
 * après une retouche, ou deux feuilles qui partagent un classique, produisent
 * des titres différents pour un énoncé identique. On compare donc aussi le
 * CONTENU, et on le fait AVANT toute écriture — rien n'est jamais écrasé, la
 * décision revient à l'élève.
 */

/**
 * Réduit un énoncé à ce qui l'identifie : les mots. Accents, casse,
 * ponctuation, balises LaTeX et espaces disparaissent — deux extractions du
 * même exercice ne diffèrent souvent que par ces détails-là.
 */
export function normalizeStatement(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\\[a-z]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Similarité de Dice sur les bigrammes de mots — robuste à un mot ajouté ou retiré, contrairement à une égalité stricte. */
export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const bigrams = (text: string) => {
    const words = text.split(" ").filter(Boolean);
    if (words.length < 2) return new Set(words);
    const set = new Set<string>();
    for (let index = 0; index < words.length - 1; index++) set.add(`${words[index]} ${words[index + 1]}`);
    return set;
  };
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** Au-delà, deux énoncés sont « le même exercice » à la reformulation près. */
export const NEAR_DUPLICATE = 0.85;

export interface DuplicateMatch {
  /** `identique` : même énoncé au détail typographique près. `proche` : très probablement le même exercice. */
  kind: "identique" | "proche";
  exerciseId: string;
  title: string;
  similarity: number;
}

/** Cherche, dans la banque, un exercice qui dit déjà la même chose. */
export function findDuplicate(statement: string, existing: Exercise[]): DuplicateMatch | null {
  const needle = normalizeStatement(statement);
  if (needle.length < 20) return null;
  let best: DuplicateMatch | null = null;
  for (const exercise of existing) {
    const score = similarity(needle, normalizeStatement(exercise.statement));
    if (score < NEAR_DUPLICATE) continue;
    if (best && score <= best.similarity) continue;
    best = {
      kind: score >= 0.995 ? "identique" : "proche",
      exerciseId: exercise.id,
      title: exercise.title,
      similarity: score,
    };
  }
  return best;
}
