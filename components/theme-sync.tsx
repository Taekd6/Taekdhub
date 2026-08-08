"use client";

import { useEffect } from "react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { applyAccent } from "@/lib/theme";

/**
 * Applique l'accent choisi (Réglages) dès que les préférences sont chargées,
 * et à chaque changement — le script inline dans app/layout.tsx couvre déjà
 * le tout premier rendu (avant hydratation), ce composant prend le relais
 * pour le reste de la session (ex. changement d'accent depuis un autre onglet,
 * ou juste après l'avoir modifié dans Réglages).
 */
export function ThemeSync() {
  const { preferences, ready } = usePrepahubData();

  useEffect(() => {
    if (!ready) return;
    applyAccent(preferences.accent);
  }, [ready, preferences.accent]);

  return null;
}
