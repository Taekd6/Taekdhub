"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookMarked,
  Clock3,
  Flame,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { CircularProgress, ProgressBar } from "@/components/ui/progress";
import { ExerciseReviewPanel } from "@/components/exercises/exercise-review-panel";
import { Heatmap } from "@/components/heatmap";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import {
  computeStreak,
  levelFromXp,
  totalXp,
  workByDayMap,
  xpProgressInLevel,
} from "@/lib/gamification";
import { computeProgressBySubject, type SubjectProgress } from "@/lib/progress";
import { completedExercises, dayKey, subjectMeta, totalSeconds } from "@/lib/study";
import { formatDuration } from "@/lib/utils";

/** Purement présentationnel — la progression par matière vient de lib/progress.ts (source unique, partagée avec la page Progression depuis le Sprint 3B). */
function SubjectProgressList({ progress }: { progress: SubjectProgress[] }) {
  return (
    <div className="space-y-4">
      {progress.map(({ subject, total, mastered, completionRate }) => (
        <div key={subject}>
          <div className="mb-2 flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${subjectMeta[subject].className}`} />
              {subject}
            </span>
            <span className="text-zinc-500">
              {mastered}/{total}
            </span>
          </div>
          <ProgressBar value={completionRate} animated={false} barClassName="bg-accent/80" className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

export function DashboardOverview() {
  const { sessions, exercises, preferences, ready } = usePrepahubData();
  const router = useRouter();

  const model = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const todaySeconds = totalSeconds(sessions.filter((s) => dayKey(s.started_at) === today));
    const weekSeconds = totalSeconds(sessions.filter((s) => new Date(s.started_at) >= monday));
    const workByDay = workByDayMap(sessions);
    const streak = computeStreak(sessions);
    const active = exercises.filter((e) => !e.archived);
    const done = completedExercises(active);
    const subjectProgress = computeProgressBySubject(exercises);
    const contest = preferences.contestDate
      ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
      : null;
    const xp = totalXp(exercises, sessions);
    const level = levelFromXp(xp);
    const xpProgress = xpProgressInLevel(xp);
    const objective = Math.min(100, Math.round((todaySeconds / (preferences.dailyGoalMinutes * 60)) * 100));
    const avgDifficulty = active.length
      ? (active.reduce((sum, item) => sum + item.difficulty, 0) / active.length).toFixed(1)
      : "—";
    const recentSessions = [...sessions]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 4);

    return {
      todaySeconds,
      weekSeconds,
      workByDay,
      streak,
      active,
      done,
      subjectProgress,
      contest,
      xp,
      level,
      xpProgress,
      objective,
      avgDifficulty,
      recentSessions,
    };
  }, [sessions, exercises, preferences]);

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
    <div className="space-y-7">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <p className="eyebrow">Niveau {model.level}</p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {model.objective >= 100 ? "Objectif atteint." : "Continue sur ta lancée."}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              {formatDuration(model.todaySeconds)} travaillés aujourd&apos;hui
              {model.streak > 0 && ` · ${model.streak} jour${model.streak > 1 ? "s" : ""} de suite`}
            </p>
            <div className="mt-5 max-w-md">
              <div className="mb-2 flex justify-between text-xs text-zinc-500">
                <span>{model.xpProgress.current} / {model.xpProgress.needed} XP</span>
                <span className="flex items-center gap-1 text-accent">
                  <Zap size={12} /> {model.xp.toLocaleString("fr-FR")} XP total
                </span>
              </div>
              <ProgressBar value={model.xpProgress.percent} className="h-1.5" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:flex-col">
            <Link href="/timer">
              <Button size="lg">
                Démarrer un focus <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/exercises">
              <Button variant="secondary" size="lg">
                Voir les exercices
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Aujourd'hui" value={formatDuration(model.todaySeconds)} detail={`Objectif : ${formatDuration(preferences.dailyGoalMinutes * 60)}`} icon={Clock3} delay={0.05} />
        <MetricCard label="Cette semaine" value={formatDuration(model.weekSeconds)} detail="Depuis lundi" icon={Target} delay={0.1} />
        <MetricCard label="Série actuelle" value={`${model.streak} j`} detail="Jours consécutifs" icon={Flame} delay={0.15} />
        <MetricCard label="Concours" value={model.contest === null ? "—" : `${model.contest} j`} detail={model.contest === null ? "Ajoute une échéance" : "Avant l'échéance"} icon={Trophy} delay={0.2} />
      </section>

      {/* Daily goal + Progress */}
      <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Card className="rounded-3xl p-6 sm:p-7">
          <CardHeader>
            <div>
              <p className="eyebrow">Rythme du jour</p>
              <CardTitle className="mt-2 text-xl">Un bloc net. Puis le suivant.</CardTitle>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{model.objective}%</span>
          </CardHeader>
          <CardContent className="mt-8">
            <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatDuration(model.todaySeconds)}{" "}
              <span className="text-base font-normal text-zinc-500">/ {formatDuration(preferences.dailyGoalMinutes * 60)}</span>
            </p>
            <ProgressBar value={model.objective} className="mt-5" />
            <Link href="/timer" className="mt-8 inline-block">
              <Button>Démarrer un focus <ArrowRight size={16} /></Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-3xl p-6">
          <p className="eyebrow">Progression</p>
          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-4xl font-semibold tracking-tight">
                {model.done.length}
                <span className="text-base font-normal text-zinc-500">/{model.active.length}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-500">Exercices terminés</p>
            </div>
            <CircularProgress value={model.active.length ? Math.round((model.done.length / model.active.length) * 100) : 0} />
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
            <BookMarked size={16} className="text-accent" /> Difficulté moyenne : {model.avgDifficulty}/5
          </div>
        </Card>
      </section>

      {/* Heatmap + Subjects */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <p className="eyebrow">Constance</p>
              <CardTitle className="mt-2">84 derniers jours</CardTitle>
            </div>
            <span className="text-xs text-zinc-500">plus intense →</span>
          </CardHeader>
          <CardContent className="mt-6">
            <Heatmap workByDay={model.workByDay} />
            <p className="mt-5 text-xs text-zinc-500">Chaque case représente une journée de travail enregistrée.</p>
          </CardContent>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Par matière</p>
          <CardTitle className="mt-2">Progression</CardTitle>
          <div className="mt-5">
            <SubjectProgressList progress={model.subjectProgress} />
          </div>
        </Card>
      </section>

      {/* Recommendations + Activity */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        {/* Sprint 3A : remplace l'ancienne heuristique locale (favori + difficulté)
            par le moteur centralisé (lib/recommendation.ts) — même composant
            que sur la page Exercices, pour ne dupliquer aucune logique. Le
            clic renvoie vers la fiche exacte via ?focus=<id>. */}
        <ExerciseReviewPanel exercises={exercises} sessions={sessions} onSelect={(id) => router.push(`/exercises?focus=${id}`)} />

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-accent" />
            <p className="eyebrow">Activité récente</p>
          </div>
          <CardTitle className="mt-2">Dernières séances</CardTitle>
          <div className="mt-5 space-y-2">
            {model.recentSessions.length ? (
              model.recentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3 text-sm">
                  <div>
                    <p className="font-medium">{session.subject}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.started_at))}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-accent">{formatDuration(session.duration_seconds)}</span>
                </div>
              ))
            ) : (
              <p className="py-7 text-sm text-zinc-500">Termine une séance focus pour voir ton activité ici.</p>
            )}
          </div>
        </Card>
      </section>

      {/* Favorites */}
      <Card className="p-6">
        <p className="eyebrow">Favoris</p>
        {/* Sprint 3A : renommé (était "À revoir en priorité", qui prêtait à
            confusion avec le nouveau panneau du même nom ci-dessus — cette
            carte-ci ne montre que les favoris, pas une recommandation). */}
        <CardTitle className="mt-2">Marqués comme favoris</CardTitle>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {model.active
            .filter((e) => e.favorite)
            .slice(0, 3)
            .map((exercise) => (
              <Link
                key={exercise.id}
                href="/exercises"
                className="focus-ring block rounded-xl border border-white/[0.06] p-3 text-sm transition hover:border-white/[0.14]"
              >
                <p className="font-medium">{exercise.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{exercise.source}</p>
              </Link>
            ))}
          {!model.active.some((e) => e.favorite) && (
            <p className="py-4 text-sm text-zinc-500 sm:col-span-3">
              Marque un exercice avec le cœur pour le retrouver ici.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
