"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Archive, ChevronDown, Heart, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryBar, PriorityBadge, SubjectAvatar, StatusSelect } from "@/components/exercises/exercise-badges";
import { ExerciseDetail } from "@/components/exercises/exercise-detail";
import { cn } from "@/lib/cn";
import type { Chapter } from "@/lib/storage";
import type { Exercise, ExerciseStatus, Subject, WorkSession } from "@/lib/supabase/types";

interface ExerciseListRowProps {
  item: Exercise;
  selected: boolean;
  minutesSpent: number;
  chapters: Chapter[];
  /** Pour la section "Séances" de ExerciseDetail (Sprint 3F) — non utilisé ici directement, simple passage. */
  sessions: WorkSession[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Exercise>) => void;
  onFocus: (id: string) => void;
  onArchive: (id: string) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onRenameChapter: (id: string, label: string) => void;
  onRemoveChapter: (id: string) => void;
}

/**
 * Rangée dense pour le mode "Liste compacte" (Sprint 2B) : une ligne par
 * exercice au lieu d'une carte, pour parcourir beaucoup plus d'exercices à
 * l'écran sans défiler. Réutilise ExerciseDetail au dépli — même comportement
 * qu'en mode Cartes, pas de logique dupliquée.
 */
function ExerciseListRowImpl({
  item,
  selected,
  minutesSpent,
  chapters,
  sessions,
  onToggle,
  onUpdate,
  onFocus,
  onArchive,
  onCreateChapter,
  onRenameChapter,
  onRemoveChapter,
}: ExerciseListRowProps) {
  return (
    <motion.article id={`exercise-${item.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("surface overflow-hidden rounded-xl", selected && "border-accent/35")}>
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        <button onClick={() => onToggle(item.id)} className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left">
          <SubjectAvatar subject={item.subject} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{item.title}</span>
          <span className="hidden shrink-0 text-xs text-zinc-500 md:inline">{item.source}</span>
          <Badge className="hidden sm:inline-flex">{item.type}</Badge>
          <DifficultyDots value={item.difficulty} />
          <span className="hidden lg:inline-flex">
            <PriorityBadge value={item.priority} />
          </span>
          <span className="hidden lg:inline-flex">
            <MasteryBar value={item.mastery} />
          </span>
          {item.favorite && <Heart size={12} className="shrink-0 text-rose-300" fill="currentColor" />}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusSelect value={item.status} onChange={(status: ExerciseStatus) => onUpdate(item.id, { status })} className="px-2 py-1.5 text-2xs" />
          {selected && (
            <Button variant="ghost" size="icon" onClick={() => onFocus(item.id)} aria-label="Mode focus" className="h-8 w-8">
              <Maximize2 size={15} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onArchive(item.id)} aria-label="Archiver" className="h-8 w-8">
            <Archive size={15} />
          </Button>
          <ChevronDown size={14} className={cn("text-zinc-500 transition", selected && "rotate-180")} />
        </div>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-hairline/[0.07]">
            <ExerciseDetail
              item={item}
              update={onUpdate}
              minutesSpent={minutesSpent}
              chapters={chapters}
              sessions={sessions}
              onCreateChapter={onCreateChapter}
              onRenameChapter={onRenameChapter}
              onRemoveChapter={onRemoveChapter}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export const ExerciseListRow = memo(ExerciseListRowImpl);
