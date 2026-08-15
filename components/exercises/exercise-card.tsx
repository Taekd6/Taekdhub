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

interface ExerciseCardProps {
  item: Exercise;
  index: number;
  selected: boolean;
  /** Temps réellement passé sur cet exercice, en minutes — dérivé des WorkSession liées (voir lib/study.ts). */
  minutesSpent: number;
  chapters: Chapter[];
  /** Pour la section "Séances" de ExerciseDetail (Sprint 3F) — non utilisé ici directement, simple passage. */
  sessions: WorkSession[];
  /** Callbacks stables (identité constante) fournis par le manager — condition pour que React.memo évite les re-renders inutiles sur une banque de centaines d'exercices. */
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Exercise>) => void;
  onFocus: (id: string) => void;
  onArchive: (id: string) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onRenameChapter: (id: string, label: string) => void;
  onRemoveChapter: (id: string) => void;
}

function ExerciseCardImpl({
  item,
  index,
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
}: ExerciseCardProps) {
  return (
    <motion.article
      id={`exercise-${item.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 20) * 0.02 }}
      className={cn("surface overflow-hidden rounded-2xl", selected && "border-accent/35")}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <button onClick={() => onToggle(item.id)} className="focus-ring min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectAvatar subject={item.subject} />
            <span className="text-xs text-zinc-500">{item.source}</span>
            <Badge>{item.type}</Badge>
            {item.favorite && <Heart size={12} className="text-rose-300" fill="currentColor" />}
          </div>
          <h2 className="mt-2 truncate font-semibold tracking-tight text-zinc-100">{item.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <DifficultyDots value={item.difficulty} />
            <PriorityBadge value={item.priority} />
            <MasteryBar value={item.mastery} />
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="accent">
                {tag}
              </Badge>
            ))}
          </div>
        </button>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <StatusSelect value={item.status} onChange={(status: ExerciseStatus) => onUpdate(item.id, { status })} />
          <Button variant="ghost" size="icon" onClick={() => onUpdate(item.id, { favorite: !item.favorite })} aria-label={item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} className={cn("h-10 w-10", item.favorite && "text-rose-300")}>
            <Heart size={18} fill={item.favorite ? "currentColor" : "none"} />
          </Button>
          {selected && (
            <Button variant="ghost" size="icon" onClick={() => onFocus(item.id)} aria-label="Mode focus" className="h-10 w-10">
              <Maximize2 size={17} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onArchive(item.id)} aria-label="Archiver" className="h-10 w-10">
            <Archive size={17} />
          </Button>
          <ChevronDown size={16} className={cn("text-zinc-500 transition", selected && "rotate-180")} />
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

/**
 * Mémoïsé : sur une banque de centaines d'exercices, modifier UN exercice ne
 * doit pas re-rendre toutes les autres cartes. Fonctionne parce que le
 * manager fournit des callbacks à identité stable (voir exercise-manager.tsx)
 * — sans ça, ce memo n'aurait aucun effet.
 */
export const ExerciseCard = memo(ExerciseCardImpl);
