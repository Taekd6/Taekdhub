"use client";

import { useEffect, useState } from "react";

/**
 * `false` au premier rendu (serveur ET client) — jamais de divergence
 * d'hydratation — puis se met à jour après montage via `matchMedia`.
 * Un écran qui bascule en « bureau » ne le sait donc qu'un battement après
 * l'affichage initial : acceptable pour une décision de mise en page
 * (liste + détail plutôt qu'accordéon), jamais pour un contenu qui
 * clignoterait de façon gênante.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
