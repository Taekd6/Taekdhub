"use client";

import { useMemo } from "react";
import { Stat, StatRow } from "@/components/ui/stat";
import { computeTrackingOverview } from "@/lib/tracking";
import { describeConfidence } from "@/lib/analytics/trend";
import { formatSpan } from "@/lib/utils";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

const ARROWS = { hausse: "↑", baisse: "↓", stable: "→", insuffisant: "—" } as const;

/**
 * VUE D'ENSEMBLE — cinq chiffres, délibérément.
 *
 * La tentation d'un écran d'évolution est d'aligner quinze indicateurs ; on
 * n'en retient que ce qui répond à une question qu'on se pose vraiment en
 * ouvrant la page : combien cette semaine, à quel rythme, avec quelle
 * régularité, sur quel contenu, et dans quel sens ça va.
 *
 * Le dénominateur des jours travaillés est le nombre de jours ÉCOULÉS, pas 7 :
 * afficher « 3 / 7 » un mardi est un reproche adressé à des jours qui ne sont
 * pas arrivés.
 */
export function EvolutionOverview({
  sessions,
  exercises,
  chapters,
}: {
  sessions: WorkSession[];
  exercises: Exercise[];
  chapters: Chapter[];
}) {
  const overview = useMemo(
    () => computeTrackingOverview(sessions, exercises, chapters, new Date()),
    [sessions, exercises, chapters]
  );

  return (
    <StatRow>
      <Stat label="Cette semaine" value={formatSpan(overview.weekMinutes * 60)} detail={`aujourd'hui ${formatSpan(overview.todayMinutes * 60)}`} />
      <Stat label="Ce mois-ci" value={formatSpan(overview.monthMinutes * 60)} size="sm" />
      {/* « cette semaine » explicitement : la section « Combien tu travailles »
          affiche elle aussi des jours travaillés, mais sur une fenêtre
          GLISSANTE de 7/30/90 jours. Les deux chiffres sont justes et
          différents ; sans le dire, ils se liraient comme une contradiction. */}
      <Stat
        label="Jours travaillés"
        value={`${overview.activeDaysThisWeek} / ${overview.elapsedDaysThisWeek}`}
        detail={overview.streak > 1 ? `cette semaine · ${overview.streak} d'affilée` : "cette semaine"}
        size="sm"
      />
      <Stat label="Chapitres abordés" value={overview.chaptersWorked} size="sm" />
      <Stat
        label="Rythme"
        value={ARROWS[overview.trend.direction]}
        /* « — » plutôt qu'une flèche quand rien ne permet de conclure : une
           direction affichée sans données est exactement ce que ce produit
           s'interdit. */
        detail={
          overview.trend.direction === "insuffisant"
            ? "pas encore mesurable"
            : (describeConfidence(overview.trend) ?? "sur les semaines écoulées")
        }
        size="sm"
      />
    </StatRow>
  );
}
