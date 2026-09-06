/**
 * DÉCOUPAGE D'UN TEXTE EN SEGMENTS TEXTE / FORMULE.
 *
 * Logique pure, isolée du composant (`components/rich-math.tsx`) parce qu'elle
 * porte une décision dont dépend la stabilité du navigateur : la présence d'un
 * segment `block` (`$$…$$`) est ce qui fait neutraliser `text-wrap: pretty`
 * dans le bloc de lecture. Sans cette neutralisation, Chromium plante — voir
 * lib/reader-regression.test.ts.
 *
 * Format attendu (texte libre, jamais interprété comme du Markdown) :
 * - `$...$`   : formule en ligne, insérée dans le flux du texte ;
 * - `$$...$$` : formule affichée (bloc centré) ;
 * - le reste  : texte normal.
 */

export type Segment = { type: "text" | "inline" | "block"; value: string };

/** Formules `$$...$$` d'abord (elles peuvent contenir des `$` isolés côté LaTeX rarement, mais surtout pour ne jamais les couper en deux inline). */
export function splitBlocks(input: string): Segment[] {
  const segments: Segment[] = [];
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(input)) !== null) {
    if (match.index > lastIndex) segments.push(...splitInline(input.slice(lastIndex, match.index)));
    segments.push({ type: "block", value: match[1].trim() });
    lastIndex = blockRegex.lastIndex;
  }
  if (lastIndex < input.length) segments.push(...splitInline(input.slice(lastIndex)));
  return segments;
}

/** Une fois les blocs `$$…$$` retirés, les `$` restants ne délimitent que de l'inline — volontairement limité à une seule ligne pour ne jamais avaler tout un paragraphe si un `$` isolé traîne dans le texte. */
export function splitInline(input: string): Segment[] {
  const segments: Segment[] = [];
  const inlineRegex = /\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(input)) !== null) {
    if (match.index > lastIndex) segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
    segments.push({ type: "inline", value: match[1] });
    lastIndex = inlineRegex.lastIndex;
  }
  if (lastIndex < input.length) segments.push({ type: "text", value: input.slice(lastIndex) });
  return segments;
}
