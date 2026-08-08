"use client";

import { useMemo } from "react";
import { BarChart3, CheckCircle2, Clock3, Flame, GraduationCap, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Heatmap } from "@/components/heatmap";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeGlobalProgress, computeProgressBySubject, masteryDistribution, progressByChapter, statusDistribution } from "@/lib/progress";
import { computeReadinessBySubject, type ReadinessLevel } from "@/lib/readiness";
import type { WeekSnapshot } from "@/lib/storage";
import { statusMeta, subjectMeta, totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatDuration } from "@/lib/utils";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/** `+8`, `-3` ou `±0` — convention unique de signe pour toutes les variations affichées dans "Évolution" (temps, exercices maîtrisés, points de progression). */
function withSign(value: number, unit = ""): string {
  if (value === 0) return `±0${unit}`;
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

function withSignMinutes(seconds: number): string {
  return withSign(Math.round(seconds / 60), " min");
}

/**
 * Section "Évolution" (Sprint 5) — présentationnelle uniquement : toute la
 * comparaison vient de `compareToPreviousWeek` (lib/week-snapshot.ts). Ne
 * montre rien tant qu'aucune semaine précédente n'a été figée, plutôt que
 * d'inventer une comparaison à partir de presque rien (même principe que
 * lib/week.ts#neglectedSubjects).
 */
function WeekEvolution({ exercises, sessions, weekSnapshots }: { exercises: Exercise[]; sessions: WorkSession[]; weekSnapshots: WeekSnapshot[] }) {
  const comparison = useMemo(() => {
    const previous = findPreviousWeekSnapshot(weekSnapshots);
    return previous ? compareToPreviousWeek(exercises, sessions, previous) : null;
  }, [exercises, sessions, weekSnapshots]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-accent" />
        <p className="eyebrow">Mémoire</p>
      </div>
      <CardTitle className="mt-2">Évolution</CardTitle>

      {!comparison ? (
        <p className="mt-4 text-sm text-zinc-500">TaekdHub commence à mesurer ta progression cette semaine.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] p-3.5">
              <p className="text-xs text-zinc-500">Temps travaillé</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{formatDuration(comparison.currentTotalSeconds)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSignMinutes(comparison.deltaTotalSeconds)} vs semaine précédente</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-3.5">
              <p className="text-xs text-zinc-500">Exercices maîtrisés</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{comparison.currentMasteredCount}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSign(comparison.deltaMasteredCount)} vs semaine précédente</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-3.5">
              <p className="text-xs text-zinc-500">Progression globale</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{comparison.currentCompletionRate}%</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSign(comparison.deltaCompletionRate, " pt")} vs semaine précédente</p>
            </div>
          </div>

          {(comparison.mostImprovedSubject || comparison.mostNeglectedSubject) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {comparison.mostImprovedSubject && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 text-sm">
                  <p className="text-xs text-zinc-500">A le plus progressé</p>
                  <p className="mt-1 font-medium text-emerald-200">{comparison.mostImprovedSubject.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{withSign(comparison.mostImprovedSubject.deltaCompletionRate, " pt")} de maîtrise</p>
                </div>
              )}
              {comparison.mostNeglectedSubject && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-sm">
                  <p className="text-xs text-zinc-500">La moins travaillée</p>
                  <p className="mt-1 font-medium text-amber-200">{comparison.mostNeglectedSubject.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{formatDuration(comparison.mostNeglectedSubject.currentSeconds)} cette semaine</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const READINESS_META: Record<ReadinessLevel, { label: string; badge: "success" | "warning" | "default"; border: string; bg: string }> = {
  "prêt": { label: "Prêt", badge: "success", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]" },
  "à consolider": { label: "À consolider", badge: "warning", border: "border-amber-500/20", bg: "bg-amber-500/[0.06]" },
  "pas prêt": { label: "Pas prêt", badge: "default", border: "border-rose-500/20", bg: "bg-rose-500/[0.06]" },
};

/**
 * Section "Prêt pour le DS ?" (Sprint 6) — présentationnelle uniquement :
 * tout vient de `computeReadinessBySubject` (lib/readiness.ts), qui n'est
 * lui-même qu'un regroupement par matière de `recommendExercises`
 * (lib/recommendation.ts, seule source de vérité pour "quoi travailler").
 */
function DsReadiness({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const readiness = useMemo(() => computeReadinessBySubject(exercises, sessions), [exercises, sessions]);

  if (readiness.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <GraduationCap size={14} className="text-accent" />
        <p className="eyebrow">Échéances</p>
      </div>
      <CardTitle className="mt-2">Prêt pour le DS ?</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">Par matière, à partir de ce que le moteur de recommandation signale déjà.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {readiness.map(({ subject, completionRate, flaggedCount, level }) => {
          const meta = READINESS_META[level];
          return (
            <div key={subject} className={`rounded-xl border ${meta.border} ${meta.bg} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">{subject}</p>
                <Badge variant={meta.badge}>{meta.label}</Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {completionRate}% maîtrisé
                {flaggedCount > 0 && ` · ${flaggedCount} exercice${flaggedCount > 1 ? "s" : ""} à retravailler`}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Page Progression (Sprint 3B, bloc "Par chapitre" ajouté au Sprint 3D,
 * "Évolution" ajouté au Sprint 5, "Prêt pour le DS ?" ajouté au Sprint 6) —
 * toute l'agrégation vient de lib/progress.ts (et lib/gamification.ts pour
 * la constance, lib/week-snapshot.ts pour l'évolution, lib/readiness.ts
 * pour la préparation aux DS) : ce composant ne fait qu'assembler et
 * afficher, aucun calcul métier ici.
 */
export function ProgressOverview() {
  const { sessions, exercises, chapters, weekSnapshots, ready } = usePrepahubData();

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

      <WeekEvolution exercises={exercises} sessions={sessions} weekSnapshots={weekSnapshots} />
      <DsReadiness exercises={exercises} sessions={sessions} />

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
