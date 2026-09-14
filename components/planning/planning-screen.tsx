"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, Check, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBar } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { EmptyState, Notice } from "@/components/ui/state";
import { SubjectDot } from "@/components/tasks/task-bits";
import { useComposer } from "@/components/tasks/composer";
import { dateFromDayKey, formatDayShort, formatMinutes, formatRelativeDay } from "@/lib/domain/date";
import { computeAdaptations, planWork, type PlanProposal } from "@/lib/domain/scheduling";
import { subjectById } from "@/lib/domain/subjects";
import { isDeadlineTask, isOpen, isScheduled, remainingMinutes } from "@/lib/domain/tasks";
import { computeFeasibility, computeWorkload } from "@/lib/domain/workload";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { DayLoad } from "@/lib/domain/workload";

/**
 * ============================================================================
 * PLANNING — « est-ce que ça tient ? »
 * ============================================================================
 *
 * Trois blocs, dans l'ordre où l'on s'en sert :
 *
 *   1. LE VERDICT. Une phrase : ça tient, ou il manque tant d'heures. C'est
 *      la seule information que l'élève vient réellement chercher ici.
 *   2. LA CHARGE, jour par jour. Un tableau, pas un graphique : « jeudi, 6 h
 *      prévues pour 4 h disponibles » se lit et se vérifie ; une courbe ne se
 *      vérifie pas.
 *   3. LA PLANIFICATION. TaekdHub propose une répartition, l'élève la lit
 *      AVANT de l'appliquer — et peut refuser. Un outil qui déplace le
 *      travail sans montrer ce qu'il fait n'est jamais utilisé deux fois.
 *
 * Le bloc « adapter » n'apparaît que lorsqu'il y a réellement un écart entre
 * le prévu et le fait.
 */
