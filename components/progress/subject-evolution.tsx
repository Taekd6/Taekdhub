"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/ui/section";
import { Meter } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import { Insufficient } from "@/components/progress/insufficient";
import { SubjectAvatar } from "@/components/subject-avatar";
import { computeSubjectTracking, PERIOD_LABELS, TRACKING_PERIODS, type TrackingPeriod } from "@/lib/tracking";
import { withSignMinutes } from "@/lib/analytics/trend";
import { formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * MATIÈRE PAR MATIÈRE — la répartition du temps ET son évolution.
 *
 * Une ligne par matière porte les trois grandeurs qui se comparent : le
 * temps, sa part, et son écart à la période précédente. (L'avancement par
 * matière qui l'accompagnait — part des fiches acquises, chapitres à
 * consolider — venait de l'ancienne banque d'exercices, retirée.)
 */
export function SubjectEvolution({ sessions }: { sessions: WorkSession[] }) {
  const [period, setPeriod] = useState<TrackingPeriod>("30j");
  const rows = useMemo(() => computeSubjectTracking(sessions, period, new Date()), [sessions, period]);

  const worked = rows.filter((row) => row.minutes > 0);

  return (
    <Section
      label="Tes matières"
      title="Où part ton temps"
      description="Le temps de la période, sa part, et son écart à la période précédente."
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
      {rows.length === 0 ? (
        <Insufficient
          what="Aucune matière à comparer pour l'instant."
          how="La répartition apparaît dès qu'une séance est enregistrée."
        />
      ) : (
        <>
          {/* Une seule matière travaillée : afficher « 100 % » et une barre
              pleine serait une répartition qui ne répartit rien. */}
          {worked.length === 1 && (
            <p className="t-meta mb-4">
              Tout ton temps de cette période est allé en {worked[0].subject} : il n&apos;y a pas encore de répartition à
              comparer.
            </p>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((row) => (
                <li key={row.subject} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <SubjectAvatar subject={row.subject} size="sm" />
                  <div className="min-w-[8rem] flex-1">
                    <p className="t-subhead truncate">{row.subject}</p>
                  </div>

                  {row.minutes > 0 ? (
                    <div className="w-full sm:w-40">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="tabular text-sm text-ink">{formatSpan(row.minutes * 60)}</span>
                        <span className="t-meta tabular text-2xs">{row.percent} %</span>
                      </div>
                      <Meter value={row.percent} tone="neutral" />
                      {row.previousMinutes > 0 && (
                        <p className="t-meta mt-1 text-2xs">{withSignMinutes(row.deltaMinutes)} vs période précédente</p>
                      )}
                    </div>
                  ) : (
                    <span className="t-meta w-full text-2xs sm:w-40">Aucun temps sur cette période</span>
                  )}
                </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
