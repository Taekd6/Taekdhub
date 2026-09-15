"use client";

import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import type { HistorySummary as HistorySummaryData, ResultCounts } from "@/lib/history";
import { formatSpan } from "@/lib/utils";

/**
 * Purement présentationnel — l'agrégat de temps vient de
 * `summarizeSessions`, les résultats de `resultCounts` : « qu'est-ce que j'ai
 * réellement fait », pas seulement « combien de temps ».
 */
export function HistorySummary({ summary, results }: { summary: HistorySummaryData; results: ResultCounts }) {
  const maxSeconds = Math.max(1, ...summary.bySubject.map((entry) => entry.seconds));

  return (
    <div className="space-y-8">
      {/* Empilées, pas en rangée : dans un rail de 18 rem, trois indicateurs
          côte à côte redeviennent illisibles. */}
      <dl className="divide-y divide-line border-y border-line">
        <SummaryLine label="Temps total" value={formatSpan(summary.totalSeconds)} />
        <SummaryLine label="Séances" value={String(summary.sessionCount)} />
        <SummaryLine
          label="Réussite"
          value={results.successRate === null ? "—" : `${results.successRate} %`}
          detail={`${results.attempted} tentative${results.attempted > 1 ? "s" : ""} notée${results.attempted > 1 ? "s" : ""}`}
        />
      </dl>

      {results.attempted > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {results.success > 0 && (
            <Badge variant="success">
              {results.success} réussi{results.success > 1 ? "s" : ""}
            </Badge>
          )}
          {results.partial > 0 && (
            <Badge variant="warning">
              {results.partial} partiel{results.partial > 1 ? "s" : ""}
            </Badge>
          )}
          {results.failure > 0 && (
            <Badge variant="danger">
              {results.failure} échoué{results.failure > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

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
