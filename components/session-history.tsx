"use client";

import { Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistorySummary } from "@/components/history/history-summary";
import { SessionRow } from "@/components/history/session-row";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { defaultHistoryFilters, filterSessions, summarizeSessions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";

/**
 * Page Historique (Sprint 3F) — orchestration uniquement : filtrage et
 * agrégation viennent de lib/history.ts, l'affichage des filtres/de
 * l'agrégat/des lignes vient de components/history/*. Ce fichier ne fait
 * que les assembler.
 */
export function SessionHistory() {
  const { sessions, exercises, chapters, ready } = usePrepahubData();
  const [filters, setFilters] = useState<HistoryFiltersState>(defaultHistoryFilters);

  const exerciseById = useMemo(() => new Map(exercises.map((item) => [item.id, item])), [exercises]);
  const chapterById = useMemo(() => new Map(chapters.map((item) => [item.id, item])), [chapters]);

  const filtered = useMemo(() => filterSessions(sessions, filters), [sessions, filters]);
  const summary = useMemo(() => summarizeSessions(filtered), [filtered]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [filtered]
  );

  const updateFilters = (patch: Partial<HistoryFiltersState>) => setFilters((prev) => ({ ...prev, ...patch }));

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="surface h-16 animate-pulse rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="surface h-24 animate-pulse rounded-2xl" />
          <div className="surface h-24 animate-pulse rounded-2xl" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface h-16 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <Card className="p-12 text-center">
        <Clock3 className="mx-auto text-accent" />
        <p className="mt-4 font-medium">Ton historique est prêt.</p>
        <p className="mt-2 text-sm text-muted">Les séances terminées apparaîtront ici.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <HistoryFilters filters={filters} onChange={updateFilters} />
      <HistorySummary summary={summary} />
      <div className="space-y-3">
        {sorted.length ? (
          sorted.map((session) => {
            const exercise = session.exercise_id ? exerciseById.get(session.exercise_id) : undefined;
            const chapter = exercise?.chapter_id ? chapterById.get(exercise.chapter_id) : undefined;
            return <SessionRow key={session.id} session={session} exerciseTitle={exercise?.title} chapterLabel={chapter?.label} />;
          })
        ) : (
          <Card className="p-10 text-center">
            <p className="text-sm text-zinc-500">Aucune séance ne correspond à ces filtres.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
