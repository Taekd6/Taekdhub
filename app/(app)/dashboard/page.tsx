"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardOverview } from "@/components/dashboard-overview";
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
      {/*
       * Volontairement SANS `action` : ce bandeau portait un bouton primaire
       * "Démarrer une séance" posé juste au-dessus du bloc "À faire
       * maintenant", dont le CTA dit la même chose en mieux — il nomme
       * l'exercice, explique pourquoi lui, et annonce la durée
       * ("Commencer une séance de 60 min"). Deux boutons pleins accent, à
       * trois centimètres l'un de l'autre, pour la même destination, faisaient
       * hésiter au lieu de guider : la question "quelle est l'action
       * principale ?" n'avait plus de réponse unique. Aucune fonctionnalité
       * perdue — /session reste accessible depuis le CTA du héros, les
       * raccourcis de durée et la barre latérale.
       */}
      <PageHeader eyebrow={today} title={greeting} description={description} />
      <DashboardOverview />
    </>
  );
}
