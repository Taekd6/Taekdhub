"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Play, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBar, Split } from "@/components/ui/layout";
import { Meter } from "@/components/ui/progress";
import { List, Section } from "@/components/ui/section";
import { EmptyState, Notice, Skeleton } from "@/components/ui/state";
import { SubjectDot } from "@/components/tasks/task-bits";
import { TaskRow } from "@/components/tasks/task-row";
import { useComposer } from "@/components/tasks/composer";
import { freeSlotsForDay } from "@/lib/domain/availability";
import { dayKey, formatDay, formatMinutes, timeOf } from "@/lib/domain/date";
import { computeNextAction } from "@/lib/domain/priority";
import { computeAdaptations } from "@/lib/domain/scheduling";
import { subjectById } from "@/lib/domain/subjects";
import { isOpen, isOverdue, slotsOnDay, sortBySlot } from "@/lib/domain/tasks";
import { computeDayLoad } from "@/lib/domain/workload";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { ScoredTask } from "@/lib/domain/priority";

/**
 * ============================================================================
 * AUJOURD'HUI — le cockpit. Un seul écran, une seule question.
 * ============================================================================
 *
 * « Qu'est-ce que je fais maintenant ? »
 *
 * D'où la hiérarchie, stricte et non négociable :
 *
 *   MAINTENANT   une tâche, sa durée, la raison pour laquelle c'est elle, et
 *                un bouton pour commencer. C'est le seul élément de l'écran
 *                composé en grand.
 *   ENSUITE      ce qui tient encore dans le temps restant de la soirée.
 *   PLUS TARD    le reste, replié, pour rassurer sans encombrer.
 *
 * Le rail de droite répond à la question d'après (« où j'en suis ») sans
 * jamais voler la place de l'action. Sur mobile il passe DESSOUS : la
 * première chose à l'écran doit rester ce qu'il y a à faire, pas des
 * compteurs.
 *
 * Ce qui n'est PAS ici est aussi délibéré : aucun graphique, aucun score,
 * aucune série de badges. Ouvrir TaekdHub le lundi matin doit donner une
 * réponse, pas un tableau de bord.
 */
