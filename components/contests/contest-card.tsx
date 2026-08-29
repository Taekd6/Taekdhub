"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { ChevronDown, ExternalLink, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { ContestStatusBadge } from "@/components/contests/contest-badges";
import { contestResourceAvailable, resolveContestChapters, type ContestPaperView } from "@/lib/contests";
import { cn } from "@/lib/cn";
import type { Chapter, ContestPaperStatus } from "@/lib/storage";

const CTA_LABEL: Record<ContestPaperStatus, string> = {
  "à faire": "Commencer le sujet",
  "en cours": "Continuer",
  fait: "Revoir",
};

interface ContestCardProps {
  paper: ContestPaperView;
  selected: boolean;
  chapters: Chapter[];
  onToggle: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

function ContestCardImpl({ paper, selected, chapters, onToggle, onStart, onComplete, onReopen, onToggleFavorite }: ContestCardProps) {
  const paperChapters = resolveContestChapters(paper, chapters);
  const hasResource = contestResourceAvailable(paper);

  return (
    <motion.article
      id={`contest-${paper.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("surface overflow-hidden rounded-2xl", selected && "border-accent/35")}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <button onClick={() => onToggle(paper.id)} className="focus-ring min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectAvatar subject={paper.subject} />
            <span className="text-xs text-muted">
              {paper.competition} — {paper.year}
            </span>
            <ContestStatusBadge status={paper.status} />
            {paper.favorite && <Heart size={12} className="text-rose-300" fill="currentColor" />}
          </div>
          <h2 className="mt-2 truncate font-semibold tracking-tight text-ink">{paper.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {paper.difficulty !== null ? <DifficultyDots value={paper.difficulty} /> : <span className="text-2xs text-subtle">Difficulté non évaluée</span>}
            {paper.durationMinutes !== null && <span className="text-2xs text-muted">{paper.durationMinutes} min</span>}
            {paperChapters.slice(0, 2).map((chapter) => (
              <Badge key={chapter.id} variant="accent">
                {chapter.label}
              </Badge>
            ))}
            {!hasResource && (
              <Badge variant="warning">Ressource à ajouter</Badge>
            )}
          </div>
        </button>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(paper.id)}
            aria-label={paper.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={cn("h-9 w-9", paper.favorite && "text-rose-300")}
          >
            <Heart size={18} fill={paper.favorite ? "currentColor" : "none"} />
          </Button>
          <ChevronDown size={16} className={cn("text-muted transition", selected && "rotate-180")} />
        </div>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-hairline/[0.07]">
            <div className="space-y-4 bg-inset p-5">
              {paper.theme && (
                <p className="text-sm leading-6 text-ink">
                  <span className="eyebrow mr-2">Thème</span>
                  {paper.theme}
                </p>
              )}
              {paperChapters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">Chapitres évoqués</span>
                  {paperChapters.map((chapter) => (
                    <Badge key={chapter.id} variant="accent">
                      {chapter.label}
                    </Badge>
                  ))}
                </div>
              )}
              {paper.note && <p className="text-sm leading-6 text-muted">{paper.note}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {hasResource ? (
                  <a href={paper.resourceUrl!} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "secondary" })}>
                    <ExternalLink size={16} /> Ouvrir le portail officiel
                  </a>
                ) : (
                  <p className="text-sm text-muted">
                    Aucune ressource vérifiée n&apos;est encore rattachée à ce sujet — l&apos;énoncé n&apos;est pas reproduit dans TaekdHub (droits d&apos;auteur).
                  </p>
                )}
                {paper.correctionUrl && (
                  <a href={paper.correctionUrl} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "secondary" })}>
                    <ExternalLink size={16} /> Corrigé
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-hairline/[0.07] pt-4">
                {paper.status !== "fait" ? (
                  <>
                    {paper.status === "à faire" && (
                      <Button onClick={() => onStart(paper.id)}>{CTA_LABEL["à faire"]}</Button>
                    )}
                    {paper.status === "en cours" && <Button onClick={() => onComplete(paper.id)}>Marquer terminé</Button>}
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => onReopen(paper.id)}>
                    Reprendre
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export const ContestCard = memo(ContestCardImpl);
