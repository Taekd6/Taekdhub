"use client";

import { useEffect, useMemo, useState } from "react";
import { HomeTopBar } from "@/components/home/hero";
import { HomeGreeting } from "@/components/home/desktop-header";
import { EveningWidget, ExamWidget, NowWidget, WeekWidget } from "@/components/home/widgets";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { addDays, buildWeek, mondayOf } from "@/lib/week-agenda";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";

/**
 * ÉCRAN D'ACCUEIL — MINIMALISTE (mission 19, 2026-10-27, demande de l'élève :
 * « les données restent dans le back end, pas dans ce que je vois »).
 *
 * Rôles : Rappels d'Apple est l'outil de l'élève (il range, il coche) ;
 * TaekdHub est celui de Claude (il y entre le travail, il vérifie ce qui est
 * coché). L'accueil ne montre donc que quatre widgets : CE SOIR, PROCHAINE
 * ÉPREUVE, EN CE MOMENT, MA SEMAINE (components/home/widgets.tsx).
 *
 * Retirés de l'accueil (composants conservés, sans appelant ici) :
 * « Aujourd'hui » (lib/today-view.ts), « À faire » (doublon de Rappels),
 * « Mes chapitres » (dans la navigation), le rappel de sauvegarde (Réglages).
 * Toutes les données restent lues, écrites et synchronisées comme avant.
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
  const { workItems, saveWorkItems, preferences, ready } = usePrepahubData();
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
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-12">
        <EveningWidget workItems={workItems} saveWorkItems={saveWorkItems} now={now} className="col-span-2 lg:col-span-7 lg:row-span-2" />
        <ExamWidget events={calendar.events} workItems={workItems} now={now} className="col-span-1 lg:col-span-5" />
        <NowWidget events={calendar.events} hasFeeds={preferences.calendarFeeds.length > 0} now={now} className="col-span-1 lg:col-span-5" />
        <WeekWidget columns={columns} now={now} className="col-span-2 lg:col-span-12" />
      </div>
    </div>
  );
}
