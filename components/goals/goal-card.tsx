"use client";

import { useMemo } from "react";
import { sessionWrite } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import {
  computeGoalReadiness,
  computeUpcomingGoalSessions,
  describeGoalScope,
  explainGoalPlan,
  GOAL_READINESS_META,
  scopeToGoal,
  serializeGoalsDailyPlan,
} from "@/lib/goals";
import { computeDailyPlan, PLAN_STORAGE_KEY } from "@/lib/plan";
import type { Chapter, Goal } from "@/lib/storage";
import { formatMinutes } from "@/lib/utils";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/** Nombre de séances projetées montrées sous chaque objectif — assez pour donner un vrai aperçu, assez peu pour rester lisible (même logique que `NEXT_ACTION_PICKS`, lib/next-action.ts). */
const UPCOMING_SESSIONS_PREVIEW = 3;

function daysLabel(days: number): string {
  return `${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
}

export function GoalCard({
  goal,
  exercises,
  sessions,
  chapters,
  dailyGoalMinutes,
  onChangeStatus,
}: {
  goal: Goal;
  exercises: Exercise[];
  sessions: WorkSession[];
  chapters: Chapter[];
  dailyGoalMinutes: number;
  onChangeStatus: (status: Goal["status"]) => void;
}) {
  const router = useRouter();

  const readiness = useMemo(() => computeGoalReadiness(goal, exercises, sessions, dailyGoalMinutes), [goal, exercises, sessions, dailyGoalMinutes]);
  const upcoming = useMemo(
    () => (goal.status === "active" ? computeUpcomingGoalSessions(goal, exercises, sessions, chapters, dailyGoalMinutes, UPCOMING_SESSIONS_PREVIEW) : []),
    [goal, exercises, sessions, chapters, dailyGoalMinutes]
  );

  const meta = GOAL_READINESS_META[readiness.level];
  const canStart = goal.status === "active" && readiness.flaggedCount > 0;

  function startSessionForGoal() {
    // Périmètre scopé : pas de couverture ici (voir `coverageBank`, lib/plan.ts).
    const plan = computeDailyPlan(scopeToGoal(goal, exercises), sessions, chapters, dailyGoalMinutes, new Date(), null);
    const stored = serializeGoalsDailyPlan([{ goal, readiness, plan }]);
    if (stored.items.length === 0) return;
    sessionWrite(PLAN_STORAGE_KEY, JSON.stringify(stored));
    router.push("/session");
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{goal.title}</p>
          <p className="t-meta mt-1">{describeGoalScope(goal)}</p>
        </div>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>

      {goal.status === "active" && (
        <>
          {readiness.daysRemaining !== null && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <CalendarClock size={13} className="shrink-0" />
              {readiness.daysRemaining >= 0 ? `Échéance dans ${daysLabel(readiness.daysRemaining)}` : `Échéance dépassée depuis ${daysLabel(readiness.daysRemaining)}`}
            </p>
          )}

          {readiness.hasScope && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{readiness.coveragePercent}% de couverture réelle</span>
                {readiness.flaggedCount > 0 && (
                  <span>
                    {readiness.flaggedCount} exercice{readiness.flaggedCount > 1 ? "s" : ""} restant{readiness.flaggedCount > 1 ? "s" : ""} · ≈{" "}
                    {formatMinutes(readiness.estimatedMinutesRemaining)}
                  </span>
                )}
              </div>
              <ProgressBar value={readiness.coveragePercent} animated={false} className="mt-2 h-1.5" />
            </div>
          )}

          {!readiness.hasScope && (
            <p className="mt-3 text-xs text-muted">Aucun exercice actif dans ce périmètre pour l&apos;instant.</p>
          )}

          {readiness.flaggedCount > 0 && (
            <p className="mt-3 text-xs leading-5 text-muted">{explainGoalPlan(readiness)}</p>
          )}

          {upcoming.length > 0 && (
            <div className="mt-4 border-t border-hairline/[0.07] pt-3">
              <p className="eyebrow">Prochaines séances</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {upcoming.map((plan, index) => (
                  <li key={index}>
                    Séance {index + 1} · {plan.totalExercises} exercice{plan.totalExercises > 1 ? "s" : ""} · ≈ {formatMinutes(plan.totalMinutes)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canStart && (
              <Button size="sm" onClick={startSessionForGoal}>
                <PlayCircle size={14} /> Commencer une séance <ArrowRight size={13} />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onChangeStatus("completed")}>
              <CheckCircle2 size={14} /> Marquer comme terminé
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChangeStatus("abandoned")}>
              <XCircle size={14} /> Abandonner
            </Button>
          </div>
        </>
      )}

      {goal.status !== "active" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="default">{goal.status === "completed" ? "Terminé" : "Abandonné"}</Badge>
          <Button size="sm" variant="ghost" onClick={() => onChangeStatus("active")}>
            Réactiver
          </Button>
        </div>
      )}
    </Card>
  );
}
