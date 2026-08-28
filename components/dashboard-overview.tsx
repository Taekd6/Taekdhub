"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CalendarClock, CheckCircle2, ChevronRight, Flame, ListChecks, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { rowInteractiveClass, Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { CircularProgress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/cn";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import {
  computeChaptersToConsolidate,
  computeDailyObjective,
  computeNextAction,
  computeUpcoming,
} from "@/lib/next-action";
import { explainReasons, isPureDiscovery } from "@/lib/recommendation";
import {
  computeDailyPlan,
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_INTENT_META,
  PLAN_STORAGE_KEY,
  serializePlan,
  type PlanBlock,
} from "@/lib/plan";
import { formatDuration } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import type { UpcomingItem } from "@/lib/next-action";

const UPCOMING_META: Record<UpcomingItem["key"], { label: string; icon: typeof BookOpenCheck }> = {
  chapter: { label: "Chapitre à consolider", icon: BookOpenCheck },
  subject: { label: "Matière délaissée", icon: CalendarClock },
  review: { label: "Révision due", icon: ListChecks },
};

/**
 * Centre de pilotage (refonte V2 — composition, pas seulement présentation).
 *
 * La V1 empilait des sections de même largeur, chacune sa propre carte : une
 * colonne unique, lue de haut en bas comme un formulaire. Un vrai poste de
 * pilotage se lit en DEUX ZONES à la fois — CE QUE JE FAIS (large, sans
 * cadre, la typographie porte l'emphase) et OÙ J'EN SUIS EN CONTINU (une
 * colonne étroite, toujours visible, jamais à faire défiler pour la
 * retrouver). Sur desktop : deux colonnes asymétriques, la seconde fixée au
 * défilement. Sur mobile : la même hiérarchie, simplement empilée dans
 * l'ordre où elle compte (l'action d'abord, le contexte ensuite).
 *
 * Chaque bloc reste une simple vue sur des moteurs déjà existants
 * (lib/recommendation.ts, lib/progress.ts, lib/readiness.ts, lib/history.ts,
 * lib/week.ts, composés par lib/next-action.ts) — aucune nouvelle règle
 * métier n'est introduite ici, uniquement la composition et la navigation.
 */
