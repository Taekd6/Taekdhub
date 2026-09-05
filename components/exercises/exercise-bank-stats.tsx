"use client";

import { useMemo } from "react";
import { Stat, StatRow } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { resultCounts } from "@/lib/history";
import { computeExerciseBankStats } from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * État de la banque d'exercices — présentationnel, tous les calculs viennent
 * de `computeExerciseBankStats` (lib/recommendation.ts) et `resultCounts`
 * (lib/history.ts).
 *
 * TROIS métriques, plus cinq. Les deux retirées l'ont été sur constat chiffré,
 * pas par goût :
 *
 * - « Priorité moyenne » : `priority` valait 3 pour LES 402 exercices de la
 *   banque (valeur par défaut, jamais modifiée à l'import). La carte
 *   affichait donc « 3/5 » de façon strictement constante — une valeur par
 *   défaut mise en scène comme une statistique. Le champ lui-même a depuis
 *   été supprimé (un second levier manuel redondant avec l'étoile `favorite`).
 * - « Maîtrise moyenne » : moyenne de `mastery` sur toute la banque, donc
 *   structurellement proche de 0 pendant des mois (402 exercices au
 *   dénominateur), et surtout redondante avec « Progression globale », déjà
 *   affichée plus haut sur cette même page — deux nombres voisins mais
 *   différents pour la même idée, ce qui fait douter des deux.
 *
 * Restent trois métriques réellement actionnables : combien reste-t-il à
 * retravailler, combien n'ai-je jamais ouvert, et est-ce que je réussis.
 */
export function ExerciseBankStats({
  exercises,
  sessions,
  layout = "row",
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  /**
   * `row` : trois indicateurs côte à côte, séparés par des filets verticaux.
   * `rail` : empilés, valeur alignée à droite — la seule forme lisible dans
   * une colonne de 18 rem, où la version en rangée se repliait en escalier.
   */
  layout?: "row" | "rail";
}) {
  const stats = useMemo(() => computeExerciseBankStats(exercises, sessions), [exercises, sessions]);
  const results = useMemo(() => resultCounts(sessions), [sessions]);

  const entries = [
    { label: "À revoir", value: String(stats.toReviewCount), detail: "exercices à retravailler" },
    { label: "Jamais travaillés", value: String(stats.neverWorkedCount), detail: "aucune séance enregistrée" },
    {
      label: "Taux de réussite",
      value: results.successRate === null ? "—" : `${results.successRate} %`,
      detail:
        results.attempted > 0
          ? `${results.attempted} tentative${results.attempted > 1 ? "s" : ""} qualifiée${results.attempted > 1 ? "s" : ""}`
          : "aucun résultat enregistré",
    },
  ];

  if (layout === "rail") {
    return (
      <dl className="divide-y divide-line border-y border-line">
        {entries.map((entry) => (
          <div key={entry.label} className={cn("flex items-baseline justify-between gap-3 py-3")}>
            <div className="min-w-0">
              <dt className="t-label">{entry.label}</dt>
              <dd className="t-meta mt-0.5 text-2xs">{entry.detail}</dd>
            </div>
            <dd className="t-figure-sm shrink-0">{entry.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <StatRow>
      {entries.map((entry) => (
        <Stat key={entry.label} label={entry.label} value={entry.value} detail={entry.detail} />
      ))}
    </StatRow>
  );
}
