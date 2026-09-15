"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, Sheet } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented";
import { CATEGORY_FAMILY_LABELS, CATEGORY_FAMILY_ORDER, CATEGORY_META, categoriesByFamily, isDeadlineCategory } from "@/lib/domain/categories";
import { atTime, dayKey, formatMinutes, fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/domain/date";
import { computeEstimationAccuracy, estimationAdvice } from "@/lib/domain/habits";
import { activeSubjects, subjectLabel } from "@/lib/domain/subjects";
import { effortMinutes } from "@/lib/domain/tasks";
import { useStore } from "@/lib/store/store";
import type { ComposerDefaults } from "@/components/tasks/composer";
import { PRIORITY_LABELS, PRIORITIES, type Priority, type Task, type TaskCategory } from "@/lib/domain/types";

/**
 * ÉDITEUR DE TÂCHE — un seul formulaire pour créer et pour modifier.
 *
 * Deux règles qui décident de toute sa forme :
 *
 *   1. AJOUTER DOIT PRENDRE CINQ SECONDES. Cinq champs visibles : titre,
 *      matière, échéance, durée, priorité. Tout le reste (description,
 *      ressource, notes, objectif) est replié derrière « Plus de détails ».
 *      Un formulaire à quinze champs finit par n'être jamais rempli, et une
 *      tâche jamais saisie ne pèse dans aucun planning.
 *   2. LA DURÉE SE CHOISIT, ELLE NE SE TAPE PAS. Des préréglages au doigt
 *      (15, 30, 45, 1 h, 1 h 30, 2 h, 3 h) plus un champ libre : estimer, ce
 *      n'est pas saisir « 47 ».
 *
 * L'échéance se saisit en DATE SEULE par défaut (« pour lundi »), parce que
 * c'est ainsi qu'une consigne est donnée en prépa. L'heure n'apparaît que si
 * elle a un sens — une khôlle à 14 h, un DS à 8 h.
 */

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180] as const;

export interface TaskDraft {
  title: string;
  subjectId: string;
  category: TaskCategory;
  priority: Priority;
  estimatedMinutes: number;
  dueDate: string;
  dueTime: string;
  description: string;
  source: string;
  sourceUrl: string;
  notes: string;
  goalId: string;
}

function draftFromTask(task: Task | null, defaultMinutes: number): TaskDraft {
  if (!task) {
    return {
      title: "",
      subjectId: "",
      category: "autre",
      priority: 2,
      estimatedMinutes: defaultMinutes,
      dueDate: "",
      dueTime: "",
      description: "",
      source: "",
      sourceUrl: "",
      notes: "",
      goalId: "",
    };
  }
  return {
    title: task.title,
    subjectId: task.subjectId ?? "",
    category: task.category,
    priority: task.priority,
    estimatedMinutes: effortMinutes(task),
    dueDate: task.dueAt ? dayKey(task.dueAt) : "",
    dueTime: task.dueAt && !task.dueDateOnly ? toDateTimeLocalValue(task.dueAt).slice(11) : "",
    description: task.description ?? "",
    source: task.source ?? "",
    sourceUrl: task.sourceUrl ?? "",
    notes: task.notes ?? "",
    goalId: task.goalId ?? "",
  };
}

