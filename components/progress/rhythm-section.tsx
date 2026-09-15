"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { LineChart } from "@/components/ui/chart";
import { Insufficient } from "@/components/progress/insufficient";
import { computeWeeklyComparison, computeWorkTimeSeries, RHYTHM_WEEKS } from "@/lib/analytics/work-time";
import { describeConfidence, withSignMinutes } from "@/lib/analytics/trend";
import { formatSpan } from "@/lib/utils";
import type { Preferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * TON RYTHME — « combien ai-je travaillé, et est-ce que ça monte ? ».
 *
 * La courbe répond au coup d'œil ; la phrase en dessous répond à la même
 * question en toutes lettres, pour qui ne peut pas la lire — et pour tout le
 * monde en réalité, parce qu'une courbe ne dit pas « +1 h 25 ».
 *
 * L'écart hebdomadaire est présenté « à ce stade de la semaine » et non
 * comme un bilan : comparer un mercredi à une semaine complète produirait
 * une baisse tous les mercredis.
 */
export function RhythmSection({ sessions, preferences }: { sessions: WorkSession[]; preferences: Preferences }) {
  const model = useMemo(() => {
    const now = new Date();
    return {
      series: computeWorkTimeSeries(sessions, "semaine", RHYTHM_WEEKS, now),
      comparison: computeWeeklyComparison(sessions, now),
    };
  }, [sessions]);

  const { series, comparison } = model;
  const goal = preferences.weeklyGoalMinutes;
  const measuredWeeks = series.filter((point) => point.minutes > 0).length;

  return (
    <Section
      label="Ton rythme"
      title="Combien tu travailles"
      description="Le temps réellement enregistré, semaine après semaine."
    >
      {measuredWeeks === 0 ? (
        <Insufficient
          what="Aucune séance enregistrée pour l'instant."
          how="Lance une première séance ou un chronomètre : la courbe se construit toute seule ensuite."
        />
      ) : (
        <>
          <LineChart
            points={series.map((point) => ({
              label: weekLabel(point.start),
              value: point.minutes,
            }))}
            min={0}
            formatValue={(value) => formatSpan(value * 60)}
            ariaLabel={`Temps travaillé sur les ${series.length} dernières semaines : ${series
              .map((point) => `${weekLabel(point.start)} ${formatSpan(point.minutes * 60)}`)
              .join(", ")}.`}
          />

          {/* L'ÉQUIVALENT TEXTUEL, jamais optionnel — voir la note
              d'accessibilité en tête de components/ui/chart.tsx. */}
          <p className="t-body mt-4">
            <span className="font-medium">{formatSpan(comparison.currentMinutes * 60)}</span> cette semaine,{" "}
            {comparison.previousMinutes > 0 ? (
              <>
                soit {withSignMinutes(comparison.deltaMinutes)} par rapport à la semaine précédente, à ce stade.
              </>
            ) : (
              <>première semaine mesurée.</>
            )}
          </p>

          {goal > 0 && (
            <p className="t-meta mt-1">
              Objectif hebdomadaire : {formatSpan(goal * 60)} — {Math.round((comparison.currentMinutes / goal) * 100)} % atteints.
            </p>
          )}

          {/* La direction n'est annoncée QUE si la série la porte, et la mise
              en garde de confiance voyage avec elle. */}
          {comparison.trend.direction !== "insuffisant" && (
            <p className="t-meta mt-1">
              Sur les semaines écoulées, ton volume est {TREND_WORDS[comparison.trend.direction]}.
              {describeConfidence(comparison.trend) && <> {describeConfidence(comparison.trend)}</>}
            </p>
          )}
          {comparison.trend.direction === "insuffisant" && (
            <p className="t-meta mt-1">Pas encore assez de semaines écoulées pour dégager une tendance.</p>
          )}
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

const weekFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
function weekLabel(date: Date): string {
  return weekFormatter.format(date);
}
