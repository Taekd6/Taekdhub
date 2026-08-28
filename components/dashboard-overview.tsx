"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenCheck, CalendarClock, ChevronRight, Flame, ListChecks, Trophy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { rowClass, rowInteractiveClass, Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { CircularProgress } from "@/components/ui/progress";
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
import { explainReasons } from "@/lib/recommendation";
import {
  computeDailyPlan,
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_INTENT_META,
  PLAN_STORAGE_KEY,
  serializePlan,
} from "@/lib/plan";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import type { UpcomingItem } from "@/lib/next-action";

const UPCOMING_META: Record<UpcomingItem["key"], { label: string; icon: typeof BookOpenCheck }> = {
  chapter: { label: "Chapitre à consolider", icon: BookOpenCheck },
  subject: { label: "Matière délaissée", icon: CalendarClock },
  review: { label: "Révision due", icon: ListChecks },
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

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
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
  // "Revoir mes priorités" (Phase 8) : ouvre directement le premier exercice déjà signalé par le moteur de recommandation — même convention que computeUpcoming (lib/next-action.ts), aucune nouvelle route.
  // "Prochainement" ne montre plus le chapitre le plus faible : la section "À consolider" ci-dessous couvre ce signal en mieux (plusieurs chapitres, raisons explicites) — computeUpcoming lui-même reste inchangé (voir lib/next-action.test.ts).
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");

  return (
    <div className="space-y-6">
      {contestDays !== null && (
        <p className="t-meta -mt-2 flex items-center gap-1.5 px-1">
          <Trophy size={13} className="text-accent" /> {contestDays} jours avant le concours
        </p>
      )}

      {/* ══ NIVEAU 1 — CE QUE JE FAIS MAINTENANT ═════════════════════════
          Le Plan du jour PRIME désormais sur « À faire maintenant », qui
          occupait le premier rang avec un seul exercice. Un plan répond à la
          question complète (quoi, pourquoi, combien de temps, on commence) ;
          un exercice isolé n'en répond qu'au quart. Les deux blocs sont donc
          fusionnés : le plan porte la structure, et la raison du moteur — la
          part la plus utile de l'ancien héros — coiffe le tout. */}
      <Section
        rank="primary"
        eyebrow="Plan du jour"
        title={dailyPlan.blocks.length > 0 ? "Ce que tu devrais travailler aujourd'hui" : nextAction.title}
        description={planReason ?? nextAction.description}
        action={
          <SegmentedControl
            ariaLabel="Durée du plan du jour"
            value={planMinutes}
            onChange={setPlanMinutes}
            options={PLAN_DURATION_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
          />
        }
        footer={
          dailyPlan.blocks.length > 0 ? (
            <>
              <p className="t-meta">
                <span className="font-medium text-ink">{formatMinutes(dailyPlan.totalMinutes)}</span> · {dailyPlan.totalExercises} exercice
                {dailyPlan.totalExercises > 1 ? "s" : ""}
                {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites aujourd&apos;hui</>}
              </p>
              <Button size="lg" onClick={startPlan}>
                Commencer <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <p className="t-meta">
                {nextAction.kind === "empty-bank"
                  ? "Ajoute des exercices pour que TaekdHub puisse te construire un plan."
                  : "Rien à planifier pour l'instant — ta banque est à jour."}
              </p>
              <Link href={sessionHref}>
                <Button size="lg">
                  {nextAction.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            </>
          )
        }
      >
        {dailyPlan.blocks.length > 0 && (
          <ol className="space-y-1">
            {dailyPlan.blocks.map((block, index) => (
              <li key={block.intent} className={rowClass}>
                <span className="mt-0.5 w-4 shrink-0 text-center text-xs tabular-nums text-subtle">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-ink">
                      {block.label} <span className="font-normal text-muted">— {PLAN_INTENT_META[block.intent].description}</span>
                    </p>
                    <span className="t-meta shrink-0 tabular-nums">{block.estimatedMinutes} min</span>
                  </div>
                  <p className="t-meta mt-0.5 truncate">
                    {block.focus} · {block.picks.length} exercice{block.picks.length > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* ══ NIVEAU 2 — OÙ J'EN SUIS ═══════════════════════════════════════
          Quatre cartes de métriques, une carte « cette semaine », une carte
          « progression par matière », une carte « prêt pour le DS » et une
          carte « activité récente » occupaient la moitié de l'écran — toutes
          reprises à l'identique sur /progress, qui est faite pour ça. Il ne
          reste ici que ce qui sert à décider AUJOURD'HUI — présenté comme un
          fait qu'on voit (un filet qui se remplit), pas comme un pourcentage
          qu'on doit calculer soi-même en le lisant. */}
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-1">
        {/* L'anneau — voir la doc de `CircularProgress` — est réservé à CE
            chiffre : le seul qui répond à "où en suis-je là, maintenant",
            pas à une comparaison entre plusieurs valeurs (ce que les barres
            font très bien juste à côté). */}
        <div className="flex items-center gap-3">
          <CircularProgress value={objective.percent} size={52} strokeWidth={5} center={<span className="text-xs">{objective.percent}%</span>} />
          <div className="min-w-0">
            <p className="eyebrow">Objectif du jour</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-ink">
              {objective.workedMinutes} / {objective.goalMinutes} min
            </p>
          </div>
        </div>
        <Stat label="Cette semaine" value={formatDuration(weeklySummary.totalSeconds)} percent={weeklySummary.progressPercent} />
        {streak > 0 && (
          <div className="min-w-0">
            <p className="eyebrow">Série</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium tabular-nums text-ink">
              <Flame size={13} className="text-accent" /> {streak} j
            </p>
          </div>
        )}
        {/* `min-h-11` sous `lg` : un lien texte de 20 px de haut est une
            cible tactile inconfortable, même s'il n'a pas l'apparence d'un
            bouton — la règle vaut pour tout ce qu'on touche. */}
        <Link
          href="/progress"
          className="focus-ring t-meta ml-auto inline-flex items-center rounded px-1 underline-offset-4 hover:text-ink hover:underline max-lg:min-h-11"
        >
          Voir ma progression
        </Link>
      </div>

      {/* Décalé après l'action principale (refonte design) : un avertissement
          de sauvegarde ouvrait autrefois la page, avant même "quoi
          travailler aujourd'hui" — la première chose vue en arrivant n'était
          pas la priorité du jour mais une alerte administrative. Un vrai
          risque (perte du travail), mais qui n'a pas besoin de passer devant
          l'action qui fait revenir chaque jour. */}
      <BackupReminder />

      {/* ══ NIVEAU 3 — CE QUI MÉRITE MON ATTENTION ═══════════════════════ */}
      {toConsolidate.length > 0 && (
        <Section rank="secondary" eyebrow="À consolider" title="Ces chapitres méritent ton attention">
          <ul className="-mx-1 divide-y divide-hairline/[0.07]">
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

      {(secondaryPicks.length > 0 || otherSignals.length > 0) && (
        <Section rank="quiet" title="Aussi signalé" className="px-1">
          <ul className="-mx-1 divide-y divide-hairline/[0.07]">
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
        </Section>
      )}
    </div>
  );
}

/**
 * Chiffre du bandeau « où j'en suis » — une ligne, pas une carte. Le filet
 * sous la valeur (refonte design) montre la même progression que le
 * pourcentage entre parenthèses, mais SE VOIT d'un regard, sans lire un
 * nombre : deux façons de dire le même fait, une pour qui compare vite, une
 * pour qui veut le chiffre exact.
 */
function Stat({ label, value, percent }: { label: string; value: string; percent?: number }) {
  return (
    <div className="min-w-[9rem]">
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
