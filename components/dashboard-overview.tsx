"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, ChevronRight, Flame, LayoutList, NotebookPen, Trophy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { QuickLog } from "@/components/work/quick-log";
import { ReviewCapture } from "@/components/review/review-capture";
import { Button } from "@/components/ui/button";
import { List, rowInteractive, Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Ring } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { MathInline } from "@/components/rich-math";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
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
import { cn } from "@/lib/cn";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const contestDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * ÉCRAN D'ACCUEIL — « qu'est-ce que je fais maintenant ? »
 *
 * DEUX changements de fond par rapport à la version précédente.
 *
 * 1. LA COMPOSITION. L'écran était une colonne : la séance, puis les
 *    compteurs, puis les chapitres, puis le reste — donc « où j'en suis »
 *    coûtait un défilement à « qu'est-ce que je fais », alors que les deux
 *    questions se posent en même temps, en s'asseyant. Le rail de droite les
 *    met côte à côte : la décision à gauche, l'état à droite, d'un seul coup
 *    d'œil.
 *
 * 2. UNE SEULE RÉPONSE. Le tableau de bord répondait DEUX FOIS à la même
 *    question, avec deux moteurs : « Plan du jour » (lib/plan.ts) et
 *    « Préparation globale », chacun avec son sélecteur de durée et son
 *    bouton « commencer », l'un sous l'autre. Le second est devenu le SUIVI
 *    par matière (/preparation) : un espace que l'on va CONSULTER, qui ne
 *    propose plus d'exercices et ne démarre plus de séance. L'accueil reste
 *    le seul endroit d'où l'on part travailler.
 */
