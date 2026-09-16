"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { Heatmap } from "@/components/heatmap";
import { Insufficient } from "@/components/progress/insufficient";
import { Stat, StatRow } from "@/components/ui/stat";
import { computeRegularity } from "@/lib/tracking";
import { formatSpan } from "@/lib/utils";
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
  // Fenêtre de 30 jours pour les chiffres : assez pour absorber une semaine
  // creuse, assez court pour décrire le rythme actuel.
  const regularity = useMemo(() => computeRegularity(sessions, "30j", new Date()), [sessions]);
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

          {/* LES CHIFFRES QUE LA HEATMAP NE DONNE PAS. Elle montre les
              habitudes d'un coup d'œil ; elle ne dit ni combien on y passe
              quand on s'y met, ni quelle a été la meilleure semaine. */}
          <StatRow className="mt-5">
            <Stat label="Jours travaillés" value={`${regularity.activeDays} / ${regularity.days}`} size="sm" />
            <Stat
              label="Moyenne par jour travaillé"
              value={regularity.averagePerActiveDay > 0 ? formatSpan(regularity.averagePerActiveDay * 60) : "—"}
              size="sm"
            />
            {/* « — » tant qu'il n'y a pas DEUX semaines complètes à comparer :
                sur une seule, la meilleure et la pire seraient la même. */}
            <Stat
              label="Meilleure semaine"
              value={regularity.best ? formatSpan(regularity.best.minutes * 60) : "—"}
              detail={regularity.best ? weekLabel.format(regularity.best.start) : "pas encore comparable"}
              size="sm"
            />
            <Stat
              label="Semaine la plus creuse"
              value={regularity.worst ? formatSpan(regularity.worst.minutes * 60) : "—"}
              detail={regularity.worst ? weekLabel.format(regularity.worst.start) : "pas encore comparable"}
              size="sm"
            />
          </StatRow>

          <p className="t-body mt-5">
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

const weekLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const TREND_WORDS: Record<"hausse" | "baisse" | "stable", string> = {
  hausse: "en hausse",
  baisse: "en baisse",
  stable: "stable",
};
