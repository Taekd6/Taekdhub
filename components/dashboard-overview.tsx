"use client";

import { PlanningHome } from "@/components/planning/planning-home";

/**
 * ÉCRAN D'ACCUEIL = LE PLANNING (octobre 2026, à la demande de l'élève : « uniquement le planning, où je coche ce
 * que j'ai fait »). L'ancien accueil (Next Move, progression du jour, check-in, échéances en carte, agenda) est
 * retiré de l'écran ; ses composants (`components/home/`, `components/next-move/`…) et leurs pages sont conservés,
 * seulement plus affichés ni liés dans le menu — voir docs/CARNET.md, mission 21.
 */
export function DashboardOverview() {
  return <PlanningHome />;
}
