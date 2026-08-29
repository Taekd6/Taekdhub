"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/goals/goal-form";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import type { Goal, GoalPriority } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * "Objectifs" — un seul écran, pas un calendrier : la liste des objectifs
 * actifs (avec leur préparation réelle, leurs prochaines séances et un
 * lancement direct vers `/session`), les objectifs terminés/abandonnés en
 * second plan pour l'historique. Toute la logique vit dans `lib/goals.ts` —
 * ce composant ne fait qu'assembler et écrire dans le stockage local via
 * `usePrepahubData`, exactement comme les autres pages.
 */
export function GoalsView() {
  const { exercises, sessions, chapters, goals, preferences, saveGoals, ready } = usePrepahubData();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-hairline/[0.025]" />
        <div className="h-40 animate-pulse rounded-2xl bg-hairline/[0.025]" />
      </div>
    );
  }

  const active = goals.filter((goal) => goal.status === "active");
  const inactive = goals.filter((goal) => goal.status !== "active");

  function createGoal(input: { title: string; subjects: Subject[]; chapterIds: string[]; targetDate: string | null; priority: GoalPriority }) {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: input.title,
      subjects: input.subjects,
      chapterIds: input.chapterIds,
      targetDate: input.targetDate,
      priority: input.priority,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    saveGoals([...goals, goal]);
    setFormOpen(false);
  }

  function changeStatus(id: string, status: Goal["status"]) {
    saveGoals(goals.map((goal) => (goal.id === id ? { ...goal, status, updatedAt: new Date().toISOString() } : goal)));
  }

  return (
    <div className="space-y-8">
      <div>
        <Button onClick={() => setFormOpen((value) => !value)}>
          <Plus size={15} /> {formOpen ? "Fermer" : "Nouvel objectif"}
        </Button>
      </div>

      {formOpen && <GoalForm chapters={chapters} onCreate={createGoal} onCancel={() => setFormOpen(false)} />}

      {goals.length === 0 && !formOpen ? (
        <EmptyState
          title="Aucun objectif pour l'instant"
          description="Crée un objectif — un DS, un chapitre à maîtriser, une échéance — pour que TaekdHub organise ton travail autour."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={15} /> Créer mon premier objectif
            </Button>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  exercises={exercises}
                  sessions={sessions}
                  chapters={chapters}
                  dailyGoalMinutes={preferences.dailyGoalMinutes}
                  onChangeStatus={(status) => changeStatus(goal.id, status)}
                />
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <Section rank="secondary" eyebrow="Historique" title="Terminés et abandonnés">
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {inactive.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    exercises={exercises}
                    sessions={sessions}
                    chapters={chapters}
                    dailyGoalMinutes={preferences.dailyGoalMinutes}
                    onChangeStatus={(status) => changeStatus(goal.id, status)}
                  />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
