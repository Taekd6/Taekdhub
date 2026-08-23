"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardOverview } from "@/components/dashboard-overview";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeDayFlow } from "@/lib/day-flow";
import { chapterDeadlineSignals, nearestUpcomingDeadline } from "@/lib/deadlines";
import { timeOfDayGreetingWord } from "@/lib/greeting";
import { computeMpReadinessAssessments, computeMpReadinessBonus } from "@/lib/mp-readiness";
import { computeDailyObjective, computeNextAction, computeStatusLine } from "@/lib/next-action";
import { planGapMinutesBySubject } from "@/lib/weekly-plan";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

/**
 * Phrase d'état ("où j'en suis", Phase 1 du sprint Study OS) — réutilise
 * exactement les mêmes fonctions que le corps du Dashboard
 * (lib/next-action.ts), jamais une deuxième lecture de l'état.
 */
export default function DashboardPage() {
  const { sessions, exercises, chapters, preferences, deadlines, weeklyPlan, ready } = usePrepahubData();
  const name = preferences.displayName?.trim();
  // Micro-sprint « Ah ouais » — contexte temporel léger (optionnel) : seul le
  // mot de salutation varie selon l'heure, la personnalisation par prénom
  // reste strictement celle déjà en place.
  const greetingWord = timeOfDayGreetingWord();
  const greeting = ready && name ? `${greetingWord}, ${name}.` : `${greetingWord}.`;

  const description = useMemo(() => {
    if (!ready) return "Une séance claire, puis la suivante.";
    const now = new Date();
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    // Mêmes signaux que le Hero (components/dashboard-overview.tsx) — sans
    // eux, cette ligne pouvait dire "rien n'est signalé aujourd'hui" juste
    // au-dessus d'un Hero qui, lui, recommandait déjà un exercice à cause
    // d'une échéance/d'un retard de plan (Daily Copilot, contradiction
    // détectée en relisant ce fichier).
    const signals = {
      chapterDeadlines: chapterDeadlineSignals(deadlines, now),
      subjectPlanGap: planGapMinutesBySubject(weeklyPlan, sessions, now),
      nearestDeadline: nearestUpcomingDeadline(deadlines, now),
      todayPlanAllDone: computeDayFlow(weeklyPlan, sessions, now).allDone,
      // Sprint « rentrée MP » : même signal que le Hero
      // (components/dashboard-overview.tsx) — sans lui, cette ligne pouvait
      // annoncer un état différent de celui réellement proposé juste en
      // dessous.
      mpReadinessBonus: computeMpReadinessBonus(computeMpReadinessAssessments(chapters, exercises, sessions)),
    };
    const nextAction = computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now, signals);
    return computeStatusLine(objective, nextAction, signals.nearestDeadline, signals.todayPlanAllDone);
  }, [ready, sessions, exercises, chapters, preferences.dailyGoalMinutes, deadlines, weeklyPlan]);

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={greeting}
        description={description}
        action={
          <Link href="/session">
            <Button>Démarrer une séance</Button>
          </Link>
        }
      />
      <DashboardOverview />
    </>
  );
}
