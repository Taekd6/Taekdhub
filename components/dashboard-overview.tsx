"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  Clock3,
  Flame,
  GraduationCap,
  History as HistoryIcon,
  ListChecks,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import { recentDaySummaries } from "@/lib/history";
import {
  computeChaptersToConsolidate,
  computeCommandCenterProgress,
  computeDailyObjective,
  computeNextAction,
  computeUpcoming,
} from "@/lib/next-action";
import { computeProgressBySubject } from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META } from "@/lib/readiness";
import { subjectMeta } from "@/lib/study";
import { formatDuration } from "@/lib/utils";
import type { UpcomingItem } from "@/lib/next-action";

/** Préréglages de temps disponible pour les démarrages rapides — mêmes valeurs partout sur le Dashboard (objectif du jour ET raccourcis), pour rester cohérent avec l'aperçu de séance (components/session/session-runner.tsx#BUDGET_PRESETS). */
const QUICK_SESSION_PRESETS = [30, 45, 60];

const UPCOMING_META: Record<UpcomingItem["key"], { label: string; icon: typeof BookOpenCheck }> = {
  chapter: { label: "Chapitre à consolider", icon: BookOpenCheck },
  subject: { label: "Matière délaissée", icon: CalendarClock },
  review: { label: "Révision due", icon: ListChecks },
};

/** Couleur du point de statut "Prêt pour le DS ?" — dérivée de la même variante de badge que `READINESS_META` (lib/readiness.ts), jamais un second système de couleurs. */
const READINESS_DOT_CLASS: Record<"success" | "warning" | "default", string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  default: "bg-zinc-400",
};

