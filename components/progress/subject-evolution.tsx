"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/ui/section";
import { Meter } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import { Insufficient } from "@/components/progress/insufficient";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { computeSubjectTracking, PERIOD_LABELS, TRACKING_PERIODS, type TrackingPeriod } from "@/lib/tracking";
import { withSignMinutes } from "@/lib/analytics/trend";
import { formatSpan } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * MATIÈRE PAR MATIÈRE — la répartition ET son évolution, dans un seul endroit.
 *
 * Deux figures existaient séparément : une répartition statique du temps, et
 * une courbe de maîtrise pour UNE matière à la fois. Aucune ne répondait à
 * « mon travail est-il équilibré, et qu'est-ce qui bouge ». Ici, une ligne par
 * matière porte les quatre grandeurs qui se comparent : le temps, sa part, son
 * écart à la période précédente, et l'avancement avec son point de départ.
 *
 * « 25 % → 40 % » ne s'affiche QUE si un instantané hebdomadaire antérieur
 * existe (lib/week-snapshot.ts). Sans lui, on montre la valeur du jour et on
 * dit qu'il n'y a pas encore d'historique — plutôt que d'inventer un départ
 * à zéro qui ferait passer n'importe quel compte neuf pour une réussite.
 */
export function SubjectEvolution({
  sessions,
  exercises,
  chapters,
  snapshots,
}: {
  sessions: WorkSession[];
  exercises: Exercise[];
  chapters: Chapter[];
  snapshots: WeekSnapshot[];
}) {
  const [period, setPeriod] = useState<TrackingPeriod>("30j");
  const rows = useMemo(
    () => computeSubjectTracking(sessions, exercises, chapters, snapshots, period, new Date()),
    [sessions, exercises, chapters, snapshots, period]
  );

  const worked = rows.filter((row) => row.minutes > 0);

  return (
    <Section
      label="Tes matières"
      title="Où part ton temps, et ce qui avance"
      description="Le temps de la période, sa part, et l'avancement de chaque matière."
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
            {rows.map((row) => {
              const evolved = row.completionRateBefore !== null && row.completionRateBefore !== row.completionRate;
              const delta = row.completionRateBefore !== null ? row.completionRate - row.completionRateBefore : null;
              return (
                <li key={row.subject} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <SubjectAvatar subject={row.subject} size="sm" />
                  <div className="min-w-[8rem] flex-1">
                    <p className="t-subhead truncate">{row.subject}</p>
                    <p className="t-meta mt-0.5">
                      {row.measured ? (
                        <>
                          {row.completionRateBefore !== null ? (
                            <>
                              {row.completionRateBefore} % → <span className="text-ink">{row.completionRate} %</span>{" "}
                              {evolved && (
                                <span className={cn(delta! > 0 ? "text-emerald-300" : "text-rose-300")}>
                                  {delta! > 0 ? "↑" : "↓"} {Math.abs(delta!)} pt
                                </span>
                              )}
                              {!evolved && <span className="text-subtle">→ stable</span>}
                            </>
                          ) : (
                            <>
                              {row.completionRate} % acquis
                              <span className="text-subtle"> · pas encore d&apos;historique</span>
                            </>
                          )}
                          {row.fragileChapters > 0 && (
                            <span className="text-subtle">
                              {" "}
                              · {row.fragileChapters} chapitre{row.fragileChapters > 1 ? "s" : ""} à consolider
                            </span>
                          )}
                        </>
                      ) : (
                        /* « aucune fiche ouverte », et non « rien n'a été
                           travaillé » : une matière peut avoir douze heures de
                           chronomètre libre et zéro fiche engagée. Les deux
                           grandeurs sont affichées côte à côte, la phrase ne
                           peut pas contredire le temps juste à sa droite. */
                        "Avancement non mesuré — aucune fiche de cette matière n'a encore été ouverte"
                      )}
                    </p>
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
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}
