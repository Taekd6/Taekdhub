"use client";

import { useMemo } from "react";
import { BarChart3, CheckCircle2, Clock3 } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { completedExercises, subjects, subjectMeta, totalSeconds } from "@/lib/study";
import { formatDuration } from "@/lib/utils";
import type { Exercise } from "@/lib/supabase/types";

export function ProgressOverview() {
  const { sessions, exercises, ready } = usePrepahubData();

  const { active, done, chapters } = useMemo(() => {
    const activeExercises = exercises.filter((e) => !e.archived);
    const doneExercises = completedExercises(activeExercises);
    const chapterGroups = Object.entries(
      activeExercises.reduce<Record<string, Exercise[]>>((groups, exercise) => {
        const key = `${exercise.subject} · ${exercise.chapter}`;
        return { ...groups, [key]: [...(groups[key] || []), exercise] };
      }, {})
    )
      .sort(([, a], [, b]) => Number(b.some((e) => e.status !== "terminé")) - Number(a.some((e) => e.status !== "terminé")))
      .slice(0, 8);

    return { active: activeExercises, done: doneExercises, chapters: chapterGroups };
  }, [exercises]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const totalTime = totalSeconds(sessions);
  const completionRate = active.length ? Math.round((done.length / active.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Temps cumulé" value={formatDuration(totalTime)} detail="Toutes les séances" icon={Clock3} />
        <MetricCard label="Exercices terminés" value={`${done.length} / ${active.length}`} detail="Sur la banque active" icon={CheckCircle2} />
        <MetricCard label="Taux de réussite" value={`${completionRate}%`} detail="Progression globale" icon={BarChart3} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Progression par matière</CardTitle>
          <div className="mt-6 space-y-5">
            {subjects.map((subject) => {
              const all = active.filter((e) => e.subject === subject);
              const completed = done.filter((e) => e.subject === subject);
              const percentage = all.length ? Math.round((completed.length / all.length) * 100) : 0;
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                        {subjectMeta[subject].short}
                      </span>
                      {subject}
                    </span>
                    <span className="text-zinc-500">{percentage}%</span>
                  </div>
                  <ProgressBar value={percentage} animated={false} className="mt-2 h-2" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Chapitres</p>
          <CardTitle className="mt-2">Où concentrer ton énergie</CardTitle>
          <CardContent className="mt-6 space-y-3">
            {chapters.length ? (
              chapters.map(([label, list]) => {
                const complete = list.filter((e) => e.status === "terminé").length;
                const pct = list.length ? (complete / list.length) * 100 : 0;
                return (
                  <div key={label} className="rounded-xl border border-white/[0.07] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{label}</p>
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        {complete}/{list.length}
                      </span>
                    </div>
                    <ProgressBar value={pct} animated={false} barClassName="bg-accent/80" className="mt-3 h-1.5" />
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500">
                Crée tes premiers exercices pour voir les chapitres apparaître.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
