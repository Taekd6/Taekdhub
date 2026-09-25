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
  /*
   * DEUX LECTURES DU MÊME CALCUL, et c'est délibéré.
   *
   *  — `accuracy` (7 jours glissants, aujourd'hui inclus) dessine les barres :
   *    la journée en cours est celle qu'on regarde le plus, la masquer serait
   *    absurde.
   *  — `settled` s'arrête à HIER et fournit le POURCENTAGE. Une journée non
   *    terminée est structurellement déficitaire : six jours tenus à 100 %
   *    consultés le septième à 20 h donnaient « 89 % du temps prévu a été
   *    réalisé sur 7 jours », alors que l'écart venait entièrement d'une
   *    journée qui n'était pas finie.
   */
  const accuracy = useMemo(() => computePlanningAccuracy(dayPlans, sessions, 7, new Date()), [dayPlans, sessions]);
  const settled = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return computePlanningAccuracy(dayPlans, sessions, 6, yesterday);
  }, [dayPlans, sessions]);
  const sentence = describePlanningAccuracy(settled);

  return (
    <Section
      variant="panel"
      label="Ta semaine"
      title="Prévu et réalisé"
      description="Prévu la veille, fait le jour même."
    >
      {accuracy.daysCompared === 0 && settled.daysCompared === 0 ? (
        <Insufficient
          what="Aucune journée comparable pour l'instant."
          /* La promesse était INCONDITIONNELLE, et fausse pour qui n'a pas
             d'échéance : `ensureTomorrowPlanRecord` (hooks/use-prepahub-data.ts)
             sort immédiatement quand `workItems` est vide, donc aucune
             intention n'est jamais enregistrée. Un élève sans échéance se
             voyait promettre chaque jour une comparaison qui n'arriverait
             jamais. */
          how="TaekdHub note ce qu'il prévoit pour le lendemain à partir de tes échéances : la comparaison démarre dès que tu en as créé une."
        />
      ) : (
        <>
          <PairedBars
            formatValue={(minutes) => formatSpan(minutes * 60)}
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
          <p className="t-meta mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem]">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-hairline/[0.10]" /> prévu la veille
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--g1)]" /> réalisé
            </span>
          </p>

          {/* Les totaux suivent le POURCENTAGE, donc les journées terminées :
              les afficher sur sept jours à côté d'un taux calculé sur six
              recréerait exactement la contradiction qu'on vient de fermer. */}
          <p className="mt-6 border-t border-line pt-5 text-[0.9375rem] text-ink">
            Sur les journées terminées : prévu <span className="tabular font-bold">{formatSpan(settled.plannedMinutes * 60)}</span> · réalisé{" "}
            <span className="tabular font-bold">{formatSpan(settled.actualMinutes * 60)}</span>.
          </p>

          {sentence ? (
            <p className="t-meta mt-1">{sentence}</p>
          ) : (
            <p className="t-meta mt-1">
              Comparaison encore trop courte ({settled.daysCompared} jour{settled.daysCompared > 1 ? "s" : ""} sur{" "}
              {PLANNING_SOLID_DAYS} nécessaires) pour en tirer un pourcentage utile.
            </p>
          )}

          {settled.daysWithoutRecord + settled.daysWithoutPlan > 0 && (
            <p className="t-meta mt-1 text-2xs">
              {settled.daysWithoutRecord + settled.daysWithoutPlan} jour
              {settled.daysWithoutRecord + settled.daysWithoutPlan > 1 ? "s" : ""} sans rien de prévu
              {settled.daysWithoutRecord + settled.daysWithoutPlan > 1 ? " ne sont" : " n'est"} pas compté
              {settled.daysWithoutRecord + settled.daysWithoutPlan > 1 ? "s" : ""} dans le pourcentage.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
