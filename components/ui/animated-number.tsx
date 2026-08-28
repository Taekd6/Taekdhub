"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Un chiffre qui se déplace vers sa nouvelle valeur au lieu de la remplacer
 * d'un coup — pour qu'un changement (session validée, retour sur la page
 * après une séance) se VOIE, pas seulement se lise après coup. N'anime pas
 * le premier montage par défaut (sinon un XP déjà acquis depuis longtemps
 * semblerait « gagné » à chaque chargement de page) : seul un changement de
 * `value` alors que le composant est déjà affiché déclenche le mouvement —
 * sauf `animateOnMount`, pour l'exception inverse (voir plus bas). Respecte
 * `prefers-reduced-motion` en sautant directement à la valeur.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  animateOnMount = false,
}: {
  value: number;
  format?: (n: number) => string;
  /** `true` pour un compteur qui doit se révéler en comptant depuis 0 dès son premier affichage (ex. « +XP » qui n'apparaît qu'une fois, au moment gagné) — jamais le comportement par défaut, qui ferait « gagner » à nouveau une valeur déjà acquise à chaque chargement de page. */
  animateOnMount?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(animateOnMount ? 0 : value);
  const [display, setDisplay] = useState(() => format(animateOnMount ? 0 : value));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (!animateOnMount) {
        motionValue.set(value);
        setDisplay(format(value));
        return;
      }
    }
    if (reduceMotion) {
      motionValue.set(value);
      setDisplay(format(value));
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(format(latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}
