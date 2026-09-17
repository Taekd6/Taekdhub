"use client";

import { useEffect } from "react";

/**
 * Enregistre `public/sw.js` — voir ce fichier pour ce qu'il fait et pourquoi.
 *
 * EN PRODUCTION UNIQUEMENT. En développement, un service worker sert des
 * fragments d'un build précédent pendant que Next en recompile un autre : on
 * passe la soirée à déboguer un cache au lieu du code.
 *
 * Aucun rendu, aucun état, aucune donnée : si l'enregistrement échoue —
 * navigateur sans support, mode privé, page servie en HTTP — l'application
 * fonctionne exactement comme avant, en ligne. C'est une amélioration, pas
 * une dépendance, et l'échec est donc silencieux.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Après `load` : l'enregistrement déclenche le précachage d'une dizaine
    // d'écrans, et le faire pendant l'hydratation volerait de la bande
    // passante au premier affichage.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Sans hors-ligne, mais entier. */
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
