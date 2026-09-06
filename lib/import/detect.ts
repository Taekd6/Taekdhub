import { bodyFont, bodySize, buildLines, stripRunningHeads } from "@/lib/import/layout";
import { mathFontsOf, renderLine } from "@/lib/import/latex";
import type { PdfPage, SheetBlock, SheetExtraction } from "@/lib/import/types";

/**
 * DÉCOUPAGE D'UNE FEUILLE EN EXERCICES.
 *
 * Deux pièges, tous deux vus sur de vraies feuilles :
 *
 *  - « 1. » en début de ligne est presque toujours une SOUS-QUESTION, pas un
 *    exercice. On ne coupe donc que sur un mot explicite (« Exercice »,
 *    « Problème »…), jamais sur un numéro nu. Une feuille qui n'en contient
 *    aucun devient un seul exercice, ce qui est le comportement juste : mieux
 *    vaut un exercice que l'élève découpe lui-même que vingt morceaux.
 *
 *  - un exercice commencé en bas d'une page continue en haut de la suivante.
 *    Les pages sont donc mises bout à bout AVANT le découpage, et les numéros
 *    de page en tête/pied sont retirés — sans quoi ils atterrissaient au
 *    milieu d'un énoncé.
 */

/** « Exercice 12. », « EXERCICE II — Suites », « Problème 3 : … », « Ex. 4 ) ». */
const HEADING = /^(?:exercice|exercise|probl[eè]me|ex)\s*\.?\s*(?:n\s*°\s*)?([0-9]{1,3}|[IVXLC]{1,6})?\s*[.:)–—-]?\s*(.*)$/i;
/** « 1. », « 2) », « a) », « b. », « iii) » — des sous-questions, jamais des exercices. */
const PART = /^(?:\(?\s*(?:[0-9]{1,2}|[a-hα-ω]|[ivx]{1,4})\s*[.)\]]\s+)/i;

function looksLikeHeading(text: string): boolean {
  return /^(?:exercice|exercise|probl[eè]me|ex\.)\b/i.test(text.trim());
}

/** Met les pages bout à bout et convertit chaque ligne en texte prêt pour `RichMath`. */
export function toBlocks(pages: PdfPage[]): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  for (const page of pages) {
    const fonts = new Set(page.items.map((item) => item.font));
    const mathFonts = mathFontsOf(bodyFont(page.items), fonts);
    const size = bodySize(page.items);
    for (const line of stripRunningHeads(buildLines(page), page)) {
      const text = renderLine(line, mathFonts, size);
      if (!text.trim()) continue;
      if (looksLikeHeading(text)) {
        const match = text.trim().match(HEADING);
        blocks.push({
          kind: "heading",
          page: page.number,
          text: text.trim(),
          number: match?.[1] ?? undefined,
          label: match?.[2]?.trim() || undefined,
          stacked: line.stacked,
        });
      } else {
        blocks.push({ kind: "text", page: page.number, text, stacked: line.stacked });
      }
    }
  }
  return blocks;
}

/** Un titre lisible : celui écrit sur la feuille, sinon la première phrase de l'énoncé. */
function deriveTitle(label: string | undefined, statement: string, fallback: string): string {
  if (label && label.length >= 3) return label;
  const firstLine = statement.split("\n").find((line) => line.trim().length > 0) ?? "";
  // On coupe à la première ponctuation forte, hors formule : couper au milieu
  // d'un `$…$` produirait un titre au LaTeX déséquilibré, illisible partout.
  let depth = 0;
  for (let index = 0; index < firstLine.length; index++) {
    const character = firstLine[index];
    if (character === "$" && firstLine[index - 1] !== "\\") depth = depth === 0 ? 1 : 0;
    if (depth === 0 && /[.?!:]/.test(character) && index >= 12) {
      return firstLine.slice(0, index).trim();
    }
  }
  const candidate = firstLine.trim();
  if (candidate.length >= 6) return candidate.length <= 90 ? candidate : `${candidate.slice(0, 87).trimEnd()}…`;
  return fallback;
}

