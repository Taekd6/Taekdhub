"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CalendarClock, Clock3, Flame, ListChecks, Sparkles, Target, Trophy } from "lucide-react";
import { useMemo } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import { computeCommandCenterProgress, computeDailyObjective, computeNextAction, computeUpcoming } from "@/lib/next-action";
import { formatDuration } from "@/lib/utils";
import type { UpcomingItem } from "@/lib/next-action";

/** Préréglages de temps disponible pour le lien direct "Tu as N min ?" — mêmes valeurs que l'aperçu de séance (components/session/session-runner.tsx#BUDGET_PRESETS), pour rester cohérent entre les deux écrans. */
const QUICK_SESSION_PRESETS = [15, 30, 45, 60];

const UPCOMING_META: Record<UpcomingItem["key"], { label: string; icon: typeof BookOpenCheck }> = {
  chapter: { label: "Chapitre à consolider", icon: BookOpenCheck },
  subject: { label: "Matière délaissée", icon: CalendarClock },
  review: { label: "Révision due", icon: ListChecks },
};

/**
 * Centre de pilotage (Sprint 7) — remplace l'ancien tableau de bord "vitrine"
 * (XP/niveau, heatmap, listes dupliquées avec /progress et /history) par
 * quatre blocs à haute valeur, tous dérivés de lib/next-action.ts (qui
 * lui-même ne fait que composer lib/recommendation.ts, lib/progress.ts,
 * lib/week.ts et lib/history.ts — aucune nouvelle règle métier ici).
 *
 * Volontairement RETIRÉ par rapport à l'ancienne version : XP/niveau
 * (gamification artificielle), heatmap de constance, détail par matière et
 * activité récente (déjà couverts, en mieux, par /progress et /history —
 * cette page y renvoie plutôt que de les dupliquer), favoris. Rien de tout
 * cela n'est supprimé ailleurs : uniquement retiré d'ici pour ne garder que
 * ce qui répond à "qu'est-ce que je fais maintenant".
 */
export function DashboardOverview() {
  const { sessions, exercises, chapters, preferences, ready } = usePrepahubData();

  const model = useMemo(() => {
    const now = new Date();
    return {
      nextAction: computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now),
      objective: computeDailyObjective(sessions, preferences.dailyGoalMinutes, now),
      upcoming: computeUpcoming(exercises, sessions, chapters, now),
      progress: computeCommandCenterProgress(exercises, sessions, now),
      streak: computeStreak(sessions),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
    };
  }, [exercises, sessions, chapters, preferences]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const { nextAction, objective, upcoming, progress, streak, contestDays } = model;
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);

  return (
    <div className="space-y-6">
      <BackupReminder />

      {/* À FAIRE MAINTENANT */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <p className="eyebrow">À faire maintenant</p>
            {contestDays !== null && (
              <Badge variant="accent" className="ml-auto flex items-center gap-1">
                <Trophy size={11} /> {contestDays} j avant le concours
              </Badge>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{nextAction.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{nextAction.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={sessionHref}>
              <Button size="lg">
                {nextAction.ctaLabel} <ArrowRight size={16} />
              </Button>
            </Link>
            {nextAction.kind !== "start-session" && (
              <Link href="/session">
                <Button variant="secondary" size="lg">
                  Ouvrir une séance
                </Button>
              </Link>
            )}
          </div>

          {secondaryPicks.length > 0 && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {secondaryPicks.map(({ exercise, reasons }) => (
                <Link
                  key={exercise.id}
                  href={`/exercises?focus=${exercise.id}`}
                  className="focus-ring flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] p-3 text-sm transition hover:border-white/[0.14] hover:bg-white/[0.02]"
                >
                  <SubjectAvatar subject={exercise.subject} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">{exercise.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {reasons.slice(0, 2).map((reason) => (
                        <Badge key={reason} variant="warning">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* OBJECTIF DU JOUR + TA PROGRESSION */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-3xl p-6 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Objectif du jour</p>
              <CardTitle className="mt-2 text-xl">
                {formatDuration(objective.workedMinutes * 60)}{" "}
                <span className="text-base font-normal text-zinc-500">/ {formatDuration(objective.goalMinutes * 60)}</span>
              </CardTitle>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{objective.percent}%</span>
          </div>
          <ProgressBar value={objective.percent} className="mt-5" />
          <p className="mt-3 text-xs text-zinc-500">
            {objective.met
              ? "Objectif atteint."
              : `${objective.remainingMinutes} min restantes aujourd'hui`}
            {streak > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-accent">
                <Flame size={11} className="inline" /> {streak} j de suite
              </span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK_SESSION_PRESETS.map((preset) => (
              <Link key={preset} href={`/session?minutes=${preset}`}>
                <Button variant="secondary" size="sm">
                  {preset} min
                </Button>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Ta progression</p>
              <CardTitle className="mt-2">Vue d&apos;ensemble</CardTitle>
            </div>
            <Target size={16} className="text-accent" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight">{progress.averageMastery}%</p>
              <p className="mt-0.5 text-xs text-zinc-500">Maîtrise globale</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{progress.results.successRate === null ? "—" : `${progress.results.successRate}%`}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Réussite</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{progress.sessionCount}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Séances</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{formatDuration(progress.totalSeconds)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Temps travaillé</p>
            </div>
          </div>
          <Link href="/progress" className="mt-5 inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
            Voir le détail <ArrowRight size={12} />
          </Link>
        </Card>
      </section>

      {/* PROCHAINEMENT */}
      {upcoming.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Clock3 size={14} className="text-accent" />
            <p className="eyebrow">Prochainement</p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {upcoming.map((item) => {
              const meta = UPCOMING_META[item.key];
              const Icon = meta.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="focus-ring flex min-w-0 flex-col gap-2 rounded-xl border border-white/[0.06] p-3.5 text-sm transition hover:border-white/[0.14] hover:bg-white/[0.02]"
                >
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Icon size={12} /> {meta.label}
                  </span>
                  <p className="truncate font-medium text-zinc-100">{item.label}</p>
                  <p className="text-xs text-zinc-500">{item.detail}</p>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
