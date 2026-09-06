"use client";

import katex from "katex";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { splitBlocks, splitInline } from "@/lib/math-segments";

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

function renderKatex(value: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(value, { throwOnError: false, displayMode, strict: "ignore" });
  } catch {
    return null;
  }
}

export function RichMath({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitBlocks(text), [text]);
  /*
   * PLANTAGE DU MOTEUR DE RENDU — `text-wrap: pretty` + formule centrée.
   *
   * Mesuré au navigateur : tout exercice dont l'énoncé contient un
   * `$$…$$` faisait PLANTER l'onglet Chromium à l'ouverture du lecteur
   * (onglet mort, page blanche, aucune erreur JS). 92 exercices de la
   * banque étaient concernés — donc inouvrables.
   *
   * La cause n'est ni KaTeX ni la formule : c'est l'algorithme
   * `text-wrap: pretty` du bloc de lecture (`.t-read`, `.t-read-quiet`)
   * quand il doit composer une ligne autour du bloc `.katex-display`.
   * Vérifié par élimination : neutraliser cette seule propriété suffit à
   * faire disparaître le plantage ; la neutraliser SUR le KaTeX ne suffit
   * pas (c'est le bloc parent qui casse) ; les formules `$…$` en ligne ne
   * posent aucun problème.
   *
   * On désactive donc `pretty` exactement là où il casse, et nulle part
   * ailleurs : les énoncés sans formule centrée gardent leur composition.
   * `RichMath` est le seul endroit du projet qui produit un bloc `$$…$$`,
   * c'est donc ici, et pas dans la feuille de style, que l'information
   * existe.
   */
  const hasDisplayMath = useMemo(() => segments.some((segment) => segment.type === "block"), [segments]);

  return (
    <div className={cn("whitespace-pre-line", className)} data-display-math={hasDisplayMath ? "" : undefined}>
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
