"use client";

import { useMemo, useState } from "react";
import { Plus, Repeat, Target, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageBar } from "@/components/ui/layout";
import { Meter } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Field, Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/state";
import { useComposer } from "@/components/tasks/composer";
import { SubjectDot } from "@/components/tasks/task-bits";
import { CATEGORY_FAMILY_LABELS, CATEGORY_FAMILY_ORDER, CATEGORY_META, categoriesByFamily } from "@/lib/domain/categories";
import { dayKey, formatMinutes, formatRelativeDay } from "@/lib/domain/date";
import { computeAllGoalProgress } from "@/lib/domain/goals";
import { describeRule, MAX_HORIZON_DAYS } from "@/lib/domain/routines";
import { activeSubjects } from "@/lib/domain/subjects";
import { createId } from "@/lib/domain/tasks";
import { useStore } from "@/lib/store/store";
import { WEEKDAY_SHORT, WEEKDAYS, type Goal, type Routine, type TaskCategory, type Weekday } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

/**
 * ============================================================================
 * OBJECTIFS & ROUTINES — le moyen terme.
 * ============================================================================
 *
 * Deux mécanismes qui répondent à la même limite d'une liste de tâches : elle
 * ne dit ni POURQUOI on fait les choses, ni ce qui revient chaque semaine.
 *
 *   OBJECTIF   « être à jour en physique ». Sa progression n'est JAMAIS
 *              déclarée : elle est calculée sur les tâches rattachées et le
 *              temps réellement enregistré (domain/goals.ts). Un objectif
 *              qu'on coche soi-même à 60 % ne mesure rien.
 *   ROUTINE    « bilan chaque dimanche ». Elle crée de VRAIES tâches à
 *              l'avance, pour qu'elles pèsent dans la charge comme les
 *              autres — et jamais plus de deux semaines d'avance, pour ne pas
 *              transformer l'application en usine à rappels.
 */
