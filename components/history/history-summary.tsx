"use client";

import { Clock3, ListChecks } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressBar } from "@/components/ui/progress";
import type { HistorySummary as HistorySummaryData } from "@/lib/history";
import { subjectMeta } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/** Purement présentationnel — l'agrégat vient de lib/history.ts#summarizeSessions. */
export function HistorySummary({ summary }: { summary: HistorySummaryData }) {
  const maxSeconds = Math.max(1, ...summary.bySubject.map((entry) => entry.seconds));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Temps total" value={formatDuration(summary.totalSeconds)} detail="Sur la période filtrée" icon={Clock3} />
        <MetricCard label="Séances" value={String(summary.sessionCount)} detail="Sur la période filtrée" icon={ListChecks} delay={0.05} />
      </div>

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
