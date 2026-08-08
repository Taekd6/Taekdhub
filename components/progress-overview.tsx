"use client";

import { useMemo } from "react";
import { BarChart3, CheckCircle2, Clock3, Flame } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Heatmap } from "@/components/heatmap";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeGlobalProgress, computeProgressBySubject, masteryDistribution, progressByChapter, statusDistribution } from "@/lib/progress";
import { statusMeta, subjectMeta, totalSeconds } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/**
 * Page Progression (Sprint 3B, bloc "Par chapitre" ajouté au Sprint 3D) —
 * toute l'agrégation vient de lib/progress.ts (et lib/gamification.ts pour
 * la constance) : ce composant ne fait qu'assembler et afficher, aucun
 * calcul métier ici.
 */
export function ProgressOverview() {
  const { sessions, exercises, chapters, ready } = usePrepahubData();

  const model = useMemo(() => {
    return {
      global: computeGlobalProgress(exercises),
      bySubject: computeProgressBySubject(exercises),
      byChapter: progressByChapter(exercises, chapters),
      mastery: masteryDistribution(exercises),
      status: statusDistribution(exercises),
      totalTime: totalSeconds(sessions),
      streak: computeStreak(sessions),
      workByDay: workByDayMap(sessions),
    };
  }, [exercises, chapters, sessions]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Temps cumulé" value={formatDuration(model.totalTime)} detail="Toutes les séances" icon={Clock3} />
        <MetricCard
          label="Exercices maîtrisés"
          value={`${model.global.masteredCount} / ${model.global.activeCount}`}
          detail="Sur la banque active"
          icon={CheckCircle2}
          delay={0.05}
        />
        <MetricCard label="Progression globale" value={`${model.global.completionRate}%`} detail="Part maîtrisée" icon={BarChart3} delay={0.1} />
        <MetricCard label="Série actuelle" value={`${model.streak} j`} detail="Jours consécutifs" icon={Flame} delay={0.15} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Progression par matière</CardTitle>
          <div className="mt-6 space-y-5">
            {model.bySubject.map(({ subject, total, mastered, completionRate }) => (
              <div key={subject}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                      {subjectMeta[subject].short}
                    </span>
                    {subject}
                  </span>
                  <span className="text-zinc-500">
                    {mastered}/{total}
                  </span>
                </div>
                <ProgressBar value={completionRate} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Maîtrise de la banque</CardTitle>
          <div className="mt-6 space-y-5">
            {model.mastery.map(({ mastery, count, percentage }) => (
              <div key={mastery}>
                <div className="flex items-center justify-between text-sm">
                  <span>{mastery}%</span>
                  <span className="text-zinc-500">{count}</span>
                </div>
                <ProgressBar value={percentage} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Répartition</p>
        <h3 className="mb-4 mt-2 font-semibold tracking-tight">Par chapitre</h3>
        {model.byChapter.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {model.byChapter.map(({ chapter, total, mastered, completionRate }) => (
              <div key={chapter.id} className="rounded-xl border border-white/[0.07] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{chapter.label}</p>
                    <p className="text-2xs text-zinc-500">{chapter.subject}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-zinc-500">
                    {mastered}/{total}
                  </span>
                </div>
                <ProgressBar value={completionRate} animated={false} barClassName="bg-accent/80" className="mt-3 h-1.5" />
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-sm text-zinc-500">Crée des chapitres depuis un exercice pour voir leur progression ici.</Card>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Par statut</CardTitle>
          <div className="mt-6 space-y-5">
            {model.status.map(({ status, count, percentage }) => (
              <div key={status}>
                <div className="flex items-center justify-between text-sm">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusMeta[status].className}`}>{status}</span>
                  <span className="text-zinc-500">{count}</span>
                </div>
                <ProgressBar value={percentage} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Constance</p>
          <CardTitle className="mt-2">84 derniers jours</CardTitle>
          <div className="mt-6">
            <Heatmap workByDay={model.workByDay} />
            <p className="mt-5 text-xs text-zinc-500">Chaque case représente une journée de travail enregistrée.</p>
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Banque d&apos;exercices</p>
        <h3 className="mb-4 mt-2 font-semibold tracking-tight">Ce qui mérite ton attention</h3>
        <ExerciseBankStats exercises={exercises} sessions={sessions} />
      </section>
    </div>
  );
}