export function TaskEditor({
  open,
  task,
  onClose,
  /** Pré-remplissage venu du contexte d'appel (jour du calendrier, objectif ouvert). */
  defaults,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  defaults?: ComposerDefaults;
}) {
  const { state, addTask, editTask, deleteTask } = useStore();
  const subjects = useMemo(() => activeSubjects(state.subjects), [state.subjects]);
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task, state.settings.defaultEstimateMinutes));
  const [expanded, setExpanded] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // Mesures d'estimation : recalculées seulement quand l'historique change,
  // pas à chaque frappe dans le formulaire.
  const accuracy = useMemo(() => computeEstimationAccuracy(state), [state]);
  const advice = estimationAdvice(accuracy, draft.subjectId || undefined, draft.estimatedMinutes);

  // Réinitialise le brouillon quand la feuille change de sujet (nouvelle
  // tâche, ou tâche différente) sans passer par un effet : un `useEffect` de
  // synchronisation rendrait un état obsolète le temps d'une frame, ce qui se
  // voit quand la feuille s'ouvre.
  const currentSignature = `${open ? "open" : "closed"}:${task?.id ?? "new"}:${defaults?.dueDate ?? ""}:${defaults?.goalId ?? ""}`;
  if (signature !== currentSignature) {
    setSignature(currentSignature);
    const base = draftFromTask(task, state.settings.defaultEstimateMinutes);
    setDraft({
      ...base,
      dueDate: task?.dueAt ? dayKey(task.dueAt) : (defaults?.dueDate ?? ""),
      goalId: base.goalId || (defaults?.goalId ?? ""),
    });
    // Le rattachement à un objectif vit dans « Plus de détails » : si on arrive
    // DEPUIS un objectif, on déplie, pour que le lien soit visible et
    // modifiable plutôt que posé en douce.
    setExpanded(Boolean(defaults?.goalId));
  }

  function patch(values: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function submit() {
    const title = draft.title.trim();
    if (!title) return;

    const dueAt = draft.dueDate
      ? draft.dueTime
        ? fromDateTimeLocalValue(`${draft.dueDate}T${draft.dueTime}`)
        : atTime(draft.dueDate, "23:59").toISOString()
      : undefined;

    const payload = {
      title,
      subjectId: draft.subjectId || undefined,
      category: draft.category,
      priority: draft.priority,
      estimatedMinutes: draft.estimatedMinutes,
      dueAt,
      dueDateOnly: Boolean(draft.dueDate && !draft.dueTime),
      description: draft.description.trim() || undefined,
      source: draft.source.trim() || undefined,
      sourceUrl: draft.sourceUrl.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      goalId: draft.goalId || undefined,
    };

    if (task) editTask(task.id, payload);
    else addTask(payload);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? "Modifier la tâche" : "Nouvelle tâche"}
      description={task ? undefined : "Titre, matière, échéance, durée. Le reste est optionnel."}
      footer={
        <div className="flex items-center gap-2">
          {task && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer la tâche"
              onClick={() => {
                deleteTask(task.id);
                onClose();
              }}
            >
              <Trash2 size={15} />
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="ml-auto">
            Annuler
          </Button>
          <Button onClick={submit} disabled={!draft.title.trim()}>
            {task ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Tâche">
          <Input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Faire les exercices 12 à 18 du TD 4"
            autoComplete="off"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Matière">
            <Select value={draft.subjectId} onChange={(event) => patch({ subjectId: event.target.value })}>
              <option value="">Aucune</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type">
            <Select
              value={draft.category}
              onChange={(event) => {
                const category = event.target.value as TaskCategory;
                // Changer de type propose la durée typique de ce type — mais
                // seulement si l'élève n'a pas déjà choisi la sienne.
                const untouched = draft.estimatedMinutes === CATEGORY_META[draft.category].defaultMinutes;
                patch({ category, estimatedMinutes: untouched ? CATEGORY_META[category].defaultMinutes : draft.estimatedMinutes });
              }}
            >
              {CATEGORY_FAMILY_ORDER.map((family) => (
                <optgroup key={family} label={CATEGORY_FAMILY_LABELS[family]}>
                  {categoriesByFamily(family).map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_META[category].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        {/* Le piège que cette note referme : « Préparer la khôlle » saisi avec
            le type « Khôlle ». La tâche devient un rendez-vous, n'est jamais
            planifiée, et l'élève ne comprend pas pourquoi elle n'apparaît
            nulle part dans son travail. Une phrase au moment du choix vaut
            mieux qu'une règle apprise par l'échec. */}
        {isDeadlineCategory(draft.category) && (
          <p className="t-meta -mt-1 border-l-2 border-amber-400/50 pl-3">
            Une évaluation est un <strong className="font-medium text-ink">rendez-vous</strong> : elle apparaît au
            calendrier mais n&apos;occupe aucun créneau de travail. Pour t&apos;y préparer, crée une tâche à part
            (type « Préparation » ou « Révision »).
          </p>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Échéance" hint={draft.dueDate && !draft.dueTime ? "Toute la journée" : undefined}>
            <Input type="date" value={draft.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} />
          </Field>
          <Field label="Heure">
            <Input
              type="time"
              value={draft.dueTime}
              disabled={!draft.dueDate}
              onChange={(event) => patch({ dueTime: event.target.value })}
              className="w-[7.5rem]"
            />
          </Field>
        </div>

        <div>
          <span className="t-label">Durée estimée</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {DURATION_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => patch({ estimatedMinutes: minutes })}
                aria-pressed={draft.estimatedMinutes === minutes}
                className={
                  draft.estimatedMinutes === minutes
                    ? "min-h-9 rounded-lg border border-accent/40 bg-accent/[0.10] px-2.5 text-[0.8125rem] font-medium text-accent"
                    : "row-hover min-h-9 rounded-lg border border-line px-2.5 text-[0.8125rem] text-muted"
                }
              >
                {formatMinutes(minutes)}
              </button>
            ))}
            <Input
              type="number"
              min={5}
              step={5}
              value={draft.estimatedMinutes}
              onChange={(event) => patch({ estimatedMinutes: Math.max(5, Number(event.target.value) || 5) })}
              aria-label="Durée estimée en minutes"
              className="w-24"
            />
          </div>

          {/* ── CE QUE DISENT TES MESURES ────────────────────────────
              Affiché, jamais appliqué. TaekdHub sait que tu sous-estimes la
              physique de 40 % ; corriger tes durées dans ton dos rendrait ton
              planning incompréhensible et t'empêcherait de progresser en
              estimation. Le constat arrive au moment où il sert — pendant la
              saisie — avec un bouton pour l'accepter. Le choix reste à toi. */}
          {advice && (
            <p className="t-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {formatMinutes(draft.estimatedMinutes)} estimées →{" "}
                <strong className="font-medium text-ink">environ {formatMinutes(advice.suggestedMinutes)}</strong>{" "}
                d&apos;après tes {advice.samples} dernières tâches
                {advice.subjectId ? ` en ${subjectLabel(state.subjects, advice.subjectId)}` : ""} (
                {advice.underestimating ? "sous-estimées" : "surestimées"} de {advice.percent} %).
              </span>
              <button
                type="button"
                onClick={() => patch({ estimatedMinutes: advice.suggestedMinutes })}
                className="rounded text-accent underline-offset-2 hover:underline"
              >
                Utiliser
              </button>
            </p>
          )}
        </div>

        <Field label="Priorité">
          <SegmentedControl
            ariaLabel="Priorité"
            size="sm"
            options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
            value={draft.priority}
            onChange={(priority) => patch({ priority })}
          />
        </Field>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="row-hover flex min-h-10 w-full items-center gap-2 rounded-lg border border-line px-3 text-left text-sm text-muted"
        >
          <span className="flex-1">Plus de détails</span>
          <ChevronDown size={15} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>

        {expanded && (
          <div className="space-y-4 border-l border-line pl-4">
            <Field label="Description">
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Ce qu'il y a à faire exactement"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ressource" hint="Où se trouve le travail : TD 4, livre p. 112…">
                <Input value={draft.source} onChange={(event) => patch({ source: event.target.value })} placeholder="TD 4" />
              </Field>
              <Field label="Lien">
                <Input
                  type="url"
                  value={draft.sourceUrl}
                  onChange={(event) => patch({ sourceUrl: event.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>

            {state.goals.filter((goal) => goal.status === "active").length > 0 && (
              <Field label="Objectif">
                <Select value={draft.goalId} onChange={(event) => patch({ goalId: event.target.value })}>
                  <option value="">Aucun</option>
                  {state.goals
                    .filter((goal) => goal.status === "active")
                    .map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                </Select>
              </Field>
            )}

            <Field label="Note personnelle">
              <Textarea rows={2} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
            </Field>
          </div>
        )}

        {/* Permet d'envoyer avec Entrée sans afficher un second bouton à côté de celui du pied de page. */}
        <button type="submit" className="sr-only">
          Enregistrer
        </button>
      </form>
    </Sheet>
  );
}
