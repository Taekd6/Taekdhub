"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBar } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/state";
import { AgentPanel } from "@/components/review/agent-panel";
import { CATEGORY_FAMILY_LABELS } from "@/lib/domain/categories";
import { addDays, dateFromDayKey, formatDayShort, formatMinutes, startOfWeek } from "@/lib/domain/date";
import { computeHabits, describeEstimationBias, MIN_SAMPLES } from "@/lib/domain/habits";
import { computeWeeklyReview } from "@/lib/domain/review";
import { SUBJECT_TONE_BAR } from "@/lib/domain/subjects";
import { useStore } from "@/lib/store/store";
import { WEEKDAY_SHORT, WEEKDAYS } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

/**
 * ============================================================================
 * BILAN — « est-ce que j'ai réellement avancé, et que changer ? »
 * ============================================================================
 *
 * Deux temporalités, séparées parce qu'elles ne répondent pas à la même
 * question :
 *
 *   LA SEMAINE    ce qui s'est passé. Prévu / réel, échéances, matières.
 *   LES HABITUDES ce que je fais toujours. Justesse de mes estimations, ce
 *                 que je reporte, quand je travaille vraiment.
 *
 * Chaque constat est adossé à un chiffre affiché juste au-dessus : un bilan
 * dont on ne peut pas vérifier les affirmations ne change rien.
 *
 * Le seuil de prudence est visible, pas caché : tant qu'il y a moins de cinq
 * mesures, TaekdHub DIT qu'il ne sait pas encore, au lieu d'inventer une
 * tendance sur deux points.
 */
