"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { subjects } from "@/lib/study";
import { plannedMinutesForDay, setDayCellMinutes } from "@/lib/weekly-plan";
import type { Subject } from "@/lib/supabase/types";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/**
 * Plan de travail hebdomadaire (Sprint Study OS Phase 4) — une intention par
 * jour et par matière, volontairement SANS créneau horaire (voir le refus
 * explicite du calendrier horaire dans le brief). Un onglet par jour plutôt
 * que les 7 × 7 champs affichés d'un coup, pour rester une "interface très
 * simple" : un seul jour édité à la fois.
 *
 * Entièrement facultatif — un utilisateur qui ne touche jamais à cet éditeur
 * garde `weeklyPlan` à 7 jours vides, sans le moindre effet sur le reste de
 * l'app (voir lib/weekly-plan.ts#hasAnyPlannedMinutes, qui masque la carte
 * "Ma semaine" du Dashboard tant que rien n'est configuré).
 */
export function WeeklyPlanEditor() {
  const { weeklyPlan, saveWeeklyPlan } = usePrepahubData();
  const [activeDay, setActiveDay] = useState(0);

  function setMinutes(subject: Subject, value: string) {
    const minutes = value ? Math.max(0, Math.round(Number(value))) : 0;
    saveWeeklyPlan(setDayCellMinutes(weeklyPlan, activeDay, subject, minutes));
  }

  const dayEntry = weeklyPlan.find((entry) => entry.day === activeDay);

  return (
    <Card id="planification" className="max-w-2xl scroll-mt-6 p-6">
      <p className="eyebrow">Planification</p>
      <h2 className="mt-2 text-lg font-semibold">Ma semaine de travail</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500">
        Facultatif — répartis ton temps par jour et par matière. TaekdHub compare ensuite prévu et réalisé, et priorise une matière en retard sur son plan.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {DAY_LABELS.map((label, index) => {
          const minutes = plannedMinutesForDay(weeklyPlan, index);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveDay(index)}
              aria-pressed={activeDay === index}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium transition",
                activeDay === index ? "border-accent/40 bg-accent/15 text-accent-text" : "border-hairline/[0.09] text-zinc-400 hover:border-hairline/[0.18]"
              )}
            >
              {label.slice(0, 3)}
              {minutes > 0 && <span className="ml-1.5 text-2xs text-zinc-500">{minutes} min</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2">
        {subjects.map((subject) => (
          <div key={subject} className="flex items-center gap-3">
            <SubjectAvatar subject={subject} size="sm" />
            <span className="w-36 shrink-0 truncate text-sm text-zinc-300">{subject}</span>
            <Input
              type="number"
              min={0}
              value={dayEntry?.subjectMinutes[subject] ?? ""}
              onChange={(e) => setMinutes(subject, e.target.value)}
              placeholder="0"
              className="w-24"
              aria-label={`Minutes prévues pour ${subject} le ${DAY_LABELS[activeDay]}`}
            />
            <span className="text-xs text-muted">min</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
