"use client";

import { AlertCircle, Flag, Gauge, HelpCircle } from "lucide-react";
import { useMemo } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { computeExerciseBankStats } from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/** Tableau de bord de la banque d'exercices (Sprint 3A) — présentationnel, tous les calculs viennent de `computeExerciseBankStats` (lib/recommendation.ts). */
export function ExerciseBankStats({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const stats = useMemo(() => computeExerciseBankStats(exercises, sessions), [exercises, sessions]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="À revoir" value={String(stats.toReviewCount)} detail="Exercices à retravailler" icon={AlertCircle} delay={0} />
      <MetricCard label="Maîtrise moyenne" value={`${stats.averageMastery}%`} detail="Sur la banque active" icon={Gauge} delay={0.05} />
      <MetricCard label="Priorité moyenne" value={`${stats.averagePriority}/5`} detail="Sur la banque active" icon={Flag} delay={0.1} />
      <MetricCard label="Jamais travaillés" value={String(stats.neverWorkedCount)} detail="Aucune séance enregistrée" icon={HelpCircle} delay={0.15} />
    </div>
  );
}
