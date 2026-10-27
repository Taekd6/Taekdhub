"use client";

import { useEffect } from "react";

/**
 * PROJECTEUR (mission 25, idée « MagicCard » de Magic UI, MIT) — un seul
 * écouteur pour toute l'application : quand la souris passe sur un élément
 * `.spot`, on y pose --mx/--my (position du pointeur dans l'élément), et le
 * halo de app/globals.css le suit. Souris uniquement : rien au toucher.
 */
export function Spotlight() {
  useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest?.(".spot") as HTMLElement | null;
      if (!target) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${event.clientX - box.left}px`);
        target.style.setProperty("--my", `${event.clientY - box.top}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}
