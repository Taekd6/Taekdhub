"use client";

import { Archive, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryBar, SubjectAvatar } from "@/components/exercises/exercise-badges";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Vue "Archivés" (Sprint 3H) — consultation + restauration uniquement,
 * jamais d'édition ici. `onRestore` appelle le même `update(id, patch)` que
 * l'archivage (voir exercise-manager.tsx#archiveExercise) : aucune logique
 * de mutation dupliquée, juste `{ archived: false }` au lieu de `true`.
 */
export function ArchivedExercises({ exercises, onRestore }: { exercises: Exercise[]; onRestore: (id: string) => void }) {
  if (!exercises.length) {
    return (
      <Card className="px-6 py-16 text-center">
        <Archive className="mx-auto text-accent-text" />
        <p className="mt-4 font-semibold">Aucun exercice archivé.</p>
        <p className="mt-1 text-sm text-zinc-500">Les exercices que tu archives depuis la banque apparaîtront ici.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {exercises.map((item) => (
        <Card key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SubjectAvatar subject={item.subject} />
              <span className="text-xs text-zinc-500">{item.source}</span>
              <Badge>{item.type}</Badge>
            </div>
            <h2 className="mt-2 truncate font-semibold tracking-tight text-zinc-100">{item.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <DifficultyDots value={item.difficulty} />
              <MasteryBar value={item.mastery} />
              <Badge className="capitalize">{item.status}</Badge>
            </div>
          </div>
          <Button variant="secondary" onClick={() => onRestore(item.id)} className="shrink-0">
            <RotateCcw size={16} /> Restaurer
          </Button>
        </Card>
      ))}
    </div>
  );
}
