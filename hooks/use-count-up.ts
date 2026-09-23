"use client";

import { useEffect, useRef, useState } from "react";

/** Décélération cubique : le compteur file au début et se pose doucement sur sa valeur. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * COMPTEUR ANIMÉ — un nombre qui monte jusqu'à sa valeur, une fois.
 *
 * Joué au montage (depuis 0) puis à chaque CHANGEMENT de `value` (depuis la
 * valeur affichée à cet instant) : noter 30 min fait monter le total sous les
 * yeux, sans jamais repartir de zéro. Jamais en boucle.
 *
 * `requestAnimationFrame` et non un intervalle : l'animation suit le
 * rafraîchissement de l'écran et s'arrête d'elle-même quand l'onglet est
 * masqué. Sous `prefers-reduced-motion`, la valeur finale est rendue
 * directement.
 *
 * Retourne un ENTIER : c'est un compteur de minutes, de jours, de
 * pourcentages — une décimale qui défile ne se lit pas.
 */
export function useCountUp(value: number, duration = 900): number {
  const target = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const from = current.current;
    if (from === target || duration <= 0 || prefersReducedMotion()) {
      current.current = target;
      setDisplay(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (target - from) * easeOutCubic(progress));
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}
