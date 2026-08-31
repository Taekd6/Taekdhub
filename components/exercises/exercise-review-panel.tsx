"use client";

import { ArrowRight, Compass, ListChecks } from "lucide-react";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { rowInteractiveClass } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { isPureDiscovery, recommendExercises } from "@/lib/recommendation";
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
    return <EmptyState title="Rien à revoir pour l'instant" description="Continue comme ça." className="py-8" />;
  }

  // Un élève tout juste arrivé n'a encore RIEN à "revoir" — tout ce qui
  // remonte ici n'a simplement jamais été travaillé. Même critère que le
  // Dashboard (voir `isPureDiscovery`, lib/recommendation.ts) : jamais deux
  // façons de trancher la même question.
  const isDiscoveryOnly = recommendations.every(({ reasons }) => isPureDiscovery(reasons));

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        {isDiscoveryOnly ? <Compass size={16} className="text-accent" /> : <ListChecks size={16} className="text-accent" />}
        <CardTitle className="text-base">{isDiscoveryOnly ? "À découvrir en priorité" : "À revoir en priorité"}</CardTitle>
      </div>
      {/* Des rangées, plus des cartes bordées à badges : six tuiles encadrées
          portant chacune deux étiquettes teintées faisaient un mur d'emphase
          où aucun titre ne ressortait — c'est pourtant le titre qu'on lit. */}
      <ul className="mt-3 -mx-1 divide-y divide-hairline/[0.07]">
        {recommendations.map(({ exercise, reasons }) => (
          <li key={exercise.id}>
            <button onClick={() => onSelect(exercise.id)} className={cn(rowInteractiveClass, "w-full items-center")}>
              <span className="mt-0.5 shrink-0">
                <SubjectAvatar subject={exercise.subject} size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                {/* Deux lignes sous `sm` : à 320 px la rangée n'accorde que
                    171 px au titre, et six recommandations d'affilée se
                    lisaient « Résolution d'un systèm... », « Construction
                    d'image p... » — c'est pourtant sur ce titre qu'on choisit.
                    Au-delà de `sm`, la rangée reste sur une ligne. */}
                <span className="block text-sm text-ink max-sm:line-clamp-2 sm:truncate">{exercise.title}</span>
                <span className="t-meta mt-0.5 block truncate">{reasons.join(" · ")}</span>
              </span>
              <ArrowRight size={15} className="shrink-0 text-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
