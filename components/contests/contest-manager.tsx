"use client";

import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { ContestCard } from "@/components/contests/contest-card";
import { ContestFiltersBar } from "@/components/contests/contest-filters-bar";
import {
  contestChapterOptions,
  contestPapers,
  contestProgressCounts,
  defaultContestFilters,
  distinctContestCompetitions,
  distinctContestDifficulties,
  distinctContestYears,
  filterContestPapers,
  updateContestProgress,
  withContestProgress,
  type ContestFilters,
} from "@/lib/contests";

/**
 * Banque de sujets de concours — même esprit que `ExerciseManager` (état des
 * filtres, sélection, persistance) mais volontairement plus simple : pas de
 * mode navigation Matière → Chapitre, pas de mode focus chronométré (un sujet
 * de concours n'est pas transformé en séance — voir la doc de `ContestPaper`,
 * lib/storage.ts). Le catalogue lui-même (`contestPapers`) est statique,
 * livré avec l'app ; seule la progression de l'élève est lue/écrite ici.
 */
export function ContestManager() {
  const { chapters, contestProgress, saveContestProgress, ready } = usePrepahubData();
  const [filters, setFilters] = useState<ContestFilters>(defaultContestFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateFilters = useCallback((patch: Partial<ContestFilters>) => setFilters((prev) => ({ ...prev, ...patch })), []);
  const toggleSelected = useCallback((id: string) => setSelectedId((prev) => (prev === id ? null : id)), []);

  const papers = useMemo(() => withContestProgress(contestPapers, contestProgress), [contestProgress]);

  const setProgress = useCallback(
    (id: string, patch: Parameters<typeof updateContestProgress>[2]) => {
      saveContestProgress(updateContestProgress(contestProgress, id, patch));
    },
    [contestProgress, saveContestProgress]
  );
  const startPaper = useCallback((id: string) => setProgress(id, { status: "en cours", startedAt: new Date().toISOString() }), [setProgress]);
  const completePaper = useCallback((id: string) => setProgress(id, { status: "fait", completedAt: new Date().toISOString() }), [setProgress]);
  const reopenPaper = useCallback((id: string) => setProgress(id, { status: "en cours" }), [setProgress]);
  const toggleFavorite = useCallback(
    (id: string) => {
      const current = papers.find((paper) => paper.id === id);
      setProgress(id, { favorite: !current?.favorite });
    },
    [papers, setProgress]
  );

  const competitionOptions = useMemo(() => distinctContestCompetitions(contestPapers), []);
  const yearOptions = useMemo(() => distinctContestYears(contestPapers), []);
  const difficultyOptions = useMemo(() => distinctContestDifficulties(contestPapers), []);
  const chapterOptions = useMemo(() => contestChapterOptions(contestPapers, chapters, filters.subject), [chapters, filters.subject]);

  const visible = useMemo(() => filterContestPapers(papers, filters, chapters), [papers, filters, chapters]);
  const counts = useMemo(() => contestProgressCounts(papers), [papers]);

  if (!ready) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 px-1 text-sm text-muted">
        <span>
          <span className="font-semibold text-ink">{contestPapers.length}</span> sujet{contestPapers.length > 1 ? "s" : ""} disponible
          {contestPapers.length > 1 ? "s" : ""}
        </span>
        {(counts["en cours"] > 0 || counts.fait > 0) && (
          <span>
            · <span className="font-semibold text-ink">{counts["en cours"]}</span> en cours · <span className="font-semibold text-ink">{counts.fait}</span> terminé
            {counts.fait > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Le format, dit une fois, parce que rien d'autre ne le dit.
          Un sujet dure 180 ou 240 minutes (les seules valeurs du catalogue) ;
          le plus long préréglage du plan du jour est 90 (PLAN_DURATION_PRESETS).
          Un sujet ne peut donc structurellement JAMAIS entrer dans une séance :
          `fillBudget` (lib/plan.ts) saute tout ce qui dépasse le budget. Ce
          n'est pas un arbitrage à afficher, c'est une conséquence mécanique —
          autant l'énoncer plutôt que de laisser l'élève la découvrir en
          cherchant ses sujets dans le plan du jour. */}
      <p className="px-1 text-2xs leading-5 text-subtle">
        Un sujet complet dure 3 à 4 h : il remplace la séance du jour, il ne s&apos;y ajoute pas. Ces sujets restent à part, choisis par
        toi — ils n&apos;entrent jamais dans le plan du jour ni dans les recommandations.
      </p>

      <ContestFiltersBar
        filters={filters}
        onChange={updateFilters}
        competitionOptions={competitionOptions}
        yearOptions={yearOptions}
        difficultyOptions={difficultyOptions}
        chapterOptions={chapterOptions}
      />

      <p className="px-1 text-sm text-muted">
        <span className="font-semibold text-ink">{visible.length}</span> sujet{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""}
      </p>

      <div className="grid gap-3">
        {visible.map((paper) => (
          <ContestCard
            key={paper.id}
            paper={paper}
            selected={selectedId === paper.id}
            chapters={chapters}
            onToggle={toggleSelected}
            onStart={startPaper}
            onComplete={completePaper}
            onReopen={reopenPaper}
            onToggleFavorite={toggleFavorite}
          />
        ))}
        {visible.length === 0 && (
          <EmptyState title="Aucun sujet ne correspond." description="Ajuste les filtres ou efface la recherche." className="py-16" />
        )}
      </div>
    </div>
  );
}
