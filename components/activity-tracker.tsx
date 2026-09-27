"use client";

import { useEffect } from "react";
import { LAST_ACTIVITY_KEY } from "@/lib/briefing";
import { readFlag, writeFlag } from "@/lib/storage";

/** Écart minimal entre deux écritures : une trace à la minute suffit pour mesurer des heures d'absence. */
const MIN_INTERVAL_MS = 60_000;

/** Ce qui compte comme « l'élève est là » : un geste réel, pas un onglet resté ouvert. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * DERNIER SIGNE D'ACTIVITÉ — ce qui permet à « Le point » de ne revenir
 * qu'après une vraie absence (lib/briefing.ts#shouldShowBriefing).
 *
 * Écrit à chaque GESTE (au plus une fois par minute) : un onglet laissé
 * visible sur un ordinateur pendant que l'élève est parti ne compte pas.
 * JAMAIS au montage : l'aiguillage vers le point lit la valeur au même
 * moment, et doit y trouver l'heure de la visite PRÉCÉDENTE.
 */
export function ActivityTracker() {
  useEffect(() => {
    let last = Date.parse(readFlag(LAST_ACTIVITY_KEY) ?? "") || 0;
    const record = () => {
      const now = Date.now();
      if (now - last < MIN_INTERVAL_MS) return;
      last = now;
      writeFlag(LAST_ACTIVITY_KEY, new Date(now).toISOString());
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, record, { passive: true });
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, record);
    };
  }, []);
  return null;
}
