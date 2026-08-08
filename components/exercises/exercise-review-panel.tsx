"use client";

import { ArrowRight, ListChecks, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { recommendExercises } from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Tableau "À revoir" (Sprint 3A) — présentationnel uniquement : tout le
 * classement vient de `recommendExercises` (lib/recommendation.ts). Ce
 * composant se contente d'afficher le résultat et de déléguer le clic.
 */
export function ExerciseReviewPanel({
  exercises,
  sessions,
  onSelect,
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  onSelect: (id: string) => void;
}) {
  const recommendations = useMemo(() => recommendExercises(exercises, sessions, 6), [exercises, sessions]);

  if (recommendations.length === 0) {
    return (
      <Card className="p-5 text-center">
        <Sparkles className="mx-auto text-accent" size={20} />
        <p className="mt-3 text-sm text-zinc-400">Rien à revoir pour l&apos;instant — continue comme ça.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <ListChecks size={16} className="text-accent" />
        <CardTitle className="text-base">À revoir en priorité</CardTitle>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {recommendations.map(({ exercise, reasons }) => (
          <button
            key={exercise.id}
            onClick={() => onSelect(exercise.id)}
            className="focus-ring flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] p-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.02]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SubjectAvatar subject={exercise.subject} size="sm" />
                <p className="truncate text-sm font-medium text-zinc-100">{exercise.title}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reasons.map((reason) => (
                  <Badge key={reason} variant="warning">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-zinc-500" />
          </button>
        ))}
      </div>
    </Card>
  );
}
