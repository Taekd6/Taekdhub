"use client";

import { useEffect, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { HomeTopBar } from "@/components/home/hero";
import { HomeGreeting } from "@/components/home/desktop-header";
import { EveningWidget, ExamWidget, NowWidget, WeekWidget } from "@/components/home/widgets";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { addDays, buildWeek, mondayOf } from "@/lib/week-agenda";
import { ChaptersCard } from "@/components/home/chapters-card";
import { TodayCard } from "@/components/home/today-card";
import { TodoCard } from "@/components/home/todo-card";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";

/**
 * ÉCRAN D'ACCUEIL — un OUTIL D'ORGANISATION (2026-10-24), qui ne propose que
 * ce que l'élève a déjà posé (2026-10-25, sur sa demande : « ouvrir le site,
 * savoir quoi faire, être prêt pour mes échéances »).
 *
 * TaekdHub range et montre ; ce sont les conversations avec Claude qui
 * proposent exercices et colles. L'accueil garde :
 *
 *   le bandeau   salutation (horloge dès `lg`) et la semaine ;
 *   AUJOURD'HUI  3 à 5 lignes, avec leur raison : échéances proches, erreurs
 *                et cours des chapitres EN COURS (lib/today-view.ts) ; Anki à part ;
 *   À FAIRE      la liste de tâches de l'élève, rangée par échéance (il l'écrit,
 *                la coche, la supprime) ;
 *   CHAPITRES    « Mes chapitres » (cours, méthodes, erreurs rangés) ; le rappel
 *                de sauvegarde en bas.
 *
 * Retirés de l'accueil (les composants sont conservés, sans appelant ici) :
 * « Ton prochain mouvement » (Next Move), « Le reste de ta journée », la
 * progression du jour et le check-in du sommeil. Les autres écrans (`/progress`,
 * `/revision`, `/timer`…) existent toujours.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants : chaque appel du hook tient sa propre copie de
 * l'état, et une seconde copie resterait figée après une saisie.
 */
/** L'heure, rafraîchie chaque minute : « en ce moment », « ce soir ». */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function DashboardOverview() {
  const { workItems, saveWorkItems, preferences, ready, errors, chapterNotes, ankiSnapshots } = usePrepahubData();
  const now = useMinute();
  const dayStamp = now.toDateString();
  // Lundi de la semaine, et deux semaines d'agenda (le prochain DS peut être la semaine suivante).
  const monday = useMemo(() => mondayOf(new Date(dayStamp)), [dayStamp]);
  const horizon = useMemo(() => addDays(monday, 14), [monday]);
  const calendar = useCalendarEvents(preferences.calendarFeeds, monday, horizon);
  const columns = useMemo(() => buildWeek(monday, calendar.events, workItems), [monday, calendar.events, workItems]);

  const contestDays = preferences.contestDate ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000)) : null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-[68rem] space-y-6">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-48 w-full rounded-[1.625rem]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[68rem]">
      <HomeTopBar name={preferences.displayName ?? ""} avatar={preferences.avatarDataUrl} contestDays={contestDays} className="mb-6 lg:hidden" />
      <HomeGreeting className="mb-4 lg:mb-6" />

      {/* ── WIDGETS : ce soir, la prochaine épreuve, le cours en cours, la semaine ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 lg:mb-8 lg:grid-cols-12">
        <EveningWidget workItems={workItems} saveWorkItems={saveWorkItems} now={now} className="col-span-2 lg:col-span-7 lg:row-span-2" />
        <ExamWidget events={calendar.events} workItems={workItems} now={now} className="col-span-1 lg:col-span-5" />
        <NowWidget events={calendar.events} hasFeeds={preferences.calendarFeeds.length > 0} now={now} className="col-span-1 lg:col-span-5" />
        <WeekWidget columns={columns} now={now} className="col-span-2 lg:col-span-12" />
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-0">
        {/* ── COLONNE « À FAIRE » : la liste de tâches de l'élève ── */}
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          <TodayCard workItems={workItems} errors={errors} chapterNotes={chapterNotes} ankiSnapshots={ankiSnapshots} currentChapterIds={preferences.currentChapterIds} className="order-1 lg:order-none" />
          <TodoCard workItems={workItems} saveWorkItems={saveWorkItems} className="order-2 lg:order-none" />
        </div>

        {/* ── COLONNE « CHAPITRES » : ce qui est rangé ── */}
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <ChaptersCard notes={chapterNotes} errors={errors} className="order-3 lg:order-none" />
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
