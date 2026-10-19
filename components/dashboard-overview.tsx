"use client";

import { useMemo } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { DailyCheckinCard } from "@/components/checkin/daily-checkin"; // check-in du soir
import { HomeTopBar } from "@/components/home/hero";
import { DayProgress, HomeGreeting, WeekStrip } from "@/components/home/desktop-header";
import { NextMoveCard } from "@/components/next-move/next-move-card"; // Next Move
import { DayAgendaCard } from "@/components/home/day-agenda-card";
import { useAnnales } from "@/hooks/use-annales";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import { DeadlinesCard } from "@/components/home/cards";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { effectiveDailyGoal } from "@/lib/evening-minimums";
import { computeDailyObjective } from "@/lib/daily-objective";
import { buildWeeklyPlan } from "@/lib/planning";
import { weekDayStacks } from "@/lib/day-stack";
import { dayKey, subjects as allSubjects, totalSeconds } from "@/lib/study";

/**
 * ÉCRAN D'ACCUEIL — volontairement SOBRE (octobre 2026).
 *
 * L'élève trouvait l'accueil chargé : il ne garde que ce qui sert à décider
 * et à suivre sa journée.
 *
 *   le bandeau   salutation (horloge dès `lg`) et la semaine ;
 *   FAIRE        Next Move (« qu'est-ce que je fais maintenant ? »), puis le
 *                plan du reste de la journée ;
 *   SURVEILLER   la progression du jour, les échéances, et — le soir
 *                seulement — le check-in ; le rappel de sauvegarde en bas.
 *
 * Ce qui a quitté l'accueil existe toujours sur sa page : gestes rapides
 * (chrono, saisie du temps), cartes par matière, courbe, révisions, mémoire,
 * série (`/progress`, `/revision`, `/memoire`, `/timer`…). Les composants
 * retirés (`components/home/cards.tsx`, `hero.tsx`…) sont conservés.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants : chaque appel du hook tient sa propre copie de
 * l'état, et une seconde copie resterait figée après une saisie.
 */
export function DashboardOverview() {
  const { sessions, workItems, reviewItems, preferences, ready, checkins, saveCheckins, chapterMemory, grades, errors, nextMoves, saveNextMoves, attempts, ankiSnapshots, saveWorkItems } = usePrepahubData();
  const kholle = useKholleHistory();

  // Annales corrigées avec Claude (compte connecté seulement) — voir hooks/use-annales.ts.
  const { logs: annales } = useAnnales();

  /* Tout ce que lit le moteur Next Move (lib/next-move/engine.ts) — mémoïsé pour ne recalculer qu'à un vrai changement. */
  const nextMoveData = useMemo(
    () => ({ sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, attempts, ankiSnapshots, kholle }),
    [sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, attempts, ankiSnapshots, kholle]
  );

  const model = useMemo(() => {
    const now = new Date();
    return {
      objective: computeDailyObjective(sessions, effectiveDailyGoal(preferences, now), now),
      todayBySubject: allSubjects
        .map((subject) => ({
          subject,
          minutes: Math.round(totalSeconds(sessions.filter((session) => session.subject === subject && dayKey(session.started_at) === dayKey(now))) / 60),
        }))
        .filter((entry) => entry.minutes > 0),
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

  if (!ready) {
    return (
      <div className="mx-auto max-w-[68rem] space-y-6">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-48 w-full rounded-[1.625rem]" />
      </div>
    );
  }

  const { objective, todayBySubject, contestDays, week } = model;
  const upcomingDeadlines = workPlan.priorities.filter((priority) => priority.item.dueDate !== null).slice(0, 3);

  return (
    <div className="mx-auto max-w-[68rem]">
      <HomeTopBar name={preferences.displayName ?? ""} avatar={preferences.avatarDataUrl} contestDays={contestDays} className="mb-6 lg:hidden" />
      <HomeGreeting className="mb-4 lg:mb-6" />

      <WeekStrip week={week} className="mb-5 lg:mb-6" />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-0">
        {/* ── COLONNE « FAIRE » : la prochaine séance, puis la journée ── */}
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          <NextMoveCard data={nextMoveData} history={nextMoves} saveHistory={saveNextMoves} ready={ready} className="order-1 lg:order-none" />
          <DayAgendaCard data={nextMoveData} history={nextMoves} saveWorkItems={saveWorkItems} ready={ready} className="order-1 lg:order-none" />
        </div>

        {/* ── COLONNE « SURVEILLER » : le jour, les échéances ── */}
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <DayProgress workedMinutes={objective.workedMinutes} goalMinutes={objective.goalMinutes} bySubject={todayBySubject} className="order-2 lg:order-none" />
          <DeadlinesCard deadlines={upcomingDeadlines} className="order-3 lg:order-none" />
          {/* Le check-in du soir n'apparaît que le soir, tant qu'il n'est pas fait ; l'enveloppe disparaît quand il ne rend rien. */}
          <div className="reveal order-4 empty:hidden lg:order-none">
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
