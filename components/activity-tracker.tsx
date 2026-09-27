"use client";

import { useEffect } from "react";
import { LAST_ACTIVITY_KEY } from "@/lib/briefing";
import { readFlag, writeFlag } from "@/lib/storage";

/** Écart minimal entre deux écritures : une trace à la minute suffit pour mesurer des heures d'absence. */
const MIN_INTERVAL_MS = 60_000;

/**
 * DERNIER SIGNE D'ACTIVITÉ — ce qui permet à « Le point » de ne revenir
 * qu'après une vraie absence (lib/briefing.ts#shouldShowBriefing).
 *
 * Écrit toutes les minutes tant que la page est visible, et au moment où
 * elle cesse de l'être. JAMAIS au montage : l'aiguillage vers le point lit
 * la valeur au même moment, et doit y trouver l'heure de la visite
 * PRÉCÉDENTE, pas celle-ci.
 */
export function ActivityTracker() {
  useEffect(() => {
    let last = Date.parse(readFlag(LAST_ACTIVITY_KEY) ?? "") || 0;
    const record = (force = false) => {
      const now = Date.now();
      if (!force && now - last < MIN_INTERVAL_MS) return;
      last = now;
      writeFlag(LAST_ACTIVITY_KEY, new Date(now).toISOString());
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") record(true);
    };
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") record();
    }, MIN_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    const onPageHide = () => record(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
  return null;
}
