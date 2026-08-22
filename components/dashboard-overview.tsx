"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CalendarRange,
  Check,
  Clock3,
  Compass,
  Flag,
  Flame,
  GraduationCap,
  History as HistoryIcon,
  ListChecks,
  ListPlus,
  ListTodo,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { ResumeBanner } from "@/components/resume-banner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { WhyThisExercise } from "@/components/exercises/why-this-exercise";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { computeDailyObjectiveBreakdown } from "@/lib/daily-goals";
import { computeStreak } from "@/lib/gamification";
import { recentDaySummaries } from "@/lib/history";
import {
  computeChaptersToConsolidate,
  computeCommandCenterProgress,
  computeDailyObjective,
  computeNextAction,
  computeUpcoming,
} from "@/lib/next-action";
import {
  computeDailyPlan,
  computeSubjectPriorities,
  computeSubjectTrajectory,
  computeWeeklyProjection,
  CONTEST_URGENCY_HORIZON_DAYS,
  daysUntilContest,
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_STORAGE_KEY,
  serializePlan,
  type SubjectPriorityLevel,
  type SubjectTrajectoryStatus,
} from "@/lib/plan";
import { computePilotagePhrase } from "@/lib/pilotage";
import { computeProgressBySubject } from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META } from "@/lib/readiness";
import { estimatedDurationMinutes } from "@/lib/recommendation";
import { subjectMeta } from "@/lib/study";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { computeWeeklyDayBars, computeWeeklySummary, type WeeklyPace } from "@/lib/week";
import { removeFromQueue, usableQueueEntries } from "@/lib/work-queue";
import type { NextAction, UpcomingItem } from "@/lib/next-action";
import type { StoredPlan } from "@/lib/plan";

const UPCOMING_META: Record<UpcomingItem["key"], { label: string; icon: typeof BookOpenCheck }> = {
  chapter: { label: "Chapitre à consolider", icon: BookOpenCheck },
  subject: { label: "Matière délaissée", icon: CalendarClock },
  review: { label: "Révision due", icon: ListChecks },
};

/** Point de statut "Priorités de la semaine" — mêmes couleurs que `READINESS_DOT_CLASS` ci-dessous, un seul vocabulaire visuel pour tout niveau qualitatif du Dashboard. */
const PRIORITY_META: Record<SubjectPriorityLevel, { dot: string; label: string }> = {
  "critique": { dot: "bg-rose-400", label: "Critique" },
  "à surveiller": { dot: "bg-amber-400", label: "À surveiller" },
  "correct": { dot: "bg-emerald-400", label: "Correct" },
};

/** Couleur du point de statut "Prêt pour le DS ?" — dérivée de la même variante de badge que `READINESS_META` (lib/readiness.ts), jamais un second système de couleurs. */
const READINESS_DOT_CLASS: Record<"success" | "warning" | "default", string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  default: "bg-zinc-400",
};

/** Badge "rythme" de l'objectif hebdomadaire (lib/week.ts#computeWeeklyPace) — "à travailler" reste en `warning` (ambre), jamais `danger` : un rythme en retard n'est pas une erreur, voir la note dans lib/week.ts. */
const WEEKLY_PACE_BADGE: Record<WeeklyPace, "success" | "warning" | "accent"> = {
  "en avance": "success",
  "dans le rythme": "accent",
  "à travailler": "warning",
};

/**
 * Trajectoire par matière (Sprint trajectoire par matière) — même vocabulaire
 * visuel (points colorés) que `PRIORITY_META` ci-dessus, mais des libellés
 * distincts : c'est un signal différent ("suis-je dans les temps cette
 * semaine sur cette matière", pas "quel est le niveau de priorité global").
 * Explique la décision déjà prise par `subjectWeight`/`computeWeeklyProjection`
 * — n'en recalcule jamais aucune.
 */
const TRAJECTORY_META: Record<SubjectTrajectoryStatus, { dot: string; label: string }> = {
  "prioritaire": { dot: "bg-rose-400", label: "Prioritaire" },
  "à renforcer": { dot: "bg-amber-400", label: "À renforcer" },
  "dans le rythme": { dot: "bg-emerald-400", label: "Dans le rythme" },
};

