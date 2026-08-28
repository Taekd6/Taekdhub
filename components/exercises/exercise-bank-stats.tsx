"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/ui/metric-card";
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
export function ExerciseBankStats({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const stats = useMemo(() => computeExerciseBankStats(exercises, sessions), [exercises, sessions]);
  const results = useMemo(() => resultCounts(sessions), [sessions]);

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      <MetricCard label="À revoir" value={String(stats.toReviewCount)} detail="Exercices à retravailler" delay={0} />
      <MetricCard label="Jamais travaillés" value={String(stats.neverWorkedCount)} detail="Aucune séance enregistrée" delay={0.05} />
      <MetricCard
        label="Taux de réussite"
        value={results.successRate === null ? "—" : `${results.successRate}%`}
        detail={results.attempted > 0 ? `${results.attempted} tentative${results.attempted > 1 ? "s" : ""} qualifiée${results.attempted > 1 ? "s" : ""}` : "Aucun résultat enregistré"}
        delay={0.1}
      />
    </div>
  );
}
