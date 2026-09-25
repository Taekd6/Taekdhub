"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * ENTRÉES AU DÉFILEMENT — le geste d'apple.com : un bloc monte de 24 px en
 * fondu au moment où il ENTRE dans l'écran, pas au chargement de la page.
 *
 * TROIS PIÈCES, UNE SEULE MÉCANIQUE.
 *
 *   `RevealObserver`  monté UNE fois, dans app/layout.tsx. Une seule
 *                     IntersectionObserver pour toute la page : elle
 *                     surveille chaque élément animé (`.reveal`, `.grow-x`,
 *                     `.grow-y`, `.ring-draw`, `.ring-grow`, `.line-draw`,
 *                     `.area-fade`, `.pop` — voir
 *                     app/globals.css) et lui pose `data-revealed` quand il
 *                     devient visible. Les éléments ajoutés plus tard (liste
 *                     chargée, onglet ouvert) sont rattrapés par une
 *                     MutationObserver. JAMAIS d'écouteur `scroll` sur la
 *                     fenêtre : l'observateur est asynchrone, hors du fil
 *                     principal, et ne coûte rien pendant le défilement.
 *
 *   `Reveal`          un conteneur qui porte `.reveal` et son rang de
 *                     cascade (`--i`) — pour un bloc qui n'est pas une
 *                     `Section`.
 *
 *   `useReveal`       le crochet pour un composant qui doit SAVOIR qu'il est
 *                     visible (un compteur qui ne doit démarrer qu'à ce
 *                     moment-là — voir `CountUp`).
 *
 * Pourquoi un attribut `data-revealed` et non une classe : React réécrit
 * `className` à chaque rendu où elle change, et effacerait une classe posée
 * de l'extérieur. Il ne touche jamais un attribut qu'il n'a pas rendu.
 *
 * TANT QUE RIEN N'EST ARMÉ, RIEN N'EST CACHÉ. Les animations ne sont figées
 * que sous `html[data-reveal="armed"]`, posé par le script anti-flash
 * (app/layout.tsx) — jamais sous `prefers-reduced-motion`, jamais sans
 * IntersectionObserver. Et si cet observateur ne se signale pas dans les
 * 4 s (`window.__revealLive`), le script désarme tout.
 */

const ANIMATED = ".reveal, .grow-x, .grow-y, .ring-draw, .ring-grow, .line-draw, .area-fade, .pop";

declare global {
  interface Window {
    __revealLive?: boolean;
  }
}

export function RevealObserver() {
  useEffect(() => {
    window.__revealLive = true;
    const root = document.documentElement;
    if (root.getAttribute("data-reveal") !== "armed" || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      // Déclenche un peu AVANT que le bloc n'atteigne le bas de l'écran
      // visible — sinon on le voit arriver vide, puis se remplir.
      { rootMargin: "0px 0px -6% 0px", threshold: 0 }
    );

    const scan = () => {
      for (const element of document.querySelectorAll(ANIMATED)) {
        if (element.hasAttribute("data-revealed") || element.hasAttribute("data-reveal-watched")) continue;
        element.setAttribute("data-reveal-watched", "");
        observer.observe(element);
      }
    };

    // Les mutations arrivent en rafales (une liste qui se remplit) : un seul
    // balayage par image suffit.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    });

    scan();
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

/**
 * Conteneur qui entre au défilement. `index` = rang dans une rangée de blocs
 * voisins (70 ms de décalage par rang, plafonné à 6).
 */
export function Reveal({
  as: Tag = "div",
  index = 0,
  className,
  style,
  children,
  ...props
}: {
  as?: ElementType;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "style" | "children">) {
  return (
    <Tag className={cn("reveal", className)} style={{ "--i": index, ...style } as CSSProperties} {...props}>
      {children}
    </Tag>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * `true` dès que l'élément a été vu une fois (il ne redevient jamais
 * `false`). Vrai d'emblée sous `prefers-reduced-motion` ou sans
 * IntersectionObserver : on ne fait pas attendre une valeur pour rien.
 */
export function useReveal<T extends Element>(rootMargin = "0px 0px -6% 0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || revealed) return;
    if (typeof IntersectionObserver === "undefined" || reducedMotion()) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [revealed, rootMargin]);

  return [ref, revealed];
}
