"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { PageBar, Split } from "@/components/ui/layout";
import { EmptyState, Skeleton } from "@/components/ui/state";
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
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <EmptyState
        icon={Clock3}
        title="Ton journal est prêt."
        description="Chaque exercice travaillé y laissera sa durée, son résultat et sa date. Rien n'y est écrit à ta place."
      />
    );
  }

  /*
   * Le JOURNAL est le contenu ; les agrégats le commentent. Ils étaient
   * empilés au-dessus de lui, si bien qu'on faisait défiler trois blocs de
   * synthèse avant d'atteindre la première séance — alors que c'est
   * précisément la séance qu'on vient chercher. Ils passent dans le rail,
   * où ils restent visibles pendant qu'on remonte le journal.
   */
  return (
    <Split
      railLabel="Synthèse de la période"
      rail={
        <div className="space-y-8">
          <HistoryFilters filters={filters} onChange={updateFilters} />
          <HistorySummary summary={summary} results={results} />
        </div>
      }
    >
      <div className="space-y-8">
        <PageBar
          title="Séances"
          meta="La trace exacte du travail accompli : ce qui a été travaillé, combien de temps, avec quel résultat."
        />

      <Section label="Journal" title={`${sorted.length} séance${sorted.length > 1 ? "s" : ""}`}>
        {sorted.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {sorted.slice(0, visibleCount).map((session) => {
              const exercise = session.exercise_id ? exerciseById.get(session.exercise_id) : undefined;
              const chapter = exercise?.chapter_id ? chapterById.get(exercise.chapter_id) : undefined;
              return (
                <SessionRow key={session.id} session={session} exerciseTitle={exercise?.title} chapterLabel={chapter?.label} />
              );
            })}
          </ul>
        ) : (
          <p className="t-meta border-y border-line py-6 text-center">Aucune séance ne correspond à ces filtres.</p>
        )}

        {sorted.length > visibleCount && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}>
              Afficher {Math.min(HISTORY_PAGE_SIZE, sorted.length - visibleCount)} de plus <ChevronDown size={14} />
            </Button>
            <p className="t-meta tabular">
              {visibleCount} sur {sorted.length}
            </p>
          </div>
        )}
      </Section>
      </div>
    </Split>
  );
}
