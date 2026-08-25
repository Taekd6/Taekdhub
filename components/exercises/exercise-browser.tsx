"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { computeProgressBySubject, progressByChapter, type ChapterProgress } from "@/lib/progress";
import type { ExerciseFilters } from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * Navigation Matière → Chapitre de la banque d'exercices (Sprint navigation).
 * Reflète UNIQUEMENT `filters.subject`/`filters.chapter` — aucun état
 * propre : cliquer une carte appelle `onNavigate`, qui passe par le même
 * `updateFilters` que la barre de filtres existante (lib/exercise-filters.ts).
 * Aucune seconde source de vérité : les statistiques affichées viennent
 * telles quelles de lib/progress.ts (déjà utilisé par la page Progression),
 * jamais recalculées différemment ici.
 *
 * Trois états, dérivés de `filters` :
 * - `subject === "Toutes"` : grille des matières ayant au moins un exercice actif.
 * - `subject` choisi, `chapter === "Tous"` : fil d'ariane + grille des chapitres de cette matière.
 * - les deux choisis : fil d'ariane + bandeau de stats du chapitre (la liste d'exercices, juste en dessous dans ExerciseManager, fait le reste).
 *
 * Les callbacks sont volontairement distincts (plutôt qu'un `onNavigate`
 * générique) : choisir une matière/remonter reste DANS la navigation
 * (ExerciseManager garde la liste plate masquée), alors que choisir un
 * chapitre en SORT (la liste apparaît, filtrée sur ce chapitre) — même état
 * `filters`, mais une intention différente que seul l'appelant peut arbitrer.
 */
export function ExerciseBrowser({
  exercises,
  chapters,
  filters,
  onGoHome,
  onSelectSubject,
  onGoToChapters,
  onSelectChapter,
}: {
  exercises: Exercise[];
  chapters: Chapter[];
  filters: ExerciseFilters;
  onGoHome: () => void;
  onSelectSubject: (subject: Subject) => void;
  onGoToChapters: () => void;
  onSelectChapter: (chapterId: string) => void;
}) {
  if (filters.subject === "Toutes") {
    return <SubjectGrid exercises={exercises} onSelect={onSelectSubject} />;
  }

  const chapterEntries = progressByChapter(exercises, chapters)
    .filter((entry) => entry.chapter.subject === filters.subject)
    .sort((a, b) => a.chapter.label.localeCompare(b.chapter.label, "fr"));

  if (filters.chapter === "Tous") {
    return (
      <div className="space-y-3">
        <Breadcrumb subject={filters.subject} onHome={onGoHome} />
        {chapterEntries.length === 0 ? (
          <div className="surface rounded-2xl px-6 py-8 text-center">
            <p className="font-semibold">Aucun chapitre pour {filters.subject} pour l&apos;instant.</p>
            <p className="mt-1 text-sm text-zinc-500">Les exercices sans chapitre assigné restent visibles ci-dessous, filtrables normalement.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {chapterEntries.map((entry, index) => (
              <ChapterCard key={entry.chapter.id} entry={entry} index={index} onSelect={() => onSelectChapter(entry.chapter.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const current = chapterEntries.find((entry) => entry.chapter.id === filters.chapter);

  return (
    <div className="space-y-3">
      <Breadcrumb subject={filters.subject} chapterLabel={current?.chapter.label} onHome={onGoHome} onSubject={onGoToChapters} />
      {current && (
        <div className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
          <div>
            <h2 className="font-semibold tracking-tight">{current.chapter.label}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {current.total} exercice{current.total > 1 ? "s" : ""} · {current.completionRate}% maîtrisés · {current.averageMastery}% de maîtrise moyenne
            </p>
          </div>
          <ProgressBar value={current.completionRate} className="h-1.5 w-full sm:w-32" />
        </div>
      )}
    </div>
  );
}

function SubjectGrid({ exercises, onSelect }: { exercises: Exercise[]; onSelect: (subject: Subject) => void }) {
  const entries = computeProgressBySubject(exercises).filter((entry) => entry.total > 0);
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="eyebrow mb-2">Matières</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, index) => (
          <motion.button
            key={entry.subject}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 10) * 0.03 }}
            onClick={() => onSelect(entry.subject)}
            className="surface surface-hover flex items-center justify-between gap-4 rounded-2xl p-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <SubjectAvatar subject={entry.subject} />
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-tight">{entry.subject}</p>
                <p className="text-xs text-zinc-500">
                  {entry.total} exercice{entry.total > 1 ? "s" : ""} · {entry.completionRate}% maîtrisés
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-zinc-600" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ChapterCard({ entry, index, onSelect }: { entry: ChapterProgress; index: number; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 20) * 0.02 }}
      onClick={onSelect}
      className="surface surface-hover flex flex-col gap-2 rounded-2xl p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-semibold tracking-tight">{entry.chapter.label}</p>
        <ChevronRight size={15} className="shrink-0 text-zinc-600" />
      </div>
      <p className="text-xs text-zinc-500">
        {entry.total} exercice{entry.total > 1 ? "s" : ""} · {entry.completionRate}% maîtrisés
      </p>
      <ProgressBar value={entry.completionRate} className="h-1.5" />
    </motion.button>
  );
}

function Breadcrumb({
  subject,
  chapterLabel,
  onHome,
  onSubject,
}: {
  subject: Subject;
  chapterLabel?: string;
  onHome: () => void;
  onSubject?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <Button variant="ghost" size="sm" onClick={onHome} className="px-2">
        <ArrowLeft size={14} /> Matières
      </Button>
      <ChevronRight size={13} className="shrink-0 text-zinc-700" />
      {chapterLabel ? (
        <>
          <button
            type="button"
            onClick={onSubject}
            className="focus-ring rounded-lg px-2 py-1 text-zinc-400 transition hover:bg-hairline/[0.04] hover:text-zinc-200"
          >
            {subject}
          </button>
          <ChevronRight size={13} className="shrink-0 text-zinc-700" />
          <span className="truncate px-2 py-1 font-medium text-zinc-200">{chapterLabel}</span>
        </>
      ) : (
        <span className="truncate px-2 py-1 font-medium text-zinc-200">{subject}</span>
      )}
    </div>
  );
}
