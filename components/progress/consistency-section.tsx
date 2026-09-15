"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { Heatmap } from "@/components/heatmap";
import { Insufficient } from "@/components/progress/insufficient";
import { computeConsistency, currentStreak } from "@/lib/analytics/consistency";
import { describeConfidence } from "@/lib/analytics/trend";
import { workByDayMap } from "@/lib/gamification";
import type { WorkSession } from "@/lib/supabase/types";

/** Douze semaines — le trimestre en cours, soit la période sur laquelle une régularité veut dire quelque chose en prépa. */
const CONSISTENCY_WEEKS = 12;

/**
 * TA RÉGULARITÉ — « est-ce que je m'y mets souvent ? ».
 *
 * La mesure est le NOMBRE DE JOURS ACTIFS, pas le volume. Cinq jours à une
 * heure valent mieux que deux jours à deux heures et demie, et un écran qui
 * célèbre les pics enseigne le contraire de ce qu'il faudrait.
 *
 * La série en cours est affichée parce qu'elle décrit un fait, jamais comme
 * quelque chose à défendre : aucune alerte quand elle tombe, aucun palier,
 * aucun trophée.
 */
export function ConsistencySection({ sessions }: { sessions: WorkSession[] }) {
  const model = useMemo(() => {
    const now = new Date();
    return {
      consistency: computeConsistency(sessions, CONSISTENCY_WEEKS, now),
      streak: currentStreak(sessions, now),
      workByDay: workByDayMap(sessions),
    };
  }, [sessions]);

  const { consistency, streak, workByDay } = model;
  const hasActivity = Object.values(workByDay).some((seconds) => seconds > 0);

  return (
    <Section label="Ta régularité" title="À quelle fréquence tu t'y mets" description="Chaque case est une journée ; l'intensité suit le temps travaillé.">
      {!hasActivity ? (
        <Insufficient
          what="Aucune journée de travail enregistrée."
          how="La régularité se construit jour après jour — une première séance suffit à démarrer."
        />
      ) : (
        <>
          <Heatmap workByDay={workByDay} />

          <p className="t-body mt-4">
            <span className="font-medium">{consistency.currentActiveDays}</span> jour
            {consistency.currentActiveDays > 1 ? "s" : ""} actif{consistency.currentActiveDays > 1 ? "s" : ""} cette semaine
            {consistency.averageActiveDays !== null && (
              <>
                , contre {String(consistency.averageActiveDays).replace(".", ",")} en moyenne sur les semaines écoulées
              </>
            )}
            .
          </p>

          {consistency.trend.direction !== "insuffisant" ? (
            <p className="t-meta mt-1">
              Ta régularité est {TREND_WORDS[consistency.trend.direction]}.
              {describeConfidence(consistency.trend) && <> {describeConfidence(consistency.trend)}</>}
            </p>
          ) : (
            <p className="t-meta mt-1">Pas encore assez de semaines écoulées pour dire si ta régularité évolue.</p>
          )}

          {streak > 1 && <p className="t-meta mt-1 text-2xs">{streak} jours consécutifs à ce jour.</p>}
        </>
      )}
    </Section>
  );
}

const TREND_WORDS: Record<"hausse" | "baisse" | "stable", string> = {
  hausse: "en hausse",
  baisse: "en baisse",
  stable: "stable",
};
