"use client";

import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import type { HistorySummary as HistorySummaryData, ResultCounts } from "@/lib/history";
import { formatDuration } from "@/lib/utils";

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
        <SummaryLine label="Temps total" value={formatDuration(summary.totalSeconds)} />
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
          <ul className="space-y-2.5">
            {summary.bySubject.map(({ subject, seconds }) => (
              <li key={subject} className="flex items-center gap-3">
                <SubjectAvatar subject={subject} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{subject}</span>
                <Meter value={(seconds / maxSeconds) * 100} className="w-14 shrink-0" tone="neutral" />
                <span className="tabular w-12 shrink-0 text-right text-2xs text-muted">{formatDuration(seconds)}</span>
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
