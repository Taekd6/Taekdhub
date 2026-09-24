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
 * Une rangée par matière porte les trois grandeurs qui se comparent : le
 * temps, sa part, et son écart à la période précédente. (L'avancement par
 * matière qui l'accompagnait — part des fiches acquises, chapitres à
 * consolider — venait de l'ancienne banque d'exercices, retirée.)
 *
 * GRIS ET UN ACCENT : la barre de la matière en tête (celle qui prend le
 * plus de temps) est à l'accent, les autres en gris. Sept barres de couleur
 * disaient « sept choses importantes » ; une seule dit où va l'essentiel.
 */
export function SubjectEvolution({ sessions }: { sessions: WorkSession[] }) {
  const [period, setPeriod] = useState<TrackingPeriod>("30j");
  const rows = useMemo(() => computeSubjectTracking(sessions, period, new Date()), [sessions, period]);

  const worked = rows.filter((row) => row.minutes > 0);
  const leader = worked.length > 1 ? worked.reduce((best, row) => (row.minutes > best.minutes ? row : best)).subject : null;

  return (
    <Section
      variant="panel"
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
          <ul className="-mx-2 space-y-0.5">
            {rows.map((row, index) => (
              <li
                key={row.subject}
                className="row-hover grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl px-2 py-3 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,2.6fr)_minmax(0,1fr)] sm:gap-x-5"
              >
                <SubjectAvatar subject={row.subject} />
                <p className="truncate text-[0.9375rem] font-semibold text-ink">{row.subject}</p>
                <div className="col-span-3 sm:col-span-1">
                  {row.minutes > 0 ? (
                    <Meter value={row.percent} tone={row.subject === leader ? "accent" : "neutral"} index={index} className="h-2" />
                  ) : (
                    <span className="t-meta text-2xs">Aucun temps sur cette période</span>
                  )}
                </div>
                <div className="col-start-3 row-start-1 text-right sm:col-start-4">
                  <p className="tabular whitespace-nowrap text-[0.9375rem] font-bold text-ink">
                    {row.minutes > 0 ? formatSpan(row.minutes * 60) : "—"}
                    {row.minutes > 0 && <span className="ml-1.5 text-[0.8125rem] font-medium text-subtle">{row.percent} %</span>}
                  </p>
                  {row.previousMinutes > 0 && <p className="t-meta tabular whitespace-nowrap text-2xs">{withSignMinutes(row.deltaMinutes)} vs avant</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