export function PlanningScreen() {
  const { state, ready, applyPlan, postponeTask, unscheduleTask } = useStore();
  const { open } = useComposer();
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const now = useMemo(() => new Date(), []);

  const view = useMemo(() => {
    const workload = computeWorkload(state, now, 7, now);
    const feasibility = computeFeasibility(state, now, 7, now);
    const adaptations = computeAdaptations(state, now);
    // Les évaluations n'ont pas de créneau à recevoir : ce sont des repères
    // (voir domain/scheduling.ts#planWork). Les lister ici ferait croire qu'il
    // manque quatre heures de travail pour un DS qui, lui, aura bien lieu.
    const unplanned = state.tasks.filter((task) => isOpen(task) && !isScheduled(task) && !isDeadlineTask(task));
    return { workload, feasibility, adaptations, unplanned };
  }, [state, now]);

  const taskById = useMemo(() => new Map(state.tasks.map((task) => [task.id, task])), [state.tasks]);

  function propose(replace: boolean) {
    setReplaceExisting(replace);
    setProposal(planWork(state, { now, days: 7, replaceExisting: replace }));
  }

  if (!ready) return null;

  return (
    <div className="space-y-9">
      <PageBar
        title="Planning"
        lede="Ce que tu as à faire, face au temps que tu as réellement."
        actions={
          <Button onClick={() => propose(false)}>
            <Wand2 size={16} /> Planifier
          </Button>
        }
      />

      {/* ── VERDICT ─────────────────────────────────────────────── */}
      <Section variant="feature" label="Les 7 prochains jours" title={verdictTitle(view.feasibility.feasible, view.feasibility.deficitMinutes)}>
        <div className="space-y-4">
          <p className="t-body text-muted">
            {formatMinutes(view.feasibility.requiredMinutes)} de travail à échéance cette semaine, pour{" "}
            {formatMinutes(view.feasibility.availableMinutes)} disponibles.
            {view.workload.unscheduledCount > 0 && (
              <>
                {" "}
                {view.workload.unscheduledCount} tâche{view.workload.unscheduledCount > 1 ? "s" : ""} ne{" "}
                {view.workload.unscheduledCount > 1 ? "sont" : "est"} posée{view.workload.unscheduledCount > 1 ? "s" : ""} nulle part (
                {formatMinutes(view.workload.unscheduledMinutes)}).
              </>
            )}
          </p>

          {!view.feasibility.feasible && (
            <Notice tone="danger" title="Ce planning ne tient pas">
              Il manque {formatMinutes(view.feasibility.deficitMinutes)}. Trois issues honnêtes : élargir tes
              disponibilités, réduire une estimation trop généreuse, ou renoncer à une tâche — TaekdHub ne fera pas
              rentrer 40 heures dans 31.
            </Notice>
          )}

          {view.workload.overdueCount > 0 && (
            <Notice tone="warning" title={`${view.workload.overdueCount} tâche${view.workload.overdueCount > 1 ? "s" : ""} en retard`}>
              {formatMinutes(view.workload.overdueMinutes)} à rattraper, comptées en plus de la semaine qui vient.
            </Notice>
          )}
        </div>
      </Section>

      {/* ── CHARGE ──────────────────────────────────────────────── */}
      <Section label="Charge" title="Jour par jour" description="Disponible, planifié, et ce qu'il reste de marge.">
        <LoadTable days={view.workload.days} />
      </Section>

      {/* ── PROPOSITION ─────────────────────────────────────────── */}
      {proposal && (
        <Section
          variant="panel"
          label="Proposition"
          title={proposal.assignments.length > 0 ? "Voici comment TaekdHub répartirait" : "Rien à placer"}
          description={
            proposal.assignments.length > 0
              ? "Rien n'est enregistré tant que tu n'as pas appliqué. Les échéances sont respectées : aucune tâche n'est posée après sa date."
              : undefined
          }
          action={
            <Button size="sm" variant="ghost" aria-label="Fermer la proposition" onClick={() => setProposal(null)}>
              <X size={15} />
            </Button>
          }
          footer={
            proposal.assignments.length > 0 ? (
              <>
                <span className="t-meta">
                  {proposal.assignments.length} tâche{proposal.assignments.length > 1 ? "s" : ""} placée
                  {proposal.assignments.length > 1 ? "s" : ""}
                  {proposal.unplaced.length > 0 && ` · ${proposal.unplaced.length} sans place`}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setProposal(null)}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      applyPlan(proposal);
                      setProposal(null);
                    }}
                  >
                    <Check size={14} /> Appliquer
                  </Button>
                </span>
              </>
            ) : undefined
          }
        >
          {proposal.assignments.length === 0 && proposal.unplaced.length === 0 ? (
            <div className="space-y-3">
              <p className="t-meta">Toutes tes tâches ouvertes ont déjà un créneau.</p>
              <Button size="sm" variant="secondary" onClick={() => propose(true)}>
                Tout replanifier depuis zéro
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="divide-y divide-line border-y border-line">
                {proposal.assignments.map((assignment) => {
                  const task = taskById.get(assignment.taskId);
                  if (!task) return null;
                  return (
                    <li key={assignment.taskId} className="flex items-start gap-3 px-1 py-3">
                      <SubjectDot subject={subjectById(state.subjects, task.subjectId)} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem]">{task.title}</p>
                        <p className="t-meta mt-0.5">{assignment.rationale}</p>
                      </div>
                      <Badge variant={assignment.missingMinutes > 0 ? "warning" : "default"}>
                        {formatMinutes(assignment.minutes)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>

              {proposal.unplaced.length > 0 && (
                <div>
                  <p className="t-label mb-2">Sans place</p>
                  <ul className="space-y-1.5">
                    {proposal.unplaced.map((item) => {
                      const task = taskById.get(item.taskId);
                      return (
                        <li key={item.taskId} className="t-meta flex items-start gap-2">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-300" />
                          <span>
                            <strong className="font-medium text-ink">{task?.title}</strong> — {item.message}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!replaceExisting && (
                <Button size="sm" variant="ghost" onClick={() => propose(true)}>
                  Replanifier aussi ce qui est déjà posé
                </Button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── ADAPTER AU RÉEL ─────────────────────────────────────── */}
      {view.adaptations.length > 0 && (
        <Section
          id="adapter"
          label="Adapter"
          title="Prévu, mais pas fait"
          description="Ce qui n'a pas eu lieu ne repart pas « à demain » par défaut : voici où ça a réellement sa place."
        >
          <ul className="divide-y divide-line border-y border-line">
            {view.adaptations.map(({ task, plannedMinutes, doneMinutes, suggestion }) => (
              <li key={task.id} className="flex flex-wrap items-start gap-3 px-1 py-4">
                <SubjectDot subject={subjectById(state.subjects, task.subjectId)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => open(task)} className="truncate text-left text-[0.9375rem]">
                    {task.title}
                  </button>
                  <p className="t-meta mt-0.5">
                    {formatMinutes(plannedMinutes)} prévues, {doneMinutes > 0 ? `${formatMinutes(doneMinutes)} faites` : "rien de fait"}.
                    {suggestion ? ` ${suggestion.message}` : " Aucun créneau libre trouvé dans les 14 jours."}
                  </p>
                  {suggestion?.warning && <p className="t-meta mt-0.5 text-amber-300">{suggestion.warning}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => unscheduleTask(task.id)}>
                    Retirer
                  </Button>
                  {suggestion && (
                    <Button size="sm" onClick={() => postponeTask(task.id, suggestion.slots)}>
                      <CalendarCheck size={14} /> {formatRelativeDay(suggestion.day, now)}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── À CASER ─────────────────────────────────────────────── */}
      <Section
        label="À caser"
        title={`${view.unplanned.length} tâche${view.unplanned.length > 1 ? "s" : ""} sans créneau`}
        action={
          <Link href="/goals" className="t-meta inline-flex items-center gap-1 text-accent hover:underline">
            Objectifs & routines <ArrowRight size={12} />
          </Link>
        }
      >
        {view.unplanned.length === 0 ? (
          <EmptyState title="Tout est posé" description="Chaque tâche ouverte a sa place dans le calendrier." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {view.unplanned.slice(0, 12).map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-1 py-2.5">
                <SubjectDot subject={subjectById(state.subjects, task.subjectId)} />
                <button type="button" onClick={() => open(task)} className="min-w-0 flex-1 truncate text-left text-[0.9375rem]">
                  {task.title}
                </button>
                <span className="t-meta shrink-0">{formatMinutes(remainingMinutes(task, state.timeEntries))}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/**
 * TABLEAU DE CHARGE — le cœur de l'écran.
 *
 * Une ligne par jour, une barre proportionnelle, et le verdict en clair.
 * La barre dépasse VISIBLEMENT son rail quand la journée déborde : plafonner
 * à 100 % masquerait précisément l'information qu'on vient chercher.
 */
export function LoadTable({ days }: { days: DayLoad[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {days.map((day) => {
        const ratio = day.capacityMinutes > 0 ? day.plannedMinutes / day.capacityMinutes : day.plannedMinutes > 0 ? 1.5 : 0;
        return (
          <li key={day.date} className="flex items-center gap-3 px-1 py-3">
            <Link
              href="/calendar"
              className="w-[5.5rem] shrink-0 text-sm text-muted hover:text-ink"
              title={`Voir le ${formatDayShort(dateFromDayKey(day.date))}`}
            >
              {capitalize(formatDayShort(dateFromDayKey(day.date)))}
            </Link>

            <span className="tabular hidden w-[9rem] shrink-0 text-sm text-muted sm:block">
              {formatMinutes(day.plannedMinutes)} / {formatMinutes(day.capacityMinutes)}
            </span>

            <span aria-hidden className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-hairline/[0.10]">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  day.status === "over" ? "bg-rose-400" : day.status === "tight" ? "bg-amber-400" : "bg-accent-brand"
                )}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </span>

            <span className="w-[6.5rem] shrink-0 text-right">
              <StatusLabel day={day} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusLabel({ day }: { day: DayLoad }) {
  if (day.status === "empty") return <span className="t-meta text-subtle">—</span>;
  if (day.status === "over") return <span className="text-sm text-rose-300">+{formatMinutes(day.overflowMinutes)}</span>;
  if (day.status === "tight") return <span className="text-sm text-amber-300">Tendu</span>;
  return <span className="t-meta">{formatMinutes(day.freeMinutes)} libres</span>;
}

function verdictTitle(feasible: boolean, deficit: number): string {
  return feasible ? "Ta semaine tient debout" : `Il te manque ${formatMinutes(deficit)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

