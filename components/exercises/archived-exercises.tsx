"use client";

import { Archive, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryBar, SubjectAvatar } from "@/components/exercises/exercise-badges";
import type { Exercise } from "@/lib/supabase/types";
import { MathInline } from "@/components/rich-math";

/**
 * Vue "Archivés" (Sprint 3H) — consultation + restauration uniquement,
 * jamais d'édition ici. `onRestore` appelle le même `update(id, patch)` que
 * l'archivage (voir exercise-manager.tsx#archiveExercise) : aucune logique
 * de mutation dupliquée, juste `{ archived: false }` au lieu de `true`.
 */
export function ArchivedExercises({ exercises, onRestore }: { exercises: Exercise[]; onRestore: (id: string) => void }) {
  if (!exercises.length) {
    return (
      <EmptyState
        icon={Archive}
        title="Aucun exercice archivé."
        description="Les exercices que tu archives depuis la banque apparaîtront ici, et pourront en être ressortis à tout moment."
      />
    );
  }

  // Une LISTE, comme la banque : ces exercices sont exactement les mêmes
  // objets, ils n'ont aucune raison d'être présentés autrement parce qu'ils
  // sont rangés.
  return (
    <ul className="divide-y divide-line border-y border-line">
      {exercises.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <SubjectAvatar subject={item.subject} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">
              <MathInline text={item.title} />
            </p>
            <p className="t-meta mt-0.5 flex min-w-0 items-center gap-2 truncate">
              <span className="truncate">{item.source}</span>
              <Badge>{item.type}</Badge>
              <Badge className="capitalize">{item.status}</Badge>
            </p>
          </div>
          <span className="hidden shrink-0 sm:inline-flex">
            <DifficultyDots value={item.difficulty} />
          </span>
          <span className="hidden shrink-0 lg:inline-flex">
            <MasteryBar value={item.mastery} />
          </span>
          <Button variant="secondary" size="sm" onClick={() => onRestore(item.id)} className="shrink-0">
            <RotateCcw size={15} /> Restaurer
          </Button>
        </li>
      ))}
    </ul>
  );
}
