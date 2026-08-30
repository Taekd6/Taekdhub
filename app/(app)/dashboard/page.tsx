"use client";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardOverview } from "@/components/dashboard-overview";
import { PreparationCommand } from "@/components/preparation/preparation-command";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeDailyObjective, computeNextAction, computeStatusLine } from "@/lib/next-action";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export default function DashboardPage() {
  const { sessions, exercises, preferences, ready } = usePrepahubData();
  const name = preferences.displayName?.trim();
  const greeting = ready && name ? `Bonjour, ${name}.` : "Bonjour.";

  const description = useMemo(() => {
    if (!ready) return "Une séance claire, puis la suivante.";
    const now = new Date();
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    const nextAction = computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now);
    return computeStatusLine(objective, nextAction);
  }, [ready, sessions, exercises, preferences.dailyGoalMinutes]);

  return (
    <>
      <PageHeader eyebrow={today} title={greeting} description={description} />
      <DashboardOverview />
      <PreparationCommand />
    </>
  );
}
