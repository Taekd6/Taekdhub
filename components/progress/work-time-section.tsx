"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { SegmentedControl } from "@/components/ui/segmented";
import { VolumeBars } from "@/components/ui/chart";
import { Insufficient } from "@/components/progress/insufficient";
import { computePeriodTotals, granularityFor, PERIOD_LABELS, TRACKING_PERIODS, type TrackingPeriod } from "@/lib/tracking";
import { withSignMinutes } from "@/lib/analytics/trend";
import { formatSpan } from "@/lib/utils";
import type { Preferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
const MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
/** « 8/9 » — assez court pour tenir sous une barre de 20 px. */
const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric" });

/**
 * TEMPS DE TRAVAIL — la figure principale de l'écran.
 *
 * Trois périodes, une seule question : « combien, et à quel rythme ». Le
 * sélecteur ne change pas la nature de la mesure, seulement sa fenêtre — et
 * au-delà d'un mois la barre devient hebdomadaire, parce que quatre-vingt-dix
 * barres quotidiennes sur 390 px ne sont plus lisibles (`granularityFor`).
 *
 * La comparaison à la période précédente n'apparaît QUE si cette période
 * précédente contient quelque chose. Passer de rien à quatre heures n'est pas
 * « +100 % » : c'est un début, et aucun pourcentage ne le décrit.
 */
export function WorkTimeSection({ sessions, preferences }: { sessions: WorkSession[]; preferences: Preferences }) {
  const [period, setPeriod] = useState<TrackingPeriod>("7j");
  const totals = useMemo(() => computePeriodTotals(sessions, period, new Date()), [sessions, period]);
  /*
   * L'OBJECTIF HEBDOMADAIRE vient des préférences existantes
   * (`weeklyGoalMinutes`) : aucun second système d'objectifs n'est créé. Il
   * n'est rapporté qu'à la SEMAINE EN COURS — le confronter à une fenêtre de
   * 30 jours ou de 3 mois comparerait un objectif hebdomadaire à un total
   * mensuel, ce qui ne veut rien dire.
   */
  const weekly = useMemo(() => computePeriodTotals(sessions, "7j", new Date()), [sessions]);
  const goal = preferences.weeklyGoalMinutes;

  const bars = useMemo(() => {
    const daily = granularityFor(period) === "jour";
    return totals.points.map((point, index) => ({
      id: point.key,
      // Sur trente jours, une lettre sous chaque barre devient une bouillie
      // (et « L » ne dit pas QUEL lundi) : on n'étiquette qu'une barre sur
      // cinq, par sa DATE. Sur trois mois, une semaine sur deux. Les autres
      // portent leur libellé complet dans l'info-bulle et l'`aria-label`.
      label: daily
        ? totals.points.length > 10
          ? (totals.points.length - 1 - index) % 5 === 0
            ? String(point.start.getDate())
            : ""
          : DAY_LETTERS[point.start.getDay()]
        : (totals.points.length - 1 - index) % 2 === 1
          ? ""
          : DAY_MONTH.format(point.start),
      title: daily
        ? point.start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
        : `semaine du ${MONTH_SHORT.format(point.start)}`,
      minutes: point.minutes,
    }));
  }, [totals.points, period]);

  const daily = granularityFor(period) === "jour";
  // L'objectif tracé sur la figure : le QUOTIDIEN quand une barre est un
  // jour, l'HEBDOMADAIRE quand une barre est une semaine (fenêtre de 3 mois).
  const barGoal = daily ? preferences.dailyGoalMinutes : goal;

  return (
    <Section
      variant="panel"
      label="Ton temps"
      title="Combien tu travailles"
      description="Le temps réellement enregistré, jour après jour. Survole une barre pour sa valeur."
      action={
        <SegmentedControl
          size="sm"
          ariaLabel="Période observée"
          value={period}
          onChange={(value) => setPeriod(value as TrackingPeriod)}
          options={TRACKING_PERIODS.map((entry) => ({ value: entry, label: PERIOD_LABELS[entry] }))}
        />
      }
    >
      {totals.minutes === 0 ? (
        <Insufficient
          what={`Aucune séance enregistrée sur les ${PERIOD_LABELS[period]}.`}
          how="Ton suivi commence dès la première séance chronométrée."
        />
      ) : (
        <>
          <StatRow>
            <Stat label="Total" value={formatSpan(totals.minutes * 60)} size="sm" />
            <Stat label="Moyenne par jour" value={formatSpan(totals.dailyAverage * 60)} size="sm" />
            <Stat
              label="Jours travaillés"
              value={`${totals.activeDays} / ${totals.days}`}
              detail={`sur ${PERIOD_LABELS[period]}`}
              size="sm"
            />
          </StatRow>

          <VolumeBars
            className="mt-8"
            bars={bars}
            goal={barGoal > 0 ? barGoal : undefined}
            goalLabel={daily ? "Objectif quotidien" : "Objectif hebdomadaire"}
                        formatValue={(minutes) => formatSpan(minutes * 60)}
            ariaLabel={`Temps travaillé sur ${PERIOD_LABELS[period]} : ${bars
              .map((bar) => `${bar.title} ${formatSpan(bar.minutes * 60)}`)
              .join(", ")}.`}
          />

          <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 sm:gap-6">
            {goal > 0 && (
              <p className="t-meta">
                <span className="font-semibold text-ink">Objectif hebdomadaire · {formatSpan(goal * 60)}</span>
                <br />
                {formatSpan(weekly.minutes * 60)} sur les 7 derniers jours, soit {Math.round((weekly.minutes / goal) * 100)} %.
              </p>
            )}
            {/* La comparaison, seulement si elle repose sur quelque chose. */}
            {totals.previousMinutes > 0 ? (
              <p className="t-meta">
                <span className="font-semibold text-ink">
                  {withSignMinutes(totals.deltaMinutes)} face aux {PERIOD_LABELS[period]} précédents
                  {totals.deltaPercent !== null ? ` (${totals.deltaPercent > 0 ? "+" : ""}${totals.deltaPercent} %)` : ""}
                </span>
                <br />
                {formatSpan(totals.previousMinutes * 60)} alors, {formatSpan(totals.minutes * 60)} maintenant.
              </p>
            ) : (
              <p className="t-meta">
                Rien n&apos;avait été enregistré sur les {PERIOD_LABELS[period]} précédents : il n&apos;y a pas encore de quoi
                comparer.
              </p>
            )}
          </div>
        </>
      )}
    </Section>
  );
}
