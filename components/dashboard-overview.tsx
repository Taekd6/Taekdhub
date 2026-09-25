"use client";

import { Copy, Plus, SquareX, Timer } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { QuickLog } from "@/components/work/quick-log";
import { ReviewCapture } from "@/components/review/review-capture";
import { DailyCheckinCard } from "@/components/checkin/daily-checkin"; // check-in du soir
import { HomeTopBar, TodayHero, WeekCurve } from "@/components/home/hero";
import { DeadlinesCard, ReviewBanner, StatTiles, SubjectCards } from "@/components/home/cards";
import { ActionButtons, type ActionItem } from "@/components/ui/action-buttons";
import { BlockHeader } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import { computeDailyObjective } from "@/lib/daily-objective";
import { computeWeeklySummary } from "@/lib/week";
import { buildWeeklyPlan } from "@/lib/planning";
import { selectReviewItems } from "@/lib/review-items";
import { dueReviewItems, nextReviewDay } from "@/lib/spaced-repetition";
import { weekDayStacks } from "@/lib/day-stack";
import { dayKey, subjects as allSubjects, totalSeconds } from "@/lib/study";

/**
 * Les quatre gestes du matin, en boutons ronds sous la courbe (maquette
 * « Revolut clair »). Le chrono ouvre la rangée, en dégradé : c'est LE
 * geste de l'application. « Noter » descend à la saisie rapide de cette
 * même page (ancre `#noter`).
 */
const ACTIONS: ActionItem[] = [
  { label: "Chrono", icon: Timer, href: "/timer", primary: true },
  { label: "Noter", icon: Plus, href: "#noter" },
  { label: "Réviser", icon: Copy, href: "/revoir/session" },
  { label: "Erreur", icon: SquareX, href: "/erreurs" },
];

/**
 * ÉCRAN D'ACCUEIL — la maquette validée « D2 · Style Revolut clair »,
 * recomposée avec les vraies données.
 *
 *   1. LA BARRE     avatar en dégradé, date (et J−n du concours), réglages.
 *   2. LE HÉROS     « Aujourd'hui », le temps du jour en énorme (il compte
 *                   jusqu'à sa valeur), et la pastille « vs hier ».
 *   3. LA COURBE    la semaine, minutes par jour, qui se dessine.
 *   4. LES GESTES   Chrono · Noter · Réviser · Erreur, en boutons ronds.
 *   5. MATIÈRES     la galerie de cartes en dégradé (anneau = budget).
 *   6. RÉVISIONS    la bannière du jour (≈ 2 min par carte), « Go ».
 *   7. ÉCHÉANCES    les trois plus pressantes, pastille datée.
 *   8. LES TUILES   Série, Semaine.
 *   9. LA SAISIE    noter du temps, le check-in du soir, le carnet.
 *
 * Peu de texte (« moins de blabla ») : un chiffre, un mot, une sortie.
 *
 * GRAND ÉCRAN. La même page, en deux colonnes : à gauche ce qu'on FAIT
 * (héros, gestes, matières, saisie), à droite ce qu'on SURVEILLE (courbe,
 * révisions, échéances, tuiles). Une seule suite d'éléments dans le DOM :
 * sur téléphone, les deux colonnes sont « transparentes » (`contents`) et
 * `order` rétablit l'ordre de la maquette ; sur grand écran, chacune
 * redevient une pile. L'ordre de tabulation suit donc le DOM — colonne de
 * gauche, puis de droite —, sans jamais sauter d'un bord à l'autre.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants : chaque appel du hook tient sa propre copie de
 * l'état, et une seconde copie resterait figée après une saisie.
 */
