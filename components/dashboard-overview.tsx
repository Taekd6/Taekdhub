"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, ChevronRight, Flame, LayoutList, LineChart, NotebookPen, Trophy } from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { QuickLog } from "@/components/work/quick-log";
import { ReviewCapture } from "@/components/review/review-capture";
import { DueToday } from "@/components/review/due-today";
import { DailyCheckinCard } from "@/components/checkin/daily-checkin"; // check-in du soir
import { Button, buttonVariants } from "@/components/ui/button";
import { List, rowInteractive, Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { SegmentRing } from "@/components/ui/progress";
import { StackedColumns } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { MathInline } from "@/components/rich-math";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useCountUp } from "@/hooks/use-count-up";
import { computeStreak } from "@/lib/gamification";
import {
  computeChaptersToConsolidate,
  computeDailyObjective,
  computeNextAction,
  computeStatusLine,
  computeUpcoming,
} from "@/lib/next-action";
import { explainReasons } from "@/lib/recommendation";
import { explainPriority } from "@/lib/deadlines";
import {
  computeDailyPlan,
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_INTENT_META,
  PLAN_STORAGE_KEY,
  serializePlan,
} from "@/lib/plan";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import { computeSubjectTargets } from "@/lib/subject-targets";
import { SubjectTargetList } from "@/components/work/subject-targets";
import { buildWeeklyPlan } from "@/lib/planning";
import { servesBankExercises, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { LOAD_STATUS_META } from "@/lib/workload";
import { computeProgressBySubject } from "@/lib/progress";
import { selectReviewItems } from "@/lib/review-items";
import { ringSegments, todayBySubject, weekDayStacks } from "@/lib/day-stack";
import { subjectMeta, subjects as allSubjects } from "@/lib/study";
import { cn } from "@/lib/cn";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const contestDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Anneau du jour : diamètre et épaisseur, partagés entre le dessin et le calcul de l'écart entre segments. */
const RING_SIZE = 176;
const RING_STROKE = 14;

/**
 * ÉCRAN D'ACCUEIL — « qu'est-ce que je fais maintenant ? »
 *
 * REFONTE « NUIT » : une PHRASE, puis une grille de cartes.
 *
 * 1. LA PHRASE. L'écran s'ouvre sur ce qu'il reste à faire aujourd'hui, en
 *    très grand (« Encore 35 min et ta journée est faite. »), avec le bouton
 *    pour s'y mettre juste à côté. C'est la seule question qu'on se pose en
 *    ouvrant l'application ; la réponse ne doit pas se chercher.
 *
 * 2. LES CARTES, dans l'ordre de lecture d'un téléphone (le DOM), placées
 *    en grille de trois colonnes sur grand écran : la séance et l'anneau du
 *    jour, puis la saisie rapide et la semaine, puis les budgets par matière
 *    et le planning du jour, puis le carnet « À revoir » et ce qu'on
 *    reprenait. La COULEUR DE MATIÈRE relie les cartes entre elles : le
 *    violet des maths est le même dans l'anneau, dans les colonnes de la
 *    semaine et dans les barres de budget.
 *
 * UNE SEULE RÉPONSE à « que faire » : le bloc séance (planning du jour s'il
 * existe, sinon la séance construite depuis la banque). /preparation reste
 * un espace que l'on CONSULTE ; l'accueil est le seul endroit d'où l'on part
 * travailler.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants (saisie rapide, carnet) : chaque appel du hook tient
 * sa propre copie de l'état, et une seconde copie resterait figée après une
 * saisie.
 */
export function DashboardOverview() {
  const { sessions, exercises, chapters, workItems, reviewItems, preferences, ready, saveSessions, removeSession, saveReviewItems, checkins, saveCheckins } = usePrepahubData();
  const router = useRouter();
  const [planMinutes, setPlanMinutes] = useState<number>(DEFAULT_PLAN_MINUTES);

  const model = useMemo(() => {
    const now = new Date();
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    const nextAction = computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now);
    return {
      nextAction,
      objective,
      statusLine: computeStatusLine(objective, nextAction),
      upcoming: computeUpcoming(exercises, sessions, chapters, now),
      toConsolidate: computeChaptersToConsolidate(exercises, sessions, chapters, now),
      weeklySummary: computeWeeklySummary(exercises, sessions, preferences.weeklyGoalMinutes, now),
      // Pondéré par la capacité déclarée : un plan tourné vers le week-end
      // n'est pas « en retard » le samedi matin (voir lib/subject-targets.ts).
      subjectTargets: computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday),
      streak: computeStreak(sessions),
      // Les deux figures colorées : même définition du temps que l'objectif
      // du jour et le bilan de la semaine (voir lib/day-stack.ts).
      today: todayBySubject(sessions, now),
      week: weekDayStacks(sessions, now),
      /*
       * REPRENDRE — les derniers exercices réellement ouverts, dans l'ordre.
       * Dérivé des `WorkSession` (aucun nouveau champ) : on remonte le
       * journal, on garde le premier passage sur chaque exercice.
       */
      resume: (() => {
        const seen = new Set<string>();
        const out: { exercise: (typeof exercises)[number]; at: string }[] = [];
        for (const session of [...sessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())) {
          if (!session.exercise_id || seen.has(session.exercise_id)) continue;
          const exercise = exercises.find((item) => item.id === session.exercise_id && !item.archived);
          if (!exercise) continue;
          seen.add(session.exercise_id);
          out.push({ exercise, at: session.started_at });
          if (out.length === 3) break;
        }
        return out;
      })(),
      subjects: computeProgressBySubject(exercises).filter((entry) => entry.total > 0),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
      contestDate: preferences.contestDate ? contestDateFormatter.format(new Date(preferences.contestDate)) : null,
    };
  }, [exercises, sessions, chapters, preferences]);

  const openReviews = useMemo(() => selectReviewItems(reviewItems, { openOnly: true }), [reviewItems]);

  const dailyPlan = useMemo(
    () => computeDailyPlan(exercises, sessions, chapters, planMinutes, new Date()),
    [exercises, sessions, chapters, planMinutes]
  );

  /*
   * LE PLANNING, recalculé à chaque rendu depuis les travaux, les séances et
   * la capacité déclarée — jamais stocké, donc jamais périmé (voir
   * lib/planning.ts). L'accueil n'en affiche que trois choses : ce qui est
   * prévu aujourd'hui, les deux échéances les plus pressantes, et ce qui ne
   * rentre plus. Le détail vit sur /echeances.
   */
  const workPlan = useMemo(
    () => buildWeeklyPlan(workItems, sessions, preferences, new Date()),
    [workItems, sessions, preferences]
  );

  const startPlan = useCallback(() => {
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan(dailyPlan)));
    router.push("/session");
  }, [dailyPlan, router]);

  // Compteurs animés — appelés AVANT tout retour anticipé (règle des hooks).
  // Tant que les données ne sont pas prêtes, ils visent 0 et ne bougent pas.
  const remainingCount = useCountUp(ready ? model.objective.remainingMinutes : 0);
  const workedCount = useCountUp(ready ? model.objective.workedMinutes : 0);
  const weekCount = useCountUp(ready ? Math.round(model.weeklySummary.totalSeconds / 60) : 0);

  const name = preferences.displayName?.trim();

  if (!ready) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-14 w-full max-w-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { nextAction, objective, statusLine, upcoming, toConsolidate, weeklySummary, subjectTargets, streak, contestDays, contestDate, resume, subjects, today: todayParts, week } = model;
  const today = workPlan.days[0];
  /*
   * QUI RÉPOND À « MAINTENANT » ?
   *
   * Dès qu'un travail est PLANIFIÉ pour aujourd'hui, c'est lui — une
   * échéance datée prime toujours sur une proposition de la banque, qui
   * n'engage à rien. Sans planning du jour, le bloc reprend la séance
   * construite par `computeDailyPlan`.
   *
   * Les deux moteurs ne se disputent jamais : le planning dit QUAND et
   * COMBIEN, et pour un travail qui passe par la banque (« exercices »,
   * « chapitre ») c'est `recommendExercises` qui choisit le contenu au
   * moment de démarrer — d'où le lien vers /session, portant la matière et
   * le budget du créneau. Un DM, lui, part au chronomètre.
   */
  const firstSlot = today?.slots[0] ?? null;
  const nextSlots = today?.slots.slice(1) ?? [];
  const slotItem = firstSlot ? workItems.find((entry) => entry.id === firstSlot.workItemId) : undefined;
  const slotPriority = firstSlot ? workPlan.priorities.find((entry) => entry.item.id === firstSlot.workItemId) : undefined;
  const slotHref =
    firstSlot && slotItem
      ? servesBankExercises(slotItem)
        ? `/session?minutes=${firstSlot.minutes}${slotItem.subject ? `&subject=${encodeURIComponent(slotItem.subject)}` : ""}&travail=${slotItem.id}`
        : `/timer?travail=${slotItem.id}`
      : null;
  /*
   * À SURVEILLER — au plus DEUX entrées : un retard, une échéance qui ne
   * tient plus, ou une échéance à moins de deux jours. Une échéance
   * lointaine et confortable n'a rien à faire ici — la signaler apprendrait
   * à ignorer la rubrique. Le reste vit sur /echeances.
   */
  const watchList = workPlan.priorities
    .filter(
      (priority) =>
        priority.overdue ||
        priority.feasibility.level === "non casable" ||
        (priority.daysUntilDue !== null && priority.daysUntilDue <= 1)
    )
    .slice(0, 2);
  const planReason = explainReasons(dailyPlan.blocks[0]?.picks[0]?.reasons ?? []);
  const hasPlan = dailyPlan.blocks.length > 0;
  const [firstBlock, ...nextBlocks] = dailyPlan.blocks;
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");
  const hasTodayPlan = today.load.plannedMinutes > 0 || today.slots.length > 0;

  /* ANNEAU DU JOUR — un segment par matière, dans sa couleur. L'écart entre
     deux segments couvre les bouts arrondis (une demi-épaisseur de chaque
     côté) plus 3 px d'air : sans lui, deux segments se chevaucheraient. */
  const ringCircumference = Math.PI * (RING_SIZE - RING_STROKE);
  const arcs = ringSegments(todayParts, objective.goalMinutes * 60, (RING_STROKE + 3) / ringCircumference).map((segment) => ({
    id: segment.subject,
    start: segment.start,
    length: segment.length,
    color: subjectMeta[segment.subject].fill,
  }));

  /* SEMAINE — sept colonnes empilées par matière, et la légende des seules
     matières réellement travaillées cette semaine (sept pastilles pour deux
     matières travaillées, c'est cinq pastilles de bruit). */
  const weekSubjects = allSubjects.filter((subject) => week.some((day) => day.segments.some((segment) => segment.subject === subject)));
  const weekColumns = week.map((day) => ({
    id: day.key,
    label: day.label,
    title: day.longLabel,
    highlight: day.isToday,
    muted: day.isFuture,
    segments: day.segments.map((segment) => ({ id: segment.subject, value: segment.seconds, color: subjectMeta[segment.subject].fill })),
  }));
  const weekAria = `Temps de travail de la semaine, jour par jour : ${week
    .filter((day) => !day.isFuture)
    .map((day) => `${day.longLabel}, ${formatSpan(day.totalSeconds)}`)
    .join(" ; ")}.`;

  /* L'ACTION PRINCIPALE — une seule par écran, portée par la phrase
     d'accueil. Même logique qu'avant, déplacée : planning du jour, sinon
     plan de la banque, sinon l'action suggérée (banque vide, à jour…). */
  const primaryAction =
    firstSlot && slotHref ? (
      /* Un lien STYLÉ en bouton, pas un bouton dans un lien : deux éléments
         interactifs imbriqués font deux arrêts de tabulation pour une action. */
      <Link href={slotHref} className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}>
        Commencer <ArrowRight size={17} strokeWidth={2.4} />
      </Link>
    ) : hasPlan ? (
      <Button size="lg" onClick={startPlan} className="max-sm:w-full">
        Commencer <ArrowRight size={17} strokeWidth={2.4} />
      </Button>
    ) : (
      <Link href={sessionHref} className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}>
        {nextAction.ctaLabel} <ArrowRight size={17} strokeWidth={2.4} />
      </Link>
    );

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── LA PHRASE ───────────────────────────────────────────────
          Salutation + date en petit, puis ce qu'il reste à faire en très
          grand, le chiffre à la couleur d'accent et qui monte jusqu'à sa
          valeur. À droite (dessous sur mobile), le bouton pour s'y mettre. */}
      <header className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-6" style={{ "--i": 0 } as CSSProperties}>
        <div className="min-w-0 max-w-3xl">
          <p className="t-meta font-semibold">
            {name ? `Bonjour ${name}` : "Bonjour"} · <span className="capitalize">{dateFormatter.format(new Date())}</span>
          </p>
          <h1 className="t-display mt-3">
            {objective.met ? (
              <>
                Journée faite<span className="text-accent">.</span> Tout le reste est du bonus.
              </>
            ) : (
              <>
                Encore <span className="tabular text-accent">{remainingCount}&nbsp;min</span> et ta journée est faite.
              </>
            )}
          </h1>
          <p className="t-lede mt-3">{statusLine}</p>
          {/* Deux repères qui ne méritent pas une carte : la série et le
              concours, en pastilles. Le concours porte sa DATE — un compte à
              rebours sans date oblige à aller la vérifier. */}
          {(streak > 0 || contestDays !== null) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {streak > 0 && (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-inset px-3 text-[0.8125rem] font-bold">
                  <Flame size={14} className="text-subj-fr-ink" aria-hidden /> {streak} j d&apos;affilée
                </span>
              )}
              {contestDays !== null && (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-inset px-3 text-[0.8125rem] font-bold">
                  <Trophy size={14} className="text-accent" aria-hidden /> J−{contestDays}
                  <span className="font-semibold text-muted">· {contestDate}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 max-sm:w-full">{primaryAction}</div>
      </header>

      <div className="grid grid-flow-row-dense gap-4 sm:gap-5 lg:grid-cols-3">
        {/* ── LA SÉANCE ────────────────────────────────────────────── */}
        <Section
          variant="feature"
          index={1}
          label="La séance"
          className="lg:col-span-2"
          title={firstSlot || hasPlan ? "Ce que tu devrais travailler maintenant" : <MathInline text={nextAction.title} />}
          /* Le chapeau justifie CE QUI EST AFFICHÉ, jamais autre chose : sans
             raison explicite pour le premier bloc, pas de phrase du tout
             plutôt que la justification d'un exercice absent de l'écran. */
          description={firstSlot ? (slotPriority ? explainPriority(slotPriority) ?? undefined : undefined) : hasPlan ? planReason ?? undefined : nextAction.description}
          /* Le sélecteur de durée n'apparaît QUE quand la banque pilote le
             bloc : en mode planning, les durées viennent des créneaux, et un
             contrôle sans effet est pire qu'un contrôle absent. */
          action={
            firstSlot ? undefined : (
              <SegmentedControl
                ariaLabel="Durée de la séance"
                value={planMinutes}
                onChange={setPlanMinutes}
                options={PLAN_DURATION_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
              />
            )
          }
        >
          {firstSlot && (
            /* MODE PLANNING — même composition « Maintenant / Puis » que la
               séance de la banque, alimentée par les créneaux du jour. */
            <div key={firstSlot.workItemId} className="animate-fade-in">
              <NowBlock
                title={firstSlot.title}
                meta={
                  <>
                    {WORK_ITEM_KIND_META[firstSlot.kind].label}
                    {firstSlot.subject && ` · ${firstSlot.subject}`}
                  </>
                }
                subject={firstSlot.subject ?? undefined}
                /* `formatSpan` et non « N min » : un créneau peut dépasser
                   l'heure, et « 90 min » se lit moins vite que « 1 h 30 ». */
                figure={formatSpan(firstSlot.minutes * 60)}
              />
              {nextSlots.length > 0 && (
                <ThenList
                  items={nextSlots.map((slot) => ({
                    key: slot.workItemId,
                    title: slot.title,
                    meta: `${WORK_ITEM_KIND_META[slot.kind].label}${slot.subject ? ` · ${slot.subject}` : ""}`,
                    figure: formatSpan(slot.minutes * 60),
                  }))}
                />
              )}
            </div>
          )}
          {!firstSlot && hasPlan && (
            /*
             * MAINTENANT, PUIS — le premier bloc est composé comme la
             * réponse (titre, durée en grand chiffre), ce qui suit reste une
             * liste en retrait. Exactement les mêmes `dailyPlan.blocks`.
             *
             * Le `key` sur la durée demandée rejoue un fondu quand on passe
             * de 45 à 60 minutes : le plan change entièrement, et le fondu
             * dit « ceci vient d'être recalculé ».
             */
            <div key={planMinutes} className="animate-fade-in">
              <NowBlock
                title={
                  <>
                    {firstBlock.label}
                    <span className="text-muted"> — {PLAN_INTENT_META[firstBlock.intent].description}</span>
                  </>
                }
                meta={firstBlock.focus}
                figure={`${firstBlock.estimatedMinutes} min`}
              />
              {nextBlocks.length > 0 && (
                <ThenList
                  items={nextBlocks.map((block) => ({
                    key: block.intent,
                    title: `${block.label} — ${PLAN_INTENT_META[block.intent].description}`,
                    meta: block.focus,
                    figure: `${block.estimatedMinutes} min`,
                  }))}
                />
              )}
            </div>
          )}

          <p className="t-meta mt-5">
            {firstSlot ? (
              <>
                <span className="font-bold text-ink">{formatSpan(today.load.plannedMinutes * 60)}</span> prévues aujourd&apos;hui
                {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites</>}
              </>
            ) : hasPlan ? (
              <>
                <span className="font-bold text-ink">{formatMinutesSpan(dailyPlan.totalMinutes)}</span> au total
                {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites aujourd&apos;hui</>}
              </>
            ) : nextAction.kind === "empty-bank" ? (
              "Ta banque est vide — TaekdHub ne peut rien te proposer tant qu'elle l'est."
            ) : (
              "Rien à planifier pour l'instant — ta banque est à jour."
            )}
          </p>
        </Section>

        {/* ── AUJOURD'HUI — l'anneau par matière ─────────────────────── */}
        <Section variant="panel" index={2} title="Aujourd'hui" bodyClassName="flex flex-col items-center">
          <SegmentRing
            arcs={arcs}
            size={RING_SIZE}
            strokeWidth={RING_STROKE}
            label={`Objectif du jour : ${objective.workedMinutes} minutes sur ${objective.goalMinutes}${
              todayParts.length > 0 ? `, dont ${todayParts.map((part) => `${part.subject} ${formatSpan(part.seconds)}`).join(", ")}` : ""
            }.`}
          >
            <div>
              <p className="t-figure-lg tabular">{workedCount}</p>
              <p className="t-meta mt-1 font-semibold">/ {objective.goalMinutes} min</p>
              {objective.met && <p className="mt-1 text-2xs font-bold text-emerald-300">Objectif atteint</p>}
            </div>
          </SegmentRing>
          {todayParts.length > 0 ? (
            <ul className="mt-5 flex w-full flex-wrap justify-center gap-x-4 gap-y-2">
              {todayParts.map((part) => (
                <li key={part.subject} className="flex items-center gap-1.5 text-[0.8125rem]">
                  <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", subjectMeta[part.subject].solid)} />
                  <span className="font-semibold text-ink">{part.subject}</span>
                  <span className="tabular text-muted">{formatSpan(part.seconds)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-meta mt-5 text-center">Rien de noté aujourd&apos;hui. Chaque séance ou saisie colore l&apos;anneau.</p>
          )}
        </Section>

        {/* ── NOTER DU TEMPS — juste à côté de l'anneau, qui bouge sous les
            yeux à chaque saisie. Voir components/work/quick-log.tsx. */}
        <Section variant="panel" index={3} title="Noter du temps" description="Anki, relecture de cours… ce que le chrono n'a pas vu.">
          <QuickLog sessions={sessions} saveSessions={saveSessions} removeSession={removeSession} ready={ready} />
        </Section>

        {/* ── LA SEMAINE — sept colonnes empilées par matière ────────── */}
        <Section
          variant="panel"
          index={4}
          className="lg:col-span-2"
          title="Ta semaine"
          action={
            <p className="text-right max-sm:text-left">
              <span className="t-figure-md tabular">{formatSpan(weekCount * 60)}</span>
              <span className="t-meta ml-2 font-semibold">{weeklySummary.progressPercent} % de l&apos;objectif</span>
            </p>
          }
          bodyClassName="flex flex-col"
        >
          <StackedColumns columns={weekColumns} ariaLabel={weekAria} formatValue={(value) => formatSpan(value)} className="mt-2" heightClassName="h-36 lg:h-60" />
          {weekSubjects.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-hidden>
              {weekSubjects.map((subject) => (
                <li key={subject} className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                  <span className={cn("h-2 w-2 rounded-full", subjectMeta[subject].solid)} />
                  {subject}
                </li>
              ))}
            </ul>
          )}
          {/* ── Check-in du soir, au pied de la semaine : le composant décide
              seul de s'afficher (après 17 h, tant qu'il n'est pas fait) et ne
              laisse rien derrière lui sinon. Voir components/checkin/daily-checkin.tsx. */}
          <div className="mt-auto pt-6 empty:hidden">
            <DailyCheckinCard checkins={checkins} onSave={saveCheckins} ready={ready} />
          </div>
        </Section>

        {/* ── BUDGETS PAR MATIÈRE — le budget fixé dans Réglages, face au
            temps noté. Absent quand aucune matière n'a de budget. */}
        {subjectTargets.length > 0 && (
          <Section
            variant="panel"
            index={5}
            className="lg:col-span-2"
            title="Cette semaine par matière"
            action={
              <Link href="/settings" className="t-meta inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-ink max-lg:min-h-11">
                Régler <ChevronRight size={14} />
              </Link>
            }
          >
            <SubjectTargetList rows={subjectTargets} size="comfortable" />
          </Section>
        )}

        {/* ── PLANNING DU JOUR ET ÉCHÉANCES ─────────────────────────────
            Ce qui est prévu face à ce que la journée peut absorber, puis les
            échéances qui appellent une décision. Les deux signaux restent
            distincts : « en retard » est un fait, « ne tient pas » une
            projection. */}
        {(hasTodayPlan || watchList.length > 0) && (
          <Section variant="panel" index={6} title="Planning">
            {hasTodayPlan && (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="t-label">Prévu aujourd&apos;hui</p>
                  <p className="tabular t-meta shrink-0 whitespace-nowrap">
                    <span className="font-bold text-ink">{formatSpan(today.load.plannedMinutes * 60)}</span> / {formatSpan(today.load.capacityMinutes * 60)}
                  </p>
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {today.slots.map((slot) => (
                    <li key={slot.workItemId} className="flex items-baseline gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {slot.title}
                        <span className="text-subtle"> · {WORK_ITEM_KIND_META[slot.kind].short}</span>
                      </span>
                      <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] font-semibold text-muted">{formatSpan(slot.minutes * 60)}</span>
                    </li>
                  ))}
                </ul>
                {(today.load.status === "surchargé" || today.load.status === "intenable") && (
                  <p className={cn("t-meta mt-1.5", today.load.status === "intenable" ? "text-rose-300" : "text-amber-300")}>
                    {LOAD_STATUS_META[today.load.status].label} — {describeTodayLoad(today.load.overflowMinutes, today.load.status)}
                  </p>
                )}
              </div>
            )}
            {watchList.length > 0 && (
              <div className={cn(hasTodayPlan && "mt-5")}>
                <p className="t-label mb-1">À surveiller</p>
                <ul className="divide-y divide-line">
                  {watchList.map((priority) => (
                    <li key={priority.item.id}>
                      <Link href="/echeances" className="row-hover -mx-2 block rounded-xl px-2 py-2.5 max-lg:min-h-11">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{priority.item.title}</span>
                          <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] text-muted">{formatSpan(priority.remainingMinutes * 60)}</span>
                        </span>
                        <span className={cn("mt-0.5 block truncate text-[0.8125rem]", priority.overdue || priority.feasibility.level === "non casable" ? "text-rose-300" : "text-amber-300")}>
                          {priority.overdue
                            ? "En retard"
                            : priority.feasibility.level === "non casable"
                              ? "Ne tient plus dans tes journées"
                              : priority.daysUntilDue === 0
                                ? "À rendre aujourd'hui"
                                : priority.daysUntilDue === 1
                                  ? "À rendre demain"
                                  : `Dans ${priority.daysUntilDue} jours`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ── À REVOIR — une SAISIE, d'où sa place dans la colonne large.
            Six lignes au plus : au-delà, l'accueil deviendrait le carnet, et
            le carnet a sa page. */}
        <Section
          variant="panel"
          index={7}
          className="lg:col-span-2"
          label="À revoir"
          title="Ce qu'il faut reprendre"
          action={
            <Link href="/revoir" className="t-meta inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-ink max-lg:min-h-11">
              Le carnet <ChevronRight size={14} />
            </Link>
          }
        >
          {/* Révisions espacées du carnet — voir components/review/due-today.tsx. */}
          <DueToday items={reviewItems} className="mb-4" />
          <ReviewCapture
            items={reviewItems}
            saveItems={saveReviewItems}
            ready={ready}
            visible={openReviews}
            limit={REVIEW_ITEMS_ON_DASHBOARD}
            allHref="/revoir"
          />
        </Section>

        {/* ── REPRENDRE — ce sur quoi on travaillait. Au tout début, il n'y a
            rien à reprendre : on propose alors d'entrer par une matière. */}
        {resume.length > 0 ? (
          <Section variant="panel" index={8} label="Reprendre" title="Ce que tu travaillais">
            <List className="-mx-2">
              {resume.map(({ exercise, at }) => (
                <li key={exercise.id}>
                  <Link href={`/exercises?focus=${exercise.id}`} className={rowInteractive}>
                    <SubjectAvatar subject={exercise.subject} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        <MathInline text={exercise.title} />
                      </p>
                      <p className="t-meta mt-0.5 truncate">
                        {exercise.subject} · {relativeDay(at)}
                      </p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        ) : (
          subjects.length > 0 && (
            /* PAS UNE VITRINE DE LA BANQUE : mène au SUIVI de la matière, et
               ne montre que l'avancement — un pourcentage, pas un stock. */
            <Section variant="panel" index={8} label="Explorer" title="Entre par une matière">
              <List className="-mx-2">
                {subjects.map((entry) => (
                  <li key={entry.subject}>
                    <Link href={`/preparation?subject=${encodeURIComponent(entry.subject)}`} className={rowInteractive}>
                      <SubjectAvatar subject={entry.subject} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="t-subhead truncate">{entry.subject}</p>
                        <p className="t-meta mt-0.5">{entry.completionRate > 0 ? `${entry.completionRate} % acquis` : "Pas encore mesuré"}</p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-subtle" />
                    </Link>
                  </li>
                ))}
              </List>
            </Section>
          )
        )}

        {/* ── À CONSOLIDER ──────────────────────────────────────────── */}
        {toConsolidate.length > 0 && (
          <Section
            variant="panel"
            index={9}
            className="lg:col-span-2"
            label="À consolider"
            title="Ces chapitres appellent du travail"
            description="Classés par urgence réelle, chacun justifié par tes tentatives datées."
          >
            <List className="-mx-2">
              {toConsolidate.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
                <li key={chapter.id}>
                  <Link href={href} className={rowInteractive}>
                    {/* Le RANG, écrit : les maîtrises voisines (0 %, 3 %, 4 %)
                        ne laissent rien voir du classement annoncé. */}
                    <span className="t-figure w-5 shrink-0 text-right text-sm text-subtle">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="t-subhead truncate">{chapter.label}</p>
                      <p className="t-meta mt-0.5 truncate">
                        {chapter.subject} · {reasons.join(" · ")}
                        {evidence.sinceDays !== null && (
                          <>
                            {" "}
                            · {evidence.attempts} tentative{evidence.attempts > 1 ? "s" : ""} sur {evidence.sinceDays} j
                          </>
                        )}
                      </p>
                    </div>
                    {/* La maîtrise est un CHIFFRE, pas une barre : cinq nombres
                        alignés se comparent mieux que cinq barres voisines. */}
                    <span
                      className={cn(
                        "t-figure tabular shrink-0 text-base",
                        averageMastery >= 75 ? "text-emerald-300" : averageMastery >= 40 ? "text-amber-300" : "text-rose-300"
                      )}
                    >
                      {averageMastery}
                      <span className="text-xs font-semibold text-subtle"> %</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        )}

        {/* ── AUSSI SIGNALÉ — des signaux à surveiller, pas des choses à
            faire maintenant : jamais au rang de la séance. */}
        {(secondaryPicks.length > 0 || otherSignals.length > 0) && (
          <Section variant="panel" index={10} title="Aussi signalé">
            <ul className="-mx-2 divide-y divide-line">
              {secondaryPicks.map(({ exercise, reasons }) => (
                <li key={exercise.id}>
                  <Link href={`/exercises?focus=${exercise.id}`} className="row-hover flex items-center gap-2.5 rounded-xl px-2 py-2.5 max-lg:min-h-11">
                    <SubjectAvatar subject={exercise.subject} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        <MathInline text={exercise.title} />
                      </span>
                      <span className="t-meta mt-0.5 block truncate text-[0.8125rem]">{reasons.slice(0, 1).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {otherSignals.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="row-hover block rounded-xl px-2 py-2.5 max-lg:min-h-11">
                    <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
                    <span className="t-meta mt-0.5 block truncate text-[0.8125rem]">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Le rappel de sauvegarde est une CORVÉE, pas une décision : il reste
          aussi visible, mais APRÈS ce qu'on est venu chercher. */}
      <BackupReminder />

      <nav aria-label="Aller plus loin" className="flex flex-wrap gap-2">
        {[
          { href: "/echeances", label: "Mes échéances", icon: CalendarClock },
          { href: "/preparation", label: "Suivi par matière", icon: LayoutList },
          { href: "/erreurs", label: "Carnet d'erreurs", icon: NotebookPen },
          { href: "/progress", label: "Ma progression", icon: LineChart },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="press inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-bold text-muted transition-colors hover:border-hairline/[0.14] hover:text-ink max-lg:min-h-11"
          >
            <Icon size={15} aria-hidden /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Au-delà, l'accueil deviendrait le carnet — le reste vit sur /revoir. */
const REVIEW_ITEMS_ON_DASHBOARD = 6;

/**
 * « MAINTENANT » — le premier bloc de la séance, composé comme la réponse :
 * un encart en creux, le titre en gras, la durée en grand chiffre à droite.
 * Quand le créneau porte une matière, sa pastille le signe.
 */
function NowBlock({
  title,
  meta,
  figure,
  subject,
}: {
  title: React.ReactNode;
  meta: React.ReactNode;
  figure: string;
  subject?: (typeof allSubjects)[number];
}) {
  return (
    <div className="well flex items-center gap-4 p-4 sm:p-5">
      {subject && <SubjectAvatar subject={subject} />}
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-bold text-accent">Maintenant</p>
        <p className="t-heading mt-0.5">{title}</p>
        <p className="t-meta mt-1">{meta}</p>
      </div>
      <span className="t-figure-sm tabular shrink-0 whitespace-nowrap">{figure}</span>
    </div>
  );
}

/** « PUIS » — la suite de la séance, en retrait : une liste, pas des blocs de même poids. */
function ThenList({ items }: { items: { key: string; title: string; meta: string; figure: string }[] }) {
  return (
    <ol className="mt-4 space-y-1">
      <li className="t-label px-1">Puis</li>
      {items.map((item) => (
        <li key={item.key} className="flex items-baseline gap-3 rounded-xl px-1 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
            <p className="t-meta mt-0.5 truncate text-[0.8125rem]">{item.meta}</p>
          </div>
          <span className="tabular shrink-0 whitespace-nowrap text-sm font-bold text-muted">{item.figure}</span>
        </li>
      ))}
    </ol>
  );
}

/** « aujourd'hui » / « hier » / « il y a 4 jours » — jamais une date brute pour du travail récent. */
function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Phrase d'alerte de la journée — toujours avec son chiffre, jamais un mot seul. */
function describeTodayLoad(overflowMinutes: number, status: "surchargé" | "intenable"): string {
  return status === "intenable"
    ? `dépassement de ${formatSpan(overflowMinutes * 60)} sur ta capacité.`
    : "le planning entame ta marge.";
}
