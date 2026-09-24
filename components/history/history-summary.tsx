"use client";

import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/subject-avatar";
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

  return (
    <div className="surface p-6">
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="t-label">Temps total</dt>
          <dd className="t-figure-sm mt-1.5 whitespace-nowrap">{formatSpan(summary.totalSeconds)}</dd>
        </div>
        <div>
          <dt className="t-label">Séances</dt>
          <dd className="t-figure-sm mt-1.5">{summary.sessionCount}</dd>
        </div>
      </dl>

      {sorted.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="t-label mb-3">Par matière</p>
          <ul className="space-y-3.5">
            {sorted.map(({ subject, seconds }, index) => (
              <li key={subject}>
                <div className="flex items-center gap-2.5">
                  <SubjectAvatar subject={subject} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{subject}</span>
                  <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] text-muted">{formatSpan(seconds)}</span>
                </div>
                <Meter value={(seconds / maxSeconds) * 100} className="mt-2" tone={index === 0 ? "accent" : "neutral"} index={index} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