export function ReviewScreen() {
  const { state, ready } = useStore();
  const [offset, setOffset] = useState(0);

  const now = useMemo(() => new Date(), []);
  const reference = useMemo(() => addDays(startOfWeek(now), offset * 7), [now, offset]);
  const review = useMemo(() => computeWeeklyReview(state, reference, now), [state, reference, now]);
  const habits = useMemo(() => computeHabits(state), [state]);

  if (!ready) return null;

  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const maxSubjectMinutes = Math.max(1, ...review.bySubject.map((item) => item.minutes));
  const maxDayMinutes = Math.max(1, ...review.byDay.map((day) => Math.max(day.plannedMinutes, day.workedMinutes)));
  const maxWeekdayMinutes = Math.max(1, ...habits.byWeekday.map((item) => item.minutes));
  const bias = describeEstimationBias(habits);

  return (
    <div className="space-y-10">
      <PageBar
        title="Bilan"
        meta={`${formatDayShort(dateFromDayKey(review.weekStart))} → ${formatDayShort(dateFromDayKey(review.weekEnd))}${review.current ? " · semaine en cours" : ""}`}
        actions={
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" aria-label="Semaine précédente" onClick={() => setOffset((value) => value - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)} disabled={offset === 0}>
              Cette semaine
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Semaine suivante"
              onClick={() => setOffset((value) => Math.min(0, value + 1))}
              disabled={offset >= 0}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      {/* ── TRAVAIL ─────────────────────────────────────────────── */}
      <Section label="Travail" title="Prévu et réel">
        <StatRow>
          <Stat label="Temps réel" value={formatMinutes(review.workedMinutes)} size="lg" />
          <Stat label="Temps prévu" value={formatMinutes(review.plannedMinutes)} />
          <Stat
            label="Réalisation"
            value={review.plannedMinutes > 0 ? `${review.completionRate} %` : "—"}
            tone={review.completionRate >= 80 ? "success" : review.completionRate >= 50 ? "warning" : review.plannedMinutes > 0 ? "danger" : undefined}
          />
          <Stat label="Tâches terminées" value={review.tasksCompleted} />
          <Stat label="Reportées" value={review.tasksPostponed} tone={review.tasksPostponed >= 3 ? "warning" : undefined} />
          {review.tasksCancelled > 0 && <Stat label="Abandonnées" value={review.tasksCancelled} />}
        </StatRow>

        <div className="mt-7">
          <p className="t-label mb-3">Jour par jour</p>
          <ul className="space-y-2.5">
            {review.byDay.map((day) => (
              <li key={day.date} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-sm text-muted">{capitalize(formatDayShort(dateFromDayKey(day.date)).slice(0, 3))}</span>
                <span aria-hidden className="relative h-4 min-w-0 flex-1">
                  {/* Prévu en creux, réel en plein : l'écart entre les deux EST
                      l'information, et deux barres superposées le montrent
                      sans qu'on ait à faire la soustraction. */}
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-hairline/[0.10]"
                    style={{ width: `${(day.plannedMinutes / maxDayMinutes) * 100}%` }}
                  />
                  <span
                    className="absolute inset-y-1 left-0 rounded-sm bg-accent-brand"
                    style={{ width: `${(day.workedMinutes / maxDayMinutes) * 100}%` }}
                  />
                </span>
                <span className="tabular w-32 shrink-0 text-right text-sm text-muted">
                  {formatMinutes(day.workedMinutes)}
                  <span className="text-subtle"> / {formatMinutes(day.plannedMinutes)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── ÉCHÉANCES ───────────────────────────────────────────── */}
      <Section label="Échéances" title="Tenues et manquées">
        <StatRow>
          <Stat label="Tenues" value={review.deadlinesMet} tone={review.deadlinesMet > 0 ? "success" : undefined} />
          <Stat label="Manquées" value={review.deadlinesMissed} tone={review.deadlinesMissed > 0 ? "danger" : undefined} />
          <Stat label="Encore ouvertes" value={review.deadlinesAtRisk} tone={review.deadlinesAtRisk > 0 ? "warning" : undefined} />
        </StatRow>
      </Section>

      {/* ── MATIÈRES ────────────────────────────────────────────── */}
      <Section label="Matières" title="Où est passé ton temps">
        {review.bySubject.length === 0 ? (
          <EmptyState title="Aucun temps enregistré cette semaine" description="Le temps se note depuis une tâche, ou avec le chronomètre." />
        ) : (
          <ul className="space-y-3">
            {review.bySubject.map((item) => {
              const subject = item.subjectId ? subjectById.get(item.subjectId) : undefined;
              return (
                <li key={item.subjectId ?? "none"} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm">{subject?.label ?? "Sans matière"}</span>
                  <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-hairline/10">
                    <span
                      className={cn("block h-full rounded-full", subject ? SUBJECT_TONE_BAR[subject.tone] : "bg-hairline/30")}
                      style={{ width: `${(item.minutes / maxSubjectMinutes) * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-sm text-muted">{formatMinutes(item.minutes)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {review.byFamily.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {review.byFamily.map((item) => (
              <Badge key={item.family}>
                {CATEGORY_FAMILY_LABELS[item.family]} · {formatMinutes(item.minutes)}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* ── ANALYSE ─────────────────────────────────────────────── */}
      {(review.insights.length > 0 || review.suggestions.length > 0) && (
        <Section variant="panel" label="Analyse" title="Ce que dit cette semaine">
          {review.insights.length > 0 && (
            <ul className="space-y-2.5">
              {review.insights.map((insight) => (
                <li key={insight} className="t-body flex gap-2.5 text-muted">
                  <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-accent-brand" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}

          {review.suggestions.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="t-label mb-3">À changer la semaine prochaine</p>
              <ul className="space-y-2.5">
                {review.suggestions.map((suggestion) => (
                  <li key={suggestion} className="t-body flex gap-2.5">
                    <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ── HABITUDES ───────────────────────────────────────────── */}
      <Section
        label="Habitudes"
        title="Comment tu fonctionnes"
        description={`Mesuré sur ${habits.weeksObserved} semaine${habits.weeksObserved > 1 ? "s" : ""} — TaekdHub ne conclut rien sous ${MIN_SAMPLES} mesures.`}
      >
        <div className="space-y-7">
          <div>
            <p className="t-label">Justesse de tes estimations</p>
            <p className="t-body mt-1.5">{bias ?? "Pas encore assez de tâches terminées avec leur temps réel pour le dire."}</p>
            {habits.accuracy.filter((item) => item.ratio !== null).length > 0 && (
              <ul className="mt-3 space-y-2">
                {habits.accuracy
                  .filter((item) => item.ratio !== null)
                  .map((item) => {
                    const subject = item.subjectId ? subjectById.get(item.subjectId) : undefined;
                    const percent = Math.round(((item.ratio ?? 1) - 1) * 100);
                    return (
                      <li key={item.subjectId ?? "none"} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 truncate text-sm">{subject?.label ?? "Sans matière"}</span>
                        <span className={cn("text-sm", percent > 10 ? "text-amber-300" : percent < -10 ? "text-sky-300" : "text-emerald-300")}>
                          {percent > 0 ? `+${percent} %` : `${percent} %`}
                        </span>
                        <span className="t-meta">({item.samples} tâches)</span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          <div className="border-t border-line pt-6">
            <p className="t-label mb-3">Quand tu travailles vraiment</p>
            <ul className="flex items-end gap-2">
              {WEEKDAYS.map((day) => {
                const minutes = habits.byWeekday[day]?.minutes ?? 0;
                return (
                  <li key={day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span
                      aria-hidden
                      className="w-full rounded-t-sm bg-accent-brand/70"
                      style={{ height: `${Math.max(2, (minutes / maxWeekdayMinutes) * 72)}px` }}
                    />
                    <span className="t-meta text-2xs">{WEEKDAY_SHORT[day]}</span>
                    <span className="tabular text-2xs text-subtle">{minutes > 0 ? formatMinutes(minutes) : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {habits.mostPostponed.length > 0 && (
            <div className="border-t border-line pt-6">
              <p className="t-label mb-3">Ce que tu reportes le plus</p>
              <ul className="space-y-2">
                {habits.mostPostponed.map((item) => (
                  <li key={item.taskId} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    <Badge variant="warning">{item.count}×</Badge>
                  </li>
                ))}
              </ul>
              {habits.postponedFamilies.length > 0 && (
                <p className="t-meta mt-3">
                  Surtout des tâches de type{" "}
                  <strong className="font-medium text-ink">{CATEGORY_FAMILY_LABELS[habits.postponedFamilies[0].family]}</strong>.
                </p>
              )}
            </div>
          )}

          <div className="border-t border-line pt-6">
            <p className="t-label mb-2">Total travaillé depuis le début</p>
            <p className="t-figure-md">{formatMinutes(habits.totalWorkedMinutes)}</p>
            {/* Pas de jauge ici : il n'existe aucun total « à atteindre » dont
                ce chiffre serait un pourcentage. Une barre supposerait un
                dénominateur inventé — et une jauge inventée est pire qu'une
                absence de jauge. La moyenne hebdomadaire, elle, veut dire
                quelque chose. */}
            {habits.weeksObserved > 0 && (
              <p className="t-meta mt-1.5">
                soit {formatMinutes(Math.round(habits.totalWorkedMinutes / habits.weeksObserved))} par semaine travaillée,
                sur {habits.weeksObserved} semaine{habits.weeksObserved > 1 ? "s" : ""}.
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── ANALYSE PAR UN AGENT ────────────────────────────────── */}
      <AgentPanel />
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
