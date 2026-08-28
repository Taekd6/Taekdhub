"use client";

import { MotionConfig } from "framer-motion";

/**
 * Point d'entrée UNIQUE du réglage `prefers-reduced-motion` (refonte
 * "vivant") : `reducedMotion="user"` fait respecter automatiquement la
 * préférence système à TOUTE animation framer-motion de l'app (transform et
 * layout animations désactivées, les changements d'état restent instantanés)
 * sans avoir à vérifier `useReducedMotion()` composant par composant à
 * chaque nouvelle animation ajoutée.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
