"use client";

import { useEffect } from "react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { applySubjectColors } from "@/lib/subject-colors";
import { applyAccent, applyThemeMode } from "@/lib/theme";

/**
 * Applique l'accent, le mode d'apparence ET les couleurs de matière choisis
 * (Réglages) dès que les préférences sont chargées, et à chaque changement —
 * le script inline dans app/layout.tsx couvre déjà le tout premier rendu
 * (avant hydratation), ce composant prend le relais pour le reste de la
 * session (ex. changement depuis un autre onglet, ou juste après une
 * modification dans Réglages).
 */
export function ThemeSync() {
  const { preferences, ready } = usePrepahubData();

  useEffect(() => {
    if (!ready) return;
    applyAccent(preferences.accent);
    applyThemeMode(preferences.themeMode);
    applySubjectColors(preferences.subjectPalette, preferences.subjectColors);
  }, [ready, preferences.accent, preferences.themeMode, preferences.subjectPalette, preferences.subjectColors]);

  return null;
}