export function DashboardOverview() {
  const { sessions, exercises, chapters, workItems, reviewItems, preferences, ready, saveSessions, removeSession, saveReviewItems } = usePrepahubData();
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
      /*
       * REPRENDRE — les derniers exercices réellement ouverts, dans l'ordre.
       *
       * La colonne principale s'arrêtait après la séance quand rien n'était
       * signalé : un écran d'accueil qui se termine par du vide au premier
       * tiers de la page. Or il existe toujours une réponse utile à
       * « et sinon ? » : soit ce sur quoi on travaillait hier, soit, au tout
       * début, les matières elles-mêmes.
       *
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

  const name = preferences.displayName?.trim();

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const { nextAction, objective, statusLine, upcoming, toConsolidate, weeklySummary, subjectTargets, streak, contestDays, contestDate, resume, subjects } = model;
  const today = workPlan.days[0];
  /*
   * QUI RÉPOND À « MAINTENANT » ?
   *
   * Dès qu'un travail est PLANIFIÉ pour aujourd'hui, c'est lui — une
   * échéance datée prime toujours sur une proposition de la banque, qui
   * n'engage à rien. Sans planning du jour, le bloc reprend exactement son
   * comportement d'avant : la séance construite par `computeDailyPlan`.
   *
   * Les deux moteurs ne se disputent jamais : le planning dit QUAND et
   * COMBIEN, et pour un travail qui passe par la banque (« exercices »,
   * « chapitre ») c'est `recommendExercises` qui choisit le contenu au
   * moment de démarrer — d'où le lien vers /session, portant la matière et
   * le budget du créneau. Un DM, lui, part au chronomètre : personne ne
   * prétend en connaître le contenu.
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
   * À SURVEILLER — au plus DEUX entrées.
   *
   * Ne retient que ce qui appelle une décision aujourd'hui : un retard, une
   * échéance qui ne tient plus, ou une échéance à moins de deux jours. Une
   * échéance lointaine et confortable n'a rien à faire ici — la signaler
   * apprendrait à ignorer la rubrique. Le reste vit sur /echeances.
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

  return (
    <Split
      railLabel="Où j'en suis"
      rail={
        <div className="space-y-8">
          {/* L'OBJECTIF DU JOUR en tête du rail : c'est la seule mesure qu'on
              regarde plusieurs fois par jour, donc la seule qui mérite un
              anneau plutôt qu'une ligne. */}
          <div className="flex items-center gap-4">
            <Ring value={objective.percent} size={62} strokeWidth={4}>
              <span className="t-figure text-[0.9375rem]">{objective.percent}%</span>
            </Ring>
            <div className="min-w-0">
              <p className="t-label">Objectif du jour</p>
              <p className="tabular mt-1 text-sm">
                <span className="font-medium text-ink">{objective.workedMinutes}</span>
                <span className="text-muted"> / {objective.goalMinutes} min</span>
              </p>
              {objective.met && <p className="t-meta mt-0.5 text-emerald-300">Atteint</p>}
            </div>
          </div>

          {/* NOTER DU TEMPS juste sous l'anneau : la saisie le fait avancer
              sous les yeux de l'élève. Voir components/work/quick-log.tsx. */}
          <QuickLog sessions={sessions} saveSessions={saveSessions} removeSession={removeSession} ready={ready} />

          {/* AUJOURD'HUI — ce qui est prévu, face à ce que la journée peut
              absorber. Deux nombres, pas un graphique : « suis-je à jour ? »
              se répond en les comparant, et rien d'autre ne le répond. */}
          {(today.load.plannedMinutes > 0 || today.slots.length > 0) && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-label">Prévu aujourd&apos;hui</p>
                <p className="tabular t-meta shrink-0 whitespace-nowrap">
                  <span className="text-ink">{formatSpan(today.load.plannedMinutes * 60)}</span> /{" "}
                  {formatSpan(today.load.capacityMinutes * 60)}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {today.slots.map((slot) => (
                  <li key={slot.workItemId} className="flex items-baseline gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
                      {slot.title}
                      <span className="text-subtle"> · {WORK_ITEM_KIND_META[slot.kind].short}</span>
                    </span>
                    <span className="tabular shrink-0 whitespace-nowrap text-2xs text-muted">{formatSpan(slot.minutes * 60)}</span>
                  </li>
                ))}
              </ul>
              {(today.load.status === "surchargé" || today.load.status === "intenable") && (
                <p className={cn("t-meta mt-1.5 text-2xs", today.load.status === "intenable" ? "text-rose-300" : "text-amber-300")}>
                  {LOAD_STATUS_META[today.load.status].label} — {describeTodayLoad(today.load.overflowMinutes, today.load.status)}
                </p>
              )}
            </div>
          )}

          {/* CETTE SEMAINE PAR MATIÈRE — le budget que l'élève s'est fixé
              (Réglages), face au temps réellement noté. Juste sous la saisie
              rapide et le prévu du jour : noter 30 min d'anglais fait bouger
              la ligne correspondante sous les yeux. Absent quand aucune
              matière n'a de budget — un bloc vide n'apprend rien. */}
          {subjectTargets.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="t-label">Cette semaine par matière</p>
                <Link href="/settings" className="t-meta shrink-0 rounded text-2xs hover:text-ink max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
                  Régler
                </Link>
              </div>
              <SubjectTargetList rows={subjectTargets} />
            </div>
          )}

          {/* À SURVEILLER — les échéances qui approchent, et celles qui ne
              tiennent plus. Les deux signaux restent distincts : « en retard »
              est un fait, « ne tient pas » une projection. */}
          {watchList.length > 0 && (
            <div>
              <p className="t-label mb-2">À surveiller</p>
              <ul className="divide-y divide-line border-y border-line">
                {watchList.map((priority) => (
                  <li key={priority.item.id}>
                    <Link href="/echeances" className="row-hover block rounded-md py-2.5 max-lg:min-h-11">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">{priority.item.title}</span>
                        <span className="tabular shrink-0 whitespace-nowrap text-2xs text-muted">
                          {formatSpan(priority.remainingMinutes * 60)}
                        </span>
                      </span>
                      <span className="t-meta mt-0.5 block truncate text-2xs">
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

          <dl className="divide-y divide-line border-y border-line">
            <RailFigure label="Cette semaine" value={formatSpan(weeklySummary.totalSeconds)} detail={`${weeklySummary.progressPercent} % de l'objectif`} />
            {streak > 0 && (
              <RailFigure label="Série" value={`${streak} j`} detail="jours d'affilée" icon={<Flame size={13} className="text-accent" />} />
            )}
            {contestDays !== null && (
              /* « J−223 · avant l'échéance » ne disait pas QUELLE échéance.
                 Un compte à rebours sans sa date oblige à aller la vérifier
                 dans les réglages pour la resituer dans un calendrier. */
              <RailFigure
                label="Concours"
                value={`J−${contestDays}`}
                detail={contestDate ?? "avant l'échéance"}
                icon={<Trophy size={13} className="text-accent" />}
              />
            )}
          </dl>

          {/* AUSSI SIGNALÉ vit dans le rail, pas sous la séance : ce sont des
              signaux à surveiller, pas des choses à faire maintenant. Les
              mettre dans le flux principal les mettait au même rang que le
              plan du jour. */}
          {(secondaryPicks.length > 0 || otherSignals.length > 0) && (
            <div>
              <p className="t-label mb-2">Aussi signalé</p>
              <ul className="divide-y divide-line border-y border-line">
                {secondaryPicks.map(({ exercise, reasons }) => (
                  <li key={exercise.id}>
                    <Link href={`/exercises?focus=${exercise.id}`} className="row-hover flex items-center gap-2.5 rounded-md py-2.5 max-lg:min-h-11">
                      <SubjectAvatar subject={exercise.subject} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] text-ink">
                          <MathInline text={exercise.title} />
                        </span>
                        <span className="t-meta mt-0.5 block truncate text-2xs">{reasons.slice(0, 1).join(" · ")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {otherSignals.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="row-hover block rounded-md py-2.5 max-lg:min-h-11">
                      <span className="block truncate text-[0.8125rem] text-ink">{item.label}</span>
                      <span className="t-meta mt-0.5 block truncate text-2xs">{item.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col items-start gap-2">
            <Link href="/echeances" className="t-meta inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink max-lg:min-h-11">
              <CalendarClock size={14} /> Mes échéances
            </Link>
            <Link href="/preparation" className="t-meta inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink max-lg:min-h-11">
              <LayoutList size={14} /> Suivi par matière
            </Link>
            {/* Carnet d'erreurs */}
            <Link href="/erreurs" className="t-meta inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink max-lg:min-h-11">
              <NotebookPen size={14} /> Carnet d&apos;erreurs
            </Link>
            <Link href="/progress" className="t-meta inline-flex min-h-6 items-center gap-1 rounded hover:text-ink max-lg:min-h-11">
              Ma progression <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-10">
        {/* EN-TÊTE RÉDUIT À UNE LIGNE.
            La salutation était composée en `t-display`, au même corps que le
            titre du bloc « La séance » juste en dessous : deux titres de
            même poids, donc aucun des deux ne désignait plus l'élément
            important. Elle passe en `quiet` (voir `PageBar`) et sa date se
            range sur la même ligne — la décision du jour redevient le seul
            grand titre de l'écran, et gagne la hauteur correspondante. */}
        <PageBar
          rank="quiet"
          title={name ? `Bonjour, ${name}.` : "Bonjour."}
          meta={
            <>
              <span className="capitalize">{dateFormatter.format(new Date())}</span> · {statusLine}
            </>
          }
        />

        {/* ── LA SÉANCE ─────────────────────────────────────────────
            Seul bloc encadré et seul bouton plein de l'écran. */}
        <Section
          variant="feature"
          label="La séance"
          title={firstSlot ? "Ce que tu devrais travailler maintenant" : hasPlan ? "Ce que tu devrais travailler maintenant" : <MathInline text={nextAction.title} />}
          /* Le chapeau justifie CE QUI EST AFFICHÉ, jamais autre chose.
             Quand un plan existe mais que sa première recommandation ne porte
             aucune raison explicite, on retombait sur `nextAction.description`
             — la justification d'un exercice qui, lui, n'apparaît nulle part
             sur l'écran (« Tu n'as pas encore travaillé cet exercice. » :
             lequel ?). Mieux vaut pas de phrase du tout : le bloc
             « Maintenant » dit déjà l'intention et la matière. */
          description={firstSlot ? (slotPriority ? explainPriority(slotPriority) ?? undefined : undefined) : hasPlan ? planReason ?? undefined : nextAction.description}
          /* Le sélecteur de durée ne s'affiche QUE quand la banque pilote le
             bloc : en mode planning, les durées viennent des créneaux, et un
             contrôle sans effet est pire qu'un contrôle absent. Le temps
             disponible se règle alors là où il a du sens — la capacité
             (Réglages) et le budget de la séance elle-même. */
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
            /*
             * MODE PLANNING — même composition « Maintenant / Puis » que la
             * séance de la banque, mais alimentée par les créneaux du jour.
             * Rien de nouveau à l'écran : c'est la SOURCE qui change, pas la
             * forme, pour que l'élève n'ait qu'un seul endroit à regarder.
             */
            <div key={firstSlot.workItemId} className="animate-fade-in border-y border-line">
              <div className="flex items-baseline gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="t-label mb-1.5">Maintenant</p>
                  <p className="t-heading">{firstSlot.title}</p>
                  <p className="t-meta mt-1">
                    {WORK_ITEM_KIND_META[firstSlot.kind].label}
                    {firstSlot.subject && ` · ${firstSlot.subject}`}
                  </p>
                </div>
                {/* `formatSpan` et non « N min » : un créneau de planning
                    peut dépasser l'heure (un travail en retard se rattrape
                    d'un bloc), et « 90 min » se lit moins vite que « 1 h 30 ».
                    Le pied de bloc affiche déjà le total dans cette forme. */}
                <span className="t-figure-sm tabular shrink-0 whitespace-nowrap">{formatSpan(firstSlot.minutes * 60)}</span>
              </div>

              {nextSlots.length > 0 && (
                <ol className="border-t border-line pb-1 pt-3">
                  <li className="t-label mb-1">Puis</li>
                  {nextSlots.map((slot) => (
                    <li key={slot.workItemId} className="flex items-baseline gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{slot.title}</p>
                        <p className="t-meta mt-0.5 truncate text-2xs">
                          {WORK_ITEM_KIND_META[slot.kind].label}
                          {slot.subject && ` · ${slot.subject}`}
                        </p>
                      </div>
                      <span className="t-meta tabular shrink-0 whitespace-nowrap">{formatSpan(slot.minutes * 60)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          {!firstSlot && hasPlan && (
            /*
             * MAINTENANT, PUIS — pas un sommaire de trois lignes égales.
             *
             * Le plan se lisait comme une table des matières : trois rangées
             * de même poids, numérotées, qu'il fallait parcourir pour
             * comprendre par quoi commencer. Or la question posée en ouvrant
             * l'application le matin n'est pas « que contient ma séance »,
             * c'est « je fais quoi, là, tout de suite » — et la réponse
             * tenait dans la même graisse que le reste.
             *
             * Le premier bloc est donc COMPOSÉ comme la réponse : son
             * intitulé en `t-heading`, sa durée en chiffre serif à droite,
             * son détail dessous. Ce qui suit reste une liste, en retrait.
             * Aucune donnée nouvelle, aucun calcul déplacé : exactement les
             * mêmes `dailyPlan.blocks`, dans le même ordre.
             */
            /*
             * Le `key` sur la durée demandée est la SEULE animation ajoutée à
             * cet écran, et elle est fonctionnelle : quand on passe de 45 à
             * 90 minutes, le plan change entièrement — intitulés, durées,
             * nombre de blocs — mais le texte se substituait d'une image à
             * l'autre, sans rien signaler. Un fondu de 180 ms dit « ceci
             * vient d'être recalculé ». Il est annulé par
             * `prefers-reduced-motion` comme tout le reste (voir
             * app/globals.css).
             */
            <div key={planMinutes} className="animate-fade-in border-y border-line">
              <div className="flex items-baseline gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="t-label mb-1.5">Maintenant</p>
                  <p className="t-heading">
                    {firstBlock.label}
                    <span className="text-muted"> — {PLAN_INTENT_META[firstBlock.intent].description}</span>
                  </p>
                  {/* Le nombre de fiches ne figure plus ici : ce qui décide de
                      se mettre au travail, c'est le sujet et la durée. Le
                      décompte reste sur l'écran de séance, où l'on règle
                      justement la taille de la séance. */}
                  <p className="t-meta mt-1">{firstBlock.focus}</p>
                </div>
                <span className="t-figure-sm tabular shrink-0 whitespace-nowrap">
                  {firstBlock.estimatedMinutes}
                  <span className="t-meta"> min</span>
                </span>
              </div>

              {nextBlocks.length > 0 && (
                <ol className="border-t border-line pb-1 pt-3">
                  <li className="t-label mb-1">Puis</li>
                  {nextBlocks.map((block) => (
                    <li key={block.intent} className="flex items-baseline gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          {block.label}
                          <span className="text-muted"> — {PLAN_INTENT_META[block.intent].description}</span>
                        </p>
                        <p className="t-meta mt-0.5 truncate text-2xs">{block.focus}</p>
                      </div>
                      <span className="t-meta tabular shrink-0">{block.estimatedMinutes} min</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="t-meta">
              {firstSlot ? (
                <>
                  <span className="font-medium text-ink">{formatSpan(today.load.plannedMinutes * 60)}</span> prévues aujourd&apos;hui
                  {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites</>}
                </>
              ) : hasPlan ? (
                <>
                  <span className="font-medium text-ink">{formatMinutesSpan(dailyPlan.totalMinutes)}</span>
                  {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites aujourd&apos;hui</>}
                </>
              ) : nextAction.kind === "empty-bank" ? (
                "Ta banque est vide — TaekdHub ne peut rien te proposer tant qu'elle l'est."
              ) : (
                "Rien à planifier pour l'instant — ta banque est à jour."
              )}
            </p>
            {firstSlot && slotHref ? (
              <Link href={slotHref}>
                <Button size="lg">
                  Commencer <ArrowRight size={16} />
                </Button>
              </Link>
            ) : hasPlan ? (
              <Button size="lg" onClick={startPlan}>
                Commencer <ArrowRight size={16} />
              </Button>
            ) : (
              <Link href={sessionHref}>
                <Button size="lg">
                  {nextAction.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            )}
          </div>
        </Section>

        {/* Le rappel de sauvegarde est une CORVÉE, pas une décision : posé en
            tête d'écran, il repoussait la séance d'une centaine de pixels et
            accueillait chaque semaine par un bandeau orange. Il reste
            exactement aussi visible, mais APRÈS ce qu'on est venu chercher. */}
        <BackupReminder />

        {/* ── REPRENDRE ─────────────────────────────────────────────
            Ce sur quoi on travaillait hier. Au tout début, il n'y a rien à
            reprendre : on propose alors d'entrer par une matière, plutôt que
            de laisser la colonne se terminer sur du vide. */}
        {resume.length > 0 ? (
          <Section label="Reprendre" title="Ce que tu travaillais">
            <List>
              {resume.map(({ exercise, at }) => (
                <li key={exercise.id}>
                  <Link href={`/exercises?focus=${exercise.id}`} className={rowInteractive}>
                    <SubjectAvatar subject={exercise.subject} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
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
            /*
             * PAS UNE VITRINE DE LA BANQUE.
             *
             * Ce bloc annonçait « La banque entière, rangée par chapitre » et
             * listait « 321 exercices · 7 % maîtrisés » par matière : sur
             * l'écran le plus consulté du produit, un inventaire. Il mène
             * désormais au SUIVI de la matière, et ne montre que
             * l'avancement — un pourcentage, pas un stock de fiches.
             */
            <Section label="Explorer" title="Ou entre par une matière" description="Où tu en es, matière par matière.">
              <List>
                {subjects.map((entry) => (
                  <li key={entry.subject}>
                    <Link href={`/preparation?subject=${encodeURIComponent(entry.subject)}`} className={rowInteractive}>
                      <SubjectAvatar subject={entry.subject} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="t-subhead truncate">{entry.subject}</p>
                        <p className="t-meta mt-0.5">
                          {entry.completionRate > 0 ? `${entry.completionRate} % acquis` : "Pas encore mesuré"}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-subtle" />
                    </Link>
                  </li>
                ))}
              </List>
            </Section>
          )
        )}

        {/* ── À REVOIR ──────────────────────────────────────────────
            Dans la colonne principale et non dans le rail : c'est une
            SAISIE, et le rail est fait pour être lu. Sous la séance et
            « Reprendre », parce que noter ce qu'il faut revoir vient après
            avoir travaillé, pas avant. Six lignes au plus : au-delà,
            l'accueil deviendrait le carnet, et le carnet a sa page. */}
        <Section
          label="À revoir"
          title="Ce qu'il faut reprendre"
          action={
            <Link href="/revoir" className="t-meta inline-flex min-h-6 items-center gap-1 rounded hover:text-ink max-lg:min-h-11">
              Le carnet <ChevronRight size={14} />
            </Link>
          }
        >
          <ReviewCapture
            items={reviewItems}
            saveItems={saveReviewItems}
            ready={ready}
            visible={openReviews}
            limit={REVIEW_ITEMS_ON_DASHBOARD}
            allHref="/revoir"
          />
        </Section>

        {/* ── À CONSOLIDER ──────────────────────────────────────────── */}
        {toConsolidate.length > 0 && (
          <Section
            label="À consolider"
            title="Ces chapitres appellent du travail"
            description="Classés par urgence réelle, chacun justifié par tes tentatives datées."
          >
            <List>
              {toConsolidate.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
                <li key={chapter.id}>
                  <Link href={href} className={rowInteractive}>
                    {/* Le RANG, écrit.
                        La section annonce « classés par urgence réelle », mais
                        les maîtrises voisines (0 %, 3 %, 3 %, 4 %) ne
                        laissaient rien voir de ce classement : cinq lignes
                        d'apparence interchangeable. Le numéro dit ce que
                        l'ordre veut dire, exactement comme la liste des
                        priorités de l'écran Progression. */}
                    <span className="t-figure w-4 shrink-0 text-right text-sm text-subtle">{index + 1}</span>
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
                    {/* La maîtrise est un CHIFFRE, pas une barre : sur cinq
                        lignes, cinq barres de longueurs voisines se comparent
                        moins bien que cinq nombres alignés. */}
                    <span
                      className={cn(
                        "t-figure tabular shrink-0 text-base",
                        averageMastery >= 75 ? "text-emerald-300" : averageMastery >= 40 ? "text-amber-300" : "text-rose-300"
                      )}
                    >
                      {averageMastery}
                      <span className="text-xs font-normal text-subtle"> %</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        )}
      </div>
    </Split>
  );
}

/** Au-delà, l'accueil deviendrait le carnet — le reste vit sur /revoir. */
const REVIEW_ITEMS_ON_DASHBOARD = 6;

/** « aujourd'hui » / « hier » / « il y a 4 jours » — jamais une date brute pour du travail récent. */
function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Chiffre du rail — étiquette, valeur, précision. Une ligne, séparée par un filet. */
function RailFigure({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="t-label">{label}</dt>
        {detail && <dd className="t-meta mt-0.5 text-2xs">{detail}</dd>}
      </div>
      <dd className="t-figure-sm flex shrink-0 items-center gap-1.5">
        {icon}
        {value}
      </dd>
    </div>
  );
}

/** Phrase d'alerte de la journée — toujours avec son chiffre, jamais un mot seul. */
function describeTodayLoad(overflowMinutes: number, status: "surchargé" | "intenable"): string {
  return status === "intenable"
    ? `dépassement de ${formatSpan(overflowMinutes * 60)} sur ta capacité.`
    : "le planning entame ta marge.";
}
