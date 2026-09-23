"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, ChevronRight, Clock3, Flame, LayoutList, LineChart, NotebookPen, PenLine, Trophy } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { QuickLog } from "@/components/work/quick-log";
import { ReviewCapture } from "@/components/review/review-capture";
import { DueToday } from "@/components/review/due-today";
import { DailyCheckinCard } from "@/components/checkin/daily-checkin"; // check-in du soir
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SegmentRing } from "@/components/ui/progress";
import { StackedColumns } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useCountUp } from "@/hooks/use-count-up";
import { computeStreak } from "@/lib/gamification";
import { computeDailyObjective, computeStatusLine } from "@/lib/daily-objective";
import { formatSpan } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import { computeSubjectTargets } from "@/lib/subject-targets";
import { SubjectTargetList } from "@/components/work/subject-targets";
import { buildWeeklyPlan } from "@/lib/planning";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";
import { LOAD_STATUS_META } from "@/lib/workload";
import { selectReviewItems } from "@/lib/review-items";
import { dueReviewItems, nextReviewDay } from "@/lib/spaced-repetition";
import { ringSegments, todayBySubject, weekDayStacks } from "@/lib/day-stack";
import { subjectMeta, subjects as allSubjects } from "@/lib/study";
import { cn } from "@/lib/cn";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const contestDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Anneau du jour : diamètre et épaisseur, partagés entre le dessin et le calcul de l'écart entre segments. */
const RING_SIZE = 176;
const RING_STROKE = 14;

/**
 * ÉCRAN D'ACCUEIL — « où en est ma journée ? »
 *
 * L'élève travaille sur ses propres feuilles : TaekdHub ne lui dit plus QUOI
 * travailler (la banque d'exercices intégrée, son moteur de recommandation
 * et son « plan du jour » ont été retirés), il l'aide à consigner et à voir
 * son travail. L'accueil s'ouvre donc sur trois cartes, dans cet ordre :
 *
 *   1. MA JOURNÉE — le temps d'aujourd'hui face à l'objectif du jour
 *      (l'anneau, une couleur par matière), et les deux gestes qui le font
 *      avancer : lancer le chrono, ou noter du temps après coup.
 *   2. ÉCHÉANCES — ce que le planning prévoit aujourd'hui et les prochaines
 *      échéances (lib/planning.ts, recalculé à chaque rendu, jamais stocké).
 *   3. RÉVISIONS DU JOUR — la répétition espacée du carnet « À revoir ».
 *
 * Suivent, inchangés : la saisie rapide, la semaine (et le check-in du
 * soir), les budgets par matière, le carnet « À revoir », puis les liens.
 * Version volontairement sobre : la mise en forme sera reprise plus tard.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants (saisie rapide, carnet) : chaque appel du hook tient
 * sa propre copie de l'état, et une seconde copie resterait figée après une
 * saisie.
 */
