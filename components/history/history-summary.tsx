"use client";

import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/subject-avatar";
import type { HistorySummary as HistorySummaryData } from "@/lib/history";
import { formatSpan } from "@/lib/utils";

/**
 * Purement présentationnel — l'agrégat de temps vient de `summarizeSessions`.
 * (Le taux de réussite qui s'affichait ici lisait le résultat des tentatives
 * sur les exercices de l'ancienne banque, retirée.)
 */
export function HistorySummary({ summary }: { summary: HistorySummaryData }) {
  const maxSeconds = Math.max(1, ...summary.bySubject.map((entry) => entry.seconds));

  return (
    <div className="space-y-8">
      {/* Empilées, pas en rangée : dans un rail de 18 rem, des indicateurs
          côte à côte redeviennent illisibles. */}
      <dl className="divide-y divide-line border-y border-line">
        <SummaryLine label="Temps total" value={formatSpan(summary.totalSeconds)} />
        <SummaryLine label="Séances" value={String(summary.sessionCount)} />
      </dl>

      {summary.bySubject.length > 0 && (
        <div>
          <p className="t-label mb-3">Par matière</p>
          {/*
            LA JAUGE PASSE SOUS LA LIGNE, SUR TOUTE LA LARGEUR.
            Quatre éléments se disputaient les 256 px utiles du rail — pastille,
            nom, jauge, durée. Résultat mesuré : « Mathématiques » s'affichait
            « Mathématiq… » sur un écran de 1440 px, et « 5 h 50 » se cassait
            en deux lignes. Pire, les jauges ne faisaient que 48 px : 6 h 55 et
            6 h 25 y donnaient deux traits indiscernables, donc la comparaison
            — leur unique raison d'être — n'avait pas lieu.

            Sur deux lignes, le nom a toute la place, la durée ne se coupe
            plus, et la jauge fait enfin la largeur du rail : l'écart entre
            deux matières redevient visible.
          */}
          <ul className="space-y-3">
            {summary.bySubject.map(({ subject, seconds }) => (
              <li key={subject}>
                <div className="flex items-baseline gap-2">
                  <SubjectAvatar subject={subject} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{subject}</span>
                  <span className="tabular shrink-0 whitespace-nowrap text-2xs text-muted">{formatSpan(seconds)}</span>
                </div>
                <Meter value={(seconds / maxSeconds) * 100} className="mt-1.5" tone="neutral" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Une mesure du rail — étiquette à gauche, valeur en serif à droite. */
function SummaryLine({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="t-label">{label}</dt>
        {detail && <dd className="t-meta mt-0.5 text-2xs">{detail}</dd>}
      </div>
      <dd className="t-figure-sm shrink-0">{value}</dd>
    </div>
  );
}