export function GoalsScreen() {
  const { state, ready, deleteGoal, deleteRoutine, saveRoutine } = useStore();
  const { add, open } = useComposer();
  const [goalSheet, setGoalSheet] = useState<Goal | "new" | null>(null);
  const [routineSheet, setRoutineSheet] = useState<Routine | "new" | null>(null);

  const now = useMemo(() => new Date(), []);
  const progress = useMemo(() => computeAllGoalProgress(state, now), [state, now]);

  if (!ready) return null;

  return (
    <div className="space-y-10">
      <PageBar title="Objectifs" lede="Ce vers quoi tu travailles, et ce qui revient chaque semaine." />

      <Section
        label="Objectifs"
        title="En cours"
        action={
          <Button size="sm" onClick={() => setGoalSheet("new")}>
            <Plus size={14} /> Objectif
          </Button>
        }
      >
        {progress.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Aucun objectif"
            description="Un objectif rassemble des tâches sous une même intention : « préparer le DS de maths », « être à jour en physique »."
            action={<Button onClick={() => setGoalSheet("new")}>Créer un objectif</Button>}
          />
        ) : (
          <ul className="space-y-5">
            {progress.map((item) => (
              <li key={item.goal.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => setGoalSheet(item.goal)} className="t-subhead text-left">
                      {item.goal.title}
                    </button>
                    <p className="t-meta mt-1">
                      {item.doneTasks}/{item.totalTasks} tâche{item.totalTasks > 1 ? "s" : ""}
                      {item.goal.targetMinutes
                        ? ` · ${formatMinutes(item.workedMinutes)} sur ${formatMinutes(item.goal.targetMinutes)}`
                        : item.workedMinutes > 0
                          ? ` · ${formatMinutes(item.workedMinutes)} travaillées`
                          : ""}
                      {item.goal.targetDate ? ` · échéance ${formatRelativeDay(item.goal.targetDate, now)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.atRisk && <Badge variant="danger">En danger</Badge>}
                    {item.goal.status === "done" && <Badge variant="success">Atteint</Badge>}
                    <span className="tabular text-sm text-muted">{item.percent} %</span>
                  </div>
                </div>

                <Meter className="mt-3" value={item.percent} tone={item.atRisk ? "warning" : "accent"} />

                {item.tasks.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {item.tasks.slice(0, 5).map((task) => (
                      <li key={task.id} className="flex items-center gap-2">
                        <SubjectDot subject={state.subjects.find((subject) => subject.id === task.subjectId)} />
                        <button
                          type="button"
                          onClick={() => open(task)}
                          className={cn("min-w-0 flex-1 truncate text-left text-sm", task.status === "done" && "text-subtle line-through")}
                        >
                          {task.title}
                        </button>
                      </li>
                    ))}
                    {item.tasks.length > 5 && <li className="t-meta">+{item.tasks.length - 5} autres</li>}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => add({ goalId: item.goal.id })}>
                    <Plus size={13} /> Tâche pour cet objectif
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setGoalSheet(item.goal)}>
                    Modifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteGoal(item.goal.id)}>
                    <Trash2 size={13} /> Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        label="Routines"
        title="Ce qui revient"
        description="Chaque occurrence devient une vraie tâche, qui compte dans ta charge — au plus deux semaines d'avance."
        action={
          <Button size="sm" variant="secondary" onClick={() => setRoutineSheet("new")}>
            <Plus size={14} /> Routine
          </Button>
        }
      >
        {state.routines.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Aucune routine"
            description="« Bilan chaque dimanche », « revoir les erreurs de DS », « cahier de calcul le mardi et le jeudi »."
            action={<Button onClick={() => setRoutineSheet("new")}>Créer une routine</Button>}
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {state.routines.map((routine) => (
              <li key={routine.id} className="flex flex-wrap items-center gap-3 px-1 py-3">
                <SubjectDot subject={state.subjects.find((subject) => subject.id === routine.subjectId)} />
                <button type="button" onClick={() => setRoutineSheet(routine)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[0.9375rem]">{routine.title}</span>
                  <span className="t-meta">
                    {describeRule(routine)}
                    {routine.estimatedMinutes ? ` · ${formatMinutes(routine.estimatedMinutes)}` : ""}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant={routine.active ? "ghost" : "secondary"}
                  onClick={() => saveRoutine({ ...routine, active: !routine.active })}
                >
                  {routine.active ? "Suspendre" : "Reprendre"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Supprimer la routine" onClick={() => deleteRoutine(routine.id)}>
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <GoalSheet goal={goalSheet} onClose={() => setGoalSheet(null)} />
      <RoutineSheet routine={routineSheet} onClose={() => setRoutineSheet(null)} />
    </div>
  );
}

/* ─────────────────────────── FEUILLES D'ÉDITION ─────────────────────────── */

function GoalSheet({ goal, onClose }: { goal: Goal | "new" | null; onClose: () => void }) {
  const { state, saveGoal } = useStore();
  const editing = goal !== "new" && goal !== null ? goal : null;
  const [signature, setSignature] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "", subjectId: "", targetDate: "", targetHours: "", status: "active" as Goal["status"] });

  const currentSignature = goal === null ? "closed" : editing ? editing.id : "new";
  if (signature !== currentSignature) {
    setSignature(currentSignature);
    setDraft({
      title: editing?.title ?? "",
      description: editing?.description ?? "",
      subjectId: editing?.subjectId ?? "",
      targetDate: editing?.targetDate ? dayKey(editing.targetDate) : "",
      targetHours: editing?.targetMinutes ? String(editing.targetMinutes / 60) : "",
      status: editing?.status ?? "active",
    });
  }

  function submit() {
    if (!draft.title.trim()) return;
    const hours = Number(draft.targetHours);
    saveGoal({
      id: editing?.id ?? createId("g"),
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      subjectId: draft.subjectId || undefined,
      targetDate: draft.targetDate ? new Date(`${draft.targetDate}T23:59`).toISOString() : undefined,
      targetMinutes: hours > 0 ? Math.round(hours * 60) : undefined,
      status: draft.status,
      createdAt: editing?.createdAt,
    });
    onClose();
  }

  return (
    <Sheet
      open={goal !== null}
      onClose={onClose}
      title={editing ? "Modifier l'objectif" : "Nouvel objectif"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!draft.title.trim()}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Objectif">
          <Input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Être à jour en physique"
          />
        </Field>
        <Field label="Pourquoi / comment">
          <Textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Matière">
            <Select value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}>
              <option value="">Aucune</option>
              {activeSubjects(state.subjects).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pour le">
            <Input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} />
          </Field>
        </div>
        <Field label="Objectif de temps" hint="Facultatif — en heures. La progression se mesure alors sur le temps réellement travaillé.">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={draft.targetHours}
            onChange={(event) => setDraft({ ...draft, targetHours: event.target.value })}
            placeholder="5"
            className="w-28"
          />
        </Field>
        {editing && (
          <Field label="État">
            <Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Goal["status"] })}>
              <option value="active">En cours</option>
              <option value="done">Atteint</option>
              <option value="archived">Archivé</option>
            </Select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}

function RoutineSheet({ routine, onClose }: { routine: Routine | "new" | null; onClose: () => void }) {
  const { state, saveRoutine } = useStore();
  const editing = routine !== "new" && routine !== null ? routine : null;
  const [signature, setSignature] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    subjectId: "",
    category: "org-bilan" as TaskCategory,
    minutes: 30,
    weekdays: [6] as Weekday[],
    horizonDays: 7,
  });

  const currentSignature = routine === null ? "closed" : editing ? editing.id : "new";
  if (signature !== currentSignature) {
    setSignature(currentSignature);
    setDraft({
      title: editing?.title ?? "",
      subjectId: editing?.subjectId ?? "",
      category: editing?.category ?? "org-bilan",
      minutes: editing?.estimatedMinutes ?? 30,
      weekdays: editing?.rule.kind === "weekly" ? editing.rule.weekdays : [6],
      horizonDays: editing?.horizonDays ?? 7,
    });
  }

  function toggleDay(day: Weekday) {
    setDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day) ? current.weekdays.filter((value) => value !== day) : [...current.weekdays, day],
    }));
  }

  function submit() {
    if (!draft.title.trim() || draft.weekdays.length === 0) return;
    saveRoutine({
      id: editing?.id ?? createId("r"),
      title: draft.title.trim(),
      subjectId: draft.subjectId || undefined,
      category: draft.category,
      estimatedMinutes: draft.minutes,
      priority: 2,
      rule: { kind: "weekly", weekdays: draft.weekdays },
      horizonDays: draft.horizonDays,
      active: editing?.active ?? true,
      createdAt: editing?.createdAt,
    });
    onClose();
  }

  return (
    <Sheet
      open={routine !== null}
      onClose={onClose}
      title={editing ? "Modifier la routine" : "Nouvelle routine"}
      description="Elle crée de vraies tâches, qui comptent dans ta charge."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!draft.title.trim() || draft.weekdays.length === 0}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Tâche récurrente">
          <Input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Bilan de la semaine"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Matière">
            <Select value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}>
              <option value="">Aucune</option>
              {activeSubjects(state.subjects).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as TaskCategory })}>
              {CATEGORY_FAMILY_ORDER.map((family) => (
                <optgroup key={family} label={CATEGORY_FAMILY_LABELS[family]}>
                  {categoriesByFamily(family).map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_META[value].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <span className="t-label">Jours</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={draft.weekdays.includes(day)}
                className={
                  draft.weekdays.includes(day)
                    ? "min-h-10 min-w-11 rounded-lg border border-accent/40 bg-accent/[0.10] px-2 text-sm font-medium text-accent"
                    : "row-hover min-h-10 min-w-11 rounded-lg border border-line px-2 text-sm text-muted"
                }
              >
                {WEEKDAY_SHORT[day]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée (min)">
            <Input
              type="number"
              min={5}
              step={5}
              value={draft.minutes}
              onChange={(event) => setDraft({ ...draft, minutes: Math.max(5, Number(event.target.value) || 5) })}
            />
          </Field>
          <Field label="Créée à l'avance (jours)" hint={`Au plus ${MAX_HORIZON_DAYS}`}>
            <Input
              type="number"
              min={1}
              max={MAX_HORIZON_DAYS}
              value={draft.horizonDays}
              onChange={(event) =>
                setDraft({ ...draft, horizonDays: Math.min(MAX_HORIZON_DAYS, Math.max(1, Number(event.target.value) || 7)) })
              }
            />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