/** Même formulation que l'ancienne annotation "← dans N j" (avant ce sprint) — désormais accolée au statut de trajectoire plutôt qu'aux minutes restantes, voir la carte "Cette semaine". */
function deadlineLabel(deadlineDays: number): string {
  if (deadlineDays === 0) return "aujourd'hui";
  if (deadlineDays === 1) return "demain";
  return `dans ${deadlineDays} j`;
}

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
  const { sessions, exercises, chapters, preferences, workQueue, saveWorkQueue, ready } = usePrepahubData();
  const router = useRouter();
  /** Durée choisie pour "Plan du jour" — état purement local à cette page, jamais persisté (voir Phase 3 du sprint : pas de système de calendrier). */
  const [planMinutes, setPlanMinutes] = useState<number>(DEFAULT_PLAN_MINUTES);

  const model = useMemo(() => {
    const now = new Date();
    // Sprint planification hebdomadaire adaptative — "sur ce qu'il reste
    // cette semaine, combien pour chaque matière ?". Réutilise le même
    // allocateur que le Plan du jour (voir lib/plan.ts), jamais un second
    // moteur : complémentaire de `weeklySummary` (qui regarde ce qui a été
    // fait), celui-ci regarde ce qu'il reste à faire.
    const weeklyProjection = computeWeeklyProjection(
      exercises,
      sessions,
      preferences.weeklyGoalMinutes,
      now,
      preferences.contestDate,
      preferences.subjectDeadlines
    );
    const weeklySummary = computeWeeklySummary(exercises, sessions, preferences.weeklyGoalMinutes, now);
    // Sprint trajectoire par matière — explique CE QUE `weeklyProjection`
    // a déjà décidé, ne recalcule aucun poids : consomme directement
    // `weeklyProjection.bySubject` (voir lib/plan.ts#computeSubjectTrajectory).
    const trajectoryBySubject = computeSubjectTrajectory(weeklyProjection.bySubject, now);
    return {
      nextAction: computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now),
      objective: computeDailyObjective(sessions, preferences.dailyGoalMinutes, now),
      // Sprint Study OS — "Aujourd'hui" : décompose l'objectif du jour par
      // matière et en nombre d'exercices, quand configuré (voir
      // lib/daily-goals.ts). N'affecte jamais `objective` ci-dessus, qui
      // reste l'unique source du total global.
      dailyObjectiveBreakdown: computeDailyObjectiveBreakdown(sessions, preferences.dailySubjectGoals, preferences.dailyExerciseGoal, now),
      upcoming: computeUpcoming(exercises, sessions, chapters, now),
      progress: computeCommandCenterProgress(exercises, sessions, now),
      bySubject: computeProgressBySubject(exercises),
      toConsolidate: computeChaptersToConsolidate(exercises, sessions, chapters, now),
      recentDays: recentDaySummaries(sessions, now, 5),
      readiness: computeReadinessBySubject(exercises, sessions, now),
      weeklySummary,
      weeklyProjection,
      trajectoryBySubject,
      // Sprint Study OS — vue "Lun → Dim" : répartition JOUR PAR JOUR d'un
      // temps déjà comptabilisé dans `weeklySummary` ci-dessus, aucun second
      // total (voir lib/week.ts#computeWeeklyDayBars).
      weeklyDayBars: computeWeeklyDayBars(sessions, preferences.dailyGoalMinutes, now),
      // Micro-sprint polish UX final — phrase de pilotage du Dashboard :
      // compose uniquement ces valeurs déjà calculées ci-dessus, voir
      // lib/pilotage.ts. Aucun nouveau signal, aucune nouvelle décision.
      pilotagePhrase: computePilotagePhrase({
        weeklyGoalMet: weeklyProjection.met,
        weeklyPace: weeklySummary.pace,
        workedMinutes: weeklyProjection.workedMinutes,
        trajectoryBySubject,
      }),
      subjectPriorities: computeSubjectPriorities(exercises, sessions, chapters, now, preferences.contestDate, preferences.subjectDeadlines),
      streak: computeStreak(sessions),
      // Même calcul que `lib/plan.ts#daysUntilContest`, réutilisé tel quel
      // plutôt que redupliqué ici — voir Sprint priorisation + sync + XP,
      // qui a introduit cette fonction précisément pour éviter deux formules
      // légèrement différentes du même "jours avant le concours".
      contestDays: daysUntilContest(preferences.contestDate, now),
    };
  }, [exercises, sessions, chapters, preferences]);

  // Séparé de `model` : ne dépend que du choix de durée, pas besoin de
  // recalculer tout le reste du Dashboard à chaque clic sur 30/45/60 min.
  const dailyPlan = useMemo(
    () => computeDailyPlan(exercises, sessions, chapters, planMinutes, new Date(), preferences.contestDate, preferences.subjectDeadlines),
    [exercises, sessions, chapters, planMinutes, preferences.contestDate, preferences.subjectDeadlines]
  );

  // Dépose le plan dans sessionStorage puis navigue vers /session, qui le lit
  // au montage et construit la séance avec exactement ces exercices, dans cet
  // ordre — voir components/session/session-runner.tsx et lib/plan.ts. Aucune
  // sélection n'est recalculée côté /session.
  const startPlan = useCallback(() => {
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan(dailyPlan)));
    router.push("/session");
  }, [dailyPlan, router]);

  // File de travail (Sprint Study OS — "Je choisis mon travail") : une
  // sélection manuelle, distincte du Plan du jour ci-dessus (automatique).
  // Résolue contre la banque actuelle à chaque rendu (voir
  // lib/work-queue.ts#usableQueueEntries) pour ne jamais afficher un exercice
  // supprimé ou archivé depuis son ajout.
  const queueEntries = useMemo(() => usableQueueEntries(workQueue, exercises), [workQueue, exercises]);
  const removeFromWorkQueue = useCallback((id: string) => saveWorkQueue(removeFromQueue(workQueue, id)), [workQueue, saveWorkQueue]);
  // Même transport que `startPlan` (PLAN_STORAGE_KEY/StoredPlan) : /session ne
  // fait aucune différence entre un plan automatique et une file choisie à la
  // main, le Focus reste l'unique moteur d'exécution. La file est vidée au
  // moment du départ — son rôle s'arrête là, comme le Plan du jour, jamais un
  // second état persistant à faire vivre en parallèle de la séance.
  const startQueue = useCallback(() => {
    const stored: StoredPlan = {
      items: queueEntries.map(({ exercise }) => ({ exerciseId: exercise.id, reasons: ["Ajouté à ta file de travail"] })),
      requestedMinutes: queueEntries.reduce((total, { exercise }) => total + estimatedDurationMinutes(exercise, sessions), 0),
    };
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stored));
    saveWorkQueue([]);
    router.push("/session");
  }, [queueEntries, sessions, saveWorkQueue, router]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const {
    nextAction,
    objective,
    dailyObjectiveBreakdown,
    upcoming,
    progress,
    bySubject,
    toConsolidate,
    recentDays,
    readiness,
    weeklySummary,
    weeklyProjection,
    trajectoryBySubject,
    weeklyDayBars,
    pilotagePhrase,
    subjectPriorities,
    streak,
    contestDays,
  } = model;

  // "Ma prochaine action" (Sprint Study OS) — un travail explicitement
  // planifié par l'utilisateur (la file de travail) prime sur la
  // recommandation automatique de `computeNextAction` : la reprise d'une
  // séance interrompue reste gérée séparément par ResumeBanner, affichée
  // au-dessus de ce bloc — c'est donc bien ici le second échelon de la
  // priorité demandée (interrompu > planifié > à revoir/prioritaire >
  // recommandation, ces deux derniers déjà couverts par le tri de
  // `recommendExercises` à l'intérieur de `computeNextAction`).
  // Aucune nouvelle règle de sélection : reprend tels quels les exercices
  // déjà choisis par l'utilisateur, juste mis en forme comme `NextAction`.
  const effectiveNextAction: NextAction =
    queueEntries.length > 0
      ? {
          kind: "start-session",
          title: queueEntries[0].exercise.title,
          description: `Ajouté à ta file de travail — 1 sur ${queueEntries.length}.`,
          ctaLabel: queueEntries.length > 1 ? `Commencer ta file (${queueEntries.length} exercices)` : "Commencer",
          href: "/session",
          minutes: queueEntries.reduce((total, { exercise }) => total + estimatedDurationMinutes(exercise, sessions), 0),
          picks: queueEntries.slice(0, 3).map(({ exercise }) => ({ exercise, score: 0, reasons: ["Ajouté à ta file de travail"] })),
        }
      : nextAction;
  const sessionHref = effectiveNextAction.kind === "start-session" ? `/session?minutes=${effectiveNextAction.minutes}` : effectiveNextAction.href;
  const secondaryPicks = effectiveNextAction.picks.slice(1);
  // "Revoir mes priorités" (Phase 8) : ouvre directement le premier exercice déjà signalé par le moteur de recommandation — même convention que computeUpcoming (lib/next-action.ts), aucune nouvelle route.
  const prioritiesHref = nextAction.picks[0] ? `/exercises?focus=${nextAction.picks[0].exercise.id}` : "/exercises";
  // "Prochainement" ne montre plus le chapitre le plus faible : la section "À consolider" ci-dessous couvre ce signal en mieux (plusieurs chapitres, raisons explicites) — computeUpcoming lui-même reste inchangé (voir lib/next-action.test.ts).
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");
  // "Cette semaine" (Sprint planification hebdomadaire adaptative) : la
  // matière en tête de la projection (déjà triée par minutes décroissantes,
  // voir computeWeeklyProjection) devient le CTA "Commencer" — jamais une
  // nouvelle décision de recommandation, juste une navigation vers /session
  // avec la matière déjà la plus prioritaire pour le reste de la semaine
  // (même mécanisme que `computeUpcoming`/`neglectedSubjects` ailleurs sur
  // cette page : `?subject=` pré-rempli, recommendExercises décide le reste).
  const topWeeklySubject = weeklyProjection.bySubject[0];

  return (
    <div className="space-y-6">
      {/* Priorité absolue (Sprint poste de pilotage) : reprendre un travail
          déjà commencé passe avant toute nouvelle recommandation ou rappel. */}
      <ResumeBanner />
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
            <Sparkles size={16} className="text-accent-text" />
            <p className="eyebrow">À faire maintenant</p>
            {contestDays !== null && (
              <Badge variant="accent" className="ml-auto flex items-center gap-1">
                <Trophy size={11} /> {contestDays} j avant le concours
              </Badge>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{effectiveNextAction.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{effectiveNextAction.description}</p>

          {/* Phrase de pilotage (Micro-sprint polish UX final) — contexte
              hebdomadaire ("où j'en suis, pourquoi"), distinct du "quoi faire
              maintenant" ci-dessus. `null` : rien d'assez significatif à dire
              (voir lib/pilotage.ts), aucun bloc affiché plutôt qu'une phrase
              creuse. */}
          {pilotagePhrase && (
            <p className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-accent/15 bg-accent/[0.05] px-3.5 py-2.5 text-sm leading-6 text-zinc-300">
              <Compass size={14} className="mt-0.5 shrink-0 text-accent-text" />
              <span>{pilotagePhrase}</span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {queueEntries.length > 0 ? (
              <Button size="lg" onClick={startQueue}>
                {effectiveNextAction.ctaLabel} <ArrowRight size={16} />
              </Button>
            ) : (
              <Link href={sessionHref}>
                <Button size="lg">
                  {effectiveNextAction.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            )}
            {nextAction.kind !== "start-session" && queueEntries.length === 0 && (
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
                  className="focus-ring flex min-w-0 items-center gap-3 rounded-xl border border-hairline/[0.06] p-3 text-sm transition hover:border-hairline/[0.14] hover:bg-hairline/[0.02]"
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

      {/* PLAN DU JOUR */}
      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTodo size={14} className="text-accent-text" />
            <div>
              <p className="eyebrow">Plan du jour</p>
              <CardTitle className="mt-1 text-lg">Ce que tu devrais travailler aujourd&apos;hui</CardTitle>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-hairline/[0.09] bg-black/20 p-1">
            {PLAN_DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPlanMinutes(preset)}
                aria-pressed={planMinutes === preset}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  planMinutes === preset ? "bg-accent text-accent-foreground" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>

        {dailyPlan.blocks.length === 0 ? (
          <p className="mt-5 text-sm text-zinc-500">
            {nextAction.kind === "empty-bank" ? "Ajoute des exercices pour que TaekdHub puisse te construire un plan." : "Rien à planifier pour l'instant — ta banque est à jour."}
          </p>
        ) : (
          <>
            <ol className="mt-5 space-y-2.5">
              {dailyPlan.blocks.map((block, index) => (
                <li key={block.subject} className="flex items-start gap-3 rounded-xl border border-hairline/[0.06] p-3.5 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent-text">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="truncate font-medium text-zinc-100">{block.label}</p>
                      <span className="shrink-0 text-xs text-zinc-500">{block.estimatedMinutes} min</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{block.pickLabel}</p>
                    <WhyThisExercise reasons={block.picks[0]?.reasons} className="mt-1.5" />
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/[0.06] pt-5">
              <p className="text-sm text-zinc-400">
                Total : <span className="font-semibold text-zinc-100">{formatMinutes(dailyPlan.totalMinutes)}</span> · {dailyPlan.totalExercises} exercice
                {dailyPlan.totalExercises > 1 ? "s" : ""}
              </p>
              <Button onClick={startPlan}>
                Commencer le plan <ArrowRight size={16} />
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* FILE DE TRAVAIL — sélection manuelle (voir "Ajouter à la file de travail" sur chaque exercice), distincte du Plan du jour ci-dessus. Masquée quand vide : pas de carte à faire disparaître par défaut, rien à décider tant que rien n'a été choisi. */}
      {queueEntries.length > 0 && (
        <Card className="p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <ListPlus size={14} className="text-accent-text" />
            <div>
              <p className="eyebrow">File de travail</p>
              <CardTitle className="mt-1 text-lg">Ta sélection, dans l&apos;ordre</CardTitle>
            </div>
          </div>
          <ol className="mt-5 space-y-2.5">
            {queueEntries.map(({ exercise }, index) => (
              <li key={exercise.id} className="flex items-center gap-3 rounded-xl border border-hairline/[0.06] p-3.5 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent-text">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-100">{exercise.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{exercise.subject}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFromWorkQueue(exercise.id)} aria-label="Retirer de la file" className="h-8 w-8 shrink-0">
                  <X size={15} />
                </Button>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/[0.06] pt-5">
            <p className="text-sm text-zinc-400">
              {queueEntries.length} exercice{queueEntries.length > 1 ? "s" : ""} choisi{queueEntries.length > 1 ? "s" : ""}
            </p>
            <Button onClick={startQueue}>
              Commencer <ArrowRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* PRIORITÉS DE LA SEMAINE — "pourquoi" : juste après le plan, avant les chiffres d'état ("où j'en suis" ci-dessous), pour rester dans l'ordre de lecture quoi → pourquoi → où j'en suis → comment (voir la doc du composant). */}
      {subjectPriorities.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Flag size={14} className="text-accent-text" />
            <p className="eyebrow">Priorités de la semaine</p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {subjectPriorities.map(({ subject, label, level, reason }) => {
              const meta = PRIORITY_META[level];
              return (
                <div key={subject} className="flex items-center justify-between gap-3 rounded-xl border border-hairline/[0.06] px-3.5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-zinc-100">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    {label}
                  </span>
                  <span className="text-right text-xs text-zinc-500">{reason}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* À CONSOLIDER — même logique "pourquoi", au niveau du chapitre. */}
      {chapters.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-accent-text" />
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
                  className="focus-ring flex flex-col gap-2.5 rounded-xl border border-hairline/[0.06] p-3.5 text-sm transition hover:border-hairline/[0.14] hover:bg-hairline/[0.02]"
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
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent-text">
                    Travailler ce chapitre <ArrowRight size={11} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* OBJECTIF DU JOUR + TA PROGRESSION — "où j'en suis" à partir d'ici. */}
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
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-text">{objective.percent}%</span>
          </div>
          <ProgressBar value={objective.percent} className="mt-5" />
          <p className="mt-3 text-xs text-zinc-500">
            {objective.met
              ? "Objectif atteint."
              : objective.workedMinutes === 0
                ? "Tu n'as encore rien travaillé aujourd'hui."
                : `Encore ${objective.remainingMinutes} min`}
            {streak > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-accent-text">
                <Flame size={11} className="inline" /> {streak} j de suite
              </span>
            )}
          </p>

          {/* Détail de l'objectif du jour (Sprint Study OS — Aujourd'hui) —
              rien n'apparaît tant que rien n'est configuré dans Réglages
              (voir lib/daily-goals.ts) : ni exercices, ni matière forcée à
              l'affichage. */}
          {(dailyObjectiveBreakdown.exercises || dailyObjectiveBreakdown.bySubject.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-hairline/[0.07] pt-4">
              {dailyObjectiveBreakdown.exercises && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Exercices</span>
                  <span className={cn("font-medium", dailyObjectiveBreakdown.exercises.met ? "text-emerald-300" : "text-zinc-300")}>
                    {dailyObjectiveBreakdown.exercises.worked} / {dailyObjectiveBreakdown.exercises.goal}
                  </span>
                </div>
              )}
              {dailyObjectiveBreakdown.bySubject.map((entry) => (
                <div key={entry.subject} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <SubjectAvatar subject={entry.subject} size="sm" /> {entry.subject}
                  </span>
                  <span className={cn("font-medium", entry.met ? "text-emerald-300" : "text-zinc-300")}>
                    {entry.workedMinutes} / {entry.goalMinutes} min
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {objective.workedMinutes === 0 && !objective.met ? (
              <Link href={`/session?minutes=${objective.goalMinutes > 0 ? Math.min(objective.goalMinutes, 60) : 45}`}>
                <Button size="sm">
                  Commencer une session <ArrowRight size={13} />
                </Button>
              </Link>
            ) : (
              PLAN_DURATION_PRESETS.map((preset) => (
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
            <Target size={16} className="text-accent-text" />
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
          <Link href="/progress" className="mt-5 inline-flex items-center gap-1.5 text-xs text-accent-text hover:underline">
            Voir le détail <ArrowRight size={12} />
          </Link>
        </Card>
      </section>

      {/* CETTE SEMAINE */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange size={14} className="text-accent-text" />
            <div>
              <p className="eyebrow">Cette semaine</p>
              <CardTitle className="mt-1 text-lg">
                {formatDuration(weeklySummary.totalSeconds)}{" "}
                <span className="text-sm font-normal text-zinc-500">/ {formatDuration(weeklySummary.objectiveSeconds)}</span>
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {weeklySummary.pace && <Badge variant={WEEKLY_PACE_BADGE[weeklySummary.pace]}>{weeklySummary.pace}</Badge>}
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-text">{weeklySummary.progressPercent}%</span>
          </div>
        </div>
        <ProgressBar value={weeklySummary.progressPercent} className="mt-5" />

        {/* Vue "Lun → Dim" (Sprint Study OS) — répartition JOUR PAR JOUR d'un
            temps déjà compté ci-dessus (voir lib/week.ts#computeWeeklyDayBars),
            aucun second total. ✓ objectif quotidien atteint ce jour-là, ⚠
            sinon — un jour futur ne reçoit jamais de jugement (rien à
            afficher). Complémentaire de la répartition par matière ci-dessous
            (celle-ci répond "sur quoi", celle-là répond "quand"). */}
        <div className="mt-5 flex items-end justify-between gap-1.5 border-t border-hairline/[0.06] pt-5">
          {weeklyDayBars.map((day) => {
            const heightPercent =
              preferences.dailyGoalMinutes > 0
                ? Math.min(100, Math.round((day.minutes / preferences.dailyGoalMinutes) * 100))
                : day.minutes > 0
                  ? 100
                  : 0;
            return (
              <div key={day.dayKey} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-14 w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-2.5 rounded-full transition-all",
                      day.isFuture ? "bg-hairline/[0.12]" : day.met ? "bg-emerald-400" : day.minutes > 0 ? "bg-amber-400" : "bg-hairline/[0.15]"
                    )}
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                  />
                </div>
                <span className="grid h-[13px] place-items-center">
                  {!day.isFuture && (day.met ? <Check size={11} className="text-emerald-400" /> : <AlertTriangle size={11} className="text-amber-400" />)}
                </span>
                <span className={cn("text-2xs", day.isToday ? "font-semibold text-zinc-200" : "text-zinc-500")}>{day.label}</span>
              </div>
            );
          })}
        </div>

        {/* Reste de la semaine par matière (Sprint planification hebdomadaire
            adaptative) — combien reste à consacrer à chaque matière, voir
            computeWeeklyProjection. Objectif atteint : pas de répartition à
            afficher, juste un état positif (jamais "0 min restantes" ni de
            ton culpabilisant).
            Sprint trajectoire par matière : chaque ligne reçoit en plus une
            lecture explicite de sa trajectoire (`trajectoryBySubject`, voir
            lib/plan.ts#computeSubjectTrajectory) — explique la décision déjà
            prise par `subjectWeight`, n'en recalcule aucune. L'échéance
            (auparavant "← dans N j" à côté des minutes) est désormais
            rattachée à cette ligne d'explication plutôt qu'aux minutes, pour
            que "quoi" (le temps restant) et "pourquoi" (le statut) restent
            lisibles séparément. */}
        {weeklyProjection.met ? (
          <p className="mt-5 text-sm text-emerald-300">Objectif de la semaine atteint. Bien joué.</p>
        ) : (
          weeklyProjection.bySubject.length > 0 && (
            <>
              <div className="mt-5 space-y-3">
                {weeklyProjection.bySubject.map(({ subject, minutes, deadlineDays }) => {
                  const trajectory = trajectoryBySubject.find((entry) => entry.subject === subject);
                  const trajectoryMeta = trajectory ? TRAJECTORY_META[trajectory.status] : null;
                  // Même horizon que contestUrgencyBonus (voir CONTEST_URGENCY_HORIZON_DAYS) : une échéance trop lointaine pour influencer réellement le poids n'a rien d'actionnable à signaler ici non plus.
                  const showDeadline = deadlineDays !== null && deadlineDays <= CONTEST_URGENCY_HORIZON_DAYS;
                  return (
                    <div key={subject} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-zinc-300">{subject}</p>
                        {trajectoryMeta && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-zinc-500">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", trajectoryMeta.dot)} />
                            {trajectoryMeta.label}
                            {showDeadline && ` · échéance ${deadlineLabel(deadlineDays)}`}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-zinc-500">{formatMinutes(minutes)}</span>
                    </div>
                  );
                })}
              </div>
              {topWeeklySubject && (
                <Link href={`/session?subject=${encodeURIComponent(topWeeklySubject.subject)}`} className="mt-5 inline-block">
                  <Button size="sm">
                    Commencer <ArrowRight size={13} />
                  </Button>
                </Link>
              )}
            </>
          )
        )}
      </Card>

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
                <BarChart3 size={16} className="text-accent-text" />
              </div>
              <div className="mt-6 space-y-4">
                {bySubject.map(({ subject, completionRate }) => (
                  <Link
                    key={subject}
                    href={`/progress#subject-${subjectMeta[subject].short}`}
                    className="focus-ring -mx-2 block rounded-lg px-2 py-1 transition hover:bg-hairline/[0.02]"
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
                <GraduationCap size={16} className="text-accent-text" />
              </div>
              <div className="mt-6 space-y-2.5">
                {readiness.map(({ subject, level }) => {
                  const meta = READINESS_META[level];
                  return (
                    <Link
                      key={subject}
                      href="/progress"
                      className="focus-ring flex items-center justify-between gap-2 rounded-xl border border-hairline/[0.06] px-3.5 py-2.5 text-sm transition hover:border-hairline/[0.14] hover:bg-hairline/[0.02]"
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

      {/* ACTIVITÉ RÉCENTE */}
      {recentDays.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <HistoryIcon size={14} className="text-accent-text" />
            <p className="eyebrow">Activité récente</p>
          </div>
          <div className="mt-4 divide-y divide-hairline/[0.06]">
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
            <Clock3 size={14} className="text-accent-text" />
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
                  className="focus-ring flex min-w-0 flex-col gap-2 rounded-xl border border-hairline/[0.06] p-3.5 text-sm transition hover:border-hairline/[0.14] hover:bg-hairline/[0.02]"
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
