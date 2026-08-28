"use client";

import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { ProgressBar } from "@/components/ui/progress";
import type { HistorySummary as HistorySummaryData, ResultCounts } from "@/lib/history";
import { subjectMeta } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/**
 * Purement présentationnel — l'agrégat de temps vient de
 * lib/history.ts#summarizeSessions, les résultats de
 * lib/history.ts#resultCounts (Sprint Plan de travail : "qu'est-ce que j'ai
 * réellement fait", pas seulement "combien de temps").
 */
export function HistorySummary({ summary, results }: { summary: HistorySummaryData; results: ResultCounts }) {
  const maxSeconds = Math.max(1, ...summary.bySubject.map((entry) => entry.seconds));

  return (
    <div className="space-y-4">
      {/* Trois chiffres sur la période filtrée : une ligne suffit. En cartes,
          ils pesaient autant que le journal lui-même, qui est le contenu. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-1">
        <Figure label="Temps total" value={formatDuration(summary.totalSeconds)} />
        <Figure label="Séances" value={String(summary.sessionCount)} />
        <Figure
          label="Réussite"
          value={results.successRate === null ? "—" : `${results.successRate} %`}
          detail={`${results.attempted} tentative${results.attempted > 1 ? "s" : ""} notée${results.attempted > 1 ? "s" : ""}`}
        />
      </div>

      {results.attempted > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {results.success > 0 && <Badge variant="success">{results.success} réussi{results.success > 1 ? "s" : ""}</Badge>}
          {results.partial > 0 && <Badge variant="warning">{results.partial} partiel{results.partial > 1 ? "s" : ""}</Badge>}
          {results.failure > 0 && <Badge variant="danger">{results.failure} échoué{results.failure > 1 ? "s" : ""}</Badge>}
        </div>
      )}

      {summary.bySubject.length > 0 && (
        <Section rank="secondary" eyebrow="Répartition" title="Par matière">
          <div className="mt-4 space-y-3">
            {summary.bySubject.map(({ subject, seconds }) => (
              <div key={subject}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                      {subjectMeta[subject].short}
                    </span>
                    {subject}
                  </span>
                  <span className="text-muted">{formatDuration(seconds)}</span>
                </div>
                <ProgressBar value={(seconds / maxSeconds) * 100} animated={false} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/** Chiffre de synthèse — même forme que le bandeau de /progress, un seul vocabulaire pour « un nombre sur une période ». */
function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums text-ink">{value}</p>
      {detail && <p className="t-meta mt-0.5">{detail}</p>}
    </div>
  );
}
