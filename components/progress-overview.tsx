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
import { computeGlobalProgress, computeProgressBySubject, masteryDistribution, statusDistribution } from "@/lib/progress";
import { statusMeta, subjectMeta, totalSeconds } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/**
 * Page Progression (Sprint 3B) — toute l'agrégation vient de lib/progress.ts
 * (et lib/gamification.ts pour la constance) : ce composant ne fait
 * qu'assembler et afficher, aucun calcul métier ici.
 *
 * Le bloc "Chapitres" retiré au Sprint 3B n'est pas remplacé : il groupait en
 * réalité par titre d'exercice (le catalogue de chapitres, lib/chapters.ts,
 * est vide) — une vraie vue par chapitre reviendra quand ce catalogue existera.
 */
export function ProgressOverview() {
  const { sessions, exercises, ready } = usePrepahubData();

  const model = useMemo(() => {
    return {
      global: computeGlobalProgress(exercises),
      bySubject: computeProgressBySubject(exercises),
      mastery: masteryDistribution(exercises),
      status: statusDistribution(exercises),
      totalTime: totalSeconds(sessions),
      streak: computeStreak(sessions),
      workByDay: workByDayMap(sessions),
    };
  }, [exercises, sessions]);

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
