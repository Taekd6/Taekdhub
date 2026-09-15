"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { PairedBars } from "@/components/ui/chart";
import { Insufficient } from "@/components/progress/insufficient";
import { computePlanningAccuracy, describePlanningAccuracy, PLANNING_SOLID_DAYS } from "@/lib/analytics/planning";
import { formatSpan } from "@/lib/utils";
import type { DayPlanRecord } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * TA SEMAINE — « est-ce que je réalise ce que je planifie ? ».
 *
 * La comparaison porte sur les sept derniers jours, et UNIQUEMENT sur ceux
 * dont l'intention avait été enregistrée la veille (voir `DayPlanRecord`,
 * lib/storage.ts). Les autres sont comptés à part et dits : combler un jour
 * manquant par « 0 prévu » ferait chuter le taux à chaque jour où
 * l'application n'a pas été ouverte, et le rendrait faux.
 *
 * REGISTRE. Ce pourcentage mesure la justesse d'une PRÉVISION, jamais la
 * valeur de quelqu'un. « 88 % du temps prévu a été réalisé » est un fait sur
 * un planning ; « tu n'as fait que 88 % » est un reproche, et personne
 * n'ouvre le dimanche soir un écran qui fait des reproches.
 */
export function WeekSection({ dayPlans, sessions }: { dayPlans: DayPlanRecord[]; sessions: WorkSession[] }) {
  const accuracy = useMemo(() => computePlanningAccuracy(dayPlans, sessions, 7, new Date()), [dayPlans, sessions]);
  const sentence = describePlanningAccuracy(accuracy);

  return (
    <Section
      label="Ta semaine"
      title="Prévu et réalisé"
      description="Ce que ton planning réservait la veille, face au temps réellement enregistré."
    >
      {accuracy.daysCompared === 0 ? (
        <Insufficient
          what="Aucune journée comparable pour l'instant."
          how="TaekdHub enregistre chaque soir ce qu'il prévoit pour le lendemain : la comparaison apparaîtra dès demain."
        />
      ) : (
        <>
          <PairedBars
            bars={accuracy.days.map((day) => ({
              id: day.key,
              label: DAY_LETTERS[day.start.getDay()],
              planned: day.plannedMinutes,
              actual: day.actualMinutes,
            }))}
            ariaLabel={`Prévu et réalisé sur sept jours : ${accuracy.days
              .map(
                (day) =>
                  `${day.start.toLocaleDateString("fr-FR", { weekday: "long" })} ${
                    day.plannedMinutes === null ? "aucune prévision" : `prévu ${formatSpan(day.plannedMinutes * 60)}`
                  }, réalisé ${formatSpan(day.actualMinutes * 60)}`
              )
              .join(" ; ")}.`}
          />
          <p className="t-meta mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-4 w-2.5 rounded-sm border border-dashed border-line" /> prévu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-4 w-2.5 rounded-sm" style={{ backgroundColor: "rgb(var(--accent-ink-rgb) / 0.55)" }} /> réalisé
            </span>
          </p>

          <p className="t-body mt-4">
            Prévu <span className="font-medium">{formatSpan(accuracy.plannedMinutes * 60)}</span> · réalisé{" "}
            <span className="font-medium">{formatSpan(accuracy.actualMinutes * 60)}</span>.
          </p>

          {sentence ? (
            <p className="t-meta mt-1">{sentence}</p>
          ) : (
            <p className="t-meta mt-1">
              Comparaison encore trop courte ({accuracy.daysCompared} jour{accuracy.daysCompared > 1 ? "s" : ""} sur{" "}
              {PLANNING_SOLID_DAYS} nécessaires) pour en tirer un pourcentage utile.
            </p>
          )}

          {accuracy.daysWithoutRecord > 0 && (
            <p className="t-meta mt-1 text-2xs">
              {accuracy.daysWithoutRecord} jour{accuracy.daysWithoutRecord > 1 ? "s" : ""} sans prévision enregistrée
              {accuracy.daysWithoutRecord > 1 ? " ne sont" : " n'est"} pas compté
              {accuracy.daysWithoutRecord > 1 ? "s" : ""} dans le total.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
