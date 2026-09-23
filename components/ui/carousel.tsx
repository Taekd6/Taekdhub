"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * GALERIE HORIZONTALE — les rangées de tuiles d'apple.com (« Découvrez la
 * gamme ») : des cartes côte à côte qui défilent à l'horizontale, la
 * suivante DÉPASSE du bord pour dire qu'il y en a d'autres.
 *
 * API
 *
 *   children        une carte par enfant. Chaque enfant est enveloppé dans
 *                   une case d'accroche ; la carte n'a qu'à remplir sa case.
 *   ariaLabel       nom de la galerie (« Tes matières », « Outils »…).
 *   itemClassName   LARGEUR d'une case — défaut `w-[78%] sm:w-[20rem]` :
 *                   sur téléphone, une carte et le bord de la suivante.
 *   bleed           `true` (défaut) : la rangée déborde jusqu'aux BORDS DE
 *                   LA FENÊTRE, comme sur apple.com, tout en alignant sa
 *                   première carte sur la colonne de contenu (voir
 *                   `BLEED_PAD`). `false` : elle reste dans sa colonne.
 *
 * COMPORTEMENT
 *
 *   — Défilement natif avec accroche (`scroll-snap`) : le doigt, la
 *     molette et le pavé tactile marchent sans une ligne de JavaScript.
 *   — Palettes « précédent / suivant » : rondes, grises, translucides, en
 *     bas à droite ; MASQUÉES sur un écran tactile (`hover: none`) où le
 *     doigt suffit, et désactivées au bout de la rangée.
 *   — Points : un par carte, celui de la carte la plus visible est allongé.
 *     Ce sont des boutons (« Aller à la carte 3 sur 7 »).
 *   — Clavier : la rangée est focalisable ; ← / → passent d'une carte à
 *     l'autre, Début / Fin vont aux extrémités.
 *   — La carte « courante » est suivie par une IntersectionObserver dont la
 *     racine est la RANGÉE — jamais un écouteur de défilement sur la fenêtre.
 *   — Mouvement réduit : les déplacements deviennent instantanés.
 */
/*
 * Pleine largeur : la section sort de sa colonne (`50% - 50vw` de chaque
 * côté), puis la rangée remet en marge intérieure exactement l'écart entre
 * le bord de la fenêtre et le début du contenu — la moitié de ce qui reste
 * autour de `--shell-max`, plus la gouttière du cadre (16 px, 24 px dès
 * `sm`). La première carte tombe donc pile sous le titre de la page, et les
 * suivantes filent jusqu'au bord de l'écran. `body` coupe le débordement
 * horizontal (`overflow-x: clip`, app/globals.css) : `100vw` inclut la barre
 * de défilement verticale et, sans cela, ferait défiler la page de côté.
 */
const BLEED_WRAP = "mx-[calc(50%-50vw)]";
const BLEED_PAD =
  "px-[max(1rem,calc(50vw-var(--shell-max)/2+1rem))] scroll-px-[max(1rem,calc(50vw-var(--shell-max)/2+1rem))] sm:px-[max(1.5rem,calc(50vw-var(--shell-max)/2+1.5rem))] sm:scroll-px-[max(1.5rem,calc(50vw-var(--shell-max)/2+1.5rem))]";

export function Carousel({
  children,
  ariaLabel,
  itemClassName = "w-[78%] sm:w-[20rem]",
  bleed = true,
  className,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  itemClassName?: string;
  bleed?: boolean;
  className?: string;
}) {
  const slides = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: slides.length <= 1 });

  // Carte courante + bouts de rangée, observés par rapport à la rangée
  // elle-même. Une carte visible à plus de 60 % devient « courante » ; la
  // visibilité de la première et de la dernière dit si l'on est au bout.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
        const nodes = slideRefs.current;
        let best = 0;
        let bestRatio = -1;
        nodes.forEach((node, index) => {
          const ratio = node ? (ratios.get(node) ?? 0) : 0;
          if (ratio > bestRatio + 0.01) {
            best = index;
            bestRatio = ratio;
          }
        });
        setCurrent(best);
        const first = nodes[0] ? (ratios.get(nodes[0]) ?? 0) : 1;
        const last = nodes[nodes.length - 1] ? (ratios.get(nodes[nodes.length - 1] as Element) ?? 0) : 1;
        setEdges({ start: first > 0.95, end: last > 0.95 });
      },
      { root: track, threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.95, 1] }
    );
    for (const node of slideRefs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [slides.length]);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    const track = trackRef.current;
    const node = slideRefs.current[clamped];
    if (!track || !node) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Aligne le bord de la carte sur le début de la zone d'accroche (la
    // marge intérieure de la rangée).
    const padding = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || parseFloat(getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({ left: node.offsetLeft - padding, behavior: reduced ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: slides.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined || event.target !== event.currentTarget) return;
    event.preventDefault();
    goTo(next);
  }

  const paddle =
    "press grid h-9 w-9 place-items-center rounded-full bg-zinc-800/80 text-ink backdrop-blur-md transition-opacity hover:bg-zinc-700 disabled:pointer-events-none disabled:opacity-30 [@media(hover:none)]:hidden";

  return (
    <section aria-roledescription="carrousel" aria-label={ariaLabel} className={cn(bleed && BLEED_WRAP, className)}>
      <div
        ref={trackRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          "scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 sm:gap-5",
          bleed ? BLEED_PAD : "scroll-px-0"
        )}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
            role="group"
            aria-roledescription="carte"
            aria-label={`${index + 1} sur ${slides.length}`}
            className={cn("shrink-0 snap-start", itemClassName)}
          >
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className={cn("mt-5 flex items-center justify-between gap-4", bleed && "px-[max(1rem,calc(50vw-var(--shell-max)/2+1rem))] sm:px-[max(1.5rem,calc(50vw-var(--shell-max)/2+1.5rem))]")}>
          <div className="flex flex-1 items-center justify-center gap-2 sm:justify-start">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Aller à la carte ${index + 1} sur ${slides.length}`}
                aria-current={index === current ? "true" : undefined}
                className="grid h-6 place-items-center px-0.5"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
                    index === current ? "w-5 bg-ink" : "w-2 bg-hairline/[0.14] hover:bg-subtle"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className={paddle} onClick={() => goTo(current - 1)} disabled={edges.start} aria-label="Carte précédente">
              <ChevronLeft size={18} strokeWidth={2.4} />
            </button>
            <button type="button" className={paddle} onClick={() => goTo(current + 1)} disabled={edges.end} aria-label="Carte suivante">
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
