"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { Insufficient } from "@/components/progress/insufficient";
import { computeSubjectDistribution } from "@/lib/analytics/work-time";
import { startOfWeek } from "@/lib/week";
import { formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * TES MATIÈRES — « où part mon temps ? ».
 *
 * PAS DE GRAPHIQUE ICI, et c'est un choix. Sur sept matières au maximum, une
 * liste avec la durée alignée à droite et une jauge se lit plus vite qu'un
 * diagramme : on veut comparer des DURÉES, or un camembert oblige à
 * comparer des angles, et un histogramme vertical à quatre barres coûte plus
 * de place qu'il n'apporte. La jauge suffit à donner la proportion, et
 * `Meter` existe déjà dans le système.
 *
 * Deux périodes, parce qu'elles ne disent pas la même chose : la semaine
 * répond à « qu'est-ce que j'ai fait ces jours-ci », le cumul à « qu'est-ce
 * que je délaisse depuis le début ».
 */
export function SubjectsSection({ sessions }: { sessions: WorkSession[] }) {
  const model = useMemo(() => {
    const now = new Date();
    return {
      week: computeSubjectDistribution(sessions, startOfWeek(now), now),
      all: computeSubjectDistribution(sessions, null, now),
    };
  }, [sessions]);

  if (model.all.length === 0) {
    return (
      <Section label="Tes matières" title="Où part ton temps">
        <Insufficient
          what="Aucun temps enregistré pour l'instant."
          how="La répartition apparaît dès la première séance chronométrée."
        />
      </Section>
    );
  }

  return (
    <Section label="Tes matières" title="Où part ton temps" description="Le temps enregistré, cette semaine et depuis le début.">
      <div className="space-y-7">
        <Distribution
          title="Cette semaine"
          rows={model.week}
          empty="Aucune séance cette semaine pour l'instant."
        />
        <Distribution title="Depuis le début" rows={model.all} />
      </div>
    </Section>
  );
}

function Distribution({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { subject: string; minutes: number; percent: number }[];
  empty?: string;
}) {
  return (
    <div>
      <p className="t-label mb-2.5">{title}</p>
      {rows.length === 0 ? (
        <p className="t-meta text-2xs">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.subject}>
              <div className="flex items-baseline gap-2">
                <SubjectAvatar subject={row.subject as never} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{row.subject}</span>
                <span className="tabular shrink-0 whitespace-nowrap text-sm text-ink">{formatSpan(row.minutes * 60)}</span>
                <span className="tabular w-10 shrink-0 whitespace-nowrap text-right text-2xs text-muted">{row.percent} %</span>
              </div>
              <Meter value={row.percent} className="mt-1.5" tone="neutral" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