/**
 * Centre de pilotage (Sprint Study OS) — le véritable point d'entrée de
 * TaekdHub : "où j'en suis, quoi faire maintenant, pourquoi, combien de
 * temps, ce que j'ai fait récemment, ce qui mérite attention". Chaque bloc
 * reste une simple vue sur des moteurs déjà existants (lib/recommendation.ts,
 * lib/progress.ts, lib/readiness.ts, lib/history.ts, lib/week.ts, composés
 * par lib/next-action.ts) — aucune nouvelle règle métier n'est introduite
 * dans ce composant, uniquement de la présentation et de la navigation.
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
      bySubject: computeProgressBySubject(exercises).filter((entry) => entry.total > 0),
      toConsolidate: computeChaptersToConsolidate(exercises, sessions, chapters, now),
      recentDays: recentDaySummaries(sessions, now, 5),
      readiness: computeReadinessBySubject(exercises, sessions, now),
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

  const { nextAction, objective, upcoming, progress, bySubject, toConsolidate, recentDays, readiness, streak, contestDays } = model;
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);
  // "Revoir mes priorités" (Phase 8) : ouvre directement le premier exercice déjà signalé par le moteur de recommandation — même convention que computeUpcoming (lib/next-action.ts), aucune nouvelle route.
  const prioritiesHref = nextAction.picks[0] ? `/exercises?focus=${nextAction.picks[0].exercise.id}` : "/exercises";
  // "Prochainement" ne montre plus le chapitre le plus faible : la section "À consolider" ci-dessous couvre ce signal en mieux (plusieurs chapitres, raisons explicites) — computeUpcoming lui-même reste inchangé (voir lib/next-action.test.ts).
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");

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

      {/* RACCOURCIS D'ACTION */}
      <section className="flex flex-wrap gap-2.5">
        <Link href="/session?minutes=30">
          <Button variant="secondary" size="sm">
            Commencer 30 min
          </Button>
        </Link>
        <Link href="/session?minutes=45">
          <Button variant="secondary" size="sm">
            Commencer 45 min
          </Button>
        </Link>
        <Link href={prioritiesHref}>
          <Button variant="secondary" size="sm">
            Revoir mes priorités
          </Button>
        </Link>
        <Link href="/progress">
          <Button variant="secondary" size="sm">
            Voir ma progression
          </Button>
        </Link>
      </section>

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
              : objective.workedMinutes === 0
                ? "Tu n'as encore rien travaillé aujourd'hui."
                : `Encore ${objective.remainingMinutes} min`}
            {streak > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-accent">
                <Flame size={11} className="inline" /> {streak} j de suite
              </span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {objective.workedMinutes === 0 && !objective.met ? (
              <Link href={`/session?minutes=${objective.goalMinutes > 0 ? Math.min(objective.goalMinutes, 60) : 45}`}>
                <Button size="sm">
                  Commencer une session <ArrowRight size={13} />
                </Button>
              </Link>
            ) : (
              QUICK_SESSION_PRESETS.map((preset) => (
                <Link key={preset} href={`/session?minutes=${preset}`}>
                  <Button variant="secondary" size="sm">
                    {preset} min
                  </Button>
                </Link>
              ))
            )}
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

      {/* PROGRESSION PAR MATIÈRE + PRÉPARATION */}
      {(bySubject.length > 0 || readiness.length > 0) && (
        <section className="grid gap-5 xl:grid-cols-2">
          {bySubject.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Tes matières</p>
                  <CardTitle className="mt-2">Progression</CardTitle>
                </div>
                <BarChart3 size={16} className="text-accent" />
              </div>
              <div className="mt-6 space-y-4">
                {bySubject.map(({ subject, completionRate }) => (
                  <Link
                    key={subject}
                    href={`/progress#subject-${subjectMeta[subject].short}`}
                    className="focus-ring -mx-2 block rounded-lg px-2 py-1 transition hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-zinc-200">
                        <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                          {subjectMeta[subject].short}
                        </span>
                        {subject}
                      </span>
                      <span className="text-zinc-500">{completionRate}%</span>
                    </div>
                    <ProgressBar value={completionRate} animated={false} className="mt-2 h-2" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {readiness.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Échéances</p>
                  <CardTitle className="mt-2">Prêt pour le DS ?</CardTitle>
                </div>
                <GraduationCap size={16} className="text-accent" />
              </div>
              <div className="mt-6 space-y-2.5">
                {readiness.map(({ subject, level }) => {
                  const meta = READINESS_META[level];
                  return (
                    <Link
                      key={subject}
                      href="/progress"
                      className="focus-ring flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] px-3.5 py-2.5 text-sm transition hover:border-white/[0.14] hover:bg-white/[0.02]"
                    >
                      <span className="font-medium text-zinc-100">{subject}</span>
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${READINESS_DOT_CLASS[meta.badge]}`} />
                        {meta.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-4 text-2xs text-zinc-500">À partir de ce que le moteur de recommandation signale déjà — détail sur la page Progression.</p>
            </Card>
          )}
        </section>
      )}

      {/* À CONSOLIDER */}
      {chapters.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-accent" />
            <p className="eyebrow">À consolider</p>
          </div>
          <CardTitle className="mt-2">
            {toConsolidate.length > 0 ? "Ces chapitres méritent ton attention" : "Rien à consolider pour l'instant"}
          </CardTitle>

          {toConsolidate.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Tous les chapitres actifs sont sous contrôle. Continue comme ça.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {toConsolidate.map(({ chapter, averageMastery, reasons, href }) => (
                <Link
                  key={chapter.id}
                  href={href}
                  className="focus-ring flex flex-col gap-2.5 rounded-xl border border-white/[0.06] p-3.5 text-sm transition hover:border-white/[0.14] hover:bg-white/[0.02]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-zinc-100">{chapter.label}</p>
                    <span className="whitespace-nowrap text-xs text-zinc-500">{averageMastery}%</span>
                  </div>
                  <p className="-mt-1.5 text-2xs text-zinc-500">{chapter.subject}</p>
                  <div className="flex flex-wrap gap-1">
                    {reasons.map((reason) => (
                      <Badge key={reason} variant="warning">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent">
                    Travailler ce chapitre <ArrowRight size={11} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ACTIVITÉ RÉCENTE */}
      {recentDays.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <HistoryIcon size={14} className="text-accent" />
            <p className="eyebrow">Activité récente</p>
          </div>
          <div className="mt-4 divide-y divide-white/[0.06]">
            {recentDays.map((day) => (
              <div key={day.dateKey} className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="text-zinc-300">{day.label}</span>
                <span className="text-zinc-500">
                  {formatDuration(day.seconds)} · {day.sessionCount} exercice{day.sessionCount > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PROCHAINEMENT */}
      {otherSignals.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Clock3 size={14} className="text-accent" />
            <p className="eyebrow">Prochainement</p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {otherSignals.map((item) => {
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
