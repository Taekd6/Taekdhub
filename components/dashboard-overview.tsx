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
  Clock3,
  Flag,
  Flame,
  GraduationCap,
  History as HistoryIcon,
  ListChecks,
  ListTodo,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { FOCUS_TIMER_PREFIX, findPersistedSessionSuffix } from "@/hooks/use-work-timer";
import { cn } from "@/lib/cn";
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
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_STORAGE_KEY,
  serializePlan,
  type StoredPlan,
  type SubjectPriorityLevel,
} from "@/lib/plan";
import { computeProgressBySubject } from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META } from "@/lib/readiness";
import { subjectMeta } from "@/lib/study";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import type { UpcomingItem } from "@/lib/next-action";
import type { Exercise } from "@/lib/supabase/types";

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
  const router = useRouter();
  /** Durée choisie pour "Plan du jour" — état purement local à cette page, jamais persisté (voir Phase 3 du sprint : pas de système de calendrier). */
  const [planMinutes, setPlanMinutes] = useState<number>(DEFAULT_PLAN_MINUTES);
  /**
   * Plan interrompu (Sprint Adaptive Day) — présent si une séance de plan a
   * été quittée avant la fin (voir components/session/session-runner.tsx,
   * qui réécrit `PLAN_STORAGE_KEY` sans les exercices déjà travaillés à
   * chaque étape). Lu une seule fois au montage : sessionStorage n'est pas
   * une source réactive, un `focus`/`visibilitychange` suffit à la
   * réévaluer si besoin, mais un simple retour sur le Dashboard suffit déjà
   * dans l'usage réel (navigation complète depuis /session).
   *
   * Le nombre affiché est filtré contre `exercises` (même filtre que
   * SessionRunner au moment de la reprise : id existant et non archivé) —
   * sans ça, un exercice supprimé/archivé depuis /exercises (ou un autre
   * onglet) entre le dépôt du plan et ce retour sur le Dashboard laissait ce
   * bandeau annoncer un nombre d'exercices restants supérieur à ce que
   * "Reprendre" relance réellement (SessionRunner filtre déjà ces mêmes
   * exercices disparus, silencieusement, à l'ouverture de /session). On
   * attend `ready` avant de filtrer : tant que `exercises` n'est pas encore
   * chargé (valeur initiale `[]`), le filtrer donnerait à tort zéro exercice
   * valide et effacerait un plan pourtant légitime.
   */
  const [interruptedPlan, setInterruptedPlan] = useState<StoredPlan | null>(null);
  useEffect(() => {
    if (!ready) return;
    const raw = sessionStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as StoredPlan;
      const validItems = stored.items.filter((item) => exercises.some((exercise) => exercise.id === item.exerciseId && !exercise.archived));
      if (validItems.length > 0) setInterruptedPlan({ ...stored, items: validItems });
      else sessionStorage.removeItem(PLAN_STORAGE_KEY);
    } catch {
      sessionStorage.removeItem(PLAN_STORAGE_KEY);
    }
  }, [ready, exercises]);

  const discardInterruptedPlan = useCallback(() => {
    sessionStorage.removeItem(PLAN_STORAGE_KEY);
    setInterruptedPlan(null);
  }, []);

  /**
   * Séance focus interrompue HORS plan (bug réel trouvé à l'audit) : quand
   * l'utilisateur quitte un focus en cours autrement que par Échap/le bouton
   * fermer (fermeture d'onglet, navigation directe…), `useWorkTimer` laisse
   * la clé `prepahub:timer:focus:<id>` en sessionStorage — et
   * SessionRunner la reprend TOUJOURS en priorité au montage suivant de
   * /session, quel que soit le lien cliqué pour y arriver (voir son effet de
   * montage). Sans détection ici, le Dashboard n'en dit rien : le Hero
   * continue de promettre "Commencer une séance de N min" sur un tout autre
   * exercice (le mieux classé du moment), alors que cliquer ce CTA rouvre en
   * réalité silencieusement l'exercice abandonné — un lien qui ne démarre
   * pas ce qu'il annonce. N'est évalué que si aucun plan interrompu n'est
   * déjà affiché ci-dessus (même mécanisme sous-jacent : si l'interruption
   * a eu lieu PENDANT un exercice du plan, ce dernier référence déjà cet
   * exercice, et son propre "Reprendre" mène déjà correctement au bon
   * endroit) — remis à `null` explicitement dans ce cas (pas un simple
   * `return` anticipé) : les deux effets de ce composant lisent le même
   * `interruptedPlan` figé au moment du rendu qui les a déclenchés, donc au
   * tout premier passage après `ready` (le cas le plus fréquent : une
   * interruption EN PLEIN exercice du plan laisse les deux clés en même
   * temps), celui-ci peut encore valoir `null` ici alors qu'il vient
   * justement d'être posé par l'autre effet — sans ce reset explicite, les
   * deux bandeaux s'affichaient ensemble jusqu'à la prochaine navigation.
   */
  const [interruptedFocus, setInterruptedFocus] = useState<Exercise | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (interruptedPlan) {
      setInterruptedFocus(null);
      return;
    }
    const pendingId = findPersistedSessionSuffix(FOCUS_TIMER_PREFIX);
    if (!pendingId) {
      setInterruptedFocus(null);
      return;
    }
    const exercise = exercises.find((item) => item.id === pendingId && !item.archived);
    setInterruptedFocus(exercise ?? null);
  }, [ready, exercises, interruptedPlan]);

  const discardInterruptedFocus = useCallback(() => {
    if (interruptedFocus) sessionStorage.removeItem(FOCUS_TIMER_PREFIX + interruptedFocus.id);
    setInterruptedFocus(null);
  }, [interruptedFocus]);

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
      weeklySummary: computeWeeklySummary(exercises, sessions, preferences.weeklyGoalMinutes, now),
      subjectPriorities: computeSubjectPriorities(exercises, sessions, chapters, now),
      streak: computeStreak(sessions),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
    };
  }, [exercises, sessions, chapters, preferences]);

  // Séparé de `model` : ne dépend que du choix de durée, pas besoin de
  // recalculer tout le reste du Dashboard à chaque clic sur 30/45/60 min.
  const dailyPlan = useMemo(
    () => computeDailyPlan(exercises, sessions, chapters, planMinutes, new Date()),
    [exercises, sessions, chapters, planMinutes]
  );

  // Dépose le plan dans sessionStorage puis navigue vers /session, qui le lit
  // au montage et construit la séance avec exactement ces exercices, dans cet
  // ordre — voir components/session/session-runner.tsx et lib/plan.ts. Aucune
  // sélection n'est recalculée côté /session.
  const startPlan = useCallback(() => {
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan(dailyPlan)));
    router.push("/session");
  }, [dailyPlan, router]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const { nextAction, objective, upcoming, progress, bySubject, toConsolidate, recentDays, readiness, weeklySummary, subjectPriorities, streak, contestDays } = model;
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);
  // "Revoir mes priorités" (Phase 8) : ouvre directement le premier exercice déjà signalé par le moteur de recommandation — même convention que computeUpcoming (lib/next-action.ts), aucune nouvelle route.
  const prioritiesHref = nextAction.picks[0] ? `/exercises?focus=${nextAction.picks[0].exercise.id}` : "/exercises";
  // "Prochainement" ne montre plus le chapitre le plus faible : la section "À consolider" ci-dessous couvre ce signal en mieux (plusieurs chapitres, raisons explicites) — computeUpcoming lui-même reste inchangé (voir lib/next-action.test.ts).
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");

  return (
    <div className="space-y-6">
      <BackupReminder />

      {/* PLAN INTERROMPU — Adaptive Day : reprise avant tout le reste, "où j'en étais" prime sur "quoi de neuf". */}
      {interruptedPlan && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/20 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <CalendarClock size={16} />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Plan interrompu — {interruptedPlan.items.length} exercice{interruptedPlan.items.length > 1 ? "s" : ""} restant
                {interruptedPlan.items.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-zinc-500">Reprends exactement là où tu t&apos;es arrêté, ou repars sur un plan frais.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/session">
              <Button size="sm">
                Reprendre <ArrowRight size={13} />
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={discardInterruptedPlan}>
              Recommencer à zéro
            </Button>
          </div>
        </Card>
      )}

      {/* FOCUS INTERROMPU — hors plan (bug d'audit corrigé) : sans ce bandeau, le Hero ci-dessous continue de promettre un tout autre exercice alors que son propre CTA rouvrirait en réalité celui-ci (SessionRunner reprend toujours un focus persisté en priorité). */}
      {interruptedFocus && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/20 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Clock3 size={16} />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-100">Séance focus interrompue — {interruptedFocus.title}</p>
              <p className="text-xs text-zinc-500">Ton chrono tourne encore sur cet exercice — reprends-le, ou repars sur autre chose.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/session">
              <Button size="sm">
                Reprendre <ArrowRight size={13} />
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={discardInterruptedFocus}>
              Abandonner cette séance
            </Button>
          </div>
        </Card>
      )}

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
            <ListTodo size={14} className="text-accent" />
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
                  planMinutes === preset ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300"
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
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="truncate font-medium text-zinc-100">{block.label}</p>
                      <span className="shrink-0 text-xs text-zinc-500">{block.estimatedMinutes} min</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{block.pickLabel}</p>
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

      {/* PRIORITÉS DE LA SEMAINE — "pourquoi" : juste après le plan, avant les chiffres d'état ("où j'en suis" ci-dessous), pour rester dans l'ordre de lecture quoi → pourquoi → où j'en suis → comment (voir la doc du composant). */}
      {subjectPriorities.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Flag size={14} className="text-accent" />
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
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent">
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
                {formatDuration(objective.workedSeconds)}{" "}
                <span className="text-base font-normal text-zinc-500">/ {formatDuration(objective.goalMinutes * 60)}</span>
              </CardTitle>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{objective.percent}%</span>
          </div>
          <ProgressBar value={objective.percent} className="mt-5" />
          <p className="mt-3 text-xs text-zinc-500">
            {objective.met
              ? "Objectif atteint."
              : objective.workedSeconds === 0
                ? "Tu n'as encore rien travaillé aujourd'hui."
                : `Encore ${objective.remainingMinutes} min`}
            {streak > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-accent">
                <Flame size={11} className="inline" /> {streak} j de suite
              </span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {objective.workedSeconds === 0 && !objective.met ? (
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

      {/* CETTE SEMAINE */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange size={14} className="text-accent" />
            <div>
              <p className="eyebrow">Cette semaine</p>
              <CardTitle className="mt-1 text-lg">
                {formatDuration(weeklySummary.totalSeconds)}{" "}
                <span className="text-sm font-normal text-zinc-500">/ {formatDuration(weeklySummary.objectiveSeconds)}</span>
              </CardTitle>
            </div>
          </div>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{weeklySummary.progressPercent}%</span>
        </div>
        <ProgressBar value={weeklySummary.progressPercent} className="mt-5" />
        {weeklySummary.bySubject.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-500">
            {weeklySummary.bySubject.map(({ subject, seconds }) => (
              <span key={subject}>
                {subject} : <span className="text-zinc-300">{formatDuration(seconds)}</span>
              </span>
            ))}
          </div>
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
                <BarChart3 size={16} className="text-accent" />
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
                <GraduationCap size={16} className="text-accent" />
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
            <HistoryIcon size={14} className="text-accent" />
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
