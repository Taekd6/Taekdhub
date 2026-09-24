"use client";

import { lastNDays } from "@/lib/gamification";
import { dayKey } from "@/lib/study";
import { formatSpan } from "@/lib/utils";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
/** Opacité de l'accent par palier — 0 est la case vide, grise. */
const STEPS = [0, 0.28, 0.5, 0.74, 1];

function cellColor(step: number): string {
  // Reprend les variables CSS du thème (app/globals.css) — jamais une
  // teinte figée : la case suit l'accent choisi par l'élève (lib/theme.ts),
  // et la case vide reste visible dans les deux thèmes grâce à
  // `--hairline-rgb`, qui s'inverse avec eux.
  return step === 0 ? "rgb(var(--hairline-rgb) / 0.08)" : `rgb(var(--accent-ink-rgb) / ${STEPS[step]})`;
}

/**
 * CALENDRIER D'ACTIVITÉ — douze semaines, une case par jour, une colonne
 * par semaine (extrait du Dashboard au Sprint 3B, repris pour la refonte
 * « Apple » : cases plus grandes, arrondies, jours de la semaine écrits à
 * gauche et légende « moins → plus » dessous).
 *
 * QUATRE paliers, pas un dégradé continu. Une opacité proportionnelle
 * produisait des dizaines de nuances indiscernables : on ne pouvait pas dire,
 * en regardant deux cases, laquelle représentait le plus de travail. Quatre
 * marches se comparent d'un coup d'œil, et la légende suffit à les
 * expliquer.
 *
 * Chaque case porte sa date et sa durée au survol (`title`) ; la figure
 * entière est résumée pour les lecteurs d'écran par l'appelant.
 */
export function Heatmap({ workByDay, days = 84 }: { workByDay: Record<string, number>; days?: number }) {
  const range = lastNDays(days);
  const maxDay = Math.max(...Object.values(workByDay), 1);
  const firstWeekday = range[0]?.getDay() ?? 1;

  return (
    <div className="inline-flex max-w-full flex-col">
      <div className="flex gap-2">
        {/* Les jours de la semaine, alignés sur les rangées réelles : la
            première rangée est le jour de la semaine du premier jour affiché. */}
        <div aria-hidden className="grid grid-rows-7 gap-1 sm:gap-[5px]">
          {Array.from({ length: 7 }).map((_, row) => (
            <span key={row} className="t-meta flex h-4 items-center text-[0.625rem] font-semibold leading-none sm:h-5 sm:text-2xs">
              {row % 2 === 0 ? DAY_LETTERS[(firstWeekday + row) % 7] : ""}
            </span>
          ))}
        </div>
        <div className="scrollbar-none grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto sm:gap-[5px]">
          {range.map((date) => {
            const key = dayKey(date);
            const seconds = workByDay[key] || 0;
            const step = seconds === 0 ? 0 : Math.min(4, Math.ceil((seconds / maxDay) * 4));
            return (
              <span
                key={key}
                title={`${date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : ${seconds ? formatSpan(seconds) : "rien"}`}
                className="h-4 w-4 rounded-[4px] transition-transform duration-200 hover:scale-125 sm:h-5 sm:w-5 sm:rounded-[5px]"
                style={{ backgroundColor: cellColor(step) }}
              />
            );
          })}
        </div>
      </div>
      <div aria-hidden className="t-meta mt-3 flex items-center justify-end gap-1.5 text-2xs">
        moins
        {STEPS.map((_, step) => (
          <span key={step} className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: cellColor(step) }} />
        ))}
        plus
      </div>
    </div>
  );
}
