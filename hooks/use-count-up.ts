"use client";

import { useEffect, useRef, useState } from "react";

/** Décélération « expo » — la même que `--ease-out` (app/globals.css) : le compteur file au début et se pose très doucement sur sa valeur. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
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
 * `start` (vrai par défaut) permet de RETENIR le compteur à zéro jusqu'à ce
 * que le chiffre entre dans l'écran — c'est ce que fait `CountUp`
 * (components/ui/count-up.tsx) avec `useReveal`. Un chiffre qui a fini de
 * monter avant qu'on le voie n'a servi à rien.
 *
 * `requestAnimationFrame` et non un intervalle : l'animation suit le
 * rafraîchissement de l'écran et s'arrête d'elle-même quand l'onglet est
 * masqué. Sous `prefers-reduced-motion`, la valeur finale est rendue
 * directement — `start` compris.
 *
 * Retourne un ENTIER : c'est un compteur de minutes, de jours, de
 * pourcentages — une décimale qui défile ne se lit pas.
 */
export function useCountUp(value: number, duration = 1200, start = true): number {
  const target = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (!start && !prefersReducedMotion()) return;
    const from = current.current;
    if (from === target || duration <= 0 || prefersReducedMotion()) {
      current.current = target;
      setDisplay(target);
      return;
    }
    let frame = 0;
    const begin = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begin) / duration);
      const next = Math.round(from + (target - from) * easeOutExpo(progress));
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);

  return display;
}
