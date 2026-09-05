"use client";

import katex from "katex";
import { useMemo } from "react";
import { cn } from "@/lib/cn";

/**
 * Moteur de rendu mathématique UNIQUE du projet — KaTeX auto-hébergé (CSS +
 * polices bundlées via `katex/dist/katex.min.css`, importé une fois dans
 * app/layout.tsx, aucun CDN externe : fonctionne offline/PWA). Tout contenu
 * mathématique affiché dans l'app (énoncé, indices, correction…) doit passer
 * par ce composant plutôt que par un rendu texte brut ou un autre moteur.
 *
 * Format attendu (texte libre, jamais interprété comme du Markdown) :
 * - `$...$` : formule inline, insérée dans le flux du texte.
 * - `$$...$$` : formule affichée (bloc centré, `displayMode`).
 * - tout le reste : texte normal, retours à la ligne préservés
 *   (`whitespace-pre-line`, même convention que l'ancien rendu texte brut).
 *
 * Une formule invalide ne casse jamais l'affichage : KaTeX est appelé avec
 * `throwOnError: false` et, en dernier recours (erreur de parsing imprévue),
 * le composant retombe sur le texte source tel quel plutôt que de planter la
 * page — un énoncé mal formé doit rester lisible, pas faire disparaître
 * l'exercice.
 */

type Segment = { type: "text" | "inline" | "block"; value: string };

/** Formules `$$...$$` d'abord (elles peuvent contenir des `$` isolés côté LaTeX rarement, mais surtout pour ne jamais les couper en deux inline). */
function splitBlocks(input: string): Segment[] {
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
function splitInline(input: string): Segment[] {
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

function renderKatex(value: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(value, { throwOnError: false, displayMode, strict: "ignore" });
  } catch {
    return null;
  }
}

export function RichMath({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitBlocks(text), [text]);

  return (
    <div className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") return <span key={index}>{segment.value}</span>;

        const displayMode = segment.type === "block";
        const html = renderKatex(segment.value, displayMode);
        const fallback = displayMode ? `$$${segment.value}$$` : `$${segment.value}$`;

        if (displayMode) {
          return (
            <div key={index} className="my-2 overflow-x-auto">
              {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : fallback}
            </div>
          );
        }
        return html ? <span key={index} dangerouslySetInnerHTML={{ __html: html }} /> : <span key={index}>{fallback}</span>;
      })}
    </div>
  );
}

/**
 * Rendu mathématique INLINE, pour un titre d'exercice.
 *
 * 13 exercices de la banque portent du LaTeX dans leur `title` (par exemple
 * « Translation des polynômes et base de $\\mathbb{R}_n[X]$ »), et ce titre
 * s'affiche partout : aperçu de séance, en-tête du mode focus, écran de
 * résultat, banque d'exercices, historique. Rendu en texte brut, l'élève y
 * lisait les dollars et les antislashs bruts — sur l'écran même où il
 * travaille. `RichMath` ne convenait pas ici : il produit un `<div>` en
 * `whitespace-pre-line`, qui casse à la fois le `truncate` des listes et la
 * mise en ligne d'un titre.
 *
 * Ce composant rend donc un `<span>` : il s'insère dans un `<h1>`, dans un
 * conteneur `truncate`, ou au milieu d'une phrase, sans rien changer à la
 * mise en page. Seul l'inline `$...$` est interprété — un titre n'a jamais
 * de formule en bloc. Même garantie que `RichMath` : une formule invalide
 * retombe sur son texte source, jamais sur une page cassée.
 */
export function MathInline({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitInline(text), [text]);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") return <span key={index}>{segment.value}</span>;
        const html = renderKatex(segment.value, false);
        return html ? <span key={index} dangerouslySetInnerHTML={{ __html: html }} /> : <span key={index}>{`$${segment.value}$`}</span>;
      })}
    </span>
  );
}