export function TodayScreen() {
  const { state, ready, startTimer, timer } = useStore();
  const { add, open } = useComposer();
  const [showLater, setShowLater] = useState(false);

  const now = useMemo(() => new Date(), []);
  const today = dayKey(now);

  const view = useMemo(() => {
    const load = computeDayLoad(state, today);

    /*
     * DEUX temps restants, et les confondre produit un écran qui se contredit.
     *
     *   `remainingCapacity` — ce qui est encore LIBRE (hors créneaux déjà
     *      posés). C'est le chiffre du rail : « il te reste 1 h ».
     *   `remainingToday`    — tout le temps qu'il reste dans la journée, y
     *      compris les créneaux déjà posés, puisque ce qu'ils contiennent fait
     *      partie du programme proposé. C'est le budget de la file
     *      « Maintenant / Ensuite ».
     *
     * Les deux tiennent compte de l'HEURE : à 21 h 30, une soirée déclarée de
     * 18 h à 22 h ne vaut plus quatre heures mais trente minutes. Proposer un
     * programme de trois heures à cette heure-là suffit à discréditer l'outil.
     */
    const busy = state.tasks.filter(isOpen).flatMap((task) => slotsOnDay(task, today));
    const remainingCapacity = freeSlotsForDay(state.availability, today, busy, now).reduce(
      (total, slot) => total + slot.minutes,
      0
    );
    const remainingToday = freeSlotsForDay(state.availability, today, [], now).reduce(
      (total, slot) => total + slot.minutes,
      0
    );
    const scheduledToday = sortBySlot(
      state.tasks.filter((task) => isOpen(task) && slotsOnDay(task, today).length > 0),
      today
    );
    const action = computeNextAction(state, { now, remainingCapacityMinutes: remainingToday });
    const overdue = state.tasks.filter((task) => isOverdue(task, now));
    const workedToday = state.timeEntries
      .filter((entry) => dayKey(entry.startedAt) === today)
      .reduce((total, entry) => total + entry.minutes, 0);
    const adaptations = computeAdaptations(state, now);

    return { load, remainingCapacity, remainingToday, scheduledToday, action, overdue, workedToday, adaptations };
  }, [state, today, now]);

  if (!ready) return <TodaySkeleton />;

  const { action } = view;
  const scored = action.scored;

  return (
    <Split
      railLabel="Ma journée"
      rail={
        <div className="space-y-7">
          <div>
            <p className="t-label">Travaillé aujourd&apos;hui</p>
            <p className="t-figure-md mt-1.5">{formatMinutes(view.workedToday)}</p>
            <p className="t-meta mt-1">
              {view.load.capacityMinutes > 0
                ? `sur ${formatMinutes(view.load.capacityMinutes)} disponibles`
                : "aucune disponibilité déclarée aujourd'hui"}
            </p>
            {view.load.capacityMinutes > 0 && (
              <Meter
                className="mt-2.5"
                value={(view.workedToday / view.load.capacityMinutes) * 100}
                tone={view.workedToday >= view.load.capacityMinutes ? "success" : "accent"}
              />
            )}
          </div>

          <div className="border-t border-line pt-6">
            <p className="t-label">Il te reste</p>
            <p className="t-figure-sm mt-1.5">{formatMinutes(view.remainingCapacity)}</p>
            <p className="t-meta mt-1">
              {view.load.plannedMinutes > 0 ? `${formatMinutes(view.load.plannedMinutes)} déjà prévues` : "rien de posé aujourd'hui"}
            </p>
          </div>

          {view.overdue.length > 0 && (
            <div className="border-t border-line pt-6">
              <p className="t-label">En retard</p>
              <p className="t-figure-sm mt-1.5 text-rose-300">{view.overdue.length}</p>
              <Link href="/tasks?filter=overdue" className="t-meta mt-1 inline-flex items-center gap-1 text-accent hover:underline">
                Voir <ArrowRight size={12} />
              </Link>
            </div>
          )}

          <div className="border-t border-line pt-6">
            <Link href="/planning" className="t-meta inline-flex items-center gap-1.5 text-accent hover:underline">
              Ma charge des 7 prochains jours <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-9">
        <PageBar
          title={greeting(state.settings.displayName, now)}
          meta={capitalize(formatDay(now))}
          actions={
            <Button onClick={() => add()} className="max-lg:hidden">
              <Plus size={16} /> Ajouter
            </Button>
          }
        />

        {/* ── ADAPTATION AU RÉEL ──────────────────────────────────
            Ce qui était prévu hier et n'a pas été fait ne disparaît pas en
            silence : c'est la première chose dont on parle en arrivant. */}
        {view.adaptations.length > 0 && (
          <Notice
            tone="warning"
            title={`${view.adaptations.length} tâche${view.adaptations.length > 1 ? "s" : ""} prévue${view.adaptations.length > 1 ? "s" : ""} et non faite${view.adaptations.length > 1 ? "s" : ""}`}
            action={
              <Link href="/planning#adapter">
                <Button size="sm" variant="secondary">
                  Replanifier
                </Button>
              </Link>
            }
          >
            TaekdHub a recalculé où les remettre, en tenant compte de ta charge des prochains jours.
          </Notice>
        )}

        {/* ── MAINTENANT ────────────────────────────────────────── */}
        <Section variant="feature" label="Maintenant" title={action.title} description={action.rationale}>
          {scored ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <SubjectDot subject={subjectById(state.subjects, scored.task.subjectId)} />
                <Badge variant="accent">{formatMinutes(scored.minutes)}</Badge>
                {scored.reasons.slice(0, 2).map((reason) => (
                  <Badge key={reason} variant={scored.overdue ? "danger" : "default"}>
                    {reason}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  disabled={Boolean(timer)}
                  onClick={() => startTimer({ taskId: scored.task.id, subjectId: scored.task.subjectId })}
                >
                  <Play size={16} /> {timer ? "Séance en cours" : "Commencer"}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => open(scored.task)}>
                  Ouvrir la tâche
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => add()}>
                <Plus size={16} /> Ajouter une tâche
              </Button>
              {action.kind === "done-for-today" && (
                <Link href="/review">
                  <Button size="lg" variant="secondary">
                    Voir mon bilan
                  </Button>
                </Link>
              )}
            </div>
          )}
        </Section>

        {/* ── ENSUITE ──────────────────────────────────────────── */}
        {action.next.length > 0 && (
          <Section label="Ensuite" title="Si tu enchaînes" description="Ce qui tient encore dans le temps qu'il te reste aujourd'hui.">
            <List>
              {action.next.map((item) => (
                <TaskRow key={item.task.id} task={item.task} onOpen={open} showTimer now={now} />
              ))}
            </List>
          </Section>
        )}

        {/* ── CE QUI EST POSÉ AUJOURD'HUI ─────────────────────── */}
        {view.scheduledToday.length > 0 && (
          <Section
            label="Ton programme"
            title="Posé dans le calendrier"
            action={
              <Link href="/calendar" className="t-meta inline-flex items-center gap-1 text-accent hover:underline">
                Calendrier <ArrowRight size={12} />
              </Link>
            }
          >
            <ul className="divide-y divide-line border-y border-line">
              {view.scheduledToday.map((task) => {
                const slot = slotsOnDay(task, today)[0];
                // Un créneau déjà écoulé reste affiché — c'est ce qui était
                // prévu — mais en retrait : le confondre avec ce qui vient
                // ferait lire le programme de la soirée à l'envers.
                const past = slot ? new Date(slot.end).getTime() < now.getTime() : false;
                return (
                  <li key={task.id} className={cn("flex items-center gap-3 px-1 py-3", past && "opacity-55")}>
                    <span className="tabular w-[4.5rem] shrink-0 text-sm text-muted">
                      {slot ? `${timeOf(slot.start)}–${timeOf(slot.end)}` : ""}
                    </span>
                    <button type="button" onClick={() => open(task)} className="min-w-0 flex-1 truncate text-left text-[0.9375rem]">
                      {task.title}
                    </button>
                    <SubjectDot subject={subjectById(state.subjects, task.subjectId)} />
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* ── PLUS TARD ────────────────────────────────────────── */}
        {action.later.length > 0 && (
          <Section
            label="Plus tard"
            title={`${action.later.length} autre${action.later.length > 1 ? "s" : ""} en attente`}
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowLater((value) => !value)}>
                {showLater ? "Masquer" : "Afficher"}
              </Button>
            }
          >
            {showLater ? (
              <List>
                {action.later.map((item: ScoredTask) => (
                  <TaskRow key={item.task.id} task={item.task} onOpen={open} now={now} />
                ))}
              </List>
            ) : (
              <p className="t-meta">Rien d&apos;urgent parmi elles — on s&apos;en occupe quand le reste est fait.</p>
            )}
          </Section>
        )}

        {action.kind === "empty" && (
          <EmptyState
            icon={Sparkles}
            title="TaekdHub est vide"
            description="Ajoute ce que tu as à faire cette semaine : un DM, un TD, un chapitre à apprendre. L'application s'occupe du reste."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => add()}>
                  <Plus size={15} /> Ma première tâche
                </Button>
                <Link href="/settings#disponibilites">
                  <Button variant="secondary">
                    <CalendarPlus size={15} /> Mes disponibilités
                  </Button>
                </Link>
              </div>
            }
          />
        )}
      </div>
    </Split>
  );
}

function greeting(name: string, now: Date): string {
  const hour = now.getHours();
  const moment = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${moment}, ${name}` : moment;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Le squelette a la HAUTEUR du contenu réel : la page ne doit pas sauter quand les données arrivent. */
function TodaySkeleton() {
  return (
    <div className="space-y-9">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
