"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CalendarClock, CheckCircle2, ChevronRight, Flame, ListChecks, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { NotionInsight } from "@/components/notions/notion-insight";
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
import { computeGoalsDailyPlan, describeGoalScope, explainGoalPlan, serializeGoalsDailyPlan } from "@/lib/goals";
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
  const { sessions, exercises, chapters, goals, preferences, ready } = usePrepahubData();
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

  // Adaptive Planning Engine (lib/goals.ts) : quand au moins un objectif
  // actif a encore du travail à proposer, IL devient la source du plan du
  // jour — pas `dailyPlan` (banque entière). Repose entièrement sur
  // `computeDailyPlan` en coulisses (voir `computeGoalsDailyPlan`), donc
  // aucune régression pour un élève sans objectif : `goalPlans` vaut alors
  // `[]` et tout le reste de ce composant se comporte exactement comme avant.
  const goalPlans = useMemo(
    () => computeGoalsDailyPlan(goals, exercises, sessions, chapters, planMinutes, preferences.dailyGoalMinutes, new Date()),
    [goals, exercises, sessions, chapters, planMinutes, preferences.dailyGoalMinutes]
  );
  const hasGoalPlan = goalPlans.length > 0;

  // Dépose le plan dans sessionStorage puis navigue vers /session, qui le lit
  // au montage et construit la séance avec exactement ces exercices, dans cet
  // ordre — voir components/session/session-runner.tsx et lib/plan.ts. Aucune
  // sélection n'est recalculée côté /session.
  const startPlan = useCallback(() => {
    const stored = hasGoalPlan ? serializeGoalsDailyPlan(goalPlans) : serializePlan(dailyPlan);
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stored));
    router.push("/session");
  }, [hasGoalPlan, goalPlans, dailyPlan, router]);

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
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");
  const hasPlan = hasGoalPlan || dailyPlan.blocks.length > 0;

  // "Aussi signalé" (colonne latérale) doit montrer des exercices RÉELLEMENT
  // présents dans le plan affiché juste au-dessus — jamais une seconde liste
  // indépendante. Avant ce correctif (audit transversal — voir
  // lib/__audit_chain.test.ts), cette liste provenait d'un second appel à
  // `recommendExercises` (via `computeNextAction`, SANS le réordonnancement
  // par priorité de chapitre ni la réservation de l'exercice le plus urgent
  // que fait `computeDailyPlan`) : sur le même écran, au même instant, la
  // sidebar pouvait donc mettre en avant un exercice différent de celui
  // réellement en tête du plan à démarrer — mesuré : un exercice avec deux
  // échecs récents (score brut le plus haut) passait devant le chapitre
  // réellement prioritaire (`computeChaptersToConsolidate`) dans
  // `nextAction.picks`, sans jamais apparaître à la même place dans le plan
  // du jour affiché. Dérivée maintenant du(des) MÊME(S) plan(s) que ceux
  // réellement proposés : plus aucune divergence possible par construction.
  // `nextAction.picks` ne reste utile que pour le cas SANS plan (banque vide
  // / à jour), où il pilote déjà le héros lui-même.
  const planPicks = hasGoalPlan
    ? goalPlans.flatMap(({ plan }) => plan.blocks.flatMap((block) => block.picks))
    : dailyPlan.blocks.flatMap((block) => block.picks);
  const secondaryPicks = hasPlan ? planPicks.slice(1, 3) : nextAction.picks.slice(1);

  // Un seul objectif actif : son propre plan (déjà des `PlanBlock` réels —
  // voir `computeGoalsDailyPlan`) s'affiche tel quel, dans la liste de
  // détail déjà existante ci-dessous — aucun nouveau balisage. Plusieurs
  // objectifs actifs : un intitulé générique en tête, une ligne par objectif
  // dans un bloc dédié (voir plus bas), la liste de détail par intention
  // n'a alors plus de sens (elle mélangerait des objectifs différents).
  const heroBlocks: PlanBlock[] = hasGoalPlan && goalPlans.length === 1 ? goalPlans[0].plan.blocks : !hasGoalPlan ? dailyPlan.blocks : [];
  const heroMinutes = hasGoalPlan ? goalPlans.reduce((sum, { plan }) => sum + plan.totalMinutes, 0) : dailyPlan.totalMinutes;
  const heroExerciseCount = hasGoalPlan ? goalPlans.reduce((sum, { plan }) => sum + plan.totalExercises, 0) : dailyPlan.totalExercises;
  const heroLabel = hasGoalPlan
    ? goalPlans.length === 1
      ? goalPlans[0].goal.title
      : "Tes objectifs actifs"
    : hasPlan
      ? blockDisplayMeta(dailyPlan.blocks[0]).label
      : nextAction.title;
  // La raison du moteur (objectif, ou premier exercice réellement planifié) :
  // c'est la part utile de l'ancien bloc « À faire maintenant », conservée au
  // sommet de la page plutôt que dupliquée dans une carte à elle seule.
  //
  // Plusieurs objectifs actifs (audit de restitution UI) : `explainGoalPlan`
  // ne parle QUE de `goalPlans[0]` (le plus urgent — `goalPlans` est déjà
  // trié par urgence, voir `computeGoalsDailyPlan`), mais rien ne le disait
  // à l'élève : sous le titre générique "Tes objectifs actifs" (pluriel),
  // la phrase nommait un seul objectif par son titre sans jamais préciser
  // lequel des deux (ou plus) elle concernait — trouvé en rejouant un
  // scénario à deux objectifs actifs (Playwright). Un simple préfixe suffit
  // à lever l'ambiguïté, sans changer `explainGoalPlan` (qui reste correct
  // et inchangé pour son autre appelant, `GoalCard`, où le contexte — une
  // carte par objectif — ne laisse déjà planer aucun doute).
  const planReasonSentence = hasGoalPlan ? explainGoalPlan(goalPlans[0].readiness) : explainReasons(dailyPlan.blocks[0]?.picks[0]?.reasons ?? []);
  const planReason =
    hasGoalPlan && goalPlans.length > 1 && planReasonSentence ? `Le plus urgent aujourd'hui : ${planReasonSentence}` : planReasonSentence;

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
          {/* PAS "Objectif du jour" : la colonne latérale porte déjà ce
              libellé pour l'objectif de TEMPS quotidien (`preferences.
              dailyGoalMinutes`) — un concept entièrement différent d'un
              `Goal` (lib/storage.ts). Les confondre sous le même intitulé,
              affichés qui plus est sur le même écran, aurait été trompeur. */}
          <p className="eyebrow">{hasGoalPlan ? "Vers ton objectif" : "Plan du jour"}</p>
          {hasPlan && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[3.25rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[4.5rem]">
                <AnimatedNumber value={heroMinutes} />
              </span>
              <span className="text-lg font-medium text-muted">
                min · {heroExerciseCount} exercice{heroExerciseCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <h1 className={cn("font-semibold tracking-tight", hasPlan ? "mt-3 text-xl sm:text-2xl" : "mt-3 text-[2rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]")}>
            {heroLabel}
            {heroBlocks.length > 0 && (
              <span className="font-normal text-muted"> — {heroBlocks.map((block) => blockDisplayMeta(block).description).join(" · ")}</span>
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

        {/* Plusieurs objectifs actifs à la fois : une ligne par objectif —
            le détail par intention (consolider/réviser/progresser) de
            CHAQUE objectif reste consultable sur /goals, mélanger les deux
            niveaux ici serait illisible. */}
        {hasGoalPlan && goalPlans.length > 1 && (
          <ol className="mt-8 space-y-3 border-t border-hairline/[0.07] pt-6">
            {goalPlans.map(({ goal, plan }, index) => (
              <li key={goal.id} className="flex items-start gap-3">
                <span className="mt-0.5 w-4 shrink-0 text-center text-xs tabular-nums text-subtle">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="truncate text-sm font-medium text-ink">{goal.title}</p>
                    <span className="t-meta shrink-0 tabular-nums">{plan.totalMinutes} min</span>
                  </div>
                  <p className="t-meta mt-0.5 truncate">
                    {describeGoalScope(goal)} · {plan.totalExercises} exercice{plan.totalExercises > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Le détail du plan — une liste fine, sans fond ni bordure : elle
            précise le héros juste au-dessus, elle n'a pas besoin d'un
            second niveau d'emphase. Un seul objectif actif partage cette
            liste avec le plan classique (banque entière) : dans les deux
            cas, `heroBlocks` est un vrai `PlanBlock[]` (voir plus haut), pas
            une structure différente à gérer ici. */}
        {!(hasGoalPlan && goalPlans.length > 1) && hasPlan && heroBlocks.length > 1 && (
          <ol className="mt-8 space-y-3 border-t border-hairline/[0.07] pt-6">
            {heroBlocks.map((block, index) => {
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

        {/* ══ LE GRAIN EN DESSOUS DU CHAPITRE ═════════════════════════════
            Placé JUSTE AVANT la liste de chapitres, délibérément : quand
            plusieurs échecs récents partagent une notion, cette liste reste
            vraie mais cesse d'être la dernière réponse — le problème n'est
            pas réparti sur trois chapitres, il est concentré sur une notion.
            Voir components/notions/notion-insight.tsx et lib/notions.ts. */}
        <NotionInsight exercises={exercises} sessions={sessions} chapters={chapters} className="mt-12" />

        {/* ══ CE QUI MÉRITE MON ATTENTION ═════════════════════════════════ */}
        {toConsolidate.length > 0 && (
          <Section rank="secondary" eyebrow="À consolider" title="Ces chapitres méritent ton attention" className="mt-10">
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
          {/* "Objectifs" n'a pas d'entrée dans la barre du bas mobile (voir
              components/app-sidebar.tsx) — ce lien, comme celui de
              /progress juste au-dessus, est le point d'accès mobile. */}
          <Link href="/goals" className="focus-ring t-meta mt-2 inline-flex min-h-11 items-center rounded px-0 underline-offset-4 hover:text-ink hover:underline lg:mt-1 lg:min-h-0">
            {goals.length > 0 ? "Voir mes objectifs" : "Créer un objectif"}
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
