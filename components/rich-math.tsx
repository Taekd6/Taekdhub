"use client";

import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
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
 *
 * Formule plus large que son conteneur (matrice, longue expression — fréquent
 * sur mobile) : jamais coupée/perdue. `.katex-display` (bloc `$$…$$`) comme
 * `.katex` (inline `$…$`) restent chacun défilables horizontalement dans
 * leurs propres limites (`max-w-full overflow-x-auto`) sans jamais élargir la
 * page ni dépendre d'un ancêtre — de nombreuses cartes de l'app posent
 * `overflow-hidden` pour leurs coins arrondis, ce qui aurait sinon
 * silencieusement rogné tout dépassement, sans indice ni scroll possible. Un
 * bloc défilable affiche en plus un repère textuel discret UNIQUEMENT quand
 * il dépasse réellement (mesuré via `ResizeObserver`, jamais deviné à partir
 * du texte source) — l'inline n'en a pas besoin : il reste au fil du texte,
 * un swipe suffit à le découvrir comme le reste de la page.
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

/** Bloc `$$…$$` : défilable horizontalement, avec un repère "défiler" affiché
 * seulement si la formule dépasse réellement son conteneur — recalculé à
 * chaque changement de largeur (rotation d'écran, sidebar qui s'ouvre…). */
function DisplayFormula({ html, fallback }: { html: string | null; fallback: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [html]);

  return (
    <div className="my-2">
      <div ref={scrollRef} className="max-w-full overflow-x-auto">
        {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : fallback}
      </div>
      {overflowing && <p className="mt-1 text-2xs text-zinc-600">⟷ défile pour voir la suite</p>}
    </div>
  );
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
          return <DisplayFormula key={index} html={html} fallback={fallback} />;
        }
        return (
          <span key={index} className="inline-block max-w-full overflow-x-auto align-baseline">
            {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : fallback}
          </span>
        );
      })}
    </div>
  );
}
