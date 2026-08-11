"use client";

import { lastNDays } from "@/lib/gamification";
import { dayKey } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/**
 * Heatmap d'activité (extraite du Dashboard au Sprint 3B pour être partagée
 * avec la page Progression, sans dupliquer le rendu).
 */
export function Heatmap({ workByDay, days = 84 }: { workByDay: Record<string, number>; days?: number }) {
  const range = lastNDays(days);
  const maxDay = Math.max(...Object.values(workByDay), 1);

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {range.map((date) => {
        const key = dayKey(date);
        const seconds = workByDay[key] || 0;
        const ratio = seconds / maxDay;
        return (
          <span
            key={key}
            title={`${date.toLocaleDateString("fr-FR")} : ${formatDuration(seconds)}`}
            className="h-3.5 w-3.5 rounded-[4px] transition-colors"
            style={{
              // `rgb(var(--x-rgb) / alpha)` reprend les variables CSS du thème (app/globals.css) — jamais une teinte
              // figée : la case suit l'accent choisi par l'utilisateur (lib/theme.ts), et la case "vide" reste
              // visible aussi bien en thème clair (hairline sombre) qu'en thème sombre (hairline clair).
              backgroundColor: ratio ? `rgb(var(--accent-rgb) / ${0.17 + ratio * 0.83})` : "rgb(var(--hairline-rgb) / 0.08)",
            }}
          />
        );
      })}
    </div>
  );
}
