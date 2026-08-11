"use client";

import { Clock3, ListChecks, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
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
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Temps total" value={formatDuration(summary.totalSeconds)} detail="Sur la période filtrée" icon={Clock3} />
        <MetricCard label="Séances" value={String(summary.sessionCount)} detail="Sur la période filtrée" icon={ListChecks} delay={0.05} />
        <MetricCard label="Réussite" value={results.successRate === null ? "—" : `${results.successRate}%`} detail={`${results.attempted} tentative${results.attempted > 1 ? "s" : ""} notée${results.attempted > 1 ? "s" : ""}`} icon={Trophy} delay={0.1} />
      </div>

      {results.attempted > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {results.success > 0 && <Badge variant="success">{results.success} réussi{results.success > 1 ? "s" : ""}</Badge>}
          {results.partial > 0 && <Badge variant="warning">{results.partial} partiel{results.partial > 1 ? "s" : ""}</Badge>}
          {results.failure > 0 && <Badge variant="danger">{results.failure} échoué{results.failure > 1 ? "s" : ""}</Badge>}
        </div>
      )}

      {summary.bySubject.length > 0 && (
        <Card className="p-5">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2 text-base">Par matière</CardTitle>
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
                  <span className="text-zinc-500">{formatDuration(seconds)}</span>
                </div>
                <ProgressBar value={(seconds / maxSeconds) * 100} animated={false} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
