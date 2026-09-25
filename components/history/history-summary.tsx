"use client";

import type { CSSProperties } from "react";
import { CountUp } from "@/components/ui/count-up";
import { GradientCard } from "@/components/ui/gradient-card";
import type { HistorySummary as HistorySummaryData } from "@/lib/history";
import { formatSpan } from "@/lib/utils";

/**
 * Purement présentationnel — l'agrégat de temps vient de `summarizeSessions`.
 * (Le taux de réussite qui s'affichait ici lisait le résultat des tentatives
 * sur les exercices de l'ancienne banque, retirée.)
 *
 * Une tuile collante à droite du journal sur grand écran, sous les filtres
 * sur téléphone : le total et le nombre de séances en grand, puis la part de
 * chaque matière. La jauge passe SOUS le nom, sur toute la largeur — à côté,
 * elle ne faisait que 48 px et deux durées proches y devenaient deux traits
 * indiscernables. La matière en tête est à l'accent, les autres en gris.
 */
export function HistorySummary({ summary }: { summary: HistorySummaryData }) {
  const maxSeconds = Math.max(1, ...summary.bySubject.map((entry) => entry.seconds));
  const sorted = [...summary.bySubject].sort((a, b) => b.seconds - a.seconds);

  // LA SYNTHÈSE EN CARTE À DÉGRADÉ (refonte « Revolut clair ») : le temps
  // de la période en très grand, qui compte jusqu'à sa valeur, le nombre de
  // séances, puis la part de chaque matière en barres BLANCHES sur le
  // dégradé.
  return (
    <GradientCard tone="brand" tilt={false} className="reveal p-5 sm:p-6">
      <dl className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <dt className="text-[0.8125rem] font-bold opacity-80">Temps total</dt>
          <dd className="t-card-figure mt-1 whitespace-nowrap">
            <CountUp value={Math.round(summary.totalSeconds / 60)} duration={1300} format={(minutes) => formatSpan(minutes * 60)} />
          </dd>
        </div>
        <div className="shrink-0 text-right">
          <dt className="text-[0.8125rem] font-bold opacity-80">Séances</dt>
          <dd className="t-stat mt-1">
            <CountUp value={summary.sessionCount} />
          </dd>
        </div>
      </dl>

      {sorted.length > 0 && (
        <ul className="mt-5 space-y-3 border-t border-white/20 pt-4">
          {sorted.map(({ subject, seconds }, index) => (
            <li key={subject}>
              <div className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{subject}</span>
                <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] font-bold opacity-85">{formatSpan(seconds)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round((seconds / maxSeconds) * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="grow-x h-full rounded-full bg-white"
                  style={{ width: `${Math.max(3, (seconds / maxSeconds) * 100)}%`, "--i": index } as CSSProperties}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GradientCard>
  );
}
