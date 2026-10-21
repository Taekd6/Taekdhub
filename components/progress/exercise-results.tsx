"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { LineChart, StackedColumns, type LinePoint, type StackColumn } from "@/components/ui/chart";
import { Insufficient } from "@/components/progress/insufficient";
import { ATTEMPT_WEEKS, computeAttemptWeeks, MIN_ATTEMPTS_PER_WEEK } from "@/lib/analytics/attempt-trend";
import type { ExerciseAttempt } from "@/lib/attempts";

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric" });
const LONG = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

const COLORS = {
  réussi: "rgb(var(--emerald-400-rgb))",
  partiel: "rgb(var(--amber-400-rgb))",
  échec: "rgb(var(--rose-400-rgb))",
} as const;

/**
 * RÉSULTATS AUX EXERCICES — deux figures, deux faits.
 *
 *   1. Les tentatives de chaque semaine, empilées par résultat (réussi, partiel, échec).
 *   2. La part de tentatives réussies SANS AIDE, semaine après semaine : la seule qui
 *      prouve un savoir-faire. Sous trois tentatives dans la semaine la courbe s'interrompt
 *      au lieu d'afficher un pourcentage sans valeur (lib/analytics/attempt-trend.ts).
 *
 * Aucune interprétation : un exercice plus dur ou un sujet tombé juste font varier ces
 * chiffres autant que le niveau de l'élève, et TaekdHub ne les distingue pas.
 */
export function ExerciseResults({ attempts }: { attempts: ExerciseAttempt[] }) {
  const weeks = useMemo(() => computeAttemptWeeks(attempts, new Date(), ATTEMPT_WEEKS), [attempts]);
  const total = weeks.reduce((sum, week) => sum + week.total, 0);

  const columns: StackColumn[] = weeks.map((week, index) => ({
    id: week.start,
    label: DAY_MONTH.format(new Date(`${week.start}T12:00:00`)),
    title: `semaine du ${LONG.format(new Date(`${week.start}T12:00:00`))}`,
    highlight: index === weeks.length - 1,
    segments: [
      { id: "réussi", value: week.réussi, color: COLORS.réussi },
      { id: "partiel", value: week.partiel, color: COLORS.partiel },
      { id: "échec", value: week.échec, color: COLORS.échec },
    ].filter((segment) => segment.value > 0),
  }));

  const points: LinePoint[] = weeks.map((week) => ({ label: DAY_MONTH.format(new Date(`${week.start}T12:00:00`)), value: week.unaidedPercent }));
  const hasLine = points.some((point) => point.value !== null);

  return (
    <div className="space-y-5">
      <Section variant="panel" label="Tes exercices" title="Ce que tu tentes" description={`Les ${ATTEMPT_WEEKS} dernières semaines, par résultat.`}>
        {total === 0 ? (
          <Insufficient what="Aucune tentative enregistrée sur ces semaines." how="Elles apparaissent après un exercice noté au bilan d'une séance." />
        ) : (
          <>
            <StackedColumns
              columns={columns}
              heightClassName="h-44"
              formatValue={(value) => `${value} tentative${value > 1 ? "s" : ""}`}
              ariaLabel={`Tentatives par semaine : ${weeks.map((week) => `semaine du ${week.start}, ${week.réussi} réussies, ${week.partiel} partielles, ${week.échec} échecs`).join(" ; ")}.`}
            />
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-muted" aria-hidden>
              {(["réussi", "partiel", "échec"] as const).map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                  {key === "réussi" ? "Réussi" : key === "partiel" ? "Partiel" : "Échec"}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section variant="panel" label="Ce que tu sais faire" title="Réussi sans aucune aide" description="Ni indice ni correction ouverte : la seule réussite qui prouve quelque chose.">
        {hasLine ? (
          <>
            <LineChart
              points={points}
              min={0}
              max={100}
              formatValue={(value) => `${value} %`}
              ariaLabel={`Part des tentatives réussies sans aide, par semaine : ${weeks.map((week) => (week.unaidedPercent === null ? `semaine du ${week.start}, pas assez de tentatives` : `semaine du ${week.start}, ${week.unaidedPercent} %`)).join(" ; ")}.`}
            />
            <p className="t-meta mt-4">
              Une semaine n&apos;a de point qu&apos;à partir de {MIN_ATTEMPTS_PER_WEEK} tentatives. Un exercice plus difficile ou un sujet tombé juste fait varier cette part autant que ton niveau : TaekdHub ne les distingue pas.
            </p>
          </>
        ) : (
          <Insufficient what={`Aucune semaine n'a encore ${MIN_ATTEMPTS_PER_WEEK} tentatives.`} how="La courbe apparaît dès qu'une semaine en compte assez pour que le pourcentage ait un sens." />
        )}
      </Section>
    </div>
  );
}