export function DashboardOverview() {
  const { sessions, workItems, reviewItems, preferences, ready, saveSessions, removeSession, saveReviewItems, checkins, saveCheckins } = usePrepahubData();

  const model = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = dayKey(yesterday);
    return {
      objective: computeDailyObjective(sessions, preferences.dailyGoalMinutes, now),
      yesterdayMinutes: Math.round(totalSeconds(sessions.filter((session) => dayKey(session.started_at) === yesterdayKey)) / 60),
      weeklySummary: computeWeeklySummary(sessions, preferences.weeklyGoalMinutes, now),
      streak: computeStreak(sessions),
      week: weekDayStacks(sessions, now),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
    };
  }, [sessions, preferences]);

  /*
   * LE PLANNING, recalculé à chaque rendu depuis les travaux, les séances et
   * la capacité déclarée — jamais stocké, donc jamais périmé (voir
   * lib/planning.ts). L'accueil n'en garde que les trois échéances datées
   * les plus prioritaires (même tri que /echeances).
   */
  const workPlan = useMemo(() => buildWeeklyPlan(workItems, sessions, preferences, new Date()), [workItems, sessions, preferences]);

  const reviews = useMemo(() => {
    const now = new Date();
    return {
      open: selectReviewItems(reviewItems, { openOnly: true }),
      due: dueReviewItems(reviewItems, now),
      next: nextReviewDay(reviewItems, now),
    };
  }, [reviewItems]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-[68rem] space-y-6">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="mx-auto h-24 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full rounded-[1.625rem]" />
      </div>
    );
  }

  const { objective, yesterdayMinutes, weeklySummary, streak, contestDays, week } = model;
  const upcomingDeadlines = workPlan.priorities.filter((priority) => priority.item.dueDate !== null).slice(0, 3);

  const subjectCards = allSubjects.map((subject) => ({
    subject,
    seconds: weeklySummary.bySubject.find((entry) => entry.subject === subject)?.seconds ?? 0,
    targetMinutes: preferences.weeklySubjectTargets?.[subject] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-[68rem]">
      <HomeTopBar name={preferences.displayName ?? ""} contestDays={contestDays} className="mb-6 lg:mb-10" />

      <div className="flex flex-col gap-[1.375rem] lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:gap-y-0">
        {/* ── COLONNE « FAIRE » ─────────────────────────────────────── */}
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-8">
          <TodayHero
            todayMinutes={objective.workedMinutes}
            yesterdayMinutes={yesterdayMinutes}
            goalMinutes={objective.goalMinutes}
            className="order-1 pt-2 lg:order-none lg:pt-6"
          />
          <div className="reveal order-3 lg:order-none" style={{ "--i": 2 } as CSSProperties}>
            <ActionButtons items={ACTIONS} className="lg:mx-auto lg:max-w-md" />
          </div>
          <SubjectCards cards={subjectCards} className="order-4 lg:order-none" />

          {/* NOTER DU TEMPS — la cible du bouton « Noter ». */}
          <section id="noter" aria-labelledby="noter-titre" className="surface reveal order-8 scroll-mt-24 p-5 sm:p-6 lg:order-none">
            <BlockHeader id="noter-titre" title="Noter du temps" className="mb-4" />
            <QuickLog sessions={sessions} saveSessions={saveSessions} removeSession={removeSession} ready={ready} />
          </section>

          <section aria-labelledby="reprendre-titre" className="surface reveal order-10 p-5 sm:p-6 lg:order-none">
            <BlockHeader id="reprendre-titre" title="À reprendre" href="/revoir" hrefLabel="Le carnet" className="mb-4" />
            <ReviewCapture
              items={reviewItems}
              saveItems={saveReviewItems}
              ready={ready}
              visible={reviews.open}
              limit={REVIEW_ITEMS_ON_DASHBOARD}
              allHref="/revoir"
            />
          </section>
        </div>

        {/* ── COLONNE « SURVEILLER » ────────────────────────────────── */}
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          {/* La courbe sort de la colonne jusqu'aux bords de l'écran sur
              téléphone, comme dans la maquette ; sur grand écran, elle se
              pose dans une tuile. */}
          <WeekCurve week={week} className="order-2 -mx-4 sm:-mx-6 lg:order-none lg:mx-0 lg:rounded-[1.625rem] lg:bg-[var(--surface-bg)] lg:px-2 lg:pb-4 lg:pt-6 lg:[box-shadow:var(--surface-shadow)]" />
          <ReviewBanner due={reviews.due.length} next={reviews.next} className="order-5 lg:order-none" />
          <DeadlinesCard deadlines={upcomingDeadlines} className="order-6 lg:order-none" />
          <StatTiles
            streak={streak}
            weekSeconds={weeklySummary.totalSeconds}
            weekGoalMinutes={preferences.weeklyGoalMinutes}
            className="order-7 lg:order-none"
          />
          {/* Le check-in du soir n'apparaît que le soir, tant qu'il n'est pas
              fait ; l'enveloppe disparaît quand il ne rend rien. */}
          <div className="reveal order-9 empty:hidden lg:order-none">
            <DailyCheckinCard checkins={checkins} onSave={saveCheckins} ready={ready} />
          </div>
        </div>
      </div>

      {/* Le rappel de sauvegarde est une CORVÉE, pas une décision : il reste
          visible, mais APRÈS ce qu'on est venu chercher. */}
      <div className="mt-10">
        <BackupReminder />
      </div>
    </div>
  );
}

/** Au-delà, l'accueil deviendrait le carnet — le reste vit sur /revoir. */
const REVIEW_ITEMS_ON_DASHBOARD = 6;
