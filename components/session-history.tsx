"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistorySummary } from "@/components/history/history-summary";
import { SessionRow } from "@/components/history/session-row";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { defaultHistoryFilters, filterSessions, resultCounts, summarizeSessions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";

/** Lignes montées d'un coup — voir `visibleCount`. */
const HISTORY_PAGE_SIZE = 100;

/**
 * Page Historique (Sprint 3F) — orchestration uniquement : filtrage et
 * agrégation viennent de lib/history.ts, l'affichage des filtres/de
 * l'agrégat/des lignes vient de components/history/*. Ce fichier ne fait
 * que les assembler.
 */
export function SessionHistory() {
  const { sessions, exercises, chapters, ready } = usePrepahubData();
  const [filters, setFilters] = useState<HistoryFiltersState>(defaultHistoryFilters);
  // Combien de lignes sont réellement montées dans le DOM.
  //
  // La page en montait UNE PAR SÉANCE, sans plafond. Mesuré en test de
  // destruction : 10 000 séances (un peu plus d'un an à un rythme soutenu)
  // mettaient 26 secondes à s'afficher, contre ~2,5 s pour toutes les autres
  // pages du même jeu de données. Les agrégats du haut, eux, restent calculés
  // sur la TOTALITÉ des séances filtrées : c'est le rendu qui est paginé,
  // jamais la mesure.
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);

  const exerciseById = useMemo(() => new Map(exercises.map((item) => [item.id, item])), [exercises]);
  const chapterById = useMemo(() => new Map(chapters.map((item) => [item.id, item])), [chapters]);

  const filtered = useMemo(() => filterSessions(sessions, filters), [sessions, filters]);
  const summary = useMemo(() => summarizeSessions(filtered), [filtered]);
  const results = useMemo(() => resultCounts(filtered), [filtered]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [filtered]
  );

  const updateFilters = (patch: Partial<HistoryFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setVisibleCount(HISTORY_PAGE_SIZE);
  };

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
      <HistorySummary summary={summary} results={results} />
      <div className="space-y-3">
        {sorted.length ? (
          sorted.slice(0, visibleCount).map((session) => {
            const exercise = session.exercise_id ? exerciseById.get(session.exercise_id) : undefined;
            const chapter = exercise?.chapter_id ? chapterById.get(exercise.chapter_id) : undefined;
            return <SessionRow key={session.id} session={session} exerciseTitle={exercise?.title} chapterLabel={chapter?.label} />;
          })
        ) : (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted">Aucune séance ne correspond à ces filtres.</p>
          </Card>
        )}
      </div>

      {sorted.length > visibleCount && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted">
            {visibleCount} séance{visibleCount > 1 ? "s" : ""} affichée{visibleCount > 1 ? "s" : ""} sur {sorted.length}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}>
            Afficher {Math.min(HISTORY_PAGE_SIZE, sorted.length - visibleCount)} de plus <ChevronDown size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
