"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Archive, ChevronDown, Heart, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubjectAvatar, StatusSelect } from "@/components/exercises/exercise-badges";
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
  /** `false` en composition liste + détail (desktop) : la fiche vit dans le panneau latéral, jamais deux fois sur la même page. Par défaut `true` (comportement accordéon historique, mobile). */
  showInlineDetail?: boolean;
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
  showInlineDetail = true,
}: ExerciseListRowProps) {
  return (
    <motion.article id={`exercise-${item.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("overflow-hidden rounded-xl transition-colors", selected ? "surface" : "hover:bg-inset")}>
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        {/* La rangée portait huit éléments de front : avatar, titre, source,
            badge de type, difficulté, barre de maîtrise, cœur favori, statut.
            À ce compte-là, on ne lit plus le titre. Ne restent que ce qui aide
            à CHOISIR — titre, matière, difficulté, maîtrise, en une seconde
            ligne TOUJOURS visible (même vocabulaire que les rangées du
            Dashboard et de "À revoir en priorité" : une seule façon de
            mentionner un exercice dans une liste, partout dans l'app).
            Réservée aux dots/barre visuelles la vue Cartes, qui a la place —
            ici, du texte scannable, pas des jauges qui disparaissaient
            entièrement sous `sm`/`lg` et laissaient la rangée mobile vide
            entre le titre et les icônes de droite. La source et le type
            restent une frappe plus loin, dans le détail dépliable. */}
        <button onClick={() => onToggle(item.id)} className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left">
          <SubjectAvatar subject={item.subject} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {/* Deux lignes plutôt qu'une coupe sèche sous `sm` : à 320 px il
                  ne reste que 171 px pour le titre une fois l'avatar, les
                  actions et le chevron placés — « Résolution d'... », « Ce
                  que... », soit une liste où l'on ne peut plus choisir. Au
                  delà de `sm`, la rangée garde exactement sa densité d'une
                  ligne. */}
              <span className="min-w-0 text-sm text-ink max-sm:line-clamp-2 sm:truncate">{item.title}</span>
              {item.favorite && <Heart size={11} className="shrink-0 text-rose-300" fill="currentColor" />}
            </span>
            {/* La matière n'est pas répétée en texte : l'avatar coloré à
                gauche la porte déjà. Priorité à ce qui aide vraiment à
                choisir — difficulté puis maîtrise, jamais tronquées avant
                elles (un sujet long ne doit pas manger le seul chiffre qui
                compte pour décider). */}
            <span className="t-meta mt-0.5 block truncate">
              Difficulté {item.difficulty}/5 · {item.mastery}% maîtrisé
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden sm:inline-flex">
            <StatusSelect value={item.status} onChange={(status: ExerciseStatus) => onUpdate(item.id, { status })} className="px-2 py-1 text-2xs" />
          </span>
          {selected && (
            <Button variant="ghost" size="icon" onClick={() => onFocus(item.id)} aria-label="Mode focus" className="h-8 w-8">
              <Maximize2 size={15} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onArchive(item.id)} aria-label="Archiver" className="h-8 w-8">
            <Archive size={15} />
          </Button>
          {showInlineDetail && <ChevronDown size={14} className={cn("text-muted transition", selected && "rotate-180")} />}
        </div>
      </div>
      <AnimatePresence>
        {selected && showInlineDetail && (
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