function countParts(statement: string): number {
  return statement.split("\n").filter((line) => PART.test(line.trim())).length;
}

/** Raisons objectives de relire un exercice avant de l'importer. */
function warningsFor(statement: string, stacked: boolean): string[] {
  const warnings: string[] = [];
  if (statement.trim().length < 30) warnings.push("L'énoncé est très court : la détection a peut-être coupé trop tôt.");
  if (stacked) warnings.push("Cette feuille contient une fraction ou une matrice empilée : vérifie la formule, elle n'a pas pu être reconstruite.");
  if ((statement.match(/\$/g) ?? []).length % 2 !== 0) warnings.push("Une formule semble incomplète.");
  if (/[�-]/.test(statement)) warnings.push("Certains caractères n'ont pas pu être lus (police non standard).");
  return warnings;
}

/** Regroupe les blocs en exercices. Le texte qui précède le premier titre devient l'en-tête de la feuille. */
export function extractExercises(pages: PdfPage[]): SheetExtraction {
  const blocks = toBlocks(pages);
  return assemble(blocks, pages.length);
}

/**
 * Même découpage, mais à partir de texte collé à la main — la porte de sortie
 * quand le PDF est un scan, ou quand l'extraction s'est mal passée. C'est le
 * SEUL chemin manuel, et il est explicite dans l'interface plutôt que caché.
 */
export function extractFromText(raw: string): SheetExtraction {
  const blocks: SheetBlock[] = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (!looksLikeHeading(line)) return { kind: "text" as const, page: 1, text: line, stacked: false };
      const match = line.match(HEADING);
      return {
        kind: "heading" as const,
        page: 1,
        text: line,
        number: match?.[1] ?? undefined,
        label: match?.[2]?.trim() || undefined,
        stacked: false,
      };
    });
  return assemble(blocks, 1);
}

/**
 * Assemblage commun aux deux entrées (PDF et texte collé) : un seul endroit
 * décide de ce qu'est un exercice, pour que le chemin manuel produise
 * exactement les mêmes objets que le chemin automatique.
 */
function assemble(blocks: SheetBlock[], pageCount: number): SheetExtraction {
  const headerLines: string[] = [];
  const groups: { number: string | null; label?: string; lines: string[]; pages: Set<number>; stacked: boolean }[] = [];

  for (const block of blocks) {
    if (block.kind === "heading") {
      groups.push({ number: block.number ?? null, label: block.label, lines: [], pages: new Set([block.page]), stacked: block.stacked });
      continue;
    }
    if (!groups.length) {
      headerLines.push(block.text);
      continue;
    }
    const current = groups[groups.length - 1];
    current.lines.push(block.text);
    current.pages.add(block.page);
    current.stacked ||= block.stacked;
  }

  // Aucune numérotation : la feuille entière est UN exercice. Mieux vaut un
  // exercice que l'élève découpera lui-même que vingt morceaux arbitraires.
  if (!groups.length) {
    if (!headerLines.length) return { header: "", exercises: [], pages: pageCount, scanned: true };
    const [first, ...rest] = headerLines;
    const statement = rest.join("\n").trim() || first;
    return {
      header: first,
      pages: pageCount,
      scanned: false,
      exercises: [
        {
          number: null,
          title: deriveTitle(rest.length ? first : undefined, statement, "Exercice importé"),
          statement,
          pages: [...new Set(blocks.map((block) => block.page))].sort((a, b) => a - b),
          parts: countParts(statement),
          warnings: warningsFor(statement, blocks.some((block) => block.stacked)),
        },
      ],
    };
  }

  return {
    header: headerLines.join(" ").trim(),
    pages: pageCount,
    scanned: false,
    exercises: groups.map((group, index) => {
      const statement = group.lines.join("\n").trim();
      return {
        number: group.number ?? String(index + 1),
        title: deriveTitle(group.label, statement, `Exercice ${group.number ?? index + 1}`),
        statement,
        pages: [...group.pages].sort((a, b) => a - b),
        parts: countParts(statement),
        warnings: warningsFor(statement, group.stacked),
      };
    }),
  };
}
