"use client";

import { useEffect } from "react";

/**
 * Verrou de scroll partagé par tous les overlays plein écran (Focus, Timer
 * plein écran, ChapterDetail…) — Sprint Mobile UX + PWA Foundation.
 *
 * Compteur de références au lieu d'un simple booléen : si deux overlays sont
 * montés en même temps (ex. Focus + sa confirmation de sortie), le scroll ne
 * doit être restauré qu'au démontage du DERNIER, jamais avant — sinon fermer
 * le second réactiverait le scroll pendant que le premier est toujours
 * affiché.
 *
 * Utilise `position: fixed` sur `<body>` plutôt que `overflow: hidden` seul :
 * seule technique fiable contre le scroll élastique (rubber-band) d'iOS
 * Safari, qui ignore `overflow: hidden` sur `<body>`. La position de scroll
 * est mémorisée à la pose du premier verrou puis restaurée exactement à la
 * levée du dernier.
 */
let lockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const body = document.body.style;
    body.position = "fixed";
    body.top = `-${savedScrollY}px`;
    body.left = "0";
    body.right = "0";
    body.overflow = "hidden";
  }
  lockCount++;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body.style;
    body.position = "";
    body.top = "";
    body.left = "";
    body.right = "";
    body.overflow = "";
    window.scrollTo(0, savedScrollY);
  }
}

/**
 * Bloque le scroll de `<body>` tant que `active` est vrai. Sûr en cas de
 * montage/démontage React répété (StrictMode, navigation rapide) : chaque
 * appel qui verrouille est apparié à exactement un appel qui déverrouille,
 * via le cleanup de l'effet.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