export function DashboardOverview() {
  const { sessions, workItems, reviewItems, preferences, ready, saveSessions, removeSession, saveReviewItems, checkins, saveCheckins } = usePrepahubData();

  const model = useMemo(() => {
    const now = new Date();
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    return {
      objective,
      statusLine: computeStatusLine(objective),
      weeklySummary: computeWeeklySummary(sessions, preferences.weeklyGoalMinutes, now),
      // Pondéré par la capacité déclarée : un plan tourné vers le week-end
      // n'est pas « en retard » le samedi matin (voir lib/subject-targets.ts).
      subjectTargets: computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday),
      streak: computeStreak(sessions),
      // Les deux figures colorées : même définition du temps que l'objectif
      // du jour et le bilan de la semaine (voir lib/day-stack.ts).
      today: todayBySubject(sessions, now),
      week: weekDayStacks(sessions, now),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
      contestDate: preferences.contestDate ? contestDateFormatter.format(new Date(preferences.contestDate)) : null,
    };
  }, [sessions, preferences]);

  const openReviews = useMemo(() => selectReviewItems(reviewItems, { openOnly: true }), [reviewItems]);

  /*
   * LE PLANNING, recalculé à chaque rendu depuis les travaux, les séances et
   * la capacité déclarée — jamais stocké, donc jamais périmé (voir
   * lib/planning.ts). L'accueil n'en affiche que deux choses : ce qui est
   * prévu aujourd'hui, et les prochaines échéances. Le détail vit sur
   * /echeances.
   */
  const workPlan = useMemo(
    () => buildWeeklyPlan(workItems, sessions, preferences, new Date()),
    [workItems, sessions, preferences]
  );

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

  const { objective, statusLine, weeklySummary, subjectTargets, streak, contestDays, contestDate, today: todayParts, week } = model;
  const today = workPlan.days[0];
  const hasTodayPlan = today.load.plannedMinutes > 0 || today.slots.length > 0;
  /*
   * PROCHAINES ÉCHÉANCES — les travaux ouverts DATÉS, les plus prioritaires
   * d'abord (même tri que /echeances), trois au plus. Un retard ou une
   * échéance qui ne tient plus est dit en couleur ; le reste, en jours.
   */
  const upcomingDeadlines = workPlan.priorities.filter((priority) => priority.item.dueDate !== null).slice(0, 3);

  /* RÉVISIONS DU JOUR — `DueToday` ne rend rien quand le carnet n'a aucune
     révision programmée : la carte le dit alors elle-même. */
  const reviewNow = new Date();
  const hasScheduledReviews = dueReviewItems(reviewItems, reviewNow).length > 0 || nextReviewDay(reviewItems, reviewNow) !== null;

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
        <div className="shrink-0 max-sm:w-full">
          {/* L'ACTION PRINCIPALE — une seule par écran : se mettre au travail,
              chrono lancé. Un lien STYLÉ en bouton, pas un bouton dans un
              lien : deux éléments interactifs imbriqués font deux arrêts de
              tabulation pour une action. */}
          <Link href="/timer" className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}>
            Lancer le chrono <ArrowRight size={17} strokeWidth={2.4} />
          </Link>
        </div>
      </header>

      <div className="grid grid-flow-row-dense gap-4 sm:gap-5 lg:grid-cols-3">
        {/* ── 1. MA JOURNÉE — l'anneau par matière et les deux gestes ─── */}
        <Section
          variant="feature"
          index={1}
          className="lg:col-span-2"
          title="Ma journée"
          description={`${objective.workedMinutes} min sur ${objective.goalMinutes} min d'objectif.`}
          bodyClassName="flex flex-col items-center gap-6 sm:flex-row sm:items-center"
        >
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
          <div className="flex min-w-0 flex-1 flex-col gap-4 max-sm:w-full">
            {todayParts.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {todayParts.map((part) => (
                  <li key={part.subject} className="flex items-center gap-1.5 text-[0.8125rem]">
                    <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", subjectMeta[part.subject].solid)} />
                    <span className="font-semibold text-ink">{part.subject}</span>
                    <span className="tabular text-muted">{formatSpan(part.seconds)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-meta">Rien de noté aujourd&apos;hui. Chaque séance ou saisie colore l&apos;anneau.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/timer" className={cn(buttonVariants({ variant: "secondary" }), "max-sm:flex-1")}>
                <Clock3 size={16} aria-hidden /> Chrono
              </Link>
              <a href="#noter-du-temps" className={cn(buttonVariants({ variant: "secondary" }), "max-sm:flex-1")}>
                <PenLine size={16} aria-hidden /> Noter du temps
              </a>
            </div>
          </div>
        </Section>

        {/* ── 2. ÉCHÉANCES — le planning du jour et ce qui arrive ─────── */}
        <Section
          variant="panel"
          index={2}
          title="Échéances"
          action={
            <Link href="/echeances" className="t-meta inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-ink max-lg:min-h-11">
              Tout voir <ChevronRight size={14} />
            </Link>
          }
        >
          {hasTodayPlan && (
            <div className="mb-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-label">Prévu aujourd&apos;hui</p>
                <p className="tabular t-meta shrink-0 whitespace-nowrap">
                  <span className="font-bold text-ink">{formatSpan(today.load.plannedMinutes * 60)}</span> / {formatSpan(today.load.capacityMinutes * 60)}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {today.slots.map((slot) => (
                  <li key={slot.workItemId}>
                    {/* Chaque créneau part au chrono, rattaché à son travail. */}
                    <Link href={`/timer?travail=${slot.workItemId}`} className="row-hover -mx-2 flex items-baseline gap-3 rounded-xl px-2 py-2 max-lg:min-h-11">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {slot.title}
                        <span className="text-subtle"> · {WORK_ITEM_KIND_META[slot.kind].short}</span>
                      </span>
                      <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] font-semibold text-muted">{formatSpan(slot.minutes * 60)}</span>
                    </Link>
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
          {upcomingDeadlines.length > 0 ? (
            <div>
              <p className="t-label mb-1">Prochaines échéances</p>
              <ul className="divide-y divide-line">
                {upcomingDeadlines.map((priority) => (
                  <li key={priority.item.id}>
                    <Link href="/echeances" className="row-hover -mx-2 block rounded-xl px-2 py-2.5 max-lg:min-h-11">
                      <span className="flex items-baseline gap-2">
                        {priority.item.subject && <SubjectAvatar subject={priority.item.subject} size="sm" />}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{priority.item.title}</span>
                        <span className="tabular shrink-0 whitespace-nowrap text-[0.8125rem] text-muted">{formatSpan(priority.remainingMinutes * 60)}</span>
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block truncate text-[0.8125rem]",
                          priority.overdue || priority.feasibility.level === "non casable"
                            ? "text-rose-300"
                            : priority.daysUntilDue !== null && priority.daysUntilDue <= 1
                              ? "text-amber-300"
                              : "text-muted"
                        )}
                      >
                        {describeDeadline(priority.overdue, priority.feasibility.level === "non casable", priority.daysUntilDue)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            !hasTodayPlan && (
              <p className="t-meta">
                Aucune échéance datée.{" "}
                <Link href="/echeances" className="text-accent hover:underline">
                  Ajouter un DM, un DS…
                </Link>
              </p>
            )
          )}
        </Section>

        {/* ── 3. RÉVISIONS DU JOUR — la répétition espacée du carnet ───── */}
        <Section variant="panel" index={3} title="Révisions du jour">
          {hasScheduledReviews ? (
            <DueToday items={reviewItems} />
          ) : (
            <p className="t-meta">
              Aucune révision programmée. Les lignes notées dans le carnet « À revoir » reviennent ici au bon moment.{" "}
              <Link href="/revoir" className="text-accent hover:underline">
                Ouvrir le carnet
              </Link>
            </p>
          )}
        </Section>

        {/* ── NOTER DU TEMPS — la cible du bouton « Noter du temps » de Ma
            journée. Voir components/work/quick-log.tsx. */}
        <div id="noter-du-temps" className="scroll-mt-24 lg:col-span-2">
          <Section variant="panel" index={4} title="Noter du temps" description="Anki, relecture de cours… ce que le chrono n'a pas vu." className="h-full">
            <QuickLog sessions={sessions} saveSessions={saveSessions} removeSession={removeSession} ready={ready} />
          </Section>
        </div>

        {/* ── LA SEMAINE — sept colonnes empilées par matière ────────── */}
        <Section
          variant="panel"
          index={5}
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
            index={6}
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
          <ReviewCapture
            items={reviewItems}
            saveItems={saveReviewItems}
            ready={ready}
            visible={openReviews}
            limit={REVIEW_ITEMS_ON_DASHBOARD}
            allHref="/revoir"
          />
        </Section>

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

/** Échéance en mots — un retard ou une impossibilité d'abord, puis la distance en jours. */
function describeDeadline(overdue: boolean, impossible: boolean, daysUntilDue: number | null): string {
  if (overdue) return "En retard";
  if (impossible) return "Ne tient plus dans tes journées";
  if (daysUntilDue === 0) return "À rendre aujourd'hui";
  if (daysUntilDue === 1) return "À rendre demain";
  return daysUntilDue === null ? "Sans date" : `Dans ${daysUntilDue} jours`;
}

/** Phrase d'alerte de la journée — toujours avec son chiffre, jamais un mot seul. */
function describeTodayLoad(overflowMinutes: number, status: "surchargé" | "intenable"): string {
  return status === "intenable"
    ? `dépassement de ${formatSpan(overflowMinutes * 60)} sur ta capacité.`
    : "le planning entame ta marge.";
}
