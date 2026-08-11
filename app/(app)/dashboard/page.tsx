"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardOverview } from "@/components/dashboard-overview";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeDailyObjective, computeNextAction, computeStatusLine } from "@/lib/next-action";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

/**
 * Phrase d'état ("où j'en suis", Phase 1 du sprint Study OS) — réutilise
 * exactement les mêmes fonctions que le corps du Dashboard
 * (lib/next-action.ts), jamais une deuxième lecture de l'état.
 */
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
