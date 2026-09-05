"use client";
import { useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computePreparationPlan, computePreparationSnapshot } from "@/lib/preparation-os";
import { PLAN_STORAGE_KEY, serializePlan } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
export function PreparationCommand() {
  const { exercises, sessions, chapters, preferences, ready } = usePrepahubData(); const router = useRouter(); const [minutes, setMinutes] = useState(preferences.dailyGoalMinutes);
  const snapshot = useMemo(() => computePreparationSnapshot(exercises, sessions, chapters), [exercises, sessions, chapters]); const plan = useMemo(() => computePreparationPlan(exercises, sessions, chapters, minutes), [exercises, sessions, chapters, minutes]);
  if (!ready || snapshot.subjects.length === 0) return null;
  const start = () => { const picks = plan.items.flatMap((item) => { const exercise = exercises.find((e) => e.id === item.exerciseId); return exercise ? [{ exercise, score: 0, reasons: [item.reason] }] : []; }); const stored = serializePlan({ blocks: [{ intent: "consolider", label: "Préparation globale", focus: "Toutes tes matières", estimatedMinutes: plan.allocatedMinutes, picks }], requestedMinutes: plan.requestedMinutes, totalMinutes: plan.allocatedMinutes, totalExercises: picks.length }); sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stored)); router.push("/session"); };
  /*
   * L'en-tête interne (« PRÉPARATION GLOBALE · Ne laisse aucune matière
   * disparaître. ») a été retiré : ce composant avait son propre titre parce
   * qu'il vivait AU MILIEU du tableau de bord, sous un autre titre. Il a
   * maintenant son écran, dont l'en-tête dit déjà de quoi il s'agit — deux
   * titres empilés ne hiérarchisent rien.
   */
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="t-meta max-w-[56ch]">
          TaekdHub protège d&apos;abord la couverture de tes matières, puis utilise ses recommandations pour remplir le
          temps restant.
        </p>
        <SegmentedControl
          ariaLabel="Temps de préparation"
          value={minutes}
          onChange={setMinutes}
          options={[30, 45, 60, 90].map((value) => ({ value, label: `${value} min` }))}
        />
      </div>

      {/* Une LIGNE par matière, avec la minute allouée alignée à droite :
          c'est une répartition, et une répartition se lit en colonne. */}
      <ul className="divide-y divide-line border-y border-line">
        {snapshot.subjects.map((state) => {
          const planned = plan.items
            .filter((item) => item.subject === state.subject)
            .reduce((sum, item) => sum + item.minutes, 0);
          return (
            <li key={state.subject} className="flex items-center gap-3 py-3">
              <SubjectAvatar subject={state.subject} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="t-subhead truncate">{state.subject}</p>
                <p className="t-meta mt-0.5">
                  {state.completionRate} % maîtrisé · {state.pending} restant{state.pending > 1 ? "s" : ""}
                </p>
              </div>
              <span className={planned ? "t-figure-sm shrink-0" : "t-meta tabular shrink-0"}>
                {planned ? `${planned} min` : "—"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-accent" size={17} />
          <div>
            <p className="t-subhead">
              {plan.allocatedMinutes} min construites · {plan.items.length} exercice
              {plan.items.length > 1 ? "s" : ""}
            </p>
            <p className="t-meta mt-0.5">Chaque minute est recalculée depuis ton historique actuel.</p>
          </div>
        </div>
        <Button onClick={start} disabled={!plan.items.length}>
          Construire ma séance <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