export function DashboardOverview() {
  const { sessions, exercises, chapters, preferences, ready } = usePrepahubData();
  const router = useRouter();
  /** Durée choisie pour "Plan du jour" — état purement local à cette page, jamais persisté (voir Phase 3 du sprint : pas de système de calendrier). */
  const [planMinutes, setPlanMinutes] = useState<number>(DEFAULT_PLAN_MINUTES);

  const model = useMemo(() => {
    const now = new Date();
    return {
      nextAction: computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now),
      objective: computeDailyObjective(sessions, preferences.dailyGoalMinutes, now),
      upcoming: computeUpcoming(exercises, sessions, chapters, now),
      toConsolidate: computeChaptersToConsolidate(exercises, sessions, chapters, now),
      weeklySummary: computeWeeklySummary(exercises, sessions, preferences.weeklyGoalMinutes, now),
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

  // Objectif du jour franchi À L'INSTANT (pas déjà atteint au chargement) :
  // seul ce cas précis mérite le petit rebond — sinon rouvrir le Dashboard
  // un jour déjà bouclé le redéclencherait à chaque visite. Calculé avant le
  // `return` anticipé ci-dessous : les Hooks ne peuvent pas dépendre d'une
  // condition qui varie d'un rendu à l'autre.
  const goalReached = model.objective.percent >= 100;
  const [justReachedGoal, setJustReachedGoal] = useState(false);
  const previousGoalReached = useRef(goalReached);
  useEffect(() => {
    const wasReached = previousGoalReached.current;
    previousGoalReached.current = goalReached;
    if (!wasReached && goalReached) {
      setJustReachedGoal(true);
      const timeout = setTimeout(() => setJustReachedGoal(false), 1800);
      return () => clearTimeout(timeout);
    }
  }, [goalReached]);

  if (!ready) {
    return (
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-12">
        <div className="h-64 animate-pulse rounded-2xl bg-hairline/[0.025]" />
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-hairline/[0.025] lg:mt-0" />
      </div>
    );
  }

  const { nextAction, objective, upcoming, toConsolidate, weeklySummary, streak, contestDays } = model;
  // La raison du moteur, reprise du premier exercice réellement planifié :
  // c'est la part utile de l'ancien bloc « À faire maintenant », conservée au
  // sommet de la page plutôt que dupliquée dans une carte à elle seule.
  const planReason = explainReasons(dailyPlan.blocks[0]?.picks[0]?.reasons ?? []);
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");
  const hasPlan = dailyPlan.blocks.length > 0;
  const heroLabel = hasPlan ? blockDisplayMeta(dailyPlan.blocks[0]).label : nextAction.title;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-12">
      {/* ══ COLONNE PRINCIPALE — CE QUE JE FAIS ══════════════════════════ */}
      <div className="min-w-0">
        {contestDays !== null && (
          <p className="t-meta -mt-2 mb-4 flex items-center gap-1.5">
            <Trophy size={13} className="text-accent" /> {contestDays} jours avant le concours
          </p>
        )}

        {/* HÉROS — volontairement SANS carte : sur l'écran le plus vu de
            l'app, la confiance vient de la typographie et de l'espace, pas
            d'un cadre de plus. Le chiffre géant (minutes) est ce qu'on
            retient d'un coup d'œil ; le mot d'intention et la raison du
            moteur suivent, dans cet ordre, avant même le bouton. */}
        <div>
          <p className="eyebrow">Plan du jour</p>
          {hasPlan && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[3.25rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[4.5rem]">
                <AnimatedNumber value={dailyPlan.totalMinutes} />
              </span>
              <span className="text-lg font-medium text-muted">
                min · {dailyPlan.totalExercises} exercice{dailyPlan.totalExercises > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <h1 className={cn("font-semibold tracking-tight", hasPlan ? "mt-3 text-xl sm:text-2xl" : "mt-3 text-[2rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]")}>
            {heroLabel}
            {hasPlan && (
              <span className="font-normal text-muted"> — {dailyPlan.blocks.map((block) => blockDisplayMeta(block).description).join(" · ")}</span>
            )}
          </h1>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-7 text-muted">
            {hasPlan
              ? planReason
              : nextAction.kind === "empty-bank"
                ? "Ajoute des exercices pour que TaekdHub puisse te construire un plan."
                : nextAction.description}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {hasPlan ? (
              <Button size="lg" onClick={startPlan} className="px-7 text-[0.9375rem]">
                Commencer <ArrowRight size={16} />
              </Button>
            ) : (
              <Link href={sessionHref}>
                <Button size="lg" className="px-7 text-[0.9375rem]">
                  {nextAction.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            )}
            <SegmentedControl
              ariaLabel="Durée du plan du jour"
              value={planMinutes}
              onChange={setPlanMinutes}
              options={PLAN_DURATION_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
            />
          </div>
        </div>

        {/* Le détail du plan — une liste fine, sans fond ni bordure : elle
            précise le héros juste au-dessus, elle n'a pas besoin d'un
            second niveau d'emphase. */}
        {hasPlan && dailyPlan.blocks.length > 1 && (
          <ol className="mt-8 space-y-3 border-t border-hairline/[0.07] pt-6">
            {dailyPlan.blocks.map((block, index) => {
              const { label, description } = blockDisplayMeta(block);
              return (
                <li key={block.intent} className="flex items-start gap-3">
                  <span className="mt-0.5 w-4 shrink-0 text-center text-xs tabular-nums text-subtle">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium text-ink">
                        {label} <span className="font-normal text-muted">— {description}</span>
                      </p>
                      <span className="t-meta shrink-0 tabular-nums">{block.estimatedMinutes} min</span>
                    </div>
                    <p className="t-meta mt-0.5 truncate">
                      {block.focus} · {block.picks.length} exercice{block.picks.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* ══ CE QUI MÉRITE MON ATTENTION ═════════════════════════════════ */}
        {toConsolidate.length > 0 && (
          <Section rank="secondary" eyebrow="À consolider" title="Ces chapitres méritent ton attention" className="mt-12">
            <ul className="-mx-1 mt-4 divide-y divide-hairline/[0.07]">
              {toConsolidate.map(({ chapter, averageMastery, reasons, href }) => (
                <li key={chapter.id}>
                  <Link href={href} className={cn(rowInteractiveClass, "items-center")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{chapter.label}</p>
                      <p className="t-meta mt-0.5 truncate">
                        {chapter.subject} · {reasons.join(" · ")}
                      </p>
                    </div>
                    <span className="t-meta shrink-0 tabular-nums">{averageMastery} %</span>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* ══ COLONNE LATÉRALE — OÙ J'EN SUIS EN CONTINU ═══════════════════
          Fixée au défilement sur desktop (`lg:sticky`) : ces chiffres
          répondent à une question toujours valable pendant qu'on lit ou
          choisit dans la colonne principale, ils n'ont pas à disparaître dès
          qu'on descend d'un écran. */}
      <aside className="mt-12 space-y-8 lg:sticky lg:top-8 lg:mt-0">
        <div className="flex items-center gap-4">
          <CircularProgress
            value={objective.percent}
            size={72}
            strokeWidth={6}
            center={
              goalReached ? (
                <motion.span
                  initial={justReachedGoal ? { scale: 0 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.55, duration: 0.5 }}
                >
                  <CheckCircle2 size={22} className="text-accent" />
                </motion.span>
              ) : (
                <span className="text-base font-semibold">
                  <AnimatedNumber value={objective.percent} format={(n) => `${Math.round(n)}%`} />
                </span>
              )
            }
          />
          <div className="min-w-0">
            <p className="eyebrow">{goalReached ? "Objectif atteint" : "Objectif du jour"}</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-ink">
              <AnimatedNumber value={objective.workedMinutes} /> / {objective.goalMinutes} min
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-hairline/[0.07] pt-5">
          <Stat label="Cette semaine" value={formatDuration(weeklySummary.totalSeconds)} percent={weeklySummary.progressPercent} />
          {streak > 0 && (
            <div className="min-w-0">
              <p className="eyebrow">Série</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium tabular-nums text-ink">
                <Flame size={13} className="text-accent" /> {streak} j
              </p>
            </div>
          )}
          <Link href="/progress" className="focus-ring t-meta inline-flex min-h-11 items-center rounded px-0 underline-offset-4 hover:text-ink hover:underline lg:min-h-0">
            Voir ma progression
          </Link>
        </div>

        {(secondaryPicks.length > 0 || otherSignals.length > 0) && (
          <div className="border-t border-hairline/[0.07] pt-5">
            <p className="eyebrow">Aussi signalé</p>
            <ul className="-mx-1 mt-3 divide-y divide-hairline/[0.07]">
              {secondaryPicks.map(({ exercise, reasons }) => (
                <li key={exercise.id}>
                  <Link href={`/exercises?focus=${exercise.id}`} className={cn(rowInteractiveClass, "items-center")}>
                    <SubjectAvatar subject={exercise.subject} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{exercise.title}</p>
                      <p className="t-meta mt-0.5 truncate">{reasons.slice(0, 2).join(" · ")}</p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
              {otherSignals.map((item) => {
                const meta = UPCOMING_META[item.key];
                const Icon = meta.icon;
                return (
                  <li key={item.key}>
                    <Link href={item.href} className={cn(rowInteractiveClass, "items-center")}>
                      <Icon size={15} className="mt-0.5 shrink-0 text-subtle" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{item.label}</p>
                        <p className="t-meta mt-0.5 truncate">{item.detail}</p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-subtle" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Décalé en toute fin de colonne (refonte design) : un avertissement
            de sauvegarde n'a pas à concurrencer l'action principale ni les
            chiffres du jour — un vrai risque, mais qui reste secondaire. */}
        <BackupReminder />
      </aside>
    </div>
  );
}

/**
 * Habillage d'un bloc du plan — présentationnel uniquement, ne touche à rien
 * dans lib/plan.ts. `planIntent` (lib/plan.ts) range par défaut tout ce qui
 * ne se distingue pas ailleurs dans "consolider" ("quand rien d'autre ne se
 * distingue, il faut réparer avant d'avancer") — un choix juste pour un
 * exercice réellement raté ou de maîtrise faible, mais faux pour un exercice
 * JAMAIS travaillé : on ne "consolide" pas ce qu'on n'a jamais construit.
 * Un élève tout juste arrivé (banque encore à 0% partout) verrait donc
 * "Consolider — Ce qui résiste encore" comme tout premier message du
 * produit, alors que rien n'a encore "résisté" à quoi que ce soit.
 * Un bloc de consolidation dont CHAQUE exercice n'a que "Jamais travaillé"
 * (+ "Maîtrise faible", qui l'accompagne toujours par défaut) pour seule
 * raison — aucun signal d'échec ou de statut manuellement signalé — devient
 * donc "Découvrir" à l'affichage.
 */
function blockDisplayMeta(block: PlanBlock): { label: string; description: string } {
  if (block.intent === "consolider" && block.picks.every(({ reasons }) => isPureDiscovery(reasons))) {
    return { label: "Découvrir", description: "Terrain encore inexploré" };
  }
  return { label: block.label, description: PLAN_INTENT_META[block.intent].description };
}

/**
 * Chiffre de la colonne latérale — une ligne, pas une carte. Le filet sous
 * la valeur montre la même progression que le pourcentage à côté, mais SE
 * VOIT d'un regard, sans lire un nombre.
 */
function Stat({ label, value, percent }: { label: string; value: string; percent?: number }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5 text-sm font-medium tabular-nums text-ink">
        {value}
        {percent !== undefined && <span className="t-meta font-normal">{percent} %</span>}
      </p>
      {percent !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-hairline/[0.08]">
          <div className="h-full rounded-full bg-accent/70 transition-all duration-500" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      )}
    </div>
  );
}
