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
    <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1 scrollbar-none">
      {range.map((date) => {
        const key = dayKey(date);
        const seconds = workByDay[key] || 0;
        // QUATRE paliers, pas un dégradé continu. Une opacité proportionnelle
        // produisait des dizaines de nuances indiscernables : on ne pouvait
        // pas dire, en regardant deux cases, laquelle représentait le plus de
        // travail. Quatre marches se comparent d'un coup d'œil, et la
        // légende ci-dessous suffit à les expliquer.
        const step = seconds === 0 ? 0 : Math.min(4, Math.ceil((seconds / maxDay) * 4));
        return (
          <span
            key={key}
            title={`${date.toLocaleDateString("fr-FR")} : ${formatDuration(seconds)}`}
            className="h-3 w-3 rounded-[3px]"
            style={{
              // Reprend les variables CSS du thème (app/globals.css) — jamais
              // une teinte figée : la case suit l'accent choisi par l'élève
              // (lib/theme.ts), et la case vide reste visible dans les deux
              // thèmes grâce à `--hairline-rgb`, qui s'inverse avec eux.
              backgroundColor:
                step === 0
                  ? "rgb(var(--hairline-rgb) / 0.07)"
                  : `rgb(var(--accent-ink-rgb) / ${[0, 0.3, 0.5, 0.72, 1][step]})`,
            }}
          />
        );
      })}
    </div>
  );
}
